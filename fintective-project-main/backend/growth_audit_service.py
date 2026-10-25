"""Profile growth audits: recorded sources, explicit cost assumptions and scoped goals."""
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP
import calendar
import datetime as dt
import json
import re
import threading
import time

from db import get_db_connection
from finance_rules import get_ist_today

_CACHE = {}
_CACHE_LOCK = threading.Lock()
_LOAD_LOCK = threading.Lock()
_CACHE_EPOCH = 0
METRICS = {'company_share', 'revenue', 'deals'}
ZERO = Decimal('0')


def clear_cache():
    global _CACHE_EPOCH
    with _CACHE_LOCK:
        _CACHE.clear()
        _CACHE_EPOCH += 1


def norm(value):
    return ' '.join(str(value or '').strip().lower().split())


def money(value):
    try:
        result = Decimal(str(value if value is not None else 0))
    except Exception as exc:
        raise ValueError('Financial values must be numeric') from exc
    if not result.is_finite():
        raise ValueError('Financial values must be finite')
    return result


def amount(value):
    return float(money(value).quantize(Decimal('.01'), rounding=ROUND_HALF_UP))


def date_value(value):
    if isinstance(value, dt.datetime):
        return value.date()
    if isinstance(value, dt.date):
        return value
    try:
        return dt.date.fromisoformat(str(value)[:10])
    except (ValueError, TypeError):
        return None


def period_for(fy=None, as_of=None, today=None):
    today = today or get_ist_today()
    year = today.year if today.month >= 4 else today.year - 1
    if fy:
        text = re.sub(r'^FY\s*', '', str(fy).strip(), flags=re.I)
        match = re.fullmatch(r'(\d{4})(?:-(\d{2}|\d{4}))?', text)
        if not match:
            raise ValueError('Use a financial year such as FY 2026-27')
        year = int(match[1])
        if match[2] and int(match[2]) != ((year + 1) % 100 if len(match[2]) == 2 else year + 1):
            raise ValueError('Financial-year end must follow its start year')
    if not 2000 <= year <= today.year + 1:
        raise ValueError('Financial year is outside the supported range')
    cutoff = date_value(as_of) if as_of else today
    if cutoff is None or cutoff > today:
        raise ValueError('As-of date must be a valid date no later than today')
    start, end = dt.date(year, 4, 1), dt.date(year + 1, 3, 31)
    cutoff = min(cutoff, end)
    if cutoff < start:
        raise ValueError('This financial year has not started at the selected as-of date')
    return {'year': year, 'fy': f'{year}-{str(year+1)[2:]}', 'start': start, 'end': cutoff,
            'fy_end': end, 'prior_start': dt.date(year-1, 4, 1), 'today': today}


def normalize_scope(raw=None):
    if raw is None:
        raw = {}
    if not isinstance(raw, dict):
        raise ValueError('Each profile scope must be an object')
    values = {}
    for key in ('bd', 'tl', 'franchise'):
        value = str(raw.get(key) or 'All').strip()
        if len(value) > 160 or any(ord(ch) < 32 for ch in value):
            raise ValueError('Profile names must contain 160 or fewer printable characters')
        values[key] = 'All' if norm(value) == 'all' else ' '.join(value.split())
    active = [key for key, value in values.items() if value != 'All']
    kind = active[0] if len(active) == 1 else ('company' if not active else 'combo')
    key = json.dumps([norm(values[k]) for k in ('bd', 'tl', 'franchise')], ensure_ascii=False, separators=(',', ':'))
    if len(key) > 512:
        raise ValueError('Combined profile name is too long')
    return {**values, 'key': key, 'type': kind,
            'label': ' + '.join(values[k] for k in active) or 'Overall portfolio'}


def matches(row, scope):
    return all(value == 'All' or norm(row.get(key)) == norm(value)
               for key, value in scope.items() if key in ('bd', 'tl', 'franchise'))


def months_for(period):
    return [f'{period["year"] + (index >= 9)}-{(index + 3) % 12 + 1:02d}' for index in range(12)]


