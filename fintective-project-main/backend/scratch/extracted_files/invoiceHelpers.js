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
// Business rule:
// - Franchisees who have completed 3 years (>= 3 years tenure): 70% franchisee / 30% company (70 - 30).
// - Franchisees who have NOT completed 3 years (< 3 years tenure): 75% franchisee / 25% company (75 - 25).

export function getShareSplit(billDate, onboardingDate = null, yearsCompleted = null) {
  if (yearsCompleted !== null && yearsCompleted !== undefined) {
    return Number(yearsCompleted) >= 3
      ? { franchiseePct: 0.70, companyPct: 0.30 }
      : { franchiseePct: 0.75, companyPct: 0.25 };
  }

  const effectiveDate = billDate ? new Date(billDate) : new Date();
  if (onboardingDate) {
    const startDate = new Date(onboardingDate);
    if (!isNaN(startDate.getTime()) && !isNaN(effectiveDate.getTime())) {
      let years = effectiveDate.getFullYear() - startDate.getFullYear();
      const monthDiff = effectiveDate.getMonth() - startDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && effectiveDate.getDate() < startDate.getDate())) {
        years--;
      }
      return years >= 3
        ? { franchiseePct: 0.70, companyPct: 0.30 }
        : { franchiseePct: 0.75, companyPct: 0.25 };
    }
  }

  return { franchiseePct: 0.75, companyPct: 0.25 };
}

// Computes franchiseeShare and ourShare from serviceCharges, respecting the
// info-status overrides (cancelled/reversed/legal = 0 company share, PP =
// half company share) and tenure (70-30 for >= 3 years, 75-25 for < 3 years).
export function calculateShares(
  serviceCharges,
  info,
  billDate,
  isManualOverride = false,
  manualFranchiseeShare = null,
  manualOurShare = null,
  onboardingDate = null,
  yearsCompleted = null
) {
  if (isManualOverride) {
    return {
      franchiseeShare: manualFranchiseeShare !== null ? Math.round(Number(manualFranchiseeShare)) : 0,
      ourShare: manualOurShare !== null ? Math.round(Number(manualOurShare)) : 0
    };
  }

  const sc = Number.parseFloat(serviceCharges);
  if (!sc || Number.isNaN(sc)) {
    return { franchiseeShare: 0, ourShare: 0 };
  }

  const { franchiseePct, companyPct } = getShareSplit(billDate, onboardingDate, yearsCompleted);
  const franchiseeShare = Math.round(sc * franchiseePct);

  let ourShare;
  if (info === "CN" || info === "RV" || info === "LEGAL-CN" || info === "LEGAL") {
    ourShare = 0;
  } else if (info === "PP") {
    ourShare = Math.round(sc * companyPct * 0.5);
  } else {
    // "0", "PR", "R", and any other/default status
    ourShare = Math.round(sc - franchiseeShare);
  }

  return { franchiseeShare, ourShare };
}
