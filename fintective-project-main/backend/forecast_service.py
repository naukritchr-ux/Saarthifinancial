"""Closed-month company-income, operating expense and cash scenario forecast.

Historical company income is the invoice company share, excluding franchisee
pass-through revenue. Cash collections are estimated using the historical gross
collection ratio. Opening funds are derived from company-allocated collections less recorded
expenditure and net salary payable. Gross pass-through receipts and CTC are not
misrepresented as available company cash or cash salary payments.
Residual bands are approximate and do not claim calibrated 95% coverage.
"""

import math
import datetime
import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Any, Optional

try:
    from statsmodels.tsa.holtwinters import ExponentialSmoothing
    HAS_STATSMODELS = True
except ImportError:
    HAS_STATSMODELS = False

from db import get_db_connection
from finance_rules import get_ist_today
from accounting_service import load_financial_ledger, summarize_ledger, monthly_summaries, month_bounds


# -------------------------------------------------------------------------
# Helper Functions: Date & Metrics
# -------------------------------------------------------------------------

def calculate_mape(actual: np.ndarray, predicted: np.ndarray) -> Optional[float]:
    """Calculate Mean Absolute Percentage Error (MAPE)."""
    actual = np.asarray(actual, dtype=float)
    predicted = np.asarray(predicted, dtype=float)
    if actual.shape != predicted.shape or not np.all(np.isfinite(actual)) or not np.all(np.isfinite(predicted)):
        raise ValueError("MAPE requires equally sized finite arrays")
    # MAPE is undefined when any actual is zero; do not hide zero months.
    if actual.size == 0 or np.any(np.abs(actual) <= 1e-6):
        return None
    return float(np.mean(np.abs((actual - predicted) / actual)) * 100.0)


def generate_month_sequence(start_ym: str, count: int) -> List[str]:
    """Generate a sequence of YYYY-MM strings starting from start_ym."""
    year, month = map(int, start_ym.split('-'))
    months = []
    for _ in range(count):
        months.append(f"{year:04d}-{month:02d}")
        month += 1
        if month > 12:
            month = 1
            year += 1
    return months


# -------------------------------------------------------------------------
# Model Implementations: Seasonal Naive & Holt-Winters
# -------------------------------------------------------------------------

def seasonal_naive_forecast(history: np.ndarray, horizon: int, seasonal_period: int = 12) -> Tuple[np.ndarray, np.ndarray]:
    """
    Seasonal-Naive baseline: Forecast = Value(t - 12) * (1 + YoY_growth).
    Returns (forecast_array, in_sample_fitted).
    """
    n = len(history)
    if n < seasonal_period:
        raise ValueError("Seasonal forecast requires at least 12 complete months")
    fitted = np.full(n, np.nan)
    
    # Calculate trailing 12-month YoY growth factor
    if n >= 2 * seasonal_period:
        recent_year = np.sum(history[-seasonal_period:])
        prior_year = np.sum(history[-2 * seasonal_period:-seasonal_period])
        if prior_year > 1e-4:
            yoy_growth = (recent_year / prior_year) - 1.0
            # Bound realistic annual growth between -30% and +50%
            yoy_growth = max(-0.30, min(0.50, yoy_growth))
        else:
            yoy_growth = 0.0
    else:
        yoy_growth = 0.0

    # In-sample fitted values
    for t in range(seasonal_period, n):
        # Only information available before t may enter its fitted prediction.
        growth = 0.0
        if t >= 2 * seasonal_period:
            prior = float(np.sum(history[t-2*seasonal_period:t-seasonal_period]))
            if prior > 1e-4:
                growth = max(-0.30, min(0.50, float(np.sum(history[t-seasonal_period:t])) / prior - 1.0))
        fitted[t] = history[t - seasonal_period] * (1.0 + growth)

    # Out-of-sample forecast
    forecast = np.zeros(horizon)
    for h in range(horizon):
        src_idx = n - seasonal_period + (h % seasonal_period)
        if src_idx < n:
            base_val = history[src_idx]
        else:
            base_val = forecast[src_idx - n]
        forecast[h] = max(0.0, base_val * (1.0 + yoy_growth))

    return forecast, fitted


