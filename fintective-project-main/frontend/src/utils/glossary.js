/**
 * Fintective Plain-Language Financial Glossary
 * Translates technical finance & CRM jargon into plain, actionable words.
 */

export const GLOSSARY = {
  // Core Revenue & Margin
  revenue: {
    term: 'Revenue',
    plainName: 'Company Revenue',
    meaning: 'The company share (25% to 30%) retained by Saarthi corporate after partner payout.',
    evaluation: 'Higher is better. Drives company cash flow and expansion.',
    action: 'Increase placement volume and enterprise retainers.'
  },
  grossBilling: {
    term: 'Gross Billing',
    plainName: 'Total Invoiced Value',
    meaning: 'Total invoice amount billed to clients before partner payout and taxes.',
    evaluation: 'Measures total business scale and client transaction volume.',
    action: 'Track with BD and TL pipeline closure pace.'
  },
  ourShare: {
    term: 'Our Share',
    plainName: 'What We Earned',
    meaning: 'Corporate retained margin (typically 25% to 30% of gross billing).',
    evaluation: 'Our net operational top-line.',
    action: 'Ensure standard franchise split agreements are honored.'
  },
  partnerShare: {
    term: 'Partner Share',
    plainName: 'Franchisee Payout',
    meaning: 'The 70% to 75% recruitment share paid out to executing franchise partners.',
    evaluation: 'Fair incentive alignment that drives partner recruitment velocity.',
    action: 'Disburse accurately upon client invoice clearance.'
  },

  // P&L and Profitability
  profitability: {
    term: 'Cost of Performance',
    plainName: 'Profitability',
    meaning: 'What each person or branch earned for the company minus what they cost to support.',
    evaluation: 'Positive means self-sustaining value creation; negative means costs exceed earnings.',
    action: 'Review resource allocation and placement closure ratios.'
  },
  whatWeKept: {
    term: 'Net Contribution',
    plainName: 'What We Kept',
    meaning: 'Our share minus base salary, pro-rata overhead allocation, and refunds (credit notes).',
    evaluation: 'True net profit generated after all direct and operational expenses.',
    action: 'Aim for positive contribution across all BD and TL teams.'
  },
  overheadAllocation: {
    term: 'Overhead Allocation',
    plainName: 'Shared Office & Systems Cost',
    meaning: 'Pro-rata share of rent, software licenses, utilities, and management support.',
    evaluation: 'Distributed evenly per active team member to reflect true company cost.',
    action: 'Keep corporate overhead lean relative to gross billing.'
  },

  // Cash & Runway
  runway: {
    term: 'Runway',
    plainName: 'Months of Cash Left',
    meaning: 'How many months our current cash balance will cover at current monthly net spending.',
    evaluation: 'Over 6 months is safe; 3 to 6 months needs watching; under 3 months requires immediate action.',
    action: 'Accelerate collection of pending invoices and curtail non-essential expenses.'
  },
  burn: {
    term: 'Burn Rate',
    plainName: 'Monthly Net Spending',
    meaning: 'Monthly cash outflows minus monthly company cash collections.',
    evaluation: 'Zero or negative spending means the business is self-sustaining from revenue.',
    action: 'Keep net spending below zero whenever possible.'
  },

  // Attention Items
  ghostDeals: {
    term: 'Revenue Leakage / Ghost Deals',
    plainName: 'Placements Done but Not Billed',
    meaning: 'Candidates placed with a bill number assigned where client invoices lack a recorded bill date.',
    evaluation: 'Risk of uncollected revenue due to billing oversight.',
    action: 'Verify candidate joining date and issue the finalized client invoice.'
  },
  doubleEnteredExpenses: {
    term: 'Duplicate Expenses',
    plainName: 'Possible Double-Entered Expenses',
    meaning: 'Two or more expense entries with identical date, vendor, and amount.',
    evaluation: 'Risk of paying vendors twice or overstating operating costs.',
    action: 'Audit against bank statements and remove accidental duplicates.'
  },
  unpaidOver30d: {
    term: 'Aging Receivables',
    plainName: 'Unpaid Invoices Over 30 Days',
    meaning: 'Invoices issued over 30 days ago that have not been collected from the client.',
    evaluation: 'Higher aging increases risk of bad debt and restricts working capital.',
    action: 'Contact client finance team for remittance schedule.'
  },

  // Deal Pipeline & Velocity
  velocity: {
    term: 'Velocity',
    plainName: 'How Fast Deals Close',
    meaning: 'Average days elapsed from lead intake to closed candidate placement.',
    evaluation: 'Fewer days means agile candidate matching and faster cash intake.',
    action: 'Streamline client interview stages and candidate document checks.'
  },
  winRate: {
    term: 'Win Rate',
    plainName: 'Closure Rate',
    meaning: 'Percentage of resolved enquiries that resulted in a closed placement: Closed ÷ (Closed + Cancelled).',
    evaluation: 'Shows conversion efficiency; ignores ongoing active pipeline.',
    action: 'Focus on high-conviction client mandates and candidate screening.'
  },
  creditNotes: {
    term: 'Credit Notes',
    plainName: 'Refunds & Adjustments',
    meaning: 'Invoices reversed or refunded due to candidate probation dropout or scope changes.',
    evaluation: 'Deducts directly from company gross margin.',
    action: 'Enforce 90-day replacement clauses with clients.'
  },
  stalePipeline: {
    term: 'Stale Pipeline',
    plainName: 'Stale Leads (>365 Days)',
    meaning: 'Enquiries opened over 12 months ago that remain unclosed and unbilled.',
    evaluation: 'Distorts pipeline forecasts and wastes follow-up time.',
    action: 'Archive or officially cancel dead client mandates.'
  },

  // Growth & Projections
  projection: {
    term: 'Projection',
    plainName: 'Year-End Forecast',
    meaning: 'Expected total placements and revenue by March 31 based on recent 3-month pace.',
    evaluation: 'Baseline trajectory assuming consistent recruiter capacity.',
    action: 'Compare against quota to see if pace needs accelerating.'
  },
  pace: {
    term: 'Current Pace',
    plainName: 'Monthly Run Rate',
    meaning: 'Average deals closed per month in the recent period.',
    evaluation: 'Multiply by remaining months in the financial year to find year-end finish.',
    action: 'Increase weekly interview volume if pace is behind quota.'
  }
};

/**
 * Helper to fetch glossary entry by key
 */
export function getGlossaryItem(key) {
  if (!key) return null;
  return GLOSSARY[key] || {
    term: key,
    plainName: key,
    meaning: 'Financial and operational metric.',
    evaluation: '',
    action: ''
  };
}
