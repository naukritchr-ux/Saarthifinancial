import React, { useContext, useState, useEffect, useMemo, useRef } from 'react';
import { FinanceContext, API_BASE_URL } from '../context/FinanceContext';
import { fetchWithApiKey, fetchJsonWithApiKey } from '../utils/apiClient';
import { formatCurrency, formatLakhs } from '../utils/formatters';
import {
  TrendingUp,
  TrendingDown,
  Target,
  Sparkles,
  Search,
  Filter,
  Check,
  X,
  Copy,
  ChevronRight,
  Layers,
  ArrowRight,
  ChevronDown
} from 'lucide-react';
import Pagination from '../components/Pagination';
import GoalSetterModal from '../components/GoalSetterModal';
import OutcomeRecorderModal from '../components/OutcomeRecorderModal';
import AuditPanel from '../components/AuditPanel';
import FinancialPerformanceCard from '../components/FinancialPerformanceCard';
import {
  CumulativeTargetChart,
  PlanAheadTrajectoryChart
} from '../components/CustomCharts';
import './GrowthTracking.css';

const GrowthTracking = () => {
  const { franchisees, bdAgents, teamLeaders, userRole, currentUser } = useContext(FinanceContext);
  const isAdminOrManager = userRole === 'admin' || userRole === 'manager' || currentUser?.role === 'admin' || currentUser?.role === 'manager';

  // URL-synced Selectors State: BD — FY — TL — Franchise
  const getInitialUrlState = () => {
    try {
      const p = new URLSearchParams(window.location.search);
      return {
        bd: p.get('bd') || 'Komal Suresh Bhanushali',
        fy: p.get('fy') || 'FY 2026-27',
        tl: p.get('tl') || 'All',
        franchise: p.get('franchise') || 'All',
        tab: p.get('tab') || 'overview'
      };
    } catch {
      return { bd: 'Komal Suresh Bhanushali', fy: 'FY 2026-27', tl: 'All', franchise: 'All', tab: 'overview' };
    }
  };

  const initialUrl = getInitialUrlState();
  const [bdFilter, setBdFilter] = useState(initialUrl.bd);
  const [selectedFy, setSelectedFy] = useState(initialUrl.fy);
  const [tlFilter, setTlFilter] = useState(initialUrl.tl);
  const [franchiseFilter, setFranchiseFilter] = useState(initialUrl.franchise);
  const [activeTab, setActiveTab] = useState(initialUrl.tab); // 'overview' | 'plan_ahead' | 'deals' | 'targets'

  // Combobox/Search dropdown state
  const [bdSearchQuery, setBdSearchQuery] = useState('');
  const [isBdDropdownOpen, setIsBdDropdownOpen] = useState(false);
  const [fnSearchQuery, setFnSearchQuery] = useState('');
  const [isFnDropdownOpen, setIsFnDropdownOpen] = useState(false);
  const bdContainerRef = useRef(null);
  const fnContainerRef = useRef(null);

  // Filter options from backend
  const [filterOptions, setFilterOptions] = useState({
    bds: ['All', 'Komal Suresh Bhanushali'],
    tls: ['All'],
    franchises: ['All'],
    fys: ['FY 2026-27', 'FY 2025-26', 'FY 2024-25', 'FY 2023-24']
  });

  useEffect(() => {
    fetchWithApiKey(`${API_BASE_URL}/growth-targets/filter-options`)
      .then(res => res && res.ok ? res.json() : null)
      .then(data => {
        if (data && data.bds) {
          setFilterOptions(data);
        }
      })
      .catch(err => console.error("Filter options fetch error:", err));
  }, []);

  // Close comboboxes when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (bdContainerRef.current && !bdContainerRef.current.contains(e.target)) {
        setIsBdDropdownOpen(false);
      }
      if (fnContainerRef.current && !fnContainerRef.current.contains(e.target)) {
        setIsFnDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Primary entity derivation
  const primaryType = useMemo(() => {
    if (bdFilter && bdFilter !== 'All') return 'bd_agent';
    if (tlFilter && tlFilter !== 'All') return 'team_leader';
    if (franchiseFilter && franchiseFilter !== 'All') return 'franchisee';
    return 'company';
  }, [bdFilter, tlFilter, franchiseFilter]);

  const primaryName = useMemo(() => {
    if (bdFilter && bdFilter !== 'All') return bdFilter;
    if (tlFilter && tlFilter !== 'All') return tlFilter;
    if (franchiseFilter && franchiseFilter !== 'All') return franchiseFilter;
    return 'Overall Portfolio';
  }, [bdFilter, tlFilter, franchiseFilter]);

  // Step 3 Live Summary Data State
  const [summaryData, setSummaryData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(null);

  // Tab 1 Overview Measure Toggle: 'deals' | 'revenue'
  const [overviewMeasure, setOverviewMeasure] = useState('deals');

  // Tab 2 Plan Ahead Growth Rate Preset State
  const [growthRatePct, setGrowthRatePct] = useState(15);

  // Tab 3 Deals State
  const [dealTableFilter, setDealTableFilter] = useState('all'); // 'all' | 'invoiced' | 'progressed' | 'cancelled'
  const [dealTableSearch, setDealTableSearch] = useState('');
  const [dealTablePage, setDealTablePage] = useState(1);
  const DEALS_PER_PAGE = 15;

  // Tab 4 Targets State
  const [targetsList, setTargetsList] = useState([]);
  const [targetsLoading, setTargetsLoading] = useState(false);
  const [targetsPage, setTargetsPage] = useState(1);
  const TARGETS_PER_PAGE = 8;

  // Modals & Letters State
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [goalModalParams, setGoalModalParams] = useState(null);
  const [activeOutcomeTarget, setActiveOutcomeTarget] = useState(null);
  const [viewingLetter, setViewingLetter] = useState(null);
  const [letterCopied, setLetterCopied] = useState(false);

  // Audit Panel State
  const [isAuditPanelOpen, setIsAuditPanelOpen] = useState(false);
  const [auditTransactions, setAuditTransactions] = useState([]);
  const [auditPanelTitle, setAuditPanelTitle] = useState('Deal Audit');
  const [auditPanelSubtitle, setAuditPanelSubtitle] = useState('');

  // Fetch Live Summary (authoritative single payload for whole page)
  const fetchSummaryData = () => {
    setSummaryLoading(true);
    setSummaryError(null);

    const queryParams = new URLSearchParams();
    queryParams.set('bd', bdFilter || 'All');
    queryParams.set('fy', selectedFy || 'FY 2026-27');
    queryParams.set('tl', tlFilter || 'All');
    queryParams.set('franchise', franchiseFilter || 'All');
    queryParams.set('role', userRole || 'admin');

    return fetchWithApiKey(`${API_BASE_URL}/growth-targets/summary?${queryParams.toString()}`)
      .then(res => {
        if (!res || !res.ok) throw new Error(`HTTP ${res?.status || 'Network Error'}`);
        return res.json();
      })
      .then(data => {
        setSummaryData(data);
        setDealTablePage(1);
        return data;
      })
      .catch(err => {
        console.error("Summary fetch notice:", err);
        setSummaryError(err.message || 'Could not load growth targets summary');
      })
      .finally(() => {
        setSummaryLoading(false);
      });
  };

  useEffect(() => {
    fetchSummaryData();
  }, [bdFilter, selectedFy, tlFilter, franchiseFilter, userRole]);

  // Fetch Target History for Tab 4
  const fetchTargets = () => {
    setTargetsLoading(true);
    const query = new URLSearchParams();
    if (primaryType !== 'company') {
      query.set('entity_type', primaryType);
      query.set('entity_name', primaryName);
    }
    fetchWithApiKey(`${API_BASE_URL}/growth-targets?${query.toString()}`)
      .then(res => res && res.ok ? res.json() : [])
      .then(data => {
        setTargetsList(Array.isArray(data) ? data : (data?.targets || []));
      })
      .catch(err => console.error("Targets fetch notice:", err))
      .finally(() => setTargetsLoading(false));
  };

  useEffect(() => {
    fetchTargets();
  }, [primaryType, primaryName]);

  // Sync Selectors to URL
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      if (bdFilter && bdFilter !== 'All') p.set('bd', bdFilter); else p.delete('bd');
      if (selectedFy && selectedFy !== 'FY 2026-27') p.set('fy', selectedFy); else p.delete('fy');
      if (tlFilter && tlFilter !== 'All') p.set('tl', tlFilter); else p.delete('tl');
      if (franchiseFilter && franchiseFilter !== 'All') p.set('franchise', franchiseFilter); else p.delete('franchise');
      if (activeTab && activeTab !== 'overview') p.set('tab', activeTab); else p.delete('tab');

      const newQuery = p.toString();
      const newUrl = newQuery ? `${window.location.pathname}?${newQuery}` : window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    } catch (e) {
      console.warn("Could not sync URL params:", e);
    }
  }, [bdFilter, selectedFy, tlFilter, franchiseFilter, activeTab]);

  // Filter lists for comboboxes
  const visibleBdOptions = useMemo(() => {
    const list = filterOptions.bds || ['All', 'Komal Suresh Bhanushali'];
    if (!bdSearchQuery) return list;
    const q = bdSearchQuery.toLowerCase();
    return list.filter(b => b.toLowerCase().includes(q));
  }, [filterOptions.bds, bdSearchQuery]);

  const visibleFnOptions = useMemo(() => {
    const list = filterOptions.franchises || ['All'];
    if (!fnSearchQuery) return list;
    const q = fnSearchQuery.toLowerCase();
    return list.filter(f => f.toLowerCase().includes(q));
  }, [filterOptions.franchises, fnSearchQuery]);

  // Tab 3 Deals Filtered List
  const filteredDeals = useMemo(() => {
    if (!summaryData || !summaryData.deals) return [];
    let list = summaryData.deals;
    if (dealTableFilter !== 'all') {
      list = list.filter(d => d.status === dealTableFilter);
    }
    if (dealTableSearch.trim()) {
      const q = dealTableSearch.toLowerCase();
      list = list.filter(d =>
        (d.companyName && d.companyName.toLowerCase().includes(q)) ||
        (d.positionName && d.positionName.toLowerCase().includes(q)) ||
        (d.candidateName && d.candidateName.toLowerCase().includes(q)) ||
        (d.bdMemberName && d.bdMemberName.toLowerCase().includes(q)) ||
        (d.teamLeaderName && d.teamLeaderName.toLowerCase().includes(q)) ||
        (d.franchiseeName && d.franchiseeName.toLowerCase().includes(q)) ||
        (d.referenceId && d.referenceId.toLowerCase().includes(q))
      );
    }
    return list;
  }, [summaryData, dealTableFilter, dealTableSearch]);

  const paginatedDeals = useMemo(() => {
    const start = (dealTablePage - 1) * DEALS_PER_PAGE;
    return filteredDeals.slice(start, start + DEALS_PER_PAGE);
  }, [filteredDeals, dealTablePage]);

  // Tab 4 Targets Paginated
  const paginatedTargets = useMemo(() => {
    const start = (targetsPage - 1) * TARGETS_PER_PAGE;
    return targetsList.slice(start, start + TARGETS_PER_PAGE);
  }, [targetsList, targetsPage]);

  // Tab 2 Plan Ahead 5-Row Projection Matrix
  const planAheadRows = useMemo(() => {
    const baseRev = Number(summaryData?.baseline?.revenue || 0);
    const baseDeals = Number(summaryData?.baseline?.deals || 0);
    const rate = (growthRatePct || 15) / 100.0;

    const rows = [];
    for (let t = 1; t <= 5; t++) {
      const mult = Math.pow(1.0 + rate, t);
      const projRev = Math.round(baseRev * mult);
      const projDeals = Math.max(1, Math.round(baseDeals * mult));
      const gain = projRev - baseRev;
      rows.push({
        yearLabel: `Year +${t}`,
        deals: projDeals,
        revenue: projRev,
        gain: gain
      });
    }
    return rows;
  }, [summaryData, growthRatePct]);

  // Drilldown audit trigger
  const handleOpenDealAudit = (deal) => {
    const tx = [{
      billNumber: deal.bill_no || deal.referenceId,
      billDate: deal.date,
      companyName: deal.companyName,
      candidateName: deal.candidateName,
      totalBillAmt: deal.amount,
      serviceCharges: deal.amount,
      ourShare: deal.our_share,
      franchiseeShare: deal.franchisee_share,
      nameOfBd: deal.bdMemberName,
      teamLeader: deal.teamLeaderName,
      franchiseName: deal.franchiseeName,
      info: deal.raw_status,
      industry: deal.industry
    }];
    setAuditTransactions(tx);
    setAuditPanelTitle(`Deal Financial Audit: ${deal.referenceId}`);
    setAuditPanelSubtitle(`${deal.companyName} • ${deal.positionName || 'Mandate'}`);
    setIsAuditPanelOpen(true);
  };

  const handleCopyLetter = (text) => {
    navigator.clipboard.writeText(text);
    setLetterCopied(true);
    setTimeout(() => setLetterCopied(false), 2000);
  };

  return (
    <div className="growth-tracking-page">
      {/* =========================================================================
          TOP BLOCK: HEADER & SELECTORS (PRESERVED AS REQUESTED)
          ========================================================================= */}
      <div style={{
        background: 'var(--bg-card, #ffffff)',
        border: '1px solid var(--border-color, #e2e8f0)',
        borderRadius: '8px',
        padding: '16px 20px',
        marginBottom: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: 'var(--text-main, #0f172a)' }}>
              Growth Targets & Horizon
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #64748b)' }}>
              Unified collections run-rate, forward trajectories, and verified placement milestones.
            </p>
          </div>

          {/* EXACTLY ONE "Set goal" Call To Action in Header */}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsGoalModalOpen(true)}
            style={{
              padding: '8px 18px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'var(--accent-teal, #0F6E56)',
              color: '#ffffff',
              fontWeight: '700',
              fontSize: '0.84rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 4px rgba(15, 110, 86, 0.25)'
            }}
          >
            <Target size={15} />
            Set goal
          </button>
        </div>

        {/* 4-Selector Row: BD — FY — TL — Franchise */}
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {/* BD Combobox */}
          <div style={{ flex: '1 1 200px', minWidth: '180px', position: 'relative' }} ref={bdContainerRef}>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
              BD Specialist
            </label>
            <div
              onClick={() => setIsBdDropdownOpen(!isBdDropdownOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '7px 12px',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                background: 'var(--bg-main)',
                cursor: 'pointer',
                fontSize: '0.84rem',
                fontWeight: '600'
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bdFilter}</span>
              <ChevronDown size={14} color="var(--text-muted)" />
            </div>
            {isBdDropdownOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: '#ffffff',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                marginTop: '4px',
                boxShadow: '0 6px 16px rgba(0,0,0,0.1)',
                zIndex: 30,
                maxHeight: '220px',
                overflowY: 'auto',
                padding: '6px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '6px 8px', borderBottom: '1px solid var(--border-color)', marginBottom: '4px' }}>
                  <Search size={13} color="var(--text-muted)" style={{ marginRight: '6px' }} />
                  <input
                    type="text"
                    placeholder="Search BD..."
                    value={bdSearchQuery}
                    onChange={(e) => setBdSearchQuery(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ border: 'none', outline: 'none', width: '100%', fontSize: '0.8rem', background: 'transparent' }}
                  />
                </div>
                {visibleBdOptions.map(b => (
                  <div
                    key={b}
                    onClick={() => {
                      setBdFilter(b);
                      setIsBdDropdownOpen(false);
                    }}
                    style={{
                      padding: '7px 10px',
                      borderRadius: '4px',
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      fontWeight: bdFilter === b ? '700' : '400',
                      background: bdFilter === b ? 'rgba(15, 110, 86, 0.08)' : 'transparent',
                      color: bdFilter === b ? 'var(--accent-teal)' : 'var(--text-main)'
                    }}
                  >
                    {b}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* FY Select */}
          <div style={{ flex: '0 1 140px', minWidth: '130px' }}>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
              Financial Year
            </label>
            <select
              value={selectedFy}
              onChange={(e) => setSelectedFy(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 10px',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                background: 'var(--bg-main)',
                fontSize: '0.84rem',
                fontWeight: '600',
                color: 'var(--text-main)',
                cursor: 'pointer'
              }}
            >
              {filterOptions.fys.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          {/* Team Leader Select */}
          <div style={{ flex: '1 1 180px', minWidth: '160px' }}>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
              Team Leader
            </label>
            <select
              value={tlFilter}
              onChange={(e) => setTlFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 10px',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                background: 'var(--bg-main)',
                fontSize: '0.84rem',
                fontWeight: '600',
                color: 'var(--text-main)',
                cursor: 'pointer'
              }}
            >
              {filterOptions.tls.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Franchisee Combobox */}
          <div style={{ flex: '1 1 200px', minWidth: '180px', position: 'relative' }} ref={fnContainerRef}>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
              Franchise Partner
            </label>
            <div
              onClick={() => setIsFnDropdownOpen(!isFnDropdownOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '7px 12px',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                background: 'var(--bg-main)',
                cursor: 'pointer',
                fontSize: '0.84rem',
                fontWeight: '600'
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{franchiseFilter}</span>
              <ChevronDown size={14} color="var(--text-muted)" />
            </div>
            {isFnDropdownOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: '#ffffff',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                marginTop: '4px',
                boxShadow: '0 6px 16px rgba(0,0,0,0.1)',
                zIndex: 30,
                maxHeight: '220px',
                overflowY: 'auto',
                padding: '6px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '6px 8px', borderBottom: '1px solid var(--border-color)', marginBottom: '4px' }}>
                  <Search size={13} color="var(--text-muted)" style={{ marginRight: '6px' }} />
                  <input
                    type="text"
                    placeholder="Search Franchise..."
                    value={fnSearchQuery}
                    onChange={(e) => setFnSearchQuery(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ border: 'none', outline: 'none', width: '100%', fontSize: '0.8rem', background: 'transparent' }}
                  />
                </div>
                {visibleFnOptions.map(f => (
                  <div
                    key={f}
                    onClick={() => {
                      setFranchiseFilter(f);
                      setIsFnDropdownOpen(false);
                    }}
                    style={{
                      padding: '7px 10px',
                      borderRadius: '4px',
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      fontWeight: franchiseFilter === f ? '700' : '400',
                      background: franchiseFilter === f ? 'rgba(15, 110, 86, 0.08)' : 'transparent',
                      color: franchiseFilter === f ? 'var(--accent-teal)' : 'var(--text-main)'
                    }}
                  >
                    {f}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Financial Performance "Money Box" Card (Kept exactly as requested) */}
      <FinancialPerformanceCard
        selectedFy={selectedFy}
        bdFilter={bdFilter}
        tlFilter={tlFilter}
        franchiseFilter={franchiseFilter}
        primaryName={primaryName}
        isAdminOrManager={isAdminOrManager}
        userRole={userRole}
      />

      {/* =========================================================================
          4-TAB WORKLIST NAVIGATION: OVERVIEW | PLAN AHEAD | DEALS | TARGETS
          ========================================================================= */}
      <div className="growth-tab-bar">
        <button
          type="button"
          className={`growth-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          type="button"
          className={`growth-tab-btn ${activeTab === 'plan_ahead' ? 'active' : ''}`}
          onClick={() => setActiveTab('plan_ahead')}
        >
          Plan ahead
        </button>
        <button
          type="button"
          className={`growth-tab-btn ${activeTab === 'deals' ? 'active' : ''}`}
          onClick={() => setActiveTab('deals')}
        >
          Deals
          <span className="growth-tab-count">
            {summaryData?.totals?.all?.count ?? '—'}
          </span>
        </button>
        <button
          type="button"
          className={`growth-tab-btn ${activeTab === 'targets' ? 'active' : ''}`}
          onClick={() => setActiveTab('targets')}
        >
          Targets
          <span className="growth-tab-count">
            {targetsList.length}
          </span>
        </button>
      </div>

      {/* Error Notice Banner */}
      {summaryError && (
        <div style={{ background: '#fef2f2', border: '1px solid #f87171', borderRadius: '6px', padding: '10px 16px', marginBottom: '16px', color: '#991b1b', fontSize: '0.82rem' }}>
          Notice: {summaryError}
        </div>
      )}

      {/* =========================================================================
          TAB 1: OVERVIEW
          ========================================================================= */}
      {activeTab === 'overview' && (
        <div>
          {/* Plain-Language Pacing Sentence Banner */}
          <div className="growth-pacing-banner">
            <div className="growth-pacing-text">
              <Sparkles size={16} color="var(--accent-teal)" />
              <span>{summaryData?.pacing_sentence || "Calculating pacing metrics..."}</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              FY Elapsed: {summaryData?.period?.months_elapsed || 7} months • Remaining: {summaryData?.period?.months_remaining || 5} months
            </div>
          </div>

          {/* FY Progress Bar Card */}
          <div className="fy-progress-card">
            <div className="fy-progress-header">
              <div>
                <span style={{ fontSize: '0.86rem', fontWeight: '700', color: 'var(--text-main)' }}>
                  FY {selectedFy} Progress Tracker
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                  (Realized vs Projected Pace vs Company Quota)
                </span>
              </div>
            </div>

            {/* Visual Progress Bar */}
            {(() => {
              const realizedDeals = Number(summaryData?.pace?.closed_count || 0);
              const projectedDeals = Number(summaryData?.pace?.projected_total_by_fy_end || realizedDeals);
              const quotaDeals = Number(summaryData?.company_quota?.quota_deals || 100);
              const pledgeDeals = Number(summaryData?.own_pledge?.target_deals || 0);

              const maxTrack = Math.max(quotaDeals, projectedDeals, realizedDeals, pledgeDeals, 10) * 1.15;
              const actualPct = Math.min(100, (realizedDeals / maxTrack) * 100);
              const projectedPct = Math.min(100, (projectedDeals / maxTrack) * 100);
              const quotaPos = Math.min(100, (quotaDeals / maxTrack) * 100);
              const pledgePos = pledgeDeals > 0 ? Math.min(100, (pledgeDeals / maxTrack) * 100) : null;

              return (
                <div>
                  <div className="fy-progress-track">
                    {/* Actual YTD Fill */}
                    <div className="fy-progress-fill-actual" style={{ width: `${actualPct}%` }} title={`Realized YTD: ${realizedDeals} deals`} />
                    {/* Projected Pace Fill */}
                    <div className="fy-progress-fill-projected" style={{ width: `${projectedPct}%` }} title={`Projected by March: ${projectedDeals} deals`} />

                    {/* Quota Marker */}
                    <div className="fy-progress-marker" style={{ left: `${quotaPos}%`, backgroundColor: '#94a3b8' }}>
                      <span className="fy-progress-marker-tag" style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>
                        Quota: {quotaDeals}
                      </span>
                    </div>

                    {/* Own Pledge Marker (if set) */}
                    {pledgePos !== null && (
                      <div className="fy-progress-marker" style={{ left: `${pledgePos}%`, backgroundColor: '#0F6E56' }}>
                        <span className="fy-progress-marker-tag" style={{ background: 'rgba(15, 110, 86, 0.12)', color: '#0F6E56', border: '1px solid #0F6E56' }}>
                          Pledge: {pledgeDeals}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Stat Grid */}
                  <div className="fy-progress-stats-grid">
                    <div className="fy-stat-box">
                      <span className="fy-stat-label">Realized YTD</span>
                      <span className="fy-stat-value" style={{ color: '#0F6E56' }}>
                        {realizedDeals} deals
                      </span>
                      <span className="fy-stat-sub">
                        {formatCurrency(summaryData?.pace?.closed_revenue || 0)} (rev_ex_gst)
                      </span>
                    </div>

                    <div className="fy-stat-box">
                      <span className="fy-stat-label">Projected at Pace</span>
                      <span className="fy-stat-value" style={{ color: '#2563EB' }}>
                        {projectedDeals} deals
                      </span>
                      <span className="fy-stat-sub">
                        ~{summaryData?.pace?.current_monthly_pace || 0} deals/month
                      </span>
                    </div>

                    <div className="fy-stat-box">
                      <span className="fy-stat-label">Company Quota</span>
                      <span className="fy-stat-value">
                        {quotaDeals} deals
                      </span>
                      <span className="fy-stat-sub">
                        {formatCurrency(summaryData?.company_quota?.quota_revenue || 0)}
                      </span>
                    </div>

                    <div className="fy-stat-box">
                      <span className="fy-stat-label">Own Pledge</span>
                      <span className="fy-stat-value" style={{ color: pledgeDeals > 0 ? '#0F6E56' : 'var(--text-muted)' }}>
                        {pledgeDeals > 0 ? `${pledgeDeals} deals` : '—'}
                      </span>
                      <span className="fy-stat-sub">
                        {pledgeDeals > 0 ? formatCurrency(summaryData?.own_pledge?.target_revenue || 0) : 'No pledge recorded'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Cumulative Trajectory Chart (Actual vs Projected vs Target with Monthly Bars) */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
              <div style={{ display: 'inline-flex', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '2px' }}>
                <button
                  type="button"
                  onClick={() => setOverviewMeasure('deals')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    border: 'none',
                    background: overviewMeasure === 'deals' ? 'var(--accent-teal)' : 'transparent',
                    color: overviewMeasure === 'deals' ? '#ffffff' : 'var(--text-muted)',
                    fontSize: '0.74rem',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Deals Count
                </button>
                <button
                  type="button"
                  onClick={() => setOverviewMeasure('revenue')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    border: 'none',
                    background: overviewMeasure === 'revenue' ? 'var(--accent-teal)' : 'transparent',
                    color: overviewMeasure === 'revenue' ? '#ffffff' : 'var(--text-muted)',
                    fontSize: '0.74rem',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Revenue (rev_ex_gst)
                </button>
              </div>
            </div>

            <CumulativeTargetChart
              monthlySeries={summaryData?.monthly_series}
              companyQuota={summaryData?.company_quota}
              monthsElapsed={summaryData?.period?.months_elapsed || 7}
              projectedTotal={summaryData?.pace?.projected_total_by_fy_end}
              measure={overviewMeasure}
              height={220}
            />
          </div>

          {/* Same-Period vs Prior Year vs Team Average Table */}
          <div className="same-period-card">
            <div style={{ marginBottom: '12px' }}>
              <span style={{ fontSize: '0.86rem', fontWeight: '700', color: 'var(--text-main)' }}>
                Same-Period Performance Benchmark
              </span>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                Comparing same elapsed calendar slice (Apr to current date) vs prior FY and team averages. Excludes full-year distortion.
              </p>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="same-period-table">
                <thead>
                  <tr>
                    <th>METRIC</th>
                    <th>THIS PERIOD ({summaryData?.period?.months_elapsed || 7}M YTD)</th>
                    <th>PRIOR FY (SAME PERIOD)</th>
                    <th>YOY VARIANCE</th>
                    <th>PRIOR FY (FULL YEAR)</th>
                    <th>TEAM AVERAGE (SAME PERIOD)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: '700' }}>Invoiced Deals</td>
                    <td style={{ fontWeight: '700', color: '#0F6E56' }}>
                      {summaryData?.comparisons?.this_period?.closed_deals ?? 0}
                    </td>
                    <td>{summaryData?.comparisons?.prior_same_period?.closed_deals ?? 0}</td>
                    <td>
                      {(() => {
                        const v = summaryData?.comparisons?.prior_same_period?.yoy_deals_pct;
                        if (v === null || v === undefined) return '—';
                        return (
                          <span style={{ color: v >= 0 ? '#0F6E56' : '#dc2626', fontWeight: '700' }}>
                            {v >= 0 ? '+' : ''}{v}%
                          </span>
                        );
                      })()}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {summaryData?.comparisons?.prior_full_year?.closed_deals ?? 0}
                    </td>
                    <td>{summaryData?.comparisons?.team_average?.closed_deals ?? 0}</td>
                  </tr>

                  <tr>
                    <td style={{ fontWeight: '700' }}>Revenue (rev_ex_gst)</td>
                    <td style={{ fontWeight: '700', color: '#0F6E56' }}>
                      {formatCurrency(summaryData?.comparisons?.this_period?.revenue ?? 0)}
                    </td>
                    <td>{formatCurrency(summaryData?.comparisons?.prior_same_period?.revenue ?? 0)}</td>
                    <td>
                      {(() => {
                        const v = summaryData?.comparisons?.prior_same_period?.yoy_revenue_pct;
                        if (v === null || v === undefined) return '—';
                        return (
                          <span style={{ color: v >= 0 ? '#0F6E56' : '#dc2626', fontWeight: '700' }}>
                            {v >= 0 ? '+' : ''}{v}%
                          </span>
                        );
                      })()}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {formatCurrency(summaryData?.comparisons?.prior_full_year?.revenue ?? 0)}
                    </td>
                    <td>{formatCurrency(summaryData?.comparisons?.team_average?.revenue ?? 0)}</td>
                  </tr>

                  <tr>
                    <td style={{ fontWeight: '700' }}>Average Deal Size</td>
                    <td style={{ fontWeight: '700' }}>
                      {formatCurrency(summaryData?.comparisons?.this_period?.avg_deal ?? 0)}
                    </td>
                    <td>{formatCurrency(summaryData?.comparisons?.prior_same_period?.avg_deal ?? 0)}</td>
                    <td>—</td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {formatCurrency(summaryData?.comparisons?.prior_full_year?.avg_deal ?? 0)}
                    </td>
                    <td>{formatCurrency(summaryData?.comparisons?.team_average?.avg_deal ?? 0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: PLAN AHEAD
          ========================================================================= */}
      {activeTab === 'plan_ahead' && (
        <div>
          {/* Single Growth Control Bar */}
          <div className="growth-control-row">
            <div>
              <span style={{ fontSize: '0.86rem', fontWeight: '700', color: 'var(--text-main)' }}>
                Compounded Growth Velocity
              </span>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                Simulate 5-year forward trajectory against the completed historical baseline.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div className="preset-chip-group">
                {[10, 15, 25].map(p => (
                  <button
                    key={p}
                    type="button"
                    className={`preset-chip ${growthRatePct === p ? 'active' : ''}`}
                    onClick={() => setGrowthRatePct(p)}
                  >
                    +{p}%
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: '600' }}>Custom %:</span>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={growthRatePct}
                  onChange={(e) => setGrowthRatePct(Math.max(1, Math.min(100, Number(e.target.value) || 15)))}
                  style={{
                    width: '64px',
                    padding: '5px 8px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.82rem',
                    fontWeight: '700',
                    textAlign: 'center'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Baseline Summary Pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            background: 'rgba(15, 110, 86, 0.04)',
            border: '1px solid rgba(15, 110, 86, 0.15)',
            borderRadius: '6px',
            padding: '8px 14px',
            marginBottom: '16px',
            fontSize: '0.78rem',
            flexWrap: 'wrap'
          }}>
            <div>
              <strong style={{ color: 'var(--text-muted)' }}>Completed Baseline:</strong>{' '}
              <span style={{ color: 'var(--text-main)', fontWeight: '700' }}>
                {summaryData?.baseline?.period ? `${summaryData.baseline.period} (${summaryData.baseline.deals} deals • ${formatCurrency(summaryData.baseline.revenue)})` : '—'}
              </span>
            </div>
            <div>
              <strong style={{ color: 'var(--text-muted)' }}>Historical CAGR:</strong>{' '}
              <span style={{ color: summaryData?.baseline?.historical_cagr !== null ? '#0F6E56' : 'var(--text-muted)', fontWeight: '700' }}>
                {summaryData?.baseline?.historical_cagr !== null ? `${summaryData.baseline.historical_cagr_pct}%` : '— (Requires 2 completed FYs)'}
              </span>
            </div>
          </div>

          {/* Forward Trajectory Chart */}
          <PlanAheadTrajectoryChart
            historicalSeries={summaryData?.historical_series}
            appliedRate={growthRatePct / 100.0}
            historicalCagr={summaryData?.baseline?.historical_cagr}
            height={220}
          />

          {/* 5-Row Projection Matrix Table */}
          {summaryData?.baseline?.revenue > 0 ? (
            <table className="plan-ahead-table">
              <thead>
                <tr>
                  <th>HORIZON</th>
                  <th>ANNUAL DEALS</th>
                  <th>ANNUAL REVENUE (rev_ex_gst)</th>
                  <th>INCREMENTAL GAIN VS BASE</th>
                </tr>
              </thead>
              <tbody>
                {planAheadRows.map((row, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: '700', color: 'var(--text-main)' }}>{row.yearLabel}</td>
                    <td style={{ fontWeight: '700', color: '#2563EB' }}>{row.deals} deals</td>
                    <td style={{ fontWeight: '700', color: '#0F6E56' }}>{formatCurrency(row.revenue)}</td>
                    <td style={{ color: '#0F6E56', fontWeight: '600' }}>+{formatCurrency(row.gain)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
              — Not enough completed financial years to display forward plan ahead table.
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: DEALS TABLE
          ========================================================================= */}
      {activeTab === 'deals' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
          {/* Filter Chips & Search Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => { setDealTableFilter('all'); setDealTablePage(1); }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: dealTableFilter === 'all' ? '2px solid var(--accent-teal)' : '1px solid var(--border-color)',
                  background: dealTableFilter === 'all' ? 'rgba(15, 110, 86, 0.1)' : '#ffffff',
                  color: dealTableFilter === 'all' ? 'var(--accent-teal)' : 'var(--text-main)',
                  fontWeight: '700',
                  fontSize: '0.78rem',
                  cursor: 'pointer'
                }}
              >
                All · {summaryData?.totals?.all?.count ?? 0}
              </button>

              <button
                type="button"
                onClick={() => { setDealTableFilter('invoiced'); setDealTablePage(1); }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: dealTableFilter === 'invoiced' ? '2px solid #10B981' : '1px solid var(--border-color)',
                  background: dealTableFilter === 'invoiced' ? 'rgba(16, 185, 129, 0.12)' : '#ffffff',
                  color: dealTableFilter === 'invoiced' ? '#065F46' : 'var(--text-main)',
                  fontWeight: '700',
                  fontSize: '0.78rem',
                  cursor: 'pointer'
                }}
              >
                Invoices · {summaryData?.totals?.invoiced?.count ?? 0} ({formatCurrency(summaryData?.totals?.invoiced?.revenue ?? 0)})
              </button>

              <button
                type="button"
                onClick={() => { setDealTableFilter('progressed'); setDealTablePage(1); }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: dealTableFilter === 'progressed' ? '2px solid #2563EB' : '1px solid var(--border-color)',
                  background: dealTableFilter === 'progressed' ? 'rgba(37, 99, 235, 0.12)' : '#ffffff',
                  color: dealTableFilter === 'progressed' ? '#1E40AF' : 'var(--text-main)',
                  fontWeight: '700',
                  fontSize: '0.78rem',
                  cursor: 'pointer'
                }}
              >
                Progressed · {summaryData?.totals?.progressed?.count ?? 0}
              </button>

              <button
                type="button"
                onClick={() => { setDealTableFilter('cancelled'); setDealTablePage(1); }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: dealTableFilter === 'cancelled' ? '2px solid #EF4444' : '1px solid var(--border-color)',
                  background: dealTableFilter === 'cancelled' ? 'rgba(239, 68, 68, 0.12)' : '#ffffff',
                  color: dealTableFilter === 'cancelled' ? '#991B1B' : 'var(--text-main)',
                  fontWeight: '700',
                  fontSize: '0.78rem',
                  cursor: 'pointer'
                }}
              >
                Cancelled · {summaryData?.totals?.cancelled?.count ?? 0}
              </button>
            </div>

            {/* Deals Search Input */}
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '4px 10px', width: '220px' }}>
              <Search size={13} color="var(--text-muted)" style={{ marginRight: '6px' }} />
              <input
                type="text"
                placeholder="Search deals..."
                value={dealTableSearch}
                onChange={(e) => { setDealTableSearch(e.target.value); setDealTablePage(1); }}
                style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '0.78rem', width: '100%' }}
              />
            </div>
          </div>

          {/* Deals Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                  <th style={{ padding: '10px 12px' }}>BILL / REF</th>
                  <th style={{ padding: '10px 12px' }}>CLIENT / COMPANY</th>
                  <th style={{ padding: '10px 12px' }}>POSITION / CANDIDATE</th>
                  <th style={{ padding: '10px 12px' }}>BD / TL / FRANCHISE</th>
                  <th style={{ padding: '10px 12px' }}>DATE</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>DEAL VALUE</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>STATUS</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDeals.map((deal, idx) => (
                  <tr key={deal.id || idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: '700', color: 'var(--accent-teal)' }}>
                      {deal.referenceId}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: '600' }}>
                      {deal.companyName}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: '600' }}>{deal.positionName}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{deal.candidateName}</div>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      <div>{deal.bdMemberName || '—'}</div>
                      <div>{deal.teamLeaderName ? `TL: ${deal.teamLeaderName}` : ''}</div>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                      {deal.date}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700' }}>
                      {formatCurrency(deal.amount)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '0.7rem',
                        fontWeight: '700',
                        background: deal.status === 'invoiced' ? 'rgba(16, 185, 129, 0.12)' : (deal.status === 'progressed' ? 'rgba(37, 99, 235, 0.12)' : 'rgba(239, 68, 68, 0.12)'),
                        color: deal.status === 'invoiced' ? '#065F46' : (deal.status === 'progressed' ? '#1E40AF' : '#991B1B')
                      }}>
                        {deal.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => handleOpenDealAudit(deal)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-main)',
                          fontSize: '0.72rem',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        Audit
                      </button>
                    </td>
                  </tr>
                ))}
                {paginatedDeals.length === 0 && (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                      No deals found for the selected filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={dealTablePage}
            totalItems={filteredDeals.length}
            pageSize={DEALS_PER_PAGE}
            onPageChange={setDealTablePage}
            itemName="deals"
          />
        </div>
      )}

      {/* =========================================================================
          TAB 4: TARGETS & MEMOS
          ========================================================================= */}
      {activeTab === 'targets' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontSize: '0.86rem', fontWeight: '700', color: 'var(--text-main)' }}>
              Target Milestones & Memo Registry
            </span>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              {targetsList.length} recorded targets
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                  <th style={{ padding: '10px 12px' }}>ENTITY</th>
                  <th style={{ padding: '10px 12px' }}>TARGET PERIOD</th>
                  <th style={{ padding: '10px 12px' }}>GROWTH %</th>
                  <th style={{ padding: '10px 12px' }}>TARGET PLACEMENTS</th>
                  <th style={{ padding: '10px 12px' }}>TARGET REVENUE</th>
                  <th style={{ padding: '10px 12px' }}>STATUS</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTargets.map((tgt) => (
                  <tr key={tgt.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: '700', color: 'var(--text-main)' }}>
                      {tgt.entity_name || tgt.entity_id}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                      {tgt.period_start} → {tgt.period_end}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: '700', color: 'var(--accent-teal)' }}>
                      +{Number(tgt.growth_pct_target || 0).toFixed(0)}%
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: '600' }}>
                      {tgt.target_placements ? `${tgt.target_placements} deals` : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: '600' }}>
                      {tgt.target_revenue ? formatCurrency(tgt.target_revenue) : '—'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '0.7rem',
                        fontWeight: '700',
                        background: tgt.status === 'completed' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(15, 110, 86, 0.12)',
                        color: tgt.status === 'completed' ? '#065F46' : 'var(--accent-teal)'
                      }}>
                        {tgt.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        {tgt.target_letter_text && (
                          <button
                            type="button"
                            onClick={() => setViewingLetter({ title: `Target Memo: ${tgt.entity_name || tgt.entity_id}`, content: tgt.target_letter_text })}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              border: '1px solid var(--border-color)',
                              background: '#ffffff',
                              fontSize: '0.72rem',
                              fontWeight: '600',
                              cursor: 'pointer'
                            }}
                          >
                            Memo
                          </button>
                        )}
                        {tgt.status !== 'completed' && (
                          <button
                            type="button"
                            onClick={() => setActiveOutcomeTarget(tgt)}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              border: 'none',
                              background: 'var(--accent-teal)',
                              color: '#ffffff',
                              fontSize: '0.72rem',
                              fontWeight: '600',
                              cursor: 'pointer'
                            }}
                          >
                            Record Outcome
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {paginatedTargets.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                      No targets recorded yet. Use the "Set goal" button in the header to establish a target.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={targetsPage}
            totalItems={targetsList.length}
            pageSize={TARGETS_PER_PAGE}
            onPageChange={setTargetsPage}
            itemName="targets"
          />
        </div>
      )}

      {/* =========================================================================
          MODALS & OVERLAYS
          ========================================================================= */}
      {isGoalModalOpen && (
        <GoalSetterModal
          isOpen={isGoalModalOpen}
          onClose={() => {
            setIsGoalModalOpen(false);
            setGoalModalParams(null);
          }}
          entityType={primaryType}
          entity={{ id: primaryName, name: primaryName }}
          initialGrowthPct={goalModalParams?.growthPct || growthRatePct}
          initialTargetPlacements={goalModalParams?.placements}
          initialTargetRevenue={goalModalParams?.targetRevenue}
          initialTargetAuthor={goalModalParams?.targetAuthor}
          onTargetCreated={(newTarget) => {
            setTargetsList(prev => [newTarget, ...prev.filter(t => t.id !== newTarget.id)]);
            fetchTargets();
            fetchSummaryData();
          }}
        />
      )}

      {activeOutcomeTarget && (
        <OutcomeRecorderModal
          isOpen={Boolean(activeOutcomeTarget)}
          onClose={() => setActiveOutcomeTarget(null)}
          target={activeOutcomeTarget}
          onOutcomeRecorded={(updated) => {
            setTargetsList(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t));
            fetchTargets();
            fetchSummaryData();
          }}
        />
      )}

      {viewingLetter && (
        <div className="modal-backdrop" onClick={() => setViewingLetter(null)}>
          <div
            className="modal-content animate-slide-up"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '720px', width: '92%', maxHeight: '82vh', display: 'flex', flexDirection: 'column' }}
          >
            <div className="modal-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: '0.96rem', fontWeight: '700' }}>
                {viewingLetter.title}
              </h4>
              <button className="close-btn" onClick={() => setViewingLetter(null)} aria-label="Close modal">
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, backgroundColor: 'var(--bg-main)' }}>
              <pre style={{
                background: '#ffffff',
                padding: '16px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                fontSize: '0.8rem',
                fontFamily: 'Consolas, monospace',
                whiteSpace: 'pre-wrap',
                lineHeight: '1.5',
                margin: 0
              }}>
                {viewingLetter.content}
              </pre>
            </div>
            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => handleCopyLetter(viewingLetter.content)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: letterCopied ? '#e6f4ea' : '#ffffff',
                  color: letterCopied ? '#0F6E56' : 'var(--text-main)',
                  fontSize: '0.78rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {letterCopied ? <Check size={14} /> : <Copy size={14} />}
                {letterCopied ? 'Copied!' : 'Copy Letter'}
              </button>
              <button
                type="button"
                onClick={() => setViewingLetter(null)}
                style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: 'var(--accent-teal)', color: '#ffffff', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {isAuditPanelOpen && (
        <AuditPanel
          isOpen={isAuditPanelOpen}
          onClose={() => setIsAuditPanelOpen(false)}
          title={auditPanelTitle}
          subtitle={auditPanelSubtitle}
          entityType={primaryType}
          transactions={auditTransactions}
          periodLabel={selectedFy}
        />
      )}
    </div>
  );
};

export default GrowthTracking;
