"""Closed-month company-income, operating expense and cash scenario forecast.

Historical company income is the invoice company share, excluding franchisee
pass-through revenue. Cash collections are estimated using the historical gross
collection ratio. Opening cash is derived from the live ledger at the cutoff
and is a cash proxy rather than a verified bank balance.
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
            if mae < best_mae:
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
            COALESCE(SUM(amountReceived), 0.0) AS collected_amt,
            COALESCE(SUM(totalBillAmt), 0.0) AS total_gross
        FROM v_invoice_clean
        WHERE is_revenue = 1
          AND billDate >= '2024-04-01'
          AND billDate < %s
        GROUP BY ym
        ORDER BY ym ASC
    """, [cutoff.isoformat()])
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


def fetch_expense_history(conn, cutoff=None) -> Tuple[List[str], np.ndarray]:
    """
    Fetches monthly expenses from expenditure (is_deleted = 0).
    Uses complete months from April 2023 up to the supplied cutoff.
    Returns (months_list, expense_array).
    """
    cutoff = cutoff or get_ist_today().replace(day=1)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            DATE_FORMAT(billDate, '%%Y-%%m') AS ym,
            COALESCE(SUM(amount), 0.0) AS total_exp
        FROM expenditure
        WHERE is_deleted = 0
          AND billDate >= '2023-04-01'
          AND billDate < %s
        GROUP BY ym
        ORDER BY ym ASC
    """, [cutoff.isoformat()])
    rows = cursor.fetchall()
    if not rows:
        raise ValueError('No closed-month expense history is available for forecasting')
    
    expected_months = generate_month_sequence('2023-04', (cutoff.year - 2023) * 12 + cutoff.month - 4)
    exp_map = {r['ym']: float(r['total_exp']) for r in rows}
    series = [exp_map.get(m, 0.0) for m in expected_months]
    return expected_months, np.array(series, dtype=float)


def fetch_scheduled_payroll(conn, forecast_months: List[str]) -> Dict[str, float]:
    """
    Fetches future-dated scheduled payroll commitments from payroll_records.
    Months without scheduled records use the last six closed months average.
    """
    cursor = conn.cursor()
    start = forecast_months[0] + '-01'
    end = generate_month_sequence(forecast_months[-1], 2)[-1] + '-01'
    cursor.execute("""
        SELECT DATE_FORMAT(date, '%%Y-%%m') AS ym,
               COALESCE(SUM(ctc_amount), 0) AS monthly_payroll
        FROM payroll_records WHERE date >= %s AND date < %s GROUP BY ym
    """, [start, end])
    scheduled_map = {r['ym']: float(r['monthly_payroll']) for r in cursor.fetchall()}
    # Average the latest six closed calendar months, including months with no payroll.
    first = datetime.date.fromisoformat(start)
    serial = first.year * 12 + first.month - 1 - 6
    baseline_start = f"{serial // 12:04d}-{serial % 12 + 1:02d}-01"
    cursor.execute("""
        SELECT COALESCE(SUM(ctc_amount), 0) / 6.0 AS avg_payroll
        FROM payroll_records WHERE date >= %s AND date < %s
    """, [baseline_start, start])
    row = cursor.fetchone() or {}
    baseline = float(row.get('avg_payroll') or 0)
    return {m: scheduled_map.get(m, baseline) for m in forecast_months}


def fetch_current_cash_balance(conn, as_of=None) -> float:
    """Calculate the dated live ledger balance; never substitute an invented value.

    Uses the cash-balance endpoint's sources: invoice collections less expenditure
    and completed franchise payouts, plus manual ledger entries. Undated records
    cannot be assigned to a historical cutoff and are excluded. Invoice receipt
    amounts are associated with invoice bill dates; this is not a historical bank
    reconciliation or proof of when each payment actually arrived.
    """
    if as_of is None:
        as_of = get_ist_today().replace(day=1) - datetime.timedelta(days=1)
    elif isinstance(as_of, str):
        as_of = datetime.date.fromisoformat(as_of)
    # Exclusive next-day boundary includes all timestamps on the closing day.
    end = (as_of + datetime.timedelta(days=1)).isoformat()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT
              (SELECT COALESCE(SUM(amountReceived), 0)
               FROM v_invoice_clean WHERE billDate < %s)
              - (SELECT COALESCE(SUM(amount), 0)
                 FROM expenditure WHERE billDate < %s AND is_deleted = 0)
              - (SELECT COALESCE(SUM(payment_amount), 0)
                 FROM franchisePayments WHERE payment_done = 'Yes' AND payment_date < %s)
              + (SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0)
                 FROM manual_cash_entries WHERE date < %s)
              AS cash_balance
        """, [end, end, end, end])
        row = cursor.fetchone()
        if not row or row.get('cash_balance') is None:
            raise ValueError('The live ledger did not return an opening cash balance')
        value = float(row['cash_balance'])
        if not math.isfinite(value):
            raise ValueError('The live ledger returned a non-finite cash balance')
        return value
    finally:
        cursor.close()


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
        cash_balance = fetch_current_cash_balance(conn, as_of=opening_as_of)
        rev_months, rev_series, coll_ratio = fetch_revenue_history(conn, cutoff)
        exp_months, exp_series = fetch_expense_history(conn, cutoff)
        forecast_months = generate_month_sequence(cutoff.strftime('%Y-%m'), horizon)
        payroll_scheduled = fetch_scheduled_payroll(conn, forecast_months)

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

        # Historical payroll makes historical operating results comparable to forecast costs.
        cur = conn.cursor()
        cur.execute("""
            SELECT DATE_FORMAT(date, '%%Y-%%m') AS ym, COALESCE(SUM(ctc_amount), 0) AS payroll
            FROM payroll_records WHERE date >= %s AND date < %s GROUP BY ym
        """, [rev_months[0] + '-01', cutoff.isoformat()])
        historical_payroll = {r['ym']: float(r['payroll']) for r in cur.fetchall()}
        # 4. Construct the common historical timeline
        historical_points = []
        for ym in rev_months:
            r_val = float(rev_series[rev_months.index(ym)])
            e_val = float(exp_series[exp_months.index(ym)]) if ym in exp_months else 0.0
            historical_points.append({
                'month': ym,
                'revenue': round(r_val, 2),
                'expenses': round(e_val, 2),
                'payroll': round(historical_payroll.get(ym, 0.0), 2),
                'net': round(r_val - e_val - historical_payroll.get(ym, 0.0), 2)
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
            'cash_assumption': 'Opening cash is a live ledger estimate at the last closed month, not a bank reconciliation. Historical collections are grouped by invoice date, so later receipts can revise this estimate. Cash scenario: company-share collections estimated using the historical gross invoice collection ratio. Excludes tax, collection timing, outstanding receivables and future one-off manual income. Historical net is accrual income less expenses and payroll.',
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
                'cash_balance_source': 'live_ledger',
                'cash_balance_as_of': opening_as_of.isoformat(),
                'cash_balance_label': 'Ledger-derived opening balance',
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
