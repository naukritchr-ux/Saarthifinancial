/**
 * Fintective Central Financial Configuration & Share Split Standards
 * Single source of truth for revenue splits, standard commissions, and share calculations.
 */

// Saarthi Standard Franchisee Agreement Model:
// Franchisee partners receive 70% - 75% of recruitment billing.
// The corporate company retains 25% - 30% gross margin.
export const DEFAULT_COMPANY_SHARE_RATE = 0.25;      // 25% company retained
export const DEFAULT_FRANCHISEE_SHARE_RATE = 0.75;   // 75% partner share
export const SENIOR_COMPANY_SHARE_RATE = 0.25;       // Standard agreement: 25% company retained
export const SENIOR_FRANCHISEE_SHARE_RATE = 0.75;    // Standard agreement: 75% partner share

// BD Commission Standard: 20% of Company Retained Margin (equivalent to ~5% of Gross Billing)
export const DEFAULT_BD_COMMISSION_OF_COMPANY_POOL = 0.20; // 20% of company pool (5% of gross)
export const DEFAULT_TL_COMMISSION_OF_COMPANY_POOL = 0.12; // 12% of company pool (3% of gross)

// Corporate Tax Estimate Standard (Money Box Step 4)
export const DEFAULT_ESTIMATED_TAX_RATE = 0.25; // 25% corporate tax estimate

/**
 * Calculates real revenue shares for any transaction.
 * Prioritizes verified database fields (rShare, franchiseeShare).
 * Falls back to standard 25% Our Share / 75% Franchisee Share.
 */
export function getTransactionShares(tx = {}) {
  const gross = Number(tx.amount || tx.totalBillAmt || tx.serviceAmt || 0);

  // 1. If explicit verified database fields are present
  const hasRealRShare = tx.rShare !== undefined && tx.rShare !== null;
  const hasRealFShare = tx.franchiseeShare !== undefined && tx.franchiseeShare !== null;

  if (hasRealRShare || hasRealFShare) {
    const rShare = hasRealRShare ? Number(tx.rShare) : Math.round(gross * DEFAULT_COMPANY_SHARE_RATE);
    const franchiseeShare = hasRealFShare ? Number(tx.franchiseeShare) : Math.max(0, gross - rShare);
    return {
      gross,
      rShare,
      franchiseeShare,
      isVerified: true,
      source: 'live_database_record'
    };
  }

  // 2. Standard agreement ratio: 25% company / 75% franchisee
  const rShare = Math.round(gross * DEFAULT_COMPANY_SHARE_RATE);
  const franchiseeShare = gross - rShare;

  return {
    gross,
    rShare,
    franchiseeShare,
    isVerified: false,
    source: `standard_agreement_config (${Math.round(franchiseeRate * 100)}-${Math.round(companyRate * 100)})`
  };
}