def month_end(ym):
    year, month = map(int, ym.split('-'))
    return dt.date(year, month, calendar.monthrange(year, month)[1])


def month_fraction(start, end):
    if end < start:
        return ZERO
    value = ZERO
    current = start
    while current <= end:
        last = min(end, dt.date(current.year, current.month, calendar.monthrange(current.year, current.month)[1]))
        value += Decimal((last-current).days+1) / Decimal(calendar.monthrange(current.year, current.month)[1])
        current = last + dt.timedelta(days=1)
    return value


def load_dataset(period, force=False):
    key = (period['fy'], period['end'].isoformat())
    with _CACHE_LOCK:
        cached = _CACHE.get(key)
        if cached and not force and cached[0] > time.monotonic():
            return cached[1]
    with _LOAD_LOCK:
        with _CACHE_LOCK:
            cached = _CACHE.get(key)
            if cached and not force and cached[0] > time.monotonic():
                return cached[1]
            epoch = _CACHE_EPOCH
        dataset = _read_snapshot(period)
        with _CACHE_LOCK:
            if epoch == _CACHE_EPOCH:
                if len(_CACHE) >= 8:
                    _CACHE.clear()
                _CACHE[key] = (time.monotonic()+15, dataset)
        return dataset


def _read_snapshot(period):
    conn = get_db_connection()
    dataset = {'errors': {}, 'loaded_at': dt.datetime.now(dt.timezone.utc).isoformat()}
    exclusive_end = period['end'] + dt.timedelta(days=1)
    try:
        conn.begin()
        with conn.cursor() as cur:
            def read(name, sql, params=(), required=False):
                try:
                    cur.execute(sql, params)
                    dataset[name] = cur.fetchall() or []
                except Exception as exc:
                    code = exc.args[0] if exc.args and isinstance(exc.args[0], int) else None
                    if required:
                        raise RuntimeError('Unable to read profile invoice or enquiry records') from exc
                    dataset[name] = []
                    if code != 1146 or name not in ('settings', 'goals', 'legacy', 'legacy_goals'):
                        dataset['errors'][name] = 'Source unavailable; values are not assumed to be zero.'
            read('invoices', '''SELECT i.id, i.enquiry_id, i.billNumber, i.billDate AS date,
                    i.companyName AS company, i.candidateName AS candidate, i.postOfCandidate AS position,
                    i.rev_ex_gst AS revenue, i.totalBillAmt AS gross, i.ourShare AS company_share,
                    COALESCE(NULLIF(TRIM(i.nameOfBd), ''), TRIM(e.bdMemberName)) AS bd,
                    COALESCE(NULLIF(TRIM(i.teamLeader), ''), TRIM(e.teamLeaderName)) AS tl,
                    COALESCE(NULLIF(TRIM(i.franchiseName), ''), TRIM(e.franchiseeName)) AS franchise
                FROM v_invoice_clean i LEFT JOIN enquiries e ON i.enquiry_id = e.id
                WHERE i.is_revenue = 1 AND i.billDate >= %s AND i.billDate < %s''',
                 [period['prior_start'], exclusive_end], True)
            read('enquiries', '''SELECT id, companyName AS company, positionName AS position,
                    bdMemberName AS bd, teamLeaderName AS tl, franchiseeName AS franchise,
                    enquiryStatus AS status, bill_no, bill_amount,
                    LEFT(COALESCE(NULLIF(dateOfAllocation, ''), created_at), 10) AS date
                FROM enquiries WHERE LEFT(COALESCE(NULLIF(dateOfAllocation, ''), created_at), 10) >= %s
                    AND LEFT(COALESCE(NULLIF(dateOfAllocation, ''), created_at), 10) <= %s''',
                 [period['prior_start'], period['end']], True)
            read('payroll', '''SELECT id, employee_id, employee_name, date, ctc_amount, net_payable
                FROM payroll_records WHERE date >= %s AND date <= %s''', [period['start'], period['end']])
            read('expenses', '''SELECT id, billDate AS date, amount, expenses AS category,
                    expenseType, bdAgentId, franchiseeId
                FROM expenditure WHERE is_deleted = 0 AND billDate >= %s
                    AND billDate < %s''', [period['start'], exclusive_end])
            read('agents', 'SELECT id, name FROM bd_agents')
            variants = [period['fy'], 'FY '+period['fy'], f'{period["year"]}-{period["year"]+1}', f'FY {period["year"]}-{period["year"]+1}']
            read('legacy', 'SELECT bd, tl, franchise, fy, salary, expense FROM growth_money_box_inputs WHERE fy IN (%s,%s,%s,%s)', variants)
            read('settings', 'SELECT * FROM growth_profile_costs WHERE financial_year = %s', [period['fy']])
            read('goals', 'SELECT * FROM growth_profile_goals WHERE financial_year = %s ORDER BY created_at DESC', [period['fy']])
            read('legacy_goals', 'SELECT * FROM growth_targets ORDER BY created_at DESC')
        return dataset
    finally:
        try:
            conn.rollback()
        finally:
            conn.close()


