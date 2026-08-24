# Saarthi Finance — Verified Formulas by Tab

Every formula below is built on `enquiries` + `invoice` (live DB tables), never
`master_final_pipeline.csv` or `invoice_backup`/`tds_dues`/`franchisePayments`
(confirmed legacy/empty). All numbers referenced here were checked against
your actual data dumps in this session.

---

## Base building block — use this everywhere

Pre-aggregate `invoice` by `enquiry_id` before joining anything to `enquiries`.
This is required because 20 enquiries have 2+ invoice rows (one has 4),
and because 297 `billNumber`s are duplicated in `invoice` (85 of those are
genuine different-company collisions — see `invoice_dup_categorized.csv`).
Until those 85 are resolved with your DB admin, exclude them explicitly so
they don't silently inflate revenue.

```sql
invoice_agg AS (
  SELECT
    enquiry_id,
    SUM(serviceCharges)                                AS gross_revenue,
    SUM(serviceCharges - COALESCE(franchiseeShare,0))  AS net_revenue,
    SUM(COALESCE(amountReceived,0))                    AS collected,
    MAX(billNumber)                                     AS billNumber,
    MAX(billDate)                                       AS billDate,
    MAX(financialYear)                                  AS financialYear
  FROM invoice
  WHERE billNumber IS NOT NULL AND billNumber != ''
    AND billDate IS NOT NULL
    AND billNumber NOT IN (SELECT billNumber FROM invoice_dup_collisions) -- 85 flagged bill numbers, resolve manually first
  GROUP BY enquiry_id
)
```

---

## 1. Dashboard — Cash Balance / Burn / Runway

```sql
-- Cash balance
SELECT
  (SELECT COALESCE(SUM(gross_revenue),0) FROM invoice_agg ia
     JOIN invoice i ON i.enquiry_id = ia.enquiry_id AND i.billNumber = ia.billNumber
     WHERE ia.billDate <= :asOf)
  - (SELECT COALESCE(SUM(amount),0) FROM expenditure WHERE billDate <= :asOf AND is_deleted = 0)
AS cash_balance;

-- Moving avg monthly burn (3-month)
SELECT AVG(monthly_expense) AS burn FROM (
  SELECT DATE_FORMAT(billDate,'%Y-%m') AS month, SUM(amount) AS monthly_expense
  FROM expenditure
  WHERE billDate >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH) AND is_deleted = 0
  GROUP BY month
) x;

-- Runway (months) = cash_balance / burn, show "Infinite" ONLY if burn <= 0
```

Point every card that shows cash balance at the *same* query. The earlier
bug (badge showing −₹0.5L, card showing +₹42.87Cr) was two different
queries computing the same number — never let that happen again.

---

## 2. BD Performance

```sql
SELECT
  e.bdMemberName,
  SUM(ia.gross_revenue)  AS gross,
  SUM(ia.net_revenue)    AS net_verified,
  SUM(CASE WHEN i_null.franchiseeShare IS NULL THEN ia.gross_revenue ELSE 0 END) AS unverified_amount
FROM enquiries e
JOIN invoice_agg ia ON ia.enquiry_id = e.id
LEFT JOIN invoice i_null ON i_null.enquiry_id = e.id AND i_null.franchiseeShare IS NULL
WHERE TRIM(LOWER(e.bdMemberName)) NOT IN ('head office', 'head  - office')  -- note DOUBLE space + trailing space variant confirmed in live data
  AND ia.billDate BETWEEN :start AND :end
GROUP BY e.bdMemberName;
```

Show `unverified_amount` as its own column — don't fold NULL-`franchiseeShare`
deals silently into net revenue (557 of 7,321 closed invoice rows have this).

---

## 3. TL Performance

Same shape as BD Performance, swap `bdMemberName` → `teamLeaderName`.
Note: `teamLeaderName` had **zero** casing/Head-Office variants in the data
(unlike `bdMemberName`), so the exclusion filter is simpler here — just
confirm the exact "Head Office" string used on this field before filtering.

---

## 4. Franchisees

```sql
-- Franchise inflow
SELECT COALESCE(SUM(ia.gross_revenue),0) AS franchise_inflow
FROM invoice_agg ia
JOIN enquiries e ON e.id = ia.enquiry_id
WHERE TRIM(LOWER(e.franchiseeName)) = :franchisee_name_normalized;
```

