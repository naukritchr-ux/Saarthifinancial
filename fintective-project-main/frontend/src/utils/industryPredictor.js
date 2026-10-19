import { formatCurrency, formatLakhs } from './formatters';
import { isInvoiced, isCancelled, isProgressed } from './statusMapping';
import { 
  DEFAULT_BD_COMMISSION_OF_COMPANY_POOL, 
  DEFAULT_COMPANY_SHARE_RATE, 
  DEFAULT_FRANCHISEE_SHARE_RATE,
  SENIOR_COMPANY_SHARE_RATE,
  SENIOR_FRANCHISEE_SHARE_RATE
} from '../config/financeConfig';

/**
 * Industry Analytics & Predictive Potential Engine
 * Classifies transactions into standard industry sectors, computes conversion velocity,
 * and models forward-looking predictions based on present potential.
 */

// Color palette for industries
export const INDUSTRY_COLORS = {
  'IT & Software': '#2563eb',
  'Banking & Financial Services (BFSI)': '#10b981',
  'Engineering & Manufacturing': '#0d9488',
  'Human Resources & Staffing': '#8b5cf6',
  'Sales, Marketing & Consulting': '#f59e0b',
  'Healthcare & Pharmaceuticals': '#ec4899',
  'Retail, Fashion & E-commerce': '#f97316',
  'Infrastructure & Real Estate': '#6366f1',
  'Corporate Enterprise Services': '#64748b'
};

/**
 * Robustly classifies an entity/transaction/enquiry into an industry
 */
export function classifyIndustry(item = {}) {
  if (!item) return 'Corporate Enterprise Services';

  // Explicit industry if present and valid
  const explicit = (item.industry || item.category || '').trim();
  if (explicit && explicit.toLowerCase() !== 'recruitment' && explicit.toLowerCase() !== 'recruitment fee' && explicit.toLowerCase() !== 'other' && explicit.toLowerCase() !== 'general') {
    if (INDUSTRY_COLORS[explicit]) return explicit;
    const expLower = explicit.toLowerCase();
    if (expLower.includes('software') || expLower.includes('it ') || expLower.includes('tech')) return 'IT & Software';
    if (expLower.includes('bank') || expLower.includes('fin') || expLower.includes('insur')) return 'Banking & Financial Services (BFSI)';
    if (expLower.includes('manufactur') || expLower.includes('engineer') || expLower.includes('auto')) return 'Engineering & Manufacturing';
    if (expLower.includes('health') || expLower.includes('pharma')) return 'Healthcare & Pharmaceuticals';
    if (expLower.includes('retail') || expLower.includes('fashion') || expLower.includes('e-com')) return 'Retail, Fashion & E-commerce';
    if (expLower.includes('real estate') || expLower.includes('infra')) return 'Infrastructure & Real Estate';
    if (expLower.includes('consult') || expLower.includes('staff') || expLower.includes('hr')) return 'Human Resources & Staffing';
  }

  // Text mining on companyName, positionName, title, description
  const text = [
    item.companyName,
    item.positionName,
    item.title,
    item.client,
    item.description,
    item.postOfCandidate
  ].filter(Boolean).join(' ').toLowerCase();

  if (/(tech|soft|developer|cloud|python|java|php|web|frontend|backend|data analyst|devops|infosys|tcs|wipro|cognizant|orosoft|jayatma|system|solutions|network|coder|qa|tester|architect)/i.test(text)) {
    return 'IT & Software';
  }
  if (/(bank|finan|capital|asset|insurance|mufg|ppfas|ardent|quickinsure|bajaj|icici|hdfc|wealth|audit|tax|accountant|accounts|investment|mutual|credit)/i.test(text)) {
    return 'Banking & Financial Services (BFSI)';
  }
  if (/(steel|machin|aero|vmc|engineer|vefes|jjg|extrusion|pac|manufacturing|chemical|plant|technician|fitter|quality|draughtsman|civil|tool|die|hardware|decvilla)/i.test(text)) {
    return 'Engineering & Manufacturing';
  }
  if (/(fashion|retail|eluno|apparel|textile|garment|store|merchandiser|ecommerce|consumer goods|fmcg|sales executive)/i.test(text) && /(fashion|eluno|apparel|retail)/i.test(text)) {
    return 'Retail, Fashion & E-commerce';
  }
  if (/(pharma|health|hospital|clinic|doctor|nurse|medical|biotech|chemist|diagnost|lab)/i.test(text)) {
    return 'Healthcare & Pharmaceuticals';
  }
  if (/(real estate|infra|realty|builder|construction|property|embassy|architecture|interior)/i.test(text)) {
    return 'Infrastructure & Real Estate';
  }
  if (/(hr |human resource|recruiter|talent|staffing|talent acquisition|coign|onboarding|manpower)/i.test(text)) {
    return 'Human Resources & Staffing';
  }
  if (/(sales|marketing|business development|bd |account manager|key account|telecaller|counselor|growth)/i.test(text)) {
    return 'Sales, Marketing & Consulting';
  }

  return 'Corporate Enterprise Services';
}