def numpy_holt_winters(
    series: np.ndarray,
    horizon: int,
    seasonal_period: int = 12,
    alpha: float = 0.2,
    beta: float = 0.05,
    gamma: float = 0.25,
    phi: float = 0.90
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Pure NumPy implementation of Holt-Winters additive seasonal smoothing with damped trend.
    Runs in <1ms without any external dependencies.
    """
    n = len(series)
    if n < seasonal_period:
        return np.full(horizon, float(np.mean(series))), np.full(n, float(np.mean(series)))

    level = float(np.mean(series[:seasonal_period]))
    if n >= 2 * seasonal_period:
        next_level = float(np.mean(series[seasonal_period:2 * seasonal_period]))
        trend = (next_level - level) / float(seasonal_period)
    else:
        trend = 0.0

    seasonals = [float(series[i] - level) for i in range(seasonal_period)]
    season_mean = float(np.mean(seasonals))
    seasonals = [s - season_mean for s in seasonals]

    levels = [level]
    trends = [trend]
    fitted = np.zeros(n)
    fitted[:seasonal_period] = np.nan

    for t in range(seasonal_period, n):
        val = float(series[t])
        s_prev = seasonals[t % seasonal_period]
        last_l = levels[-1]
        last_b = trends[-1]

        fitted[t] = max(0.0, last_l + phi * last_b + s_prev)
        new_l = alpha * (val - s_prev) + (1.0 - alpha) * (last_l + phi * last_b)
        new_b = beta * (new_l - last_l) + (1.0 - beta) * phi * last_b
        new_s = gamma * (val - new_l) + (1.0 - gamma) * s_prev

        levels.append(new_l)
        trends.append(new_b)
        seasonals[t % seasonal_period] = new_s

    forecast = []
    last_l = levels[-1]
    last_b = trends[-1]
    damp_sum = 0.0
    for h in range(1, horizon + 1):
        damp_sum += phi ** h
        s_idx = (n + h - 1) % seasonal_period
        pred = last_l + damp_sum * last_b + seasonals[s_idx]
        forecast.append(max(0.0, float(pred)))

    return np.array(forecast, dtype=float), np.array(fitted, dtype=float)


def holt_winters_forecast(
    history: np.ndarray,
    horizon: int,
    damped: bool = True,
    seasonal_period: int = 12
) -> Tuple[np.ndarray, np.ndarray, bool]:
    """
    Fits Holt-Winters Exponential Smoothing.
    Uses statsmodels if present, or pure NumPy engine.
    Returns (forecast_array, in_sample_fitted, success_boolean).
    """
    if HAS_STATSMODELS and len(history) >= 2 * seasonal_period:
        try:
            model = ExponentialSmoothing(
                history,
                trend='add',
                damped_trend=damped,
                seasonal='add',
                seasonal_periods=seasonal_period,
                initialization_method='estimated'
            )
            fitted_model = model.fit(optimized=True)
            forecast = np.maximum(0.0, fitted_model.forecast(horizon))
            fitted = fitted_model.fittedvalues
            return np.asarray(forecast, dtype=float), np.asarray(fitted, dtype=float), True
        except Exception as err:
            pass

    # High-performance pure NumPy fallback
    fc, fitted = numpy_holt_winters(history, horizon, seasonal_period=seasonal_period, phi=0.90 if damped else 1.0)
    return fc, fitted, True


# -------------------------------------------------------------------------
# Backtest & Selection Engine
# -------------------------------------------------------------------------

def backtest_revenue_models(history: np.ndarray, test_len: int = 6) -> Dict[str, Any]:
    """
    Trains on history[:-test_len] and evaluates on history[-test_len:].
    Compares Holt-Winters (Damped) vs. Seasonal-Naive with YoY growth.
    Returns dict with winner model name, winner forecast func, and MAPEs.
    """
    n = len(history)
    if n < test_len + 12:
        return {
            'selected': 'Seasonal-Naive',
            'mape': None,
            'hw_mape': None,
            'naive_mape': None,
            'damped_used': True
        }

    train = history[:-test_len]
    test = history[-test_len:]

    # 1. Evaluate Seasonal Naive
    naive_pred, _ = seasonal_naive_forecast(train, horizon=test_len, seasonal_period=12)
    naive_mape = calculate_mape(test, naive_pred)

    # 2. Evaluate Holt-Winters (Damped)
    hw_pred, _, hw_ok = holt_winters_forecast(train, horizon=test_len, damped=True, seasonal_period=12)
    hw_mape = calculate_mape(test, hw_pred) if hw_ok else 999.0

    # Select model with lower test error
    if hw_ok and ((hw_mape is not None and naive_mape is not None and hw_mape <= naive_mape)
                  or (hw_mape is None and naive_mape is None
                      and np.mean(np.abs(test - hw_pred)) <= np.mean(np.abs(test - naive_pred)))):
        selected_model = "Holt-Winters (Damped Trend)"
        selected_mape = hw_mape
    else:
        selected_model = "Seasonal-Naive (YoY Trend)"
        selected_mape = naive_mape

    return {
        'selected': selected_model,
        'mape': round(selected_mape, 2) if selected_mape is not None else None,
        'hw_mape': round(hw_mape, 2) if hw_ok and hw_mape is not None else None,
        'naive_mape': round(naive_mape, 2) if naive_mape is not None else None,
        'damped_used': True
    }



# Simple expense candidates compete with the existing seasonal model. The last
# full year is held out where available so annual payments enter validation.
EXPENSE_CANDIDATES = (
    'Trailing 6-Month Mean',
    'Trailing 6-Month Median',
    'Last Month Baseline',
    'Seasonal-Naive (YoY Trend)',
    'Holt-Winters (Additive Seasonality)',
)


def expense_candidate_forecast(name, history, horizon):
    history = np.asarray(history, dtype=float)
    n = len(history)
    if not n or not np.all(np.isfinite(history)):
        raise ValueError('Expense forecasting requires finite historical values')
    if name == 'Holt-Winters (Additive Seasonality)':
        if n < 24:
            raise ValueError('Seasonal Holt-Winters requires two complete years')
        forecast, fitted, _ = holt_winters_forecast(history, horizon, damped=False)
        return forecast, fitted
    if name == 'Seasonal-Naive (YoY Trend)':
        return seasonal_naive_forecast(history, horizon)
    if name not in EXPENSE_CANDIDATES:
        raise ValueError('Unknown expense forecasting model')
    window = 1 if name == 'Last Month Baseline' else 6
    aggregate = np.median if name == 'Trailing 6-Month Median' else np.mean
    # Backward-only fitted values: no future observations enter a prediction.
    fitted = np.full(n, np.nan)
    for t in range(window, n):
        fitted[t] = max(0., float(aggregate(history[t-window:t])))
    value = max(0., float(aggregate(history[-window:])))
    return np.full(horizon, value), fitted


def select_expense_model(history, horizon=6):
    """Select by held-out MAE in rupees; retain the measured MAPE without alteration.

    Up to twelve final months form one chronological holdout. Selection metrics
    compare candidates, not an independent estimate of future accuracy. MAE gives
    large annual bills their monetary weight, unlike percentage error on tiny bills.
    """
    history = np.asarray(history, dtype=float)
    if history.ndim != 1 or not len(history) or not np.all(np.isfinite(history)):
        raise ValueError('Expense history must be a nonempty finite monthly series')
    test_len = min(12, max(0, len(history) - 12)) if len(history) >= 18 else 0
    comparison = []
    errors = None
    selected = EXPENSE_CANDIDATES[0]
    if test_len:
        train, actual = history[:-test_len], history[-test_len:]
        best_mae = math.inf
        for name in EXPENSE_CANDIDATES:
            try:
                prediction, _ = expense_candidate_forecast(name, train, test_len)
                if len(prediction) != test_len or not np.all(np.isfinite(prediction)):
                    continue
            except (ValueError, ArithmeticError):
                continue
            residual = actual - prediction
            mae = float(np.mean(np.abs(residual)))
            mape = calculate_mape(actual, prediction)
            denominator = float(np.sum(np.abs(actual)))
            wape = float(np.sum(np.abs(residual)) / denominator * 100) if denominator > 1e-6 else None
            comparison.append({'model': name, 'mae': round(mae, 2),
                               'mape': round(mape, 2) if mape is not None else None,
                               'wape': round(wape, 2) if wape is not None else None})
            if round(mae, 4) < round(best_mae, 4):
                best_mae, selected, errors = mae, name, residual
        if not comparison:
            raise ValueError('No expense model could be validated on the available history')
    # Refit only the selected candidate on the full history for future months.
    prediction, fitted = expense_candidate_forecast(selected, history, horizon)
    metrics = next((r for r in comparison if r['model'] == selected), {})
    return {
        'selected': selected, 'forecast': prediction, 'fitted': fitted,
        'test_months': test_len, 'mape': metrics.get('mape'),
        'mae': metrics.get('mae'), 'wape': metrics.get('wape'),
        'comparison': comparison,
        'residual_rmse': float(np.sqrt(np.mean(errors ** 2))) if errors is not None else None,
    }


# -------------------------------------------------------------------------
# Data Layer: Historical Ingestion
# -------------------------------------------------------------------------

def fetch_revenue_history(conn, cutoff=None) -> Tuple[List[str], np.ndarray, float]:
    """
    Fetches monthly company share from revenue invoices, through the last closed month.
    Returns (months_list, revenue_array, avg_collection_rate).
    """
    cutoff = cutoff or get_ist_today().replace(day=1)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            DATE_FORMAT(billDate, '%%Y-%%m') AS ym,
            COALESCE(SUM(ourShare), 0.0) AS billed_rev,
            COALESCE(SUM(CASE WHEN COALESCE(DATE(dateReceived), DATE(billDate)) < %s THEN amountReceived ELSE 0 END), 0.0) AS collected_amt,
            COALESCE(SUM(totalBillAmt), 0.0) AS total_gross
        FROM v_invoice_clean
        WHERE is_revenue = 1
          AND billDate >= '2024-04-01'
          AND billDate < %s
        GROUP BY ym
        ORDER BY ym ASC
    """, [cutoff.isoformat(), cutoff.isoformat()])
    rows = cursor.fetchall()
    if not rows:
        raise ValueError('No closed-month invoice history is available for forecasting')
    
    # Generate a continuous sequence up to the last closed month
    expected_months = generate_month_sequence('2024-04', (cutoff.year - 2024) * 12 + cutoff.month - 4)
    rev_map = {r['ym']: float(r['billed_rev']) for r in rows}
    
    total_billed = sum(float(r['total_gross'] or 0.0) for r in rows)
    total_collected = sum(float(r['collected_amt'] or 0.0) for r in rows)
    avg_collection_rate = min(1.0, max(0.0, total_collected / total_billed)) if total_billed > 0 else 0.0

    # Fill continuous series (fallback to zero or interpolation if missing)
    series = [rev_map.get(m, 0.0) for m in expected_months]
    return expected_months, np.array(series, dtype=float), avg_collection_rate