Normalize `franchiseeName` before joining/filtering — two confirmed
whitespace-only duplicate pairs in live data (`"Sheetal Sarda"` and
`"Shivani Mahajan"` each have a trailing-space variant). Use
`TRIM(LOWER(...))` on both sides of any franchisee-name comparison, not
just at display time.

**Franchisee Hub royalty/ROI card** — until `expenditure` gets a
`franchisee_id` column, there is no way to allocate `HQ Support Cost`
per location. Show **"Not tracked per-location"**, never `₹0` — a `₹0`
cost is what was producing "Infinite ROI" before.

---

## 5. Runway & ROI Tracker

**Company-wide P&L / Disbursed Outflow** — `incentive_payments` has
exactly 1 row, ever (confirmed). Don't join against it for "commission
paid." Use *accrued* commission from the rule table instead:

```sql
SELECT
  ia.enquiry_id,
  ia.gross_revenue * 0.25 * r_bd.percentage AS bd_commission_accrued,
  ia.gross_revenue * 0.25 * r_tl.percentage AS tl_commission_accrued
FROM invoice_agg ia
CROSS JOIN (SELECT percentage FROM incentive_rules WHERE role='BD' AND is_active=1) r_bd
CROSS JOIN (SELECT percentage FROM incentive_rules WHERE role='TL' AND is_active=1) r_tl
WHERE ia.billDate BETWEEN :start AND :end;
```

**Potential Loss (cancelled / internally_closed)** — confirmed real enum
values, exact counts: `cancelled` = 1,758, `internally_closed` = 451.

```sql
SELECT SUM(placementFees) AS potential_loss  -- NOT bill_amount: bill_amount is populated
FROM enquiries                                -- even on cancelled rows (quoted estimate, not
WHERE enquiryStatus IN ('cancelled','internally_closed')  -- a real bill — only 9 of 2,209 such
  AND dateOfAllocation BETWEEN :start AND :end;            -- rows have an actual bill_no)
```

**Orphaned closed enquiries** — 2,498 of 9,348 `closed` enquiries have no
matching `invoice` row at all. Decide: exclude entirely (current default
behavior of the base query above) or surface separately:

```sql
SELECT e.id, e.companyName, e.candidateName, e.placementFees, e.dateOfAllocation
FROM enquiries e
LEFT JOIN invoice i ON i.enquiry_id = e.id
WHERE e.enquiryStatus = 'closed' AND i.id IS NULL;
```

---

## 6. Cash Outflow / MoM Pivot

```sql
SELECT DATE_FORMAT(billDate,'%Y-%m') AS month,
  SUM(CASE WHEN expenses = 'Advertisement' THEN amount ELSE 0 END) AS marketing,
  SUM(CASE WHEN expenses = 'Job Portal' THEN amount ELSE 0 END)    AS job_portal_cost
FROM expenditure
WHERE billDate BETWEEN :start AND :end AND is_deleted = 0
GROUP BY month;
```

**Salaries**: not in `expenditure` — they're formula-driven in
`salary_data`/`salary_deduction` (percent-of-CTC rules), not a
transactional log. No monthly actual-spend table exists for this unless
payroll runs are logged elsewhere. Leave this card blank/"Not available"
rather than showing `₹0`.

**BD/TL commission** in this pivot: use the accrual formula from
section 5, not a lookup against `expenditure`.

---

## 7. Reports

Build every report off `invoice_agg` + `enquiries`, same base block as
above. No report should ever read `master_final_pipeline.csv` — use it
only to spot-check that a report's totals look directionally sane.

---

## Known data issues to resolve before trusting totals fully

| Issue | Scope | File |
|---|---|---|
| Duplicate enquiry rows (same company+candidate+bill_no) | 162 rows / 76 groups | `enquiries_duplicate_flagged.csv` |
| Duplicate invoice bill numbers — exact re-entries | 181 bill numbers | `invoice_dup_categorized.csv` |
| Duplicate invoice bill numbers — genuine different-company collisions | 85 bill numbers | `invoice_dup_collisions_detail.csv` |
| Duplicate invoice bill numbers — same deal, revised amount | 15 bill numbers | `invoice_dup_categorized.csv` |
| Duplicate invoice bill numbers — same company, different candidate | 16 bill numbers | `invoice_dup_categorized.csv` |
| Closed enquiries with no invoice at all | 2,498 rows | query in section 5 |

The 85 "different_company_collision" bill numbers are the most urgent —
two unrelated clients sharing one bill number is a real numbering-system
bug, not a data-entry typo, and needs your DB admin to confirm whether
the bill-number sequence generator has a collision/reset bug.
