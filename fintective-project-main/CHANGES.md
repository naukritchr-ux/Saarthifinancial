# Fintective Single Source of Truth & Financial Unification Audit

This document records the exact changes, before-and-after formulas, accounting decisions, and database view specifications implemented across Fintective (`fintective-project-main`).

---

## 1. Core Accounting Formulas (Before vs After)

| Metric | Before | After (Unified Single Source of Truth) | Rationale |
| :--- | :--- | :--- | :--- |
| **Gross Billed (Incl. GST)** | Direct sum of `enquiries.bill_amount` or `invoice.totalBillAmt` | `SUM(totalBillAmt)` from `v_invoice_clean` (or `rev_ex_gst * 1.18`) | Prevents multiplying totals across duplicate invoices or colliding bills. |
| **Revenue (Ex-GST)** | Mixed: sometimes `serviceCharges`, sometimes `totalBillAmt / 1.18`, sometimes `bill_amount` without GST stripping | `SUM(rev_ex_gst)` over `v_invoice_clean` where `is_revenue = 1` (`info IN ('R', 'PR', 'O')`) | Excludes credit notes (`CN`), cancellations (`C`), reversals (`RV`), and legal holds from recognized revenue. |
| **Company Income (Our Share)** | Hardcoded `0.25 * gross`, or `0.4375`, or raw sum including cancelled rows | Exact `SUM(ourShare)` from `v_invoice_clean` across all clean rows. Missing rows fall back to tenure split (30% for $\ge 3$ yrs, 25% for $< 3$ yrs) | Our share is company revenue. Cancelled rows retain their recorded company share if booked, but royalty and pass-throughs are never added. |
| **Franchisee Share Split** | Static 25-75 ratio regardless of partner tenure | **70-30** for franchisees with $\ge 3$ years completed tenure; **75-25** for franchisees with $< 3$ years completed tenure | Honors the Saarthi partnership agreement tiering. |
| **Royalty Expense** | Injected as synthetic operating expense transaction (`fran-royalty-payout-inv-` ₹30k–₹70k) | **Pass-Through**: Never added to operating expenses in transaction logs or waterfall calculations | Royalty / franchisee payout is deducted at the top to arrive at company margin (`ourShare`); adding it again as an expense caused double-counting. |
| **Unallocated Margin** | Ignored or lumped into profit | `MAX(0, revenue - our_share_rev - franchisee_share_rev)` | Explicitly tracks unassigned margin on recognized revenue rows without distorting operating profit. |
| **Operating Expenses** | Included fake job portal subscriptions (Wipro, TCS, Cognizant) and ₹65k fallbacks | Real `expenditure` table rows (where `is_deleted = 0`). Excludes salary categories to prevent overlap with payroll. | Removes synthetic demo seeds and prevents double-counting salaries. |
| **Net Surplus / Profit** | Arbitrary or `revenue - expenses` | `our_share - operating_expenses - salaries` | Correct corporate waterfall: profit begins from company retained margin, not gross pass-through billing. |
| **Income Tax** | Not tracked or hardcoded flat numbers | `0.25 * MAX(0, net)` (25% corporate tax estimate) | If net is negative, tax is ₹0.00. |
| **Net Surplus (Post-Tax)** | `net` | `net - tax` | Realistic bottom-line surplus for reinvestment and reserves. |
| **Profit Margin %** | `(profit / gross_revenue) * 100` | `(surplus / our_share) * 100` | Margins calculated on company income, not gross billing pass-through. |

---

## 2. Views & Database Schema Specification

### A. View: `v_colliding_bills`
Identifies invoice numbers reused across multiple distinct corporate clients (prevents billing collisions):
```sql
CREATE OR REPLACE VIEW v_colliding_bills AS
SELECT bill_no FROM enquiries
WHERE bill_no IS NOT NULL AND TRIM(bill_no) <> ''
GROUP BY bill_no HAVING COUNT(DISTINCT LOWER(TRIM(companyName))) > 1;
```

