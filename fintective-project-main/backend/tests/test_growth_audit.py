"""Synthetic growth audit and persistence regressions. No live DB operations."""
import datetime as dt
import threading
from decimal import Decimal
from unittest.mock import MagicMock, patch
import json
import pytest
import pymysql
import app as application
import growth_audit_service as service
import growth_audit_controller as controller

TODAY=dt.date(2026,10,25)
NAME='Komal Suresh Bhanushali'

def period(as_of=TODAY,fy='FY 2026-27'):
    return service.period_for(fy,as_of,today=TODAY)

def invoice(identifier=1,date='2026-04-01',share=100,revenue=400,**extra):
    return {'id':identifier,'enquiry_id':identifier,'billNumber':f'B-{identifier}','date':date,
            'company':'Example Ltd','position':'Analyst','bd':NAME,'tl':'Team A','franchise':'Partner A',
            'company_share':share,'revenue':revenue,'gross':Decimal(str(revenue))*Decimal('1.18'),**extra}

def dataset():
    return {'invoices':[invoice()],'enquiries':[],'payroll':[],'expenses':[],'agents':[],
            'legacy':[],'settings':[],'goals':[],'legacy_goals':[],'errors':{},'loaded_at':'synthetic'}

def report_data():
    data=dataset()
    data['invoices']=[invoice(i,date='2026-04-01' if i==1 else '2026-10-23',share=6451645 if i==413 else 0,
                      revenue=Decimal('22666223.89') if i==413 else 0,company=f'Company {i%214}') for i in range(1,414)]
    data['payroll']=[{'id':f'p-{month}','employee_name':NAME,'date':f'2026-{month:02d}-28','ctc_amount':ctc,'net_payable':net}
                    for month,ctc,net in [(4,80289,74276),(5,80289,74276),(6,80364,74276),(7,80289,74276),(8,92000,85987)]]
    data['legacy']=[{'bd':NAME,'tl':'All','franchise':'All','salary':75000,'expense':150000}]
    return data

def build(data=None,scope=None,p=None):
    return service.build_profile(data or dataset(),service.normalize_scope(scope or {'bd':NAME}),p or period())

def test_report_reconciles_actual_payroll_and_preserves_unknown_expense_basis():
    profile=build(report_data())
    assert profile['payroll']['ctc']==413231 and profile['payroll']['net_payable']==383091
    assert profile['legacy_salary']==75000
    assert profile['fixed_expense']['legacy_amount']==150000 and profile['fixed_expense']['amount'] is None
    assert profile['financial']['contribution'] is None
    assert profile['financial']['cost_coverage_complete'] is False
    assert profile['totals']['deals']==413 and profile['totals']['companies']==214
    assert profile['totals']['company_share']==6451645
    assert profile['payroll']['missing_closed_months'][NAME.lower()]==['2026-09']

def test_explicit_total_yields_partial_contribution_without_verified_surplus():
    data=report_data();scope=service.normalize_scope({'bd':NAME})
    data['settings']=[{'scope_key':scope['key'],'basis':'period_total','amount':150000,'period_start':'2026-04-01','period_end':'2026-10-25'}]
    profile=build(data)
    assert profile['financial']['contribution']==5888414
    assert profile['financial']['tax_estimate'] is None and profile['financial']['surplus_estimate'] is None
    assert not profile['financial']['cost_coverage_complete']

def test_base_salary_is_not_an_actual_period_cost():
    data=dataset();data['agents']=[{'id':'bd-1','name':NAME,'baseSalary':28000}]
    profile=build(data)
    assert profile['payroll']['ctc'] is None and profile['financial']['salary_ratio'] is None

def test_fixed_total_needs_matching_reporting_dates():
    data=dataset();scope=service.normalize_scope({'bd':NAME})
    data['settings']=[{'scope_key':scope['key'],'basis':'period_total','amount':150000,'period_start':'2026-04-01','period_end':'2026-09-30'}]
    assert build(data)['fixed_expense']['amount'] is None

def test_monthly_fixed_expense_prorates_partial_month():
    data=dataset();scope=service.normalize_scope({'bd':NAME})
    data['settings']=[{'scope_key':scope['key'],'basis':'monthly','amount':31000}]
    result=build(data)
    assert result['fixed_expense']['amount']==211000 and result['fixed_expense']['estimated']

def test_future_rows_and_similarly_named_profiles_are_excluded():
    data=dataset();data['invoices'] += [invoice(2,date='2026-12-01',share=9999),invoice(3,bd=NAME+' Other',share=9999)]
    assert build(data)['totals']['company_share']==100

@pytest.mark.parametrize('scope',[{'bd':NAME},{'tl':'Team A'},{'franchise':'Partner A'},{'bd':NAME,'tl':'Team A','franchise':'Partner A'},{}])
def test_every_profile_type_uses_common_invoice_definitions(scope):
    result=service.build_profile(dataset(),service.normalize_scope(scope),period())
    assert result['totals']['company_share']==100 and result['totals']['revenue']==400