def enquiry_stage(value):
    key = re.sub(r'[^a-z0-9]+', '_', norm(value)).strip('_')
    if key in {'cancelled', 'canceled', 'offered_and_rejected', 'internally_closed', 'credit_note', 'cn', 'legal_cn', 'c', 'void', 'dropped'}:
        return 'cancelled'
    if key in {'inprogress', 'in_progress', 'position_hold', 'revised', 'reallocation', 'pipeline', 'sourcing', 'interviewing', 'open'}:
        return 'in_progress'
    if key in {'closed', 'offered_and_accepted', 'invoiced', 'r', 'rv', 'billed', 'collected'}:
        return 'awaiting_invoice'
    return 'other'


def value_for(invoices, metric):
    if metric == 'deals':
        return Decimal(len({norm(row.get('billNumber')) or 'id:'+str(row['id']) for row in invoices}))
    return sum((money(row.get(metric)) for row in invoices), ZERO)


def _payroll(dataset, scope, invoices, enquiries, period):
    expected = {norm(row.get('bd')) for row in invoices+enquiries if norm(row.get('bd')) and norm(row.get('bd')) != 'all'}
    if scope['type'] == 'bd':
        expected = {norm(scope['bd'])}
    elif scope['type'] == 'tl':
        expected.add(norm(scope['tl']))
    all_inv = [row for row in dataset.get('invoices', []) if period['start'] <= (date_value(row.get('date')) or dt.date.min) <= period['end']]
    denominators = defaultdict(lambda: ZERO)
    numerators = defaultdict(lambda: ZERO)
    for row in all_inv:
        denominators[norm(row.get('bd'))] += max(ZERO, money(row.get('company_share')))
    for row in invoices:
        numerators[norm(row.get('bd'))] += max(ZERO, money(row.get('company_share')))
    direct = scope['type'] in ('bd', 'company')
    records, matched, unallocated = [], set(), set()
    for row in dataset.get('payroll', []):
        name = norm(row.get('employee_name'))
        if scope['type'] != 'company' and name not in expected:
            continue
        matched.add(name)
        factor = Decimal(1)
        if not direct and not (scope['type'] == 'tl' and name == norm(scope['tl'])):
            if denominators[name] <= 0:
                unallocated.add(name)
                continue
            factor = min(Decimal(1), numerators[name]/denominators[name])
        records.append({'id': str(row.get('id') or ''), 'name': row.get('employee_name'),
                        'date': str(row.get('date'))[:10], 'month': str(row.get('date'))[:7],
                        'ctc': amount(money(row.get('ctc_amount'))*factor),
                        'net_payable': amount(money(row.get('net_payable'))*factor),
                        'allocation_percent': amount(factor*100)})
    closed = [ym for ym in months_for(period) if month_end(ym) <= period['end'] and month_end(ym) < period['today'].replace(day=1)]
    by_person = defaultdict(set)
    for row in records:
        by_person[norm(row['name'])].add(row['month'])
    gaps = {name: [ym for ym in closed if ym not in values] for name, values in by_person.items()}
    gaps = {name: missing for name, missing in gaps.items() if missing}
    missing_people = sorted(expected-matched) if scope['type'] != 'company' else []
    available = bool(records) and 'payroll' not in dataset.get('errors', {})
    return {'available': available, 'ctc': amount(sum((money(row['ctc']) for row in records), ZERO)) if available else None,
            'net_payable': amount(sum((money(row['net_payable']) for row in records), ZERO)) if available else None,
            'records': records, 'months': sorted({row['month'] for row in records}),
            'current_month_unrecorded': period['end'].strftime('%Y-%m') not in {row['month'] for row in records},
            'missing_closed_months': gaps, 'unmatched_members': missing_people,
            'unallocated_members': sorted(unallocated), 'allocated': not direct,
            'method': 'Recorded payroll, matched by exact normalized employee name.' if direct else
                      'Allocation estimate: each matched BD payroll cost is weighted by this portfolio\'s share of that BD\'s recorded company income in this period; the TL own payroll is included in full.'}