def fetch_expense_history(conn, cutoff=None, ledger=None):
    """Cash expenditure includes remittances; confirmed net-salary duplicates are separated."""
    cutoff = cutoff or get_ist_today().replace(day=1)
    ledger = ledger if ledger is not None else load_financial_ledger(conn, cutoff - datetime.timedelta(days=1))
    months = generate_month_sequence('2023-04', (cutoff.year - 2023) * 12 + cutoff.month - 4)
    summaries = monthly_summaries(ledger, months)
    if not any(item['expense_rows'] for item in summaries.values()):
        raise ValueError('No closed-month expense history is available for forecasting')
    return months, np.array([summaries[m]['expense_cash'] + summaries[m]['manual_expense'] for m in months])


def fetch_scheduled_payroll(conn, forecast_months, ledger=None, include_sources=False):
    """Forecast net salary payable, never CTC plus duplicated remittances.

    Future rows are planned inputs, not proof of payment. Missing months use the
    average of observed payroll months in the preceding six closed months.
    """
    ledger = ledger if ledger is not None else load_financial_ledger(conn, month_bounds(forecast_months[-1])[1])
    first = datetime.date.fromisoformat(forecast_months[0] + '-01')
    serial = first.year * 12 + first.month - 1 - 6
    baseline_start = f"{serial // 12:04d}-{serial % 12 + 1:02d}"
    history_months = generate_month_sequence(baseline_start, 6)
    history = monthly_summaries(ledger, history_months)
    observed = [item['net_salary_payable'] for item in history.values() if item['payroll_rows']]
    baseline = float(np.mean(observed)) if observed else None
    future = monthly_summaries(ledger, forecast_months)
    values, sources = {}, {}
    for month, item in future.items():
        if item['audit']['missing_net_payable']:
            raise ValueError(f'Net salary payable is missing for planned payroll in {month}')
        if item['payroll_rows']:
            values[month], sources[month] = item['net_salary_payable'], 'planned_payroll_records'
        elif baseline is not None:
            values[month], sources[month] = baseline, 'observed_net_payroll_average'
        else:
            raise ValueError(f'No net-payroll records or history are available for {month}; payroll cannot be assumed zero')
    return (values, sources) if include_sources else values


