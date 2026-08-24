// utils/invoiceHelpers.js

export function generateBillNumber() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `BILL-${yyyy}${mm}${dd}-${rand}`;
}

export function calculateServiceCharges(salaryOffer, serviceChargePercent) {
  const offer = parseFloat(salaryOffer || 0);
  const percent = parseFloat(serviceChargePercent || 0);
  return Math.round((offer * percent) / 100);
}

export function calculateGST(serviceCharges, isFromMaharashtra) {
  const gstRate = 0.18;
  const totalGst = Math.round(serviceCharges * gstRate);

  if (isFromMaharashtra?.toLowerCase() === "yes") {
    const half = Math.round(totalGst / 2);
    return { cgst: half, sgst: half, igst: 0, totalGst };
  } else {
    return { cgst: 0, sgst: 0, igst: totalGst, totalGst };
  }
}

export function calculateDueDate(billDate, creditPeriod) {
  const date = new Date(billDate);
  const days = parseInt(creditPeriod || 0);

  if (isNaN(date.getTime()) || isNaN(days)) return null;

  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

export function formatDateForMySQL(dateStr) {
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date.toISOString().split("T")[0];
}

// --- SHARE SPLIT (single source of truth for franchiseeShare / ourShare) ---
// Confirmed business rule: 60% franchisee / 40% company for invoices before
// the April 2026 rate change, 75% franchisee / 25% company from April 2026
// onward. Effective date is the invoice's billDate (falls back to today if
// billDate is missing, so brand-new invoices always get the current rate).
// NOTE: this does NOT touch the pre-existing ~56.25%/18.75% rows already in
// the DB for the pre-April period — those are known-bad historical data,
// explicitly left alone for now per product decision; this function only
// governs invoices computed/recomputed going forward.
const RATE_CHANGE_DATE = new Date("2026-04-01T00:00:00Z");

export function getShareSplit(billDate) {
  const effectiveDate = billDate ? new Date(billDate) : new Date();
  const isPreApril2026 = !isNaN(effectiveDate.getTime()) && effectiveDate < RATE_CHANGE_DATE;
  return isPreApril2026
    ? { franchiseePct: 0.6, companyPct: 0.4 }
    : { franchiseePct: 0.75, companyPct: 0.25 };
}

// Computes franchiseeShare and ourShare from serviceCharges, respecting the
// info-status overrides (cancelled/reversed/legal = 0 company share, PP =
// half company share) that already existed in the create-invoice logic.
// franchiseeShare is always the full franchisee percentage regardless of
// info status — only the company (`ourShare`) side varies by status.
export function calculateShares(serviceCharges, info, billDate) {
  const sc = Number.parseFloat(serviceCharges);
  if (!sc || Number.isNaN(sc)) {
    return { franchiseeShare: 0, ourShare: 0 };
  }

  const { franchiseePct, companyPct } = getShareSplit(billDate);
  const franchiseeShare = Math.round(sc * franchiseePct);

  let ourShare;
  if (info === "CN" || info === "RV" || info === "LEGAL-CN" || info === "LEGAL") {
    ourShare = 0;
  } else if (info === "PP") {
    ourShare = Math.round(sc * companyPct * 0.5);
  } else {
    // "0", "PR", "R", and any other/default status
    ourShare = Math.round(sc * companyPct);
  }

  return { franchiseeShare, ourShare };
}
