import os
import pandas as pd
import numpy as np
from datetime import datetime
from dotenv import load_dotenv
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingRegressor
from sklearn.preprocessing import LabelEncoder
import sklearn.metrics as metrics
import joblib
import sys

load_dotenv()


def main():
    if hasattr(sys.stdout, 'reconfigure'):
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass

    print("Starting Model Training process...")

    csv_path = 'miss/training_dataset_clean.csv'
    if not os.path.exists(csv_path):
        csv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'miss', 'training_dataset_clean.csv')
    if not os.path.exists(csv_path):
        print(f"Error: training dataset not found at {csv_path}")
        return

    df = pd.read_csv(csv_path)
    print(f"Loaded {len(df)} records from {csv_path}")

    # ------------------------------------------------------------------
    # 1. BASE FEATURE ENGINEERING (unchanged from v1)
    # ------------------------------------------------------------------
    df['dateOfAllocation'] = pd.to_datetime(df['dateOfAllocation'])
    df['bill_date'] = pd.to_datetime(df['invoice_billDate'])
    df['days_to_close'] = (df['bill_date'] - df['dateOfAllocation']).dt.days

    def get_industry(position):
        pos = str(position).lower()
        if any(w in pos for w in ['developer', 'software', 'tech', 'engineer', 'it', 'java', 'python', 'php', 'analyst']):
            return 'IT & Software'
        if any(w in pos for w in ['sales', 'marketing', 'bd', 'business development', 'retail', 'account manager']):
            return 'Sales & Marketing'
        if any(w in pos for w in ['finance', 'accountant', 'accounts', 'audit', 'tax', 'banking']):
            return 'Finance & Accounts'
        if any(w in pos for w in ['hr', 'recruiter', 'admin', 'human resources', 'operations']):
            return 'HR & Operations'
        return 'Other Services'

    # Prefer the real, human-assigned Industry column (from master_final_pipeline
    # via import_master_final.py) when it's present. Fall back to the keyword
    # guess only for rows imported before this column existed, or left blank.
    keyword_industry = df['positionName'].apply(get_industry)
    if 'industry' in df.columns:
        df['industry'] = df['industry'].fillna(keyword_industry)
        # 166 raw values in the real column are too granular / inconsistently
        # spelled to label-encode directly (e.g. "Engineering", "Advertising, Media").
        # Bucket rare values (<10 occurrences) into "Other" so the encoder doesn't
        # end up with hundreds of near-singleton categories.
        counts = df['industry'].value_counts()
        rare = counts[counts < 10].index
        df['industry'] = df['industry'].replace(list(rare), 'Other')
    else:
        df['industry'] = keyword_industry

    df['bill_amount'] = pd.to_numeric(df['invoice_grossRevenue'], errors='coerce').fillna(0.0)

    def get_fee_band(bill_amount):
        val = float(bill_amount or 0.0)
        if val < 30000:
            return 'Low-Fee'
        elif val < 100000:
            return 'Standard-Fee'
        return 'Premium-Fee'

    df['fee_band'] = df['bill_amount'].apply(get_fee_band)

    le_industry = LabelEncoder()
    df['industry_encoded'] = le_industry.fit_transform(df['industry'])
    le_feeband = LabelEncoder()
    df['feeband_encoded'] = le_feeband.fit_transform(df['fee_band'])
    le_bd = LabelEncoder()
    df['bd_encoded'] = le_bd.fit_transform(df['bdMemberName'].fillna('Unknown'))

    # ------------------------------------------------------------------
    # 2. NEW FEATURES
    # Label-encoding turns categories into arbitrary numbers (e.g. "Delhi
    # Franchisee" -> 37). That's fine for LOW-cardinality columns like
    # teamLeaderName (15 values) because the model can learn a rule per
    # value. It's a bad idea for franchiseeName (521 values) or
    # companyName (3,914 values) - the model would just memorize IDs and
    # overfit. Instead we FREQUENCY-ENCODE those: replace each value with
    # "how many times does this value appear in the data". That's a real,
    # meaningful number (a rough proxy for deal volume / process
    # maturity) instead of an arbitrary label.
    # ------------------------------------------------------------------
    df['alloc_month'] = df['dateOfAllocation'].dt.month
    df['alloc_quarter'] = df['dateOfAllocation'].dt.quarter

    df['franchiseeName'] = df['franchiseeName'].fillna('Unknown')
    df['companyName'] = df['companyName'].fillna('Unknown')
    df['franchisee_freq'] = df['franchiseeName'].map(df['franchiseeName'].value_counts())
    df['company_freq'] = df['companyName'].map(df['companyName'].value_counts())

    df['teamLeaderName'] = df['teamLeaderName'].fillna('Unknown')
    le_tl = LabelEncoder()
    df['teamlead_encoded'] = le_tl.fit_transform(df['teamLeaderName'])

    # "as_of" = the latest date seen in the data, standing in for "today".
    # enquiry_age_days / days_since_invoice tell the model how OLD a
    # record is, which turned out to be the single biggest driver of the
    # leakage and payment-pending classifiers - a 3-day-old unbilled
    # enquiry is not the same risk as a 3-year-old one, but without this
    # feature they looked identical to the model.
    as_of = df['dateOfAllocation'].max()
    df['enquiry_age_days'] = (as_of - df['dateOfAllocation']).dt.days
    df['days_since_invoice'] = (as_of - df['bill_date']).dt.days

    # Client tenure: how long has this client existed as of this allocation?
    # Tested empirically against master_final_pipeline.csv directly — this
    # was the #2 most useful of the previously-dropped columns (behind real
    # Industry). Missing for rows imported before dateClientAcquired existed;
    # median-fill those rather than dropping the feature.
    if 'dateClientAcquired' in df.columns:
        df['dateClientAcquired'] = pd.to_datetime(df['dateClientAcquired'], errors='coerce')
        df['client_tenure_days'] = (df['dateOfAllocation'] - df['dateClientAcquired']).dt.days
        df['client_tenure_days'] = df['client_tenure_days'].fillna(df['client_tenure_days'].median())
    else:
        df['client_tenure_days'] = 0

    print("Feature engineering complete.")

    # ------------------------------------------------------------------
    # MODEL 1: BD VELOCITY (regression)
    #
    # We use HistGradientBoostingRegressor with loss='absolute_error'
    # instead of RandomForest with its default squared-error criterion.
    # Why this matters: squared-error training pushes the model to
    # predict the MEAN of days_to_close for similar deals. Our baseline
    # (and MAE, the metric we're judged on) is about the MEDIAN. On a
    # right-skewed distribution like "days to close a deal" (a few deals
    # take a very long time), mean and median diverge a lot - so a
    # mean-optimizing model looked worse on a median-style metric even
    # though it wasn't necessarily a bad model. Switching the loss to
    # absolute_error aligns training with the metric we actually report.
    # ------------------------------------------------------------------
    print("\n--- Model 1: BD Velocity ---")
    mask = (
        df['invoice_billNumber'].notnull() & (df['invoice_billNumber'] != '') &
        df['invoice_billDate'].notnull() &
        df['days_to_close'].notnull() & (df['days_to_close'] >= 0)
    )
    df_closed = df[mask].copy()
    print(f"Closed deals count for velocity training: {len(df_closed)} rows.")

    vel_model = None
    if len(df_closed) > 0:
        upper = df_closed['days_to_close'].quantile(0.95)
        df_closed['days_to_close_capped'] = df_closed['days_to_close'].clip(upper=upper)
        print(f"Outlier capping limit (95th percentile): {upper:.1f} days.")

        features_vel = ['industry_encoded', 'feeband_encoded', 'bd_encoded',
                         'alloc_month', 'alloc_quarter', 'franchisee_freq',
                         'company_freq', 'teamlead_encoded', 'client_tenure_days']
        X_vel = df_closed[features_vel]
        y_vel = df_closed['days_to_close_capped']

        # ALWAYS compute and print the baseline next to the model score.
        # This one habit is what caught the original problem - a model
        # that "trains without error" can still be worse than a dumb
        # heuristic, and accuracy/MAE numbers alone won't tell you that.
        baseline_pred = df_closed.groupby(['industry_encoded', 'feeband_encoded'])['days_to_close_capped'].transform('median')
        baseline_mae = metrics.mean_absolute_error(y_vel, baseline_pred)
        print(f"Baseline (Industry x FeeBand median) MAE: {baseline_mae:.1f} days")

        X_train, X_test, y_train, y_test = train_test_split(X_vel, y_vel, test_size=0.2, random_state=42)
        vel_model = HistGradientBoostingRegressor(loss='absolute_error', max_iter=300, random_state=42)
        vel_model.fit(X_train, y_train)

        y_pred = vel_model.predict(X_test)
        mae = metrics.mean_absolute_error(y_test, y_pred)
        r2 = metrics.r2_score(y_test, y_pred)
        verdict = "beats" if mae < baseline_mae else "WORSE THAN"
        print(f"BD Velocity Model MAE: {mae:.2f} days (R2: {r2:.3f}) -> {verdict} baseline")
    else:
        print("Not enough closed deals to train velocity model.")

    # ------------------------------------------------------------------
    # MODEL 2: LEAKAGE PROPENSITY & PAYMENT PENDING (classification)
    #
    # Two changes from v1:
    #  1. class_weight='balanced' - both targets are imbalanced (leakage
    #     is ~79/21, pending is ~73/27). Without this, RandomForest can
    #     get a deceptively "good" accuracy just by leaning toward the
    #     majority class. Balancing forces it to actually learn the
    #     minority class instead of ignoring it.
    #  2. We score on ROC-AUC / precision / recall / F1, not just
    #     accuracy. Accuracy is the metric that made the old leakage
    #     model LOOK fine (78.6%) while being useless (majority-class
    #     baseline was 79.1%). ROC-AUC measures how well the model RANKS
    #     risky vs. safe records regardless of class balance, so it
    #     can't be gamed the same way.
    # ------------------------------------------------------------------
    print("\n--- Model 2: Leakage & Payment Pending ---")
    df['never_billed'] = (
        (df['enquiryStatus'] == 'closed') &
        (df['invoice_billNumber'].isnull() | (df['invoice_billNumber'] == ''))
    ).astype(int)

    df['billed_payment_pending'] = (
        df['invoice_billNumber'].notnull() & (df['invoice_billNumber'] != '') &
        (df['invoice_amountReceived'] < df['invoice_grossRevenue'] - 1)
    ).astype(int)

    leak_balance = df['never_billed'].value_counts(normalize=True)
    pend_balance = df['billed_payment_pending'].value_counts(normalize=True)
    print(f"never_billed class balance: {df['never_billed'].value_counts().to_dict()} "
          f"(majority-class baseline accuracy: {leak_balance.max()*100:.2f}%)")
    print(f"billed_payment_pending class balance: {df['billed_payment_pending'].value_counts().to_dict()} "
          f"(majority-class baseline accuracy: {pend_balance.max()*100:.2f}%)")

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    # 2A. Leakage classifier
    features_leak = ['industry_encoded', 'feeband_encoded', 'bd_encoded',
                      'alloc_month', 'alloc_quarter', 'franchisee_freq',
                      'company_freq', 'teamlead_encoded', 'enquiry_age_days', 'client_tenure_days']
    X_leak = df[features_leak]
    y_leak = df['never_billed']
    X_train_l, X_test_l, y_train_l, y_test_l = train_test_split(
        X_leak, y_leak, test_size=0.2, random_state=42, stratify=y_leak)

    leakage_model = RandomForestClassifier(
        n_estimators=300, min_samples_leaf=5, random_state=42,
        class_weight='balanced', n_jobs=-1)
    leakage_model.fit(X_train_l, y_train_l)
    pred_l = leakage_model.predict(X_test_l)
    proba_l = leakage_model.predict_proba(X_test_l)[:, 1]
    acc_l = metrics.accuracy_score(y_test_l, pred_l)
    prec_l, rec_l, f1_l, _ = metrics.precision_recall_fscore_support(y_test_l, pred_l, average='binary', zero_division=0)
    auc_l = metrics.roc_auc_score(y_test_l, proba_l)
    cv_auc_l = cross_val_score(leakage_model, X_leak, y_leak, cv=cv, scoring='roc_auc')
    verdict_l = "beats" if acc_l > leak_balance.max() else "WORSE THAN"
    print(f"Leakage Classifier: accuracy {acc_l*100:.2f}% -> {verdict_l} majority baseline "
          f"| precision {prec_l:.3f} recall {rec_l:.3f} f1 {f1_l:.3f} "
          f"| ROC-AUC {auc_l:.3f} (5-fold CV: {cv_auc_l.mean():.3f} +/- {cv_auc_l.std():.3f})")

    # 2B. Payment pending classifier
    features_pend = ['industry_encoded', 'feeband_encoded', 'bd_encoded',
                      'franchisee_freq', 'company_freq', 'teamlead_encoded',
                      'days_since_invoice', 'client_tenure_days']
    X_pend = df[features_pend]
    y_pend = df['billed_payment_pending']
    X_train_p, X_test_p, y_train_p, y_test_p = train_test_split(
        X_pend, y_pend, test_size=0.2, random_state=42, stratify=y_pend)

    pending_model = RandomForestClassifier(
        n_estimators=300, min_samples_leaf=5, random_state=42,
        class_weight='balanced', n_jobs=-1)
    pending_model.fit(X_train_p, y_train_p)
    pred_p = pending_model.predict(X_test_p)
    proba_p = pending_model.predict_proba(X_test_p)[:, 1]
    acc_p = metrics.accuracy_score(y_test_p, pred_p)
    prec_p, rec_p, f1_p, _ = metrics.precision_recall_fscore_support(y_test_p, pred_p, average='binary', zero_division=0)
    auc_p = metrics.roc_auc_score(y_test_p, proba_p)
    cv_auc_p = cross_val_score(pending_model, X_pend, y_pend, cv=cv, scoring='roc_auc')
    verdict_p = "beats" if acc_p > pend_balance.max() else "WORSE THAN"
    print(f"Payment Pending Classifier: accuracy {acc_p*100:.2f}% -> {verdict_p} majority baseline "
          f"| precision {prec_p:.3f} recall {rec_p:.3f} f1 {f1_p:.3f} "
          f"| ROC-AUC {auc_p:.3f} (5-fold CV: {cv_auc_p.mean():.3f} +/- {cv_auc_p.std():.3f})")

    # ------------------------------------------------------------------
    # EXPORT
    # ------------------------------------------------------------------
    os.makedirs('models', exist_ok=True)
    if vel_model is not None:
        joblib.dump(vel_model, 'models/velocity_model.joblib')
    joblib.dump(leakage_model, 'models/leakage_model.joblib')
    joblib.dump(pending_model, 'models/payment_pending_model.joblib')
    joblib.dump(le_industry, 'models/le_industry.joblib')
    joblib.dump(le_feeband, 'models/le_feeband.joblib')
    joblib.dump(le_bd, 'models/le_bd.joblib')
    joblib.dump(le_tl, 'models/le_teamlead.joblib')
    # Save the frequency maps too - at inference time you need to look up
    # a franchisee/company's frequency the same way you did in training.
    joblib.dump(df.set_index('franchiseeName')['franchisee_freq'].to_dict(), 'models/franchisee_freq_map.joblib')
    joblib.dump(df.set_index('companyName')['company_freq'].to_dict(), 'models/company_freq_map.joblib')

    print("\nAll models, encoders, and frequency maps serialized to backend/models/")


if __name__ == '__main__':
    main()