def build_profile(dataset, scope, period):
    start, end = period['start'], period['end']
    scoped_all = [row for row in dataset['invoices'] if matches(row, scope)]
    invoices = [row for row in scoped_all if start <= (date_value(row.get('date')) or dt.date.min) <= end]
    enquiries = [row for row in dataset['enquiries'] if matches(row, scope) and start <= (date_value(row.get('date')) or dt.date.min) <= end]
    billed_ids = {str(row.get('enquiry_id')) for row in dataset['invoices'] if row.get('enquiry_id') is not None}
    billed_numbers = {norm(row.get('billNumber')) for row in dataset['invoices'] if row.get('billNumber')}
    open_rows = [row for row in enquiries if str(row.get('id')) not in billed_ids and norm(row.get('bill_no')) not in billed_numbers]
    series = {ym: {'month': ym, 'revenue': 0., 'company_share': 0., 'deals': 0, 'in_progress': 0, 'cancelled': 0,
                   'awaiting_invoice': 0, 'future': ym > end.strftime('%Y-%m'), 'partial': ym == end.strftime('%Y-%m') and end < month_end(ym)} for ym in months_for(period)}
    monthly_invoices = defaultdict(list)
    for row in invoices:
        monthly_invoices[str(row['date'])[:7]].append(row)
    for ym, rows in monthly_invoices.items():
        if ym in series:
            for metric in ('revenue', 'company_share'):
                series[ym][metric] = amount(value_for(rows, metric))
    # A bill appearing on several source rows is counted once, in its earliest
    # recorded month. Financial amounts still reflect the original source rows.
    first_bill_month = {}
    for row in invoices:
        bill = norm(row.get('billNumber')) or str(row['id'])
        ym = str(row['date'])[:7]
        first_bill_month[bill] = min(first_bill_month.get(bill, ym), ym)
    for ym in first_bill_month.values():
        if ym in series:
            series[ym]['deals'] += 1
    stages = {key: 0 for key in ('in_progress', 'cancelled', 'awaiting_invoice', 'other')}
    deals = []
    for row in open_rows:
        stage = enquiry_stage(row.get('status'))
        stages[stage] += 1
        if str(row.get('date'))[:7] in series and stage in series[str(row['date'])[:7]]:
            series[str(row['date'])[:7]][stage] += 1
        deals.append({'id': 'enquiry-'+str(row['id']), 'company': row.get('company') or 'Unspecified',
                      'position': row.get('position') or '', 'date': str(row.get('date'))[:10], 'stage': stage,
                      'bill': row.get('bill_no') or '', 'revenue': None, 'company_share': None})
    for row in invoices:
        deals.append({'id': 'invoice-'+str(row['id']), 'company': row.get('company') or 'Unspecified',
                      'position': row.get('position') or '', 'date': str(row.get('date'))[:10], 'stage': 'invoiced',
                      'bill': row.get('billNumber') or '', 'revenue': amount(row.get('revenue')),
                      'company_share': amount(row['company_share']) if row.get('company_share') is not None else None})
    missing_share = sum(row.get('company_share') is None for row in invoices)
    payroll = _payroll(dataset, scope, invoices, enquiries, period)
    settings = next((row for row in dataset.get('settings', []) if row.get('scope_key') == scope['key']), None)
    legacy = next((row for row in dataset.get('legacy', []) if all(norm(row.get(k)) == norm(scope[k]) for k in ('bd','tl','franchise'))), None)
    expenses = {'amount': None, 'basis': None, 'estimated': False, 'note': '', 'legacy_amount': amount(legacy['expense']) if legacy and legacy.get('expense') is not None else None}
    if settings:
        expenses.update({'basis': settings.get('basis'), 'input_amount': amount(settings.get('amount')), 'note': settings.get('note') or ''})
        if settings.get('basis') == 'monthly':
            expenses.update(amount=amount(money(settings['amount'])*month_fraction(start,end)), estimated=True)
        elif date_value(settings.get('period_start')) == start and date_value(settings.get('period_end')) == end:
            expenses['amount'] = amount(settings['amount'])
        else:
            expenses['note'] = 'The saved total covers a different end date. Review it for this reporting period.'
    agent_names = {str(row['id']): norm(row.get('name')) for row in dataset.get('agents', [])}
    attributed = []
    attributable = scope['type'] in ('company', 'bd')
    for row in dataset.get('expenses', []):
        agent = agent_names.get(str(row.get('bdAgentId')), norm(row.get('bdAgentId')))
        if scope['type'] == 'company' or (scope['type'] == 'bd' and agent == norm(scope['bd'])):
            attributed.append(row)
    expenses['ledger_available'] = attributable and 'expenses' not in dataset.get('errors', {})
    expenses['direct_ledger_rows'] = len(attributed)
    expenses['direct_ledger_total_raw'] = amount(sum((money(row.get('amount')) for row in attributed), ZERO)) if expenses['ledger_available'] else None
    expenses['ledger_note'] = ('Direct ledger attribution is unavailable for this combined/team/franchise scope; review overhead separately.'
                               if not attributable else
                               'Raw attributed expenditure is shown for reconciliation. It is not added to fixed expenses or payroll; overhead allocation and statutory overlap still need review.')
    totals = {'companies': len({norm(row.get('company')) for row in invoices if norm(row.get('company'))}),
              'deals': int(value_for(invoices,'deals')), 'revenue': amount(value_for(invoices,'revenue')),
              'company_share': amount(value_for(invoices,'company_share')),
              'gross_billed': amount(sum((money(row.get('gross')) for row in invoices), ZERO)),
              'recorded_share_rows': len(invoices)-missing_share, 'missing_share_rows': missing_share,
              'invoice_rows': len(invoices), **stages}
    warnings = [f'{name}: {message}' for name, message in dataset.get('errors', {}).items()]
    if len(invoices) > totals['deals']:
        warnings.append('Some bill numbers occur on multiple source rows. Deal counts are distinct; review source line items or duplicates before relying on monetary totals.')
    if legacy and legacy.get('salary') is not None:
        warnings.append(f'Legacy manual salary {amount(legacy["salary"]):,.2f} is not deducted. Salary now comes from payroll_records.')
    if expenses['amount'] is None:
        warnings.append('Confirm a fixed expense amount and its period before calculating contribution.')
    if not payroll['available']:
        warnings.append('No usable payroll match for this profile. Salary cost is unavailable, not zero.')
    if payroll['missing_closed_months']:
        warnings.append('Some closed months have no matched payroll row. Check employment dates and payroll sync before treating costs as complete.')
    if payroll['available'] and payroll['current_month_unrecorded']:
        warnings.append('Payroll for the reporting end month has not been recorded. Unrecorded accruals are excluded.')
    if payroll['unmatched_members'] or payroll['unallocated_members']:
        warnings.append('Some team members need a payroll identity match or a cost-allocation basis.')
    if payroll['allocated']:
        warnings.append('Team/franchise payroll is an allocation estimate; it is not a separate payroll payment for that portfolio.')
    if missing_share:
        warnings.append('Some invoice company-share amounts are missing; recorded totals and target progress are incomplete.')
    contribution = None
    if payroll['available'] and expenses['amount'] is not None and not missing_share:
        contribution = amount(money(totals['company_share'])-money(payroll['ctc'])-money(expenses['amount']))
    coverage_complete = (payroll['available'] and expenses['amount'] is not None
                         and not payroll['missing_closed_months'] and not payroll['unmatched_members']
                         and not payroll['unallocated_members'] and not payroll['current_month_unrecorded']
                         and not missing_share)
    tax = amount(max(ZERO,money(contribution))*Decimal('.25')) if contribution is not None and coverage_complete else None
    financial = {'salary_ratio': amount(money(payroll['ctc'])/money(totals['company_share'])*100) if payroll['available'] and totals['company_share'] > 0 and not missing_share else None,
                 'contribution': contribution, 'tax_estimate': tax,
                 'surplus_estimate': amount(money(contribution)-money(tax)) if tax is not None else None,
                 'cost_coverage_complete': bool(coverage_complete), 'estimated': payroll['allocated'] or expenses['estimated'],
                 'tax_rate_assumption': .25}
    first_activity = min((date_value(row.get('date')) for row in invoices if date_value(row.get('date'))), default=None)
    completed = [row for row in series.values() if month_end(row['month']) <= end and first_activity and row['month'] >= first_activity.strftime('%Y-%m')]
    rates, trends = {}, {}
    for metric in sorted(METRICS):
        rates[metric] = amount(sum(money(row[metric]) for row in completed[-3:])/3) if len(completed) >= 3 and not (metric == 'company_share' and missing_share) else None
        previous = sum(money(row[metric]) for row in completed[-6:-3]) if len(completed) >= 6 else ZERO
        recent = sum(money(row[metric]) for row in completed[-3:])
        trends[metric] = amount((recent/previous-1)*100) if previous > 0 else None
    for row in series.values():
        ym = row['month']
        for metric in METRICS:
            rate = rates[metric]
            if row['future']:
                row['projected_'+metric] = rate
            elif row['partial'] and rate is not None:
                row['projected_'+metric] = amount(money(row[metric])+money(rate)*month_fraction(end+dt.timedelta(days=1),month_end(ym)))
            else:
                row['projected_'+metric] = row[metric]
    prior_end = dt.date(end.year-1, end.month, min(end.day, calendar.monthrange(end.year-1,end.month)[1]))
    prior = [row for row in scoped_all if period['prior_start'] <= (date_value(row.get('date')) or dt.date.min) <= prior_end]
    comparison = {'prior_revenue': amount(value_for(prior,'revenue')) if prior else None,
                  'prior_company_share': amount(value_for(prior,'company_share')) if prior else None,
                  'company_share_pct': amount((money(totals['company_share'])/value_for(prior,'company_share')-1)*100)
                      if prior and value_for(prior,'company_share') > 0 and not missing_share and all(row.get('company_share') is not None for row in prior) else None}
    goals = [goal_progress(row, invoices, period, rates, missing_share) for row in dataset.get('goals', []) if row.get('scope_key') == scope['key']]
    return {'scope': scope, 'totals': totals, 'payroll': payroll, 'fixed_expense': expenses,
            'legacy_salary': amount(legacy['salary']) if legacy and legacy.get('salary') is not None else None,
            'financial': financial, 'comparison': comparison, 'monthly': list(series.values()), 'deals': sorted(deals,key=lambda row:row['date'],reverse=True),
            'warnings': list(dict.fromkeys(warnings)), 'projection': {'method': 'Trailing average of the last three complete calendar months since the first recorded invoice; remaining partial-month days are prorated.',
            'rates': rates, 'trend_pct': trends, 'complete_observations': len(completed)}, 'goals': goals,
            '_invoice_ids': {str(row['id']) for row in invoices}, '_payroll_names': {norm(row['name']) for row in payroll['records']}}