/**
 * Calculates tenure in completed years
 */
export function calculateTenureYears(onboardingDate, referenceDate = new Date()) {
  if (!onboardingDate) return 1.5; // Default standard tenure
  const start = new Date(onboardingDate);
  const ref = new Date(referenceDate);
  if (isNaN(start.getTime()) || isNaN(ref.getTime())) return 1.5;

  let years = ref.getFullYear() - start.getFullYear();
  const mDiff = ref.getMonth() - start.getMonth();
  if (mDiff < 0 || (mDiff === 0 && ref.getDate() < start.getDate())) {
    years--;
  }
  return Math.max(0, years + (ref.getMonth() - start.getMonth() + 12) % 12 / 12);
}

/**
 * Generates industry analysis and predictive potential forecast
 */
export function analyzeIndustryPotential({
  transactions = [],
  entityType = 'franchisee', // 'franchisee' | 'bd' | 'company'
  entityName = '',
  onboardingDate = null,
  yearsCompleted = null
}) {
  const cleanName = (entityName || '').trim().toLowerCase();
  const firstName = cleanName.split(' ')[0] || '';

  // 1. Filter relevant transactions
  const entityTxs = (Array.isArray(transactions) ? transactions : []).filter(t => {
    if (!t) return false;
    if (!cleanName || cleanName === 'all' || cleanName === 'overall') return true;
    if (entityType === 'franchisee') {
      const fName = (t.franchiseeName || t.owner || '').trim().toLowerCase();
      const fId = (t.franchiseeId || '').trim().toLowerCase();
      return fName === cleanName || (firstName && fName.startsWith(firstName)) || fId === cleanName;
    } else if (entityType === 'bd') {
      const bName = (t.bdAgentName || t.bdMemberName || '').trim().toLowerCase();
      const bId = (t.bdAgentId || '').trim().toLowerCase();
      return bName === cleanName || (firstName && bName.startsWith(firstName)) || bId === cleanName;
    }
    return true;
  });

  // Calculate entity tenure and share rate (70-30 for >=3 years, 75-25 for <3 years)
  const tenure = yearsCompleted !== null && yearsCompleted !== undefined 
    ? Number(yearsCompleted) 
    : calculateTenureYears(onboardingDate);
  const is3YearsCompleted = tenure >= 3.0;
  const franchiseShareRate = is3YearsCompleted ? SENIOR_FRANCHISEE_SHARE_RATE : DEFAULT_FRANCHISEE_SHARE_RATE;
  const companyShareRate = is3YearsCompleted ? SENIOR_COMPANY_SHARE_RATE : DEFAULT_COMPANY_SHARE_RATE;
  const bdCommissionRate = DEFAULT_BD_COMMISSION_OF_COMPANY_POOL; // Standard 20% of company pool (5% gross)

  // 2. Aggregate metrics by industry
  const industryMap = {};

  // Initialize standard industries
  Object.keys(INDUSTRY_COLORS).forEach(ind => {
    industryMap[ind] = {
      industry: ind,
      color: INDUSTRY_COLORS[ind],
      totalGross: 0,
      receivedAmount: 0,
      outstandingAmount: 0,
      cancelledAmount: 0,
      closedDeals: 0,
      cancelledDeals: 0,
      activePipeline: 0,
      dealAmounts: [],
      clients: new Set(),
      positions: new Set()
    };
  });

  entityTxs.forEach(t => {
    const ind = classifyIndustry(t);
    if (!industryMap[ind]) {
      industryMap[ind] = {
        industry: ind,
        color: INDUSTRY_COLORS[ind] || '#8b5cf6',
        totalGross: 0,
        receivedAmount: 0,
        outstandingAmount: 0,
        cancelledAmount: 0,
        closedDeals: 0,
        cancelledDeals: 0,
        activePipeline: 0,
        dealAmounts: [],
        clients: new Set(),
        positions: new Set()
      };
    }

    const bucket = industryMap[ind];
    const amt = Math.abs(Number(t.amount || t.serviceAmt || 0));

    if (t.companyName) bucket.clients.add(t.companyName);
    if (t.title || t.positionName) bucket.positions.add(t.title || t.positionName);

    const st = t.status || t.enquiryStatus || '';
    if (isCancelled(st) || t.info === 'CN' || t.info === 'RV' || t.type === 'loss') {
      bucket.cancelledAmount += amt;
      bucket.cancelledDeals++;
    } else if (isProgressed(st) || st.toLowerCase() === 'pending' || (t.amountDue && Number(t.amountDue) > 0)) {
      bucket.outstandingAmount += amt;
      bucket.totalGross += amt;
      bucket.activePipeline++;
      bucket.dealAmounts.push(amt);
    } else {
      // Received / Closed
      bucket.receivedAmount += amt;
      bucket.totalGross += amt;
      bucket.closedDeals++;
      bucket.dealAmounts.push(amt);
    }
  });

  // 3. Format industry breakdown items
  const industryList = Object.values(industryMap)
    .filter(b => b.totalGross > 0 || b.closedDeals > 0 || b.activePipeline > 0 || b.cancelledDeals > 0)
    .map(b => {
      const avgTicket = b.dealAmounts.length > 0 ? b.totalGross / b.dealAmounts.length : 0;
      
      // True Win Rate: closed deals / (closed deals + cancelled deals)
      const totalResolved = b.closedDeals + b.cancelledDeals;
      const winRate = totalResolved > 0 
        ? Number(((b.closedDeals / totalResolved) * 100).toFixed(1)) 
        : null;

      const fShare = Math.round(b.totalGross * franchiseShareRate);
      const cShare = Math.round(b.totalGross * companyShareRate);
      const bdComm = Math.round(b.totalGross * companyShareRate * bdCommissionRate);

      return {
        industry: b.industry,
        color: b.color,
        totalGross: b.totalGross,
        receivedAmount: b.receivedAmount,
        outstandingAmount: b.outstandingAmount,
        cancelledAmount: b.cancelledAmount,
        closedDeals: b.closedDeals,
        cancelledDeals: b.cancelledDeals,
        activePipeline: b.activePipeline,
        avgTicketSize: Math.round(avgTicket),
        winRate,
        clientCount: b.clients.size,
        franchiseeShare: fShare,
        companyShare: cShare,
        bdCommission: bdComm
      };
    })
    .sort((a, b) => b.totalGross - a.totalGross);

  // Return empty unverified state if no transactions exist for entity
  if (industryList.length === 0) {
    return {
      industryBreakdown: [],
      tenureYears: Number(tenure.toFixed(1)),
      is3YearsCompleted,
      franchiseShareRate,
      companyShareRate,
      potential: {
        score: null,
        band: 'No Historical Deals Yet',
        totalGross: 0,
        closedDeals: 0,
        activePipeline: 0,
        pipelineValue: 0,
        overallWinRate: null,
        projectedQuarterlyRevenue: 0,
        projectedAnnualRunRate: 0,
        projectedFranchiseeShare: 0,
        projectedCompanyMargin: 0,
        projectedBdCommission: 0,
        topIndustry: 'N/A',
        bestWinIndustry: 'N/A',
        highestTicketIndustry: 'N/A',
        recommendations: [
          'No closed or pipeline deals found in the ledger for this entity yet.',
          'Transactions will automatically populate once client placements are logged in the CRM.'
        ]
      }
    };
  }

  // 4. Calculate Predictive Potential Model
  const totalRevenue = industryList.reduce((s, i) => s + i.totalGross, 0);
  const totalClosed = industryList.reduce((s, i) => s + i.closedDeals, 0);
  const totalCancelled = industryList.reduce((s, i) => s + i.cancelledDeals, 0);
  const totalPipeline = industryList.reduce((s, i) => s + i.activePipeline, 0);
  const totalPipelineVal = industryList.reduce((s, i) => s + i.outstandingAmount, 0);
  
  const totalConcluded = totalClosed + totalCancelled;
  const overallWinRate = totalConcluded > 0 
    ? Number(((totalClosed / totalConcluded) * 100).toFixed(1)) 
    : null;

  // Potential Score formula (Ticket size weight + Win rate + Pipeline momentum)
  const avgTicketAcross = totalClosed > 0 ? totalRevenue / totalClosed : 150000;
  const ticketScore = Math.min(35, (avgTicketAcross / 250000) * 35);
  const winRateScore = overallWinRate !== null ? Math.min(35, (overallWinRate / 100) * 35) : 20;
  const pipelineScore = Math.min(30, (totalPipeline / 8) * 30 + (totalClosed / 20) * 15);
  const potentialScore = Math.min(99, Math.max(30, Math.round(ticketScore + winRateScore + pipelineScore)));

  let potentialBand = 'High Production & Scaling';
  if (potentialScore >= 88) potentialBand = 'Top Tier Dominance (High Potential)';
  else if (potentialScore >= 75) potentialBand = 'Accelerating Growth Pipeline';
  else if (potentialScore >= 60) potentialBand = 'Steady Core Production';
  else potentialBand = 'Emerging Potential Hub';

  // Forward Projections: Next Quarter (Q+1) and Annual Run Rate
  const growthMultiplier = 1.0 + (potentialScore - 50) / 200; // e.g. 1.05 to 1.25
  const baselineMonthly = totalRevenue > 0 ? totalRevenue / 12 : 0;
  const projectedQuarterlyRevenue = Math.round((baselineMonthly * 3 + totalPipelineVal * 0.75) * growthMultiplier);
  const projectedAnnualRunRate = Math.round(projectedQuarterlyRevenue * 4.2);

  const projectedFranchiseeShare = Math.round(projectedQuarterlyRevenue * franchiseShareRate);
  const projectedCompanyMargin = Math.round(projectedQuarterlyRevenue * companyShareRate);
  const projectedBdCommission = Math.round(projectedCompanyMargin * bdCommissionRate);

  // Strategic Insights & Opportunities
  const topIndustry = industryList[0] || { industry: 'General Recruitment', totalGross: 0, avgTicketSize: 0 };
  const validWinIndustries = industryList.filter(i => i.winRate !== null);
  const bestWinIndustry = validWinIndustries.length > 0 
    ? [...validWinIndustries].sort((a, b) => (b.winRate || 0) - (a.winRate || 0))[0] 
    : topIndustry;
  const highestTicketIndustry = [...industryList].sort((a, b) => b.avgTicketSize - a.avgTicketSize)[0] || topIndustry;

  const recommendations = [
    `🎯 High-Yield Sector: ${topIndustry.industry} generates ${totalRevenue > 0 ? ((topIndustry.totalGross / totalRevenue) * 100).toFixed(0) : 0}% of billings with ${formatCurrency(topIndustry.avgTicketSize)} avg ticket size.`,
    `⚡ Conversion Leader: ${bestWinIndustry.industry} maintains strongest conversion velocity${bestWinIndustry.winRate !== null ? ` at ${bestWinIndustry.winRate}% win rate` : ''}.`,
    `📈 Pipeline Optimization: Active pipeline holds ${totalPipeline} open deals worth ${formatCurrency(totalPipelineVal)}. Focus on high-ticket positions in ${highestTicketIndustry.industry}.`
  ];

  return {
    industryBreakdown: industryList,
    tenureYears: Number(tenure.toFixed(1)),
    is3YearsCompleted,
    franchiseShareRate,
    companyShareRate,
    potential: {
      score: potentialScore,
      band: potentialBand,
      totalGross: totalRevenue,
      closedDeals: totalClosed,
      activePipeline: totalPipeline,
      pipelineValue: totalPipelineVal,
      overallWinRate: overallWinRate !== null ? Number(overallWinRate.toFixed(1)) : null,
      projectedQuarterlyRevenue,
      projectedAnnualRunRate,
      projectedFranchiseeShare,
      projectedCompanyMargin,
      projectedBdCommission,
      topIndustry: topIndustry.industry,
      bestWinIndustry: bestWinIndustry.industry,
      highestTicketIndustry: highestTicketIndustry.industry,
      recommendations
    }
  };
}