### B. View: `v_invoice_clean`
Single clean source of truth for all invoice records:
```sql
CREATE OR REPLACE VIEW v_invoice_clean AS
SELECT i.*,
  (i.info IS NULL OR i.info NOT IN ('CN','LEGAL-CN','LEGAL','RV')) AS is_revenue,
  COALESCE(NULLIF(i.serviceCharges,0), ROUND(i.totalBillAmt/1.18,2), 0) AS rev_ex_gst,
  CASE WHEN i.billDate IS NULL THEN 'N/A'
       WHEN MONTH(i.billDate) >= 4 THEN CONCAT(YEAR(i.billDate),'-',YEAR(i.billDate)+1)
       ELSE CONCAT(YEAR(i.billDate)-1,'-',YEAR(i.billDate)) END AS fy
FROM invoice i
WHERE i.billNumber IS NOT NULL AND i.billNumber <> ''
  AND i.billNumber NOT IN (SELECT bill_no FROM v_colliding_bills);
```

### C. Table: `growth_money_box_inputs`
Persists manual manager inputs (salary, expense, net, surplus) scoped per BD/TL/Franchise/FY:
```sql
CREATE TABLE IF NOT EXISTS growth_money_box_inputs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bd VARCHAR(255) NOT NULL DEFAULT 'All',
    tl VARCHAR(255) NOT NULL DEFAULT 'All',
    franchise VARCHAR(255) NOT NULL DEFAULT 'All',
    scope_key VARCHAR(255) NULL,
    fy VARCHAR(50) NOT NULL,
    expense DECIMAL(15, 2) NULL,
    salary DECIMAL(15, 2) NULL,
    net DECIMAL(15, 2) NULL,
    surplus DECIMAL(15, 2) NULL,
    updated_by VARCHAR(100) NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_scope_fy (bd, tl, franchise, fy),
    INDEX idx_scope_key_fy (scope_key, fy)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 3. Endpoints Updated

1. **`GET /api/finance/summary?fy=YYYY-YYYY`**
   - Returns exact metrics for the selected FY: `revenue`, `billed_incl_gst`, `gst`, `our_share`, `unallocated`, `operating_expenses`, `salary`, `net`, `tax`, `surplus`, `margin_pct`, `data_version`, and `as_of`.
2. **`GET /api/transactions`**
   - Reads directly from `v_invoice_clean`.
   - Flags `is_revenue = 0` as `credit_note`.
   - Amount is strictly ex-GST `rev_ex_gst`.
   - Removed synthetic demo portal subscriptions and fake royalty expense generation.
3. **`GET /api/finance/cash-balance`**
   - Recomputed from real accounting transactions: Cash In (`amountReceived`) minus Outflow (`expenditure` where `is_deleted=0` + `franchisePayments`).
4. **`GET /api/finance/moving-avg-burn`**
   - Calculates monthly burn using recognized revenue and real operational expenditure.
5. **`GET /api/franchisees`**
   - Location ledger revenue sourced from `v_invoice_clean`.
   - Franchisee share dynamically computed using tenure: **70%** for $\ge 3$ years, **75%** for $< 3$ years.
6. **`GET /api/bd-agents`**
   - Joins `v_invoice_clean` aggregated by `enquiry_id` before joining `enquiries`, preventing deal counts and revenues from inflating when an enquiry has multiple invoices.
7. **`POST /api/growth/compare` and `/api/growth/financial-performance`**
   - Sourced from `v_invoice_clean`.
   - Applies tenure-based fallback sharing splits (**70-30** for $\ge 3$ years, **75-25** for $< 3$ years).
   - Waterfall calculations powered by `calculate_waterfall`.
8. **`GET /api/sync/ghost-report` & `POST /api/sync/prune`**
   - Audit tool to identify rows present in Fintective but absent from CRM, with safe dry-run by default.

---

## 4. Frontend Enhancements

1. **`FinanceContext.jsx`**:
   - Removed `DEFAULT_TRANSACTIONS` fake seeds.
   - Removed direct `api.sarthi360.in` bypass: all data strictly routes through clean backend views or browser session cache.
   - Dynamic Financial Year derivation (`currentFY`) replaces hardcoded `'2025-2026'`.
   - Added cache age badge tracking (`lastSyncTimestamp`, `timeAgo`).
2. **`financeConfig.js`**:
   - `getTransactionShares` supports tenure-aware evaluation (70-30 for $\ge 3$ years, 75-25 for $< 3$ years).
3. **`Dashboard.jsx`**:
   - Profit margin computed as `profit / our_share * 100`.
   - Colliding bills warning banner shows actual count of colliding bills excluded.