def goal_progress(row, invoices, period, rates, missing_shares=0):
    metric = row['metric']
    due = date_value(row['due_date'])
    relevant = [inv for inv in invoices if (date_value(inv.get('date')) or dt.date.max) <= due]
    actual = value_for(relevant,metric)
    target = money(row['target_value'])
    gap = max(ZERO,target-actual)
    remaining = month_fraction(period['end']+dt.timedelta(days=1),due)
    planned_days = max(1,(due-period['start']).days+1)
    elapsed = max(0,min(planned_days,(period['end']-period['start']).days+1))
    planned = target*Decimal(elapsed)/Decimal(planned_days)
    if actual >= target:
        state = 'met'
    elif period['end'] > due:
        state = 'overdue'
    elif period['end'] == due:
        state = 'due_today'
    else:
        state = 'on_plan' if actual >= planned else 'behind_plan'
    if missing_shares and metric == 'company_share':
        state = 'incomplete_data'
    return {'id': row['id'], 'metric': metric, 'target': amount(target), 'actual': amount(actual),
            'gap': amount(gap), 'progress_percent': amount(actual/target*100) if target > 0 else None,
            'required_per_month': amount(gap/remaining) if remaining > 0 else None,
            'planned_to_date': amount(planned), 'due_date': due.isoformat(), 'status': row.get('status','active'),
            'pace_status': state, 'note': row.get('note') or '', 'created_at': str(row.get('created_at') or ''),
            'projected_at_due': amount(actual+money(rates[metric])*remaining) if rates.get(metric) is not None and due >= period['end'] else None,
            'baseline_as_of': str(row.get('baseline_as_of') or ''), 'baseline_value': amount(row.get('baseline_value'))}


