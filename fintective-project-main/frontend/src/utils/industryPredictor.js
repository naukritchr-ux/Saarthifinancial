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
 * Classifies transactions into standard industry sectors and granular sub-industries,
 * computes conversion velocity, tracks BD domain mastery, and models forward-looking predictions.
 */

// Color palette for industries
export const INDUSTRY_COLORS = {
  'IT & Software': '#2563eb',
  'Banking & Financial Services (BFSI)': '#10b981',
  'Engineering & Manufacturing': '#0d9488',
  'Human Resources & Staffing': '#8b5cf6',
  'Sales, Marketing & BD': '#f59e0b',
  'Healthcare & Pharmaceuticals': '#ec4899',
  'Retail, Fashion & E-commerce': '#f97316',
  'Infrastructure & Real Estate': '#6366f1',
  'Corporate Enterprise Services': '#64748b'
};

/**
 * Robustly classifies an entity/transaction/enquiry into both Industry & Sub-Industry
 */
export function classifyIndustryAndSubIndustry(item = {}) {
  if (!item) {
    return {
      industry: 'Corporate Enterprise Services',
      subIndustry: 'Enterprise Strategic Placements'
    };
  }

  const comp = (item.companyName || item.client || '').toLowerCase();
  const post = (item.postOfCandidate || item.positionName || item.subCategory || item.title || item.description || '').toLowerCase();
  const text = `${comp} ${post}`.trim();

  // 1. BANKING & FINANCIAL SERVICES (BFSI)
  if (
    anyMatch(text, ['rcm', 'medical billing', 'us healthcare billing']) ||
    (comp.includes('spry') && post.includes('rcm'))
  ) {
    return {
      industry: 'Banking & Financial Services (BFSI)',
      subIndustry: 'Healthcare Financial Ops (RCM)'
    };
  }
  if (
    anyMatch(text, [
      'accountant', 'accounts executive', 'senior accountant', 'finance manager', 
      'account executive', 'audit', 'taxation', 'tally', 'n.m.raiji', 'nm raiji', 'ca '
    ])
  ) {
    return {
      industry: 'Banking & Financial Services (BFSI)',
      subIndustry: 'Accounting, Taxation & Audit'
    };
  }
  if (anyMatch(text, ['quickinsure', 'insurance', 'broker', 'policy', 'underwriting', 'actuarial'])) {
    return {
      industry: 'Banking & Financial Services (BFSI)',
      subIndustry: 'Insurance & Underwriting'
    };
  }
  if (
    anyMatch(text, [
      'ppfas', 'mufg', 'wealth', 'asset management', 'mutual fund', 'investment', 
      'portfolio', 'relationship manager', 'relationship associate', 'kollectcare', 
      'oro precious', 'banking', 'bank ', 'nbfc', 'lending', 'credit officer', 'loan'
    ])
  ) {
    return {
      industry: 'Banking & Financial Services (BFSI)',
      subIndustry: 'Banking, Wealth & Asset Management'
    };
  }

  // 2. ENGINEERING & MANUFACTURING
  if (
    anyMatch(text, [
      'jjg aero', 'aero', 'vmc', 'cnc', 'tool', 'die', 'machin', 'lathe', 
      'fitter', 'technician', 'extrusion', 'fabricat', 'ga steels', 'veerometals', 'metal'
    ])
  ) {
    return {
      industry: 'Engineering & Manufacturing',
      subIndustry: 'Precision Machining & Plant Operations'
    };
  }
  if (
    anyMatch(text, [
      'design engineer', 'draftsman', 'autocad', 'solidworks', 'mechanical engineer', 
      'r&d engineer', 'proposal engineer', 'potential engineering'
    ])
  ) {
    return {
      industry: 'Engineering & Manufacturing',
      subIndustry: 'Industrial Design & CAD/CAM'
    };
  }
  if (anyMatch(text, ['sales engineer', 'technical sales', 'techno-commercial'])) {
    return {
      industry: 'Engineering & Manufacturing',
      subIndustry: 'Technical Sales & Engineering'
    };
  }
  if (
    anyMatch(text, [
      'vefes', 'stulz', 'electrical engineer', 'site engineer', 'project engineer', 
      'site supervisor', 'civil engineer', 'service engineer', 'safety officer', 'shift supervisor'
    ])
  ) {
    return {
      industry: 'Engineering & Manufacturing',
      subIndustry: 'Civil, Site & Plant Engineering'
    };
  }
  if (
    anyMatch(text, [
      'purchase executive', 'procurement', 'supply chain', 'logistics', 'warehouse', 
      'store executive', 'r-pac', 'rand polyproducts', 'qc chemist', 'polymer', 'chemical', 'quality'
    ])
  ) {
    return {
      industry: 'Engineering & Manufacturing',
      subIndustry: 'Procurement, QC & Supply Chain'
    };
  }

  // 3. IT & SOFTWARE
  if (
    anyMatch(text, [
      'graphic designer', 'video editor', 'ui/ux', 'motion', 'multimedia', 'animat', 
      'deep dive digital', 'jr content producer', 'span communications', 'pi communications'
    ])
  ) {
    return {
      industry: 'IT & Software',
      subIndustry: 'Digital Design, Creative & Media'
    };
  }
  if (
    anyMatch(text, [
      'software', 'developer', 'full stack', 'frontend', 'backend', 'python', 'java', 
      'react', 'node', 'coder', 'programmer', 'qa', 'tester', 'devops', 'cloud', 
      'herald logic', 'solution analyst', 'tech', 'system engineer', 'data analyst', 'data scientist'
    ])
  ) {
    return {
      industry: 'IT & Software',
      subIndustry: 'Software Development & Engineering'
    };
  }
  if (anyMatch(text, ['digital marketing', 'seo', 'social media', 'content writer', 'copywriter'])) {
    return {
      industry: 'IT & Software',
      subIndustry: 'Digital Marketing & Content Strategy'
    };
  }

  // 4. HEALTHCARE & PHARMACEUTICALS
  if (
    anyMatch(text, [
      'teleconsulting doctor', 'doctor', 'nurse', 'hospital', 'clinical', 'medical officer', 
      'chemist', 'pharma', 'upsurge labs', 'yoga sutra', 'nutritionist', 'health coach', 
      'optometrist', 'biotech', 'pathology'
    ])
  ) {
    return {
      industry: 'Healthcare & Pharmaceuticals',
      subIndustry: 'Clinical Healthcare, Pharma & Wellness'
    };
  }

  // 5. RETAIL, FASHION & E-COMMERCE
  if (
    anyMatch(text, [
      'eluno', 'fashion', 'apparel', 'textile', 'store manager', 'merchandiser', 
      'retail', 'conscious food', 'fmcg', 'madshades', 'e-commerce', 'd2c'
    ])
  ) {
    return {
      industry: 'Retail, Fashion & E-commerce',
      subIndustry: 'Fashion, Apparel & Retail Merchandising'
    };
  }

  // 6. INFRASTRUCTURE & REAL ESTATE
  if (anyMatch(text, ['interior designer', 'architect', 'real estate', 'realty', 'property', 'builder', 'interior'])) {
    return {
      industry: 'Infrastructure & Real Estate',
      subIndustry: 'Interior Design, Architecture & Realty'
    };
  }

  // 7. SALES, MARKETING & BD
  if (
    anyMatch(text, [
      'sales executive', 'sales manager', 'area sales', 'bdm', 'business development manager', 
      'business development executive', 'key account', 'sales officer', 'senior sales', 
      'telecaller', 'inside sales', 'sales coordinator', 'relationship officer'
    ])
  ) {
    return {
      industry: 'Sales, Marketing & BD',
      subIndustry: 'Corporate & B2B Sales'
    };
  }
  if (anyMatch(text, ['marketing manager', 'brand manager', 'campaign manager', 'lead generator'])) {
    return {
      industry: 'Sales, Marketing & BD',
      subIndustry: 'Brand & Strategic Marketing'
    };
  }

  // 8. HUMAN RESOURCES & STAFFING
  if (
    anyMatch(text, [
      'hr executive', 'hr manager', 'talent acquisition', 'recruiter', 'human resource', 
      'payroll executive', 'hr ', 'onboarding executive'
    ])
  ) {
    return {
      industry: 'Human Resources & Staffing',
      subIndustry: 'Talent Acquisition & HR Operations'
    };
  }

  // 9. CORPORATE ENTERPRISE SERVICES
  if (
    anyMatch(text, [
      'executive assistant', 'mis executive', 'operations executive', 'back office', 
      'receptionist', 'admin', 'office assistant', 'coordinator', 'customer service'
    ])
  ) {
    return {
      industry: 'Corporate Enterprise Services',
      subIndustry: 'Office Administration & MIS Operations'
    };
  }

  return {
    industry: 'Corporate Enterprise Services',
    subIndustry: 'Enterprise Strategic Placements'
  };
}