def fetch_current_cash_balance(conn, as_of=None, ledger=None):
    """Company-retained ledger proxy on the same basis as forecast collections."""
    as_of = as_of or (get_ist_today().replace(day=1) - datetime.timedelta(days=1))
    ledger = ledger if ledger is not None else load_financial_ledger(conn, as_of)
    snapshot = summarize_ledger(ledger, as_of=as_of)
    if snapshot['company_cash_movement_estimate'] is None:
        raise ValueError('Opening company funds need payroll reconciliation; inspect /api/finance/actuals')
    return snapshot['company_cash_movement_estimate']


def cash_runway(opening_cash, net_flows):
    """First monthly cash depletion, interpolated within the depletion month."""
    if opening_cash <= 0:
        return 0.0
    cash = opening_cash
    for index, net in enumerate(net_flows):
        if cash + net <= 0:
            return round(index + cash / -net, 1)
        cash += net
    return None


# -------------------------------------------------------------------------
# Core Engine: generate_full_forecast
# -------------------------------------------------------------------------

def generate_full_forecast(
    horizon: int = 6,
    conn = None
) -> Dict[str, Any]:
    """
    Main orchestration entrypoint:
    1. Fetches company income and operating expense data through the last closed month.
    2. Backtests revenue models and fits selected model.
    3. Compares expense baselines and seasonal models using a chronological holdout.
    4. Gathers scheduled payroll commitments.
    5. Calculates confidence intervals and runway projections.
    """
    horizon = max(1, min(12, int(horizon or 6)))
    close_conn = False
    if conn is None:
        conn = get_db_connection()
        close_conn = True

    try:
        # 1. Fetch clean historical training windows
        cutoff = get_ist_today().replace(day=1)
        opening_as_of = cutoff - datetime.timedelta(days=1)
        forecast_months = generate_month_sequence(cutoff.strftime('%Y-%m'), horizon)
        ledger = load_financial_ledger(conn, month_bounds(forecast_months[-1])[1])
        opening_snapshot = summarize_ledger(ledger, as_of=opening_as_of)
        cash_balance = fetch_current_cash_balance(conn, as_of=opening_as_of, ledger=ledger)
        rev_months, rev_series, coll_ratio = fetch_revenue_history(conn, cutoff)
        exp_months, exp_series = fetch_expense_history(conn, cutoff, ledger=ledger)
        payroll_scheduled, payroll_sources = fetch_scheduled_payroll(conn, forecast_months, ledger=ledger, include_sources=True)

        # 2. Revenue Model: Backtest & Forecast
        rev_backtest = backtest_revenue_models(rev_series, test_len=6)
        if "Holt-Winters" in rev_backtest['selected']:
            rev_fc, rev_fitted, _ = holt_winters_forecast(rev_series, horizon=horizon, damped=True, seasonal_period=12)
        else:
            rev_fc, rev_fitted = seasonal_naive_forecast(rev_series, horizon=horizon, seasonal_period=12)

        # Revenue residual error for confidence intervals
        rev_valid_mask = ~np.isnan(rev_fitted)
        if np.any(rev_valid_mask):
            rev_resid = rev_series[rev_valid_mask] - rev_fitted[rev_valid_mask]
            rev_se = float(np.std(rev_resid))
        else:
            rev_se = float(np.std(rev_series) * 0.15)

        # 3. Select the expense model using a chronological holdout, rather than
        # always forcing seasonal Holt-Winters even when its validation error is high.
        exp_selection = select_expense_model(exp_series, horizon)
        exp_fc, exp_fitted = exp_selection['forecast'], exp_selection['fitted']
        exp_model_name, exp_mape = exp_selection['selected'], exp_selection['mape']
        if exp_selection['residual_rmse'] is not None:
            exp_se = exp_selection['residual_rmse']
        else:
            valid = np.isfinite(exp_fitted)
            residual = exp_series[valid] - exp_fitted[valid]
            exp_se = float(np.sqrt(np.mean(residual ** 2))) if residual.size else 0.0

        history_details = monthly_summaries(ledger, rev_months)
        historical_payroll = {m: details['net_salary_payable'] for m, details in history_details.items()}
        # 4. Construct the common historical timeline
        historical_points = []
        for ym in rev_months:
            r_val = float(rev_series[rev_months.index(ym)])
            e_val = float(exp_series[exp_months.index(ym)]) if ym in exp_months else 0.0
            historical_points.append({
                'month': ym,
                'revenue': round(r_val, 2),
                'company_collections_estimate': history_details[ym]['company_collections_estimate'],
                'cash_inflow_estimate': round(history_details[ym]['company_collections_estimate'] + history_details[ym]['manual_income'], 2),
                'total_outflow': round(e_val + historical_payroll.get(ym, 0.0), 2),
                'expenses': round(e_val, 2),
                'payroll': round(historical_payroll.get(ym, 0.0), 2),
                'net': round(history_details[ym]['company_collections_estimate'] + history_details[ym]['manual_income'] - e_val - historical_payroll.get(ym, 0.0), 2)
            })

        # 5. Construct Forecast Timeline with Confidence Bands & Cash Trajectory
        forecast_points = []
        running_cash = cash_balance
        total_projected_net = 0.0

        net_flows = []
        for h in range(horizon):
            ym = forecast_months[h]
            step = h + 1
            z_factor = 1.96 * math.sqrt(step)

            # Revenue intervals
            pred_rev = float(rev_fc[h])
            lower_rev = max(0.0, pred_rev - z_factor * rev_se)
            upper_rev = pred_rev + z_factor * rev_se

            # Operating Expense intervals
            pred_exp = float(exp_fc[h])
            lower_exp = max(0.0, pred_exp - z_factor * exp_se)
            upper_exp = pred_exp + z_factor * exp_se

            # Fixed scheduled payroll commitment
            pay_val = float(payroll_scheduled.get(ym, 0.0))
            
            # Total Outflow = Opex + Payroll
            total_outflow = pred_exp + pay_val
            
            # Net Projected Cash Flow
            net_proj = pred_rev * coll_ratio - total_outflow
            net_lower = lower_rev * coll_ratio - (upper_exp + pay_val)
            net_upper = upper_rev * coll_ratio - (lower_exp + pay_val)

            net_flows.append(net_proj)
            running_cash += net_proj
            total_projected_net += net_proj

            forecast_points.append({
                'month': ym,
                'revenue': {
                    'predicted': round(pred_rev, 2),
                    'lower': round(lower_rev, 2),
                    'upper': round(upper_rev, 2)
                },
                'operating_expenses': {
                    'predicted': round(pred_exp, 2),
                    'lower': round(lower_exp, 2),
                    'upper': round(upper_exp, 2)
                },
                'expected_collections': round(pred_rev * coll_ratio, 2),
                'scheduled_payroll': round(pay_val, 2),
                'payroll_basis': 'net_salary_payable',
                'payroll_source': payroll_sources[ym],
                'total_projected_outflow': round(total_outflow, 2),
                'net_projected': round(net_proj, 2),
                'net_lower': round(net_lower, 2),
                'net_upper': round(net_upper, 2),
                'cumulative_cash': round(running_cash, 2)
            })

        # Report only depletion observed in this forecast horizon, not an infinite runway.
        runway_months = cash_runway(cash_balance, net_flows)
        runway_status = (f"{runway_months} Months" if runway_months is not None
                         else f"Cash remains positive over {horizon} forecast months")

        return {
            'status': 'ok',
            'revenue_basis': 'Company share (ex-GST)',
            'cash_assumption': 'Company collections are estimated from company-share income. Cash outflows include net salary payable and recorded expenditure/remittances once; CTC provisions are excluded. Receipt dates are used where recorded; invoice-date fallback, aggregate instalments and payroll-payable dates limit cash timing. Unrecorded taxes and payments are outside this estimate; it is not a bank reconciliation.',
            'opening_balance_breakdown': opening_snapshot,
            'payroll_basis': 'net_salary_payable',
            'forecast_assumptions': ['Future payroll rows are planned inputs, not confirmed bank payments.',
                                     'Missing payroll months use an average of observed net-payroll months.'],
            'interval_method': 'Approximate residual bands; not calibrated 95% prediction intervals.',
            'as_of_month': (cutoff - datetime.timedelta(days=1)).strftime('%Y-%m'),
            'forecast_start_month': cutoff.strftime('%Y-%m'),
            'horizon': horizon,
            'collection_ratio': round(coll_ratio, 3),
            'models': {
                'revenue': {
                    'selected_model': rev_backtest['selected'],
                    'backtest_mape': rev_backtest['mape'],
                    'training_months': len(rev_series),
                    'training_window': f'{rev_months[0]} to {rev_months[-1]}'
                },
                'expenses': {
                    'selected_model': exp_model_name,
                    'backtest_mape': exp_mape,
                    'backtest_mae': exp_selection['mae'],
                    'backtest_wape': exp_selection['wape'],
                    'backtest_months': exp_selection['test_months'],
                    'selection_metric': 'MAE in rupees',
                    'model_comparison': exp_selection['comparison'],
                    'training_months': len(exp_series),
                    'training_window': f'{exp_months[0]} to {exp_months[-1]}'
                }
            },
            'summary': {
                'current_cash_balance': round(cash_balance, 2),
                'cash_balance_source': 'company_retained_ledger',
                'cash_balance_as_of': opening_as_of.isoformat(),
                'cash_balance_label': 'Estimated company-retained funds',
                'projected_total_net': round(total_projected_net, 2),
                'projected_final_cash': round(running_cash, 2),
                'runway_months': runway_months,
                'runway_status': runway_status
            },
            'historical': historical_points,
            'forecast': forecast_points
        }
    finally:
        if close_conn and conn:
            conn.close()