def test_team_payroll_is_proportional_and_explicitly_an_estimate():
    data=dataset();data['invoices']=[invoice(1,share=100,tl='Team A'),invoice(2,share=300,tl='Team B')]
    data['payroll']=[{'id':'p','employee_name':NAME,'date':'2026-04-28','ctc_amount':200,'net_payable':180}]
    a=build(data,{'tl':'Team A'});b=build(data,{'tl':'Team B'})
    assert a['payroll']['ctc']==50 and b['payroll']['ctc']==150
    assert a['payroll']['allocated'] and a['financial']['estimated']

def test_team_ledger_attribution_is_unavailable_without_a_verified_mapping():
    data=dataset();data['expenses']=[{'id':1,'bdAgentId':'bd-1','amount':500}]
    team=build(data,{'tl':'Team A'})
    assert team['fixed_expense']['ledger_available'] is False
    assert team['fixed_expense']['direct_ledger_total_raw'] is None

def test_compared_profiles_disclose_shared_business_and_payroll():
    data=dataset();data['payroll']=[{'id':'p','employee_name':NAME,'date':'2026-04-28','ctc_amount':200,'net_payable':180}]
    result=service.audit_profiles(data,[service.normalize_scope({'bd':NAME}),service.normalize_scope({'tl':'Team A'})],period())
    assert result['overlaps'][0]['shared_invoices']==1 and result['overlaps'][0]['shared_payroll_members']==1
    assert '_invoice_ids' not in result['profiles'][0]

def test_missing_shares_never_become_verified_income_or_forecast():
    data=dataset();data['invoices'].append(invoice(2,share=None))
    data['payroll']=[{'id':'p','employee_name':NAME,'date':'2026-04-28','ctc_amount':50,'net_payable':45}]
    result=build(data)
    assert result['totals']['missing_share_rows']==1 and result['financial']['contribution'] is None
    assert result['financial']['salary_ratio'] is None
    assert result['projection']['rates']['company_share'] is None

def test_duplicate_bill_counts_reconcile_months_without_deleting_money():
    data=dataset();data['invoices']=[invoice(1),invoice(2,date='2026-05-01',billNumber='B-1')]
    result=build(data)
    assert result['totals']['deals']==1 and sum(row['deals'] for row in result['monthly'])==1
    assert result['totals']['company_share']==200
    assert any('multiple source rows' in note for note in result['warnings'])

def test_billed_enquiries_are_not_counted_again_as_pipeline():
    data=dataset();data['enquiries']=[{'id':1,'date':'2026-04-01','bd':NAME,'status':'inprogress'},
        {'id':2,'date':'2026-04-01','bd':NAME,'status':'cancelled'},{'id':3,'date':'2026-04-01','bd':NAME,'status':'closed'}]
    result=build(data)
    assert result['totals']['in_progress']==0 and result['totals']['cancelled']==1
    assert result['totals']['awaiting_invoice']==1 and len(result['deals'])==3

def test_partial_month_does_not_train_the_run_rate():
    data=dataset();data['invoices']=[invoice(i,date=f'2026-{month:02d}-01',share=100) for i,month in enumerate(range(4,7),1)]
    data['invoices'].append(invoice(9,date='2026-07-10',share=10000))
    result=build(data,p=period(dt.date(2026,7,15)))
    assert result['projection']['rates']['company_share']==100
    assert result['monthly'][3]['partial'] and result['monthly'][3]['projected_company_share']>10000
    assert result['monthly'][4]['projected_company_share']==100

def test_insufficient_history_leaves_projection_unavailable():
    result=build(p=period(dt.date(2026,5,1)))
    assert result['projection']['rates']['company_share'] is None
    assert result['monthly'][2]['projected_company_share'] is None

def test_goal_deadline_excludes_late_invoices():
    data=dataset();data['invoices']=[invoice(1,date='2026-09-01',share=100),invoice(2,date='2026-10-01',share=10000)]
    data['goals']=[{'id':'gp-example','scope_key':service.normalize_scope({'bd':NAME})['key'],'metric':'company_share','target_value':1000,
                   'due_date':'2026-09-30','status':'active','baseline_value':0,'baseline_as_of':'2026-04-01'}]
    goal=build(data)['goals'][0]
    assert goal['actual']==100 and goal['gap']==900 and goal['pace_status']=='overdue'
    assert goal['required_per_month'] is None

def test_yoy_uses_the_same_elapsed_period():
    data=dataset();data['invoices']=[invoice(1,share=200),invoice(2,date='2025-04-01',share=100),invoice(3,date='2025-12-01',share=10000)]
    result=build(data)['comparison']
    assert result['prior_company_share']==100 and result['company_share_pct']==100

@pytest.mark.parametrize('fy,asof',[('FY 2026-2026',TODAY),('2026;DROP TABLE x',TODAY),('2026-27',dt.date(2027,1,1)),('FY 2027-28',TODAY)])
def test_invalid_reporting_period_is_rejected(fy,asof):
    with pytest.raises(ValueError):service.period_for(fy,asof,today=TODAY)