def audit_profiles(dataset, scopes, period):
    profiles = [build_profile(dataset,scope,period) for scope in scopes]
    overlaps = []
    for index, profile in enumerate(profiles):
        for other in profiles[index+1:]:
            invoices = len(profile['_invoice_ids'] & other['_invoice_ids'])
            payroll = len(profile['_payroll_names'] & other['_payroll_names'])
            if invoices or payroll:
                overlaps.append({'a': profile['scope']['label'], 'b': other['scope']['label'],
                                 'shared_invoices': invoices, 'shared_payroll_members': payroll})
    for profile in profiles:
        del profile['_invoice_ids']; del profile['_payroll_names']
    legacy_targets = []
    for row in dataset.get('legacy_goals', []):
        created_period = date_value(row.get('period_start'))
        if created_period is None or not period['start'] <= created_period <= period['fy_end']:
            continue
        label = next((agent.get('name') for agent in dataset.get('agents', []) if str(agent.get('id')) == str(row.get('entity_id'))), row.get('entity_id') or 'Earlier profile')
        legacy_targets.append({'id':str(row.get('id') or ''), 'label': label, 'type':row.get('entity_type') or '',
                               'status':row.get('status') or '', 'start':str(row.get('period_start') or '')[:10],
                               'end':str(row.get('period_end') or '')[:10], 'target_deals':row.get('target_placements'),
                               'target_revenue':amount(row['target_revenue']) if row.get('target_revenue') is not None else None,
                               'letter':row.get('target_letter_text') or ''})
    return {'legacy_targets': legacy_targets, 'period': {'financial_year':period['fy'],'start':period['start'].isoformat(),'as_of':period['end'].isoformat(),'fy_end':period['fy_end'].isoformat()},
            'loaded_at': dataset.get('loaded_at'), 'profiles': profiles, 'overlaps': overlaps,
            'notes': ['Invoice revenue excludes GST; company share is recorded income, not bank cash.',
                      'Enquiry stages are the current CRM snapshot grouped by allocation month, not historical status-change events.',
                      'Compared portfolios can overlap. Do not add their totals.',
                      'Run-rate projections and the 25% tax estimate are model assumptions.']}