function anyMatch(text, keywords) {
  if (!text) return false;
  return keywords.some(k => text.includes(k));
}

/**
 * Robustly classifies an entity/transaction/enquiry into an industry (Backward compatible)
 */
export function classifyIndustry(item = {}) {
  const res = classifyIndustryAndSubIndustry(item);
  return res.industry;
}

/**
 * Calculates tenure in completed years
 */
export function calculateTenureYears(onboardingDate, referenceDate = new Date()) {
  if (!onboardingDate) return 1.5;
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
 * Computes BD Domain Mastery & Specializations
 * Exactly answers: "In which industry & sub-industry that BD is performing well in?"
 */
export function getBdDomainMastery(transactions = []) {
  const txList = Array.isArray(transactions) ? transactions : [];
  const bdMap = {};

  txList.forEach(t => {
    const rawBd = (t.bdAgentName || t.bdMemberName || '').trim();
    if (!rawBd || rawBd.toLowerCase() === 'unknown' || rawBd.toLowerCase() === 'none') return;

    const { industry, subIndustry } = classifyIndustryAndSubIndustry(t);
    const amt = Math.abs(Number(t.amount || t.serviceAmt || t.totalBillAmt || 0));
    const st = (t.status || t.enquiryStatus || t.info || 'R').toUpperCase();
    const isLoss = isCancelled(st) || st === 'C' || t.info === 'CN' || t.info === 'RV' || t.type === 'credit_note';
    const isClosed = !isLoss;

    if (!bdMap[rawBd]) {
      bdMap[rawBd] = {
        name: rawBd,
        totalGross: 0,
        closedDeals: 0,
        cancelledDeals: 0,
        industryVolume: {},
        subIndustryMap: {}
      };
    }

    const bdRecord = bdMap[rawBd];
    if (isClosed) {
      bdRecord.totalGross += amt;
      bdRecord.closedDeals += 1;
      bdRecord.industryVolume[industry] = (bdRecord.industryVolume[industry] || 0) + amt;
    } else {
      bdRecord.cancelledDeals += 1;
    }

    const subKey = `${industry} > ${subIndustry}`;
    if (!bdRecord.subIndustryMap[subKey]) {
      bdRecord.subIndustryMap[subKey] = {
        industry,
        subIndustry,
        closedDeals: 0,
        cancelledDeals: 0,
        grossBilled: 0
      };
    }

    const subRec = bdRecord.subIndustryMap[subKey];
    if (isClosed) {
      subRec.closedDeals += 1;
      subRec.grossBilled += amt;
    } else {
      subRec.cancelledDeals += 1;
    }
  });

  return Object.values(bdMap).map(b => {
    const totalResolved = b.closedDeals + b.cancelledDeals;
    const overallWinRate = totalResolved > 0 ? Number(((b.closedDeals / totalResolved) * 100).toFixed(1)) : 100;

    // Sub-industries ranked by performance (deals and revenue)
    const subList = Object.values(b.subIndustryMap).map(s => {
      const sResolved = s.closedDeals + s.cancelledDeals;
      const sWinRate = sResolved > 0 ? Number(((s.closedDeals / sResolved) * 100).toFixed(1)) : 100;
      const avgTicket = s.closedDeals > 0 ? Math.round(s.grossBilled / s.closedDeals) : 0;
      return {
        ...s,
        winRate: sWinRate,
        avgTicket
      };
    }).sort((x, y) => (y.closedDeals * 1000000 + y.grossBilled) - (x.closedDeals * 1000000 + x.grossBilled));

    // Primary Industry (Highest revenue)
    const sortedIndustries = Object.entries(b.industryVolume).sort((x, y) => y[1] - x[1]);
    const topIndustry = sortedIndustries[0] ? sortedIndustries[0][0] : 'Corporate Enterprise Services';

    // Top Sub-Industry (Most deals & revenue)
    const topSub = subList[0] || {
      industry: topIndustry,
      subIndustry: 'Enterprise Strategic Placements',
      winRate: overallWinRate,
      closedDeals: b.closedDeals,
      grossBilled: b.totalGross,
      avgTicket: b.closedDeals > 0 ? Math.round(b.totalGross / b.closedDeals) : 0
    };

    // Performance Badge & Specialization Title
    let specialtyBadge = 'Core Specialist';
    if (topSub.industry.includes('BFSI')) specialtyBadge = '🏆 BFSI & Financial Operations Star';
    else if (topSub.industry.includes('IT')) specialtyBadge = '🚀 Tech & Software Talent Dominant';
    else if (topSub.industry.includes('Engineering')) specialtyBadge = '🔧 Precision Machining & Engineering Pro';
    else if (topSub.industry.includes('Sales')) specialtyBadge = '⚡ B2B Enterprise Sales Accelerator';
    else if (topSub.industry.includes('Healthcare')) specialtyBadge = '🩺 Healthcare & Clinical Recruitment Lead';
    else specialtyBadge = '💼 Corporate Strategic Placements Lead';

    return {
      name: b.name,
      totalGross: b.totalGross,
      closedDeals: b.closedDeals,
      cancelledDeals: b.cancelledDeals,
      overallWinRate,
      topIndustry,
      topSubIndustry: topSub.subIndustry,
      topSubWinRate: topSub.winRate,
      topSubDeals: topSub.closedDeals,
      topSubGross: topSub.grossBilled,
      topSubAvgTicket: topSub.avgTicket,
      specialtyBadge,
      subIndustries: subList
    };
  }).sort((a, b) => b.totalGross - a.totalGross);
}

/**
 * Generates industry analysis, hierarchical sub-industries, and predictive potential forecast
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

  const tenure = yearsCompleted !== null && yearsCompleted !== undefined 
    ? Number(yearsCompleted) 
    : calculateTenureYears(onboardingDate);
  const is3YearsCompleted = tenure >= 3.0;
  const franchiseShareRate = is3YearsCompleted ? SENIOR_FRANCHISEE_SHARE_RATE : DEFAULT_FRANCHISEE_SHARE_RATE;
  const companyShareRate = is3YearsCompleted ? SENIOR_COMPANY_SHARE_RATE : DEFAULT_COMPANY_SHARE_RATE;
  const bdCommissionRate = DEFAULT_BD_COMMISSION_OF_COMPANY_POOL;

  // 2. Aggregate metrics by industry and sub-industry
  const industryMap = {};

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
      positions: new Set(),
      subIndustriesMap: {}
    };
  });

  entityTxs.forEach(t => {
    const { industry: ind, subIndustry: sub } = classifyIndustryAndSubIndustry(t);
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
        positions: new Set(),
        subIndustriesMap: {}
      };
    }

    const bucket = industryMap[ind];
    const amt = Math.abs(Number(t.amount || t.serviceAmt || t.totalBillAmt || 0));
    const bdName = (t.bdAgentName || t.bdMemberName || 'Specialist').trim();

    if (t.companyName) bucket.clients.add(t.companyName);
    if (t.title || t.positionName || t.postOfCandidate) bucket.positions.add(t.title || t.positionName || t.postOfCandidate);

    // Initialize sub-industry record
    if (!bucket.subIndustriesMap[sub]) {
      bucket.subIndustriesMap[sub] = {
        subIndustry: sub,
        totalGross: 0,
        closedDeals: 0,
        cancelledDeals: 0,
        dealAmounts: [],
        bdLeaderboard: {}
      };
    }
    const subBucket = bucket.subIndustriesMap[sub];

    const st = (t.status || t.enquiryStatus || t.info || 'R').toUpperCase();
    if (isCancelled(st) || st === 'C' || t.info === 'CN' || t.info === 'RV' || t.type === 'credit_note') {
      bucket.cancelledAmount += amt;
      bucket.cancelledDeals++;
      subBucket.cancelledDeals++;
    } else if (isProgressed(st) || st === 'PR' || st === 'O' || (t.amountDue && Number(t.amountDue) > 0)) {
      bucket.outstandingAmount += amt;
      bucket.totalGross += amt;
      bucket.activePipeline++;
      bucket.dealAmounts.push(amt);
      subBucket.totalGross += amt;
      subBucket.dealAmounts.push(amt);
    } else {
      bucket.receivedAmount += amt;
      bucket.totalGross += amt;
      bucket.closedDeals++;
      bucket.dealAmounts.push(amt);
      subBucket.totalGross += amt;
      subBucket.closedDeals++;
      subBucket.dealAmounts.push(amt);
    }

    // Track BD in sub-industry
    if (bdName && !isCancelled(st)) {
      if (!subBucket.bdLeaderboard[bdName]) {
        subBucket.bdLeaderboard[bdName] = { name: bdName, deals: 0, gross: 0 };
      }
      subBucket.bdLeaderboard[bdName].deals++;
      subBucket.bdLeaderboard[bdName].gross += amt;
    }
  });

  // 3. Format industry breakdown items with nested sub-industries
  const industryList = Object.values(industryMap)
    .filter(b => b.totalGross > 0 || b.closedDeals > 0 || b.activePipeline > 0 || b.cancelledDeals > 0)
    .map(b => {
      const avgTicket = b.dealAmounts.length > 0 ? b.totalGross / b.dealAmounts.length : 0;
      const totalResolved = b.closedDeals + b.cancelledDeals;
      const winRate = totalResolved > 0 ? Number(((b.closedDeals / totalResolved) * 100).toFixed(1)) : null;

      const fShare = Math.round(b.totalGross * franchiseShareRate);
      const cShare = Math.round(b.totalGross * companyShareRate);
      const bdComm = Math.round(b.totalGross * companyShareRate * bdCommissionRate);

      // Format nested sub-industries
      const subIndustries = Object.values(b.subIndustriesMap)
        .map(s => {
          const sResolved = s.closedDeals + s.cancelledDeals;
          const sWinRate = sResolved > 0 ? Number(((s.closedDeals / sResolved) * 100).toFixed(1)) : 100;
          const sAvgTicket = s.dealAmounts.length > 0 ? Math.round(s.totalGross / s.dealAmounts.length) : 0;
          
          // Determine top BD
          const bdSorted = Object.values(s.bdLeaderboard).sort((x, y) => y.deals - x.deals || y.gross - x.gross);
          const topBd = bdSorted[0] || null;

          return {
            subIndustry: s.subIndustry,
            totalGross: s.totalGross,
            closedDeals: s.closedDeals,
            cancelledDeals: s.cancelledDeals,
            avgTicketSize: sAvgTicket,
            winRate: sWinRate,
            topBd: topBd ? topBd.name : 'N/A',
            topBdDeals: topBd ? topBd.deals : 0
          };
        })
        .sort((x, y) => y.totalGross - x.totalGross);

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
        bdCommission: bdComm,
        subIndustries
      };
    })
    .sort((a, b) => b.totalGross - a.totalGross);

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
  const overallWinRate = totalConcluded > 0 ? Number(((totalClosed / totalConcluded) * 100).toFixed(1)) : null;

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

  const growthMultiplier = 1.0 + (potentialScore - 50) / 200;
  const baselineMonthly = totalRevenue > 0 ? totalRevenue / 12 : 0;
  const projectedQuarterlyRevenue = Math.round((baselineMonthly * 3 + totalPipelineVal * 0.75) * growthMultiplier);
  const projectedAnnualRunRate = Math.round(projectedQuarterlyRevenue * 4.2);

  const projectedFranchiseeShare = Math.round(projectedQuarterlyRevenue * franchiseShareRate);
  const projectedCompanyMargin = Math.round(projectedQuarterlyRevenue * companyShareRate);
  const projectedBdCommission = Math.round(projectedCompanyMargin * bdCommissionRate);

  const topIndustry = industryList[0] || { industry: 'Corporate Enterprise Services', totalGross: 0, avgTicketSize: 0 };
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

export default analyzeIndustryPotential;