def test_snapshot_is_select_only_and_closes_transaction():
    conn=MagicMock();cur=conn.cursor.return_value.__enter__.return_value;cur.fetchall.return_value=[]
    with patch.object(service,'get_db_connection',return_value=conn):result=service._read_snapshot(period())
    assert result['invoices']==[]
    assert all(call.args[0].lstrip().upper().startswith('SELECT ') for call in cur.execute.call_args_list)
    conn.begin.assert_called_once();conn.rollback.assert_called_once();conn.close.assert_called_once()

def test_cache_clear_is_not_blocked_by_database_io():
    service.clear_cache();entered=threading.Event();release=threading.Event()
    def read(_):entered.set();release.wait(2);return dataset()
    with patch.object(service,'_read_snapshot',side_effect=read):
        worker=threading.Thread(target=lambda:service.load_dataset(period()));worker.start();assert entered.wait(1)
        cleared=threading.Event();clearing=threading.Thread(target=lambda:(service.clear_cache(),cleared.set()));clearing.start()
        try:assert cleared.wait(.3)
        finally:release.set();worker.join(1);clearing.join(1)
    assert not worker.is_alive()

@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(application,'ENFORCE_API_KEY',False)
    monkeypatch.setattr(service,'get_ist_today',lambda:TODAY)
    monkeypatch.setattr(controller,'get_ist_today',lambda:TODAY)
    return application.app.test_client()

def test_missing_audit_role_is_rejected_before_database_access(client):
    with patch.object(controller,'load_dataset') as read:assert client.get('/api/growth/profile-audit').status_code==403
    read.assert_not_called()

def test_audit_returns_requested_profiles_with_no_store(client):
    with patch.object(controller,'load_dataset',return_value=dataset()):
        response=client.get('/api/growth/profile-audit',query_string={'role':'admin','fy':'2026-27','as_of':'2026-10-25','scopes':json.dumps([{'bd':NAME},{'tl':'Team A'}])})
    assert response.status_code==200 and len(response.json['profiles'])==2
    assert response.headers['Cache-Control']=='no-store'

@pytest.mark.parametrize('scopes',['{}','[]','[{},{}]','[1]','not-json','[{}, {}, {}, {}, {}]'])
def test_bad_comparison_does_not_load_sources(client,scopes):
    with patch.object(controller,'load_dataset') as read:
        response=client.get('/api/growth/profile-audit',query_string={'role':'admin','scopes':scopes})
    assert response.status_code==400;read.assert_not_called()

@pytest.mark.parametrize('target',['NaN','Infinity','bad',None,-1,0,0.001])
def test_bad_goal_amount_is_rejected_before_writes(client,target):
    with patch.object(controller,'get_db_connection') as connect,patch.object(controller,'load_dataset',return_value=dataset()):
        response=client.post('/api/growth/profile-goals?role=admin',json={'scope':{'bd':NAME},'fy':'2026-27','target':target,'metric':'company_share','due_date':'2027-03-31'})
    assert response.status_code==400;connect.assert_not_called()

def test_failed_insert_rolls_back_superseding_old_goal(client):
    conn=MagicMock();cur=conn.cursor.return_value.__enter__.return_value
    def execute(sql,params=None):
        if 'INSERT INTO growth_profile_goals' in sql:raise pymysql.err.OperationalError(2013,'Synthetic disconnect')
    cur.execute.side_effect=execute
    with patch.object(controller,'get_db_connection',return_value=conn),patch.object(controller,'load_dataset',return_value=dataset()):
        response=client.post('/api/growth/profile-goals?role=admin',json={'scope':{'bd':NAME},'fy':'2026-27','target':1000,'metric':'company_share','due_date':'2027-03-31'})
    assert response.status_code==503
    conn.begin.assert_called_once();conn.rollback.assert_called_once();conn.commit.assert_not_called()

def test_goal_persists_scope_metric_fy_and_actual_baseline(client):
    conn=MagicMock();cur=conn.cursor.return_value.__enter__.return_value
    with patch.object(controller,'get_db_connection',return_value=conn),patch.object(controller,'load_dataset',return_value=dataset()):
        response=client.post('/api/growth/profile-goals?role=admin',json={'scope':{'bd':NAME},'fy':'2026-27','target':1000,'metric':'company_share','due_date':'2027-03-31'})
    assert response.status_code==201 and response.json['baseline_value']==100
    values=next(call.args[1] for call in cur.execute.call_args_list if 'INSERT INTO growth_profile_goals' in call.args[0])
    assert 'company_share' in values and '2026-27' in values and service.normalize_scope({'bd':NAME})['key'] in values
    conn.commit.assert_called_once()

def test_fixed_expense_requires_basis_and_allows_explicit_zero(client):
    conn=MagicMock()
    with patch.object(controller,'get_db_connection',return_value=conn):
        response=client.post('/api/growth/profile-costs?role=admin',json={'scope':{'bd':NAME},'fy':'2026-27','amount':150000})
        assert response.status_code==400 and not conn.cursor.called
        accepted=client.post('/api/growth/profile-costs?role=admin',json={'scope':{'bd':NAME},'fy':'2026-27','amount':0,'basis':'period_total'})
    assert accepted.status_code==200 and accepted.json['period_end']=='2026-10-25'
    conn.commit.assert_called_once()
