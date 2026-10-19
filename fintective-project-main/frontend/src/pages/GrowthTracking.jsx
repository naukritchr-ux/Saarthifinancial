import React, { useContext, useState, useEffect, useMemo, useRef } from 'react';
import { FinanceContext, API_BASE_URL } from '../context/FinanceContext';
import { fetchWithApiKey, fetchJsonWithApiKey } from '../utils/apiClient';
import { formatCurrency, formatLakhs } from '../utils/formatters';
import { DEFAULT_COMPANY_SHARE_RATE, DEFAULT_ESTIMATED_TAX_RATE } from '../config/financeConfig';
import { 
  TrendingUp, 
  TrendingDown, 
  Award, 
  Users, 
  Building, 
  Building2, 
  Briefcase, 
  Plus, 
  AlertCircle, 
  Copy, 
  Check, 
  X, 
  RotateCcw, 
  DollarSign, 
  Sparkles, 
  Zap, 
  Target, 
  ArrowRight, 
  Layers,
  ChevronDown,
  Search,
  Filter,
  HelpCircle,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  CheckCircle2,
  Landmark,
  Wallet,
  Lock,
  Save
} from 'lucide-react';
import Pagination from '../components/Pagination';
import GoalSetterModal from '../components/GoalSetterModal';
import OutcomeRecorderModal from '../components/OutcomeRecorderModal';
import AuditPanel from '../components/AuditPanel';
import { TrajectoryLineChart, BarChart, Sparkline, TargetVsActualBar } from '../components/CustomCharts';

const GrowthTracking = () => {
  const { franchisees, bdAgents, teamLeaders, transactions, userRole, currentUser } = useContext(FinanceContext);
  const isAdminOrManager = userRole === 'admin' || userRole === 'manager' || currentUser?.role === 'admin' || currentUser?.role === 'manager';


  // Step 2 URL-synced Selectors State
  const getInitialUrlState = () => {
    try {
      const p = new URLSearchParams(window.location.search);
      return {
        type: p.get('type') || 'all',
        name: p.get('name') || 'all',
        fy: p.get('fy') || 'FY 2026-27'
      };
    } catch {
      return { type: 'all', name: 'all', fy: 'FY 2026-27' };
    }
  };

  const initialUrl = getInitialUrlState();
  const [type, setType] = useState(initialUrl.type); // 'bd' | 'tl' | 'franchise' | 'all'
  const [selectedName, setSelectedName] = useState(initialUrl.name);
  const [selectedFy, setSelectedFy] = useState(initialUrl.fy);
  const [nameSearchQuery, setNameSearchQuery] = useState('');
  const [isNameDropdownOpen, setIsNameDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [ariaAnnouncement, setAriaAnnouncement] = useState('');
  const nameSelectContainerRef = useRef(null);

  // Entity selection state (underlying state mapped from selectors)
  const [entityType, setEntityType] = useState(initialUrl.type === 'all' ? 'company' : (initialUrl.type === 'bd' ? 'bd_agent' : (initialUrl.type === 'tl' ? 'team_leader' : 'franchisee')));
  const [selectedEntityId, setSelectedEntityId] = useState(initialUrl.type === 'all' ? 'comp-overall' : (initialUrl.name !== 'all' ? initialUrl.name : ''));
  
  // Dynamic Roster state
  const [serverRoster, setServerRoster] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(false);

  // Step 3 Live Summary & Filters State
  const [summaryData, setSummaryData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'invoiced' | 'progressed' | 'cancelled' | 'other'
  const [activeBenchmark, setActiveBenchmark] = useState('prior_year'); // 'prior_year' | 'team_average'
  const [isAuditPanelOpen, setIsAuditPanelOpen] = useState(false);
  const [auditTransactions, setAuditTransactions] = useState([]);
  const [auditPanelTitle, setAuditPanelTitle] = useState('Deal Financial Audit');
  const [auditPanelSubtitle, setAuditPanelSubtitle] = useState('');
  const [dealTablePage, setDealTablePage] = useState(1);
  const [dealTableSearch, setDealTableSearch] = useState('');
  const DEALS_PER_PAGE = 15;

  // Step 4 Money Box State
  const [moneyBoxMode, setMoneyBoxMode] = useState('live'); // 'live' | 'fixed'
  const [fixedSalaryInput, setFixedSalaryInput] = useState('');
  const [isSavingFixedSalary, setIsSavingFixedSalary] = useState(false);
  const [fixedSalaryStatusMsg, setFixedSalaryStatusMsg] = useState(null);

  // Step 3 & 4: Fetch Live Summary & Deal Analytics
  const fetchSummaryData = () => {
    setSummaryLoading(true);
    setSummaryError(null);

    const queryParams = new URLSearchParams();
    queryParams.set('entity_type', type);
    queryParams.set('entity_name', selectedName || 'all');
    queryParams.set('fy', selectedFy || 'FY 2026-27');
    queryParams.set('role', userRole || 'admin');

    return fetchWithApiKey(`${API_BASE_URL}/growth-targets/summary?${queryParams.toString()}`, {
      headers: {
        'X-User-Role': userRole || 'admin'
      }
    })
      .then(res => {
        if (!res || !res.ok) throw new Error(`HTTP ${res?.status || 'network error'}`);
        return res.json();
      })
      .then(data => {
        setSummaryData(data);
        setDealTablePage(1);
        return data;
      })
      .catch(err => {
        console.error("Notice: Growth summary fetch notice:", err);
        setSummaryError(err.message || 'Could not load live analytics summary');
      })
      .finally(() => {
        setSummaryLoading(false);
      });
  };

  useEffect(() => {
    fetchSummaryData();
  }, [type, selectedName, selectedFy, userRole]);

  // Step 4 Save Fixed Salary (writes fixed_salary through /api/cost-performance/inputs)
  const handleSaveFixedSalary = async () => {
    if (!fixedSalaryInput || isNaN(Number(fixedSalaryInput)) || Number(fixedSalaryInput) < 0) {
      setFixedSalaryStatusMsg({ type: 'error', text: 'Please enter a valid monthly ₹ salary amount.' });
      return;
    }
    if (type !== 'bd' && type !== 'tl') {
      setFixedSalaryStatusMsg({ type: 'error', text: 'Fixed salary can only be configured for individual BD or TL members.' });
      return;
    }
    setIsSavingFixedSalary(true);
    setFixedSalaryStatusMsg(null);
    try {
      const monthlyAmt = Number(fixedSalaryInput);
      const months = summaryData?.monthly_series?.map(m => m.month) || [
        '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09',
        '2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03'
      ];
      for (const m of months) {
        const payload = {
          month: m,
          bd_costs: type === 'bd' ? [{
            bd_name: selectedName,
            fixed_salary: monthlyAmt,
            incentive_paid: 0,
            travel_expense: 0
          }] : [],
          tl_costs: type === 'tl' ? [{
            tl_name: selectedName,
            fixed_salary: monthlyAmt,
            incentive_paid: 0
          }] : []
        };
        await fetchWithApiKey(`${API_BASE_URL}/cost-performance/inputs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      setFixedSalaryStatusMsg({
        type: 'success',
        text: `Successfully saved ₹${monthlyAmt.toLocaleString('en-IN')}/mo tagged "Fixed (manual)" across FY.`
      });
      await fetchSummaryData();
    } catch (err) {
      console.error("Failed to save fixed salary:", err);
      setFixedSalaryStatusMsg({ type: 'error', text: 'Error saving salary: ' + err.message });
    } finally {
      setIsSavingFixedSalary(false);
    }
  };

  // Close searchable select on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (nameSelectContainerRef.current && !nameSelectContainerRef.current.contains(e.target)) {
        setIsNameDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Sync Selectors to URL Query Parameters
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      if (type !== 'all') { p.set('type', type); } else { p.delete('type'); }
      if (selectedName && selectedName !== 'all') { p.set('name', selectedName); } else { p.delete('name'); }
      if (selectedFy && selectedFy !== 'FY 2026-27') { p.set('fy', selectedFy); } else { p.delete('fy'); }
      
      const newQuery = p.toString();
      const newUrl = newQuery ? `${window.location.pathname}?${newQuery}` : window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    } catch (e) {
      console.warn("Could not sync URL params:", e);
    }
  }, [type, selectedName, selectedFy]);

  // Synchronize Type & Name into underlying entityType and selectedEntityId
  useEffect(() => {
    if (type === 'all') {
      setEntityType('company');
      setSelectedEntityId('comp-overall');
    } else if (type === 'bd') {
      setEntityType('bd_agent');
      setSelectedEntityId(selectedName !== 'all' ? selectedName : '');
    } else if (type === 'tl') {
      setEntityType('team_leader');
      setSelectedEntityId(selectedName !== 'all' ? selectedName : '');
    } else if (type === 'franchise') {
      setEntityType('franchisee');
      setSelectedEntityId(selectedName !== 'all' ? selectedName : '');
    }
  }, [type, selectedName]);

  // Available names filtered by selected Type
  const filteredNameOptions = useMemo(() => {
    if (type === 'bd') {
      return (bdAgents || []).map(b => ({ id: String(b.id || b.name), name: b.name, role: 'BD Specialist' }));
    } else if (type === 'tl') {
      return (teamLeaders || []).map(t => ({ id: String(t.id || t.name), name: t.name, role: t.role || 'Team Leader' }));
    } else if (type === 'franchise') {
      return (franchisees || []).map(f => ({ id: String(f.id || f.name), name: f.name || f.nameAsPerAgreement, role: 'Franchise Partner' }));
    } else {
      return [
        { id: 'all', name: 'All Profiles (Entire Agency)', role: 'All' },
        ...(bdAgents || []).map(b => ({ id: String(b.id || b.name), name: b.name, role: 'BD Specialist' })),
        ...(teamLeaders || []).map(t => ({ id: String(t.id || t.name), name: t.name, role: t.role || 'Team Leader' })),
        ...(franchisees || []).map(f => ({ id: String(f.id || f.name), name: f.name || f.nameAsPerAgreement, role: 'Franchise Partner' }))
      ];
    }
  }, [type, bdAgents, teamLeaders, franchisees]);

  const visibleNameOptions = useMemo(() => {
    if (!nameSearchQuery) return filteredNameOptions;
    const q = nameSearchQuery.toLowerCase();
    return filteredNameOptions.filter(o => o.name.toLowerCase().includes(q) || (o.role && o.role.toLowerCase().includes(q)));
  }, [filteredNameOptions, nameSearchQuery]);

  const displayName = useMemo(() => {
    if (selectedName === 'all') return 'All Profiles (Entire Agency)';
    const match = filteredNameOptions.find(o => o.id === selectedName || o.name === selectedName);
    return match ? match.name : (selectedName || 'Select Name...');
  }, [selectedName, filteredNameOptions]);

  const handleTypeChange = (newType) => {
    setType(newType);
    let defaultOpt = 'all';
    if (newType === 'bd' && bdAgents?.length > 0) defaultOpt = String(bdAgents[0].id || bdAgents[0].name);
    else if (newType === 'tl' && teamLeaders?.length > 0) defaultOpt = String(teamLeaders[0].id || teamLeaders[0].name);
    else if (newType === 'franchise' && franchisees?.length > 0) defaultOpt = String(franchisees[0].id || franchisees[0].name);
    setSelectedName(defaultOpt);
    setNameSearchQuery('');
    setIsNameDropdownOpen(false);
    setAriaAnnouncement(`Filter type changed to ${newType}. Showing ${defaultOpt}.`);
  };

  const handleSelectName = (opt) => {
    setSelectedName(opt.id || opt.name);
    setNameSearchQuery('');
    setIsNameDropdownOpen(false);
    setAriaAnnouncement(`Selected name ${opt.name}.`);
  };

  const handleFyChange = (newFy) => {
    setSelectedFy(newFy);
    setAriaAnnouncement(`Financial year updated to ${newFy}.`);
  };

  const handleNameKeyDown = (e) => {
    if (!isNameDropdownOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsNameDropdownOpen(true);
        e.preventDefault();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < visibleNameOptions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : visibleNameOptions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < visibleNameOptions.length) {
        handleSelectName(visibleNameOptions[highlightedIndex]);
      } else if (visibleNameOptions.length > 0) {
        handleSelectName(visibleNameOptions[0]);
      }
    } else if (e.key === 'Escape') {
      setIsNameDropdownOpen(false);
    }
  };

  // Step 3 Filter Row Keys & Keyboard Interaction
  const filterKeys = useMemo(() => {
    const keys = ['all', 'invoiced', 'progressed', 'cancelled'];
    if (summaryData?.totals?.other?.count > 0) keys.push('other');
    return keys;
  }, [summaryData]);

  const handleFilterKeyDown = (e, currentKey) => {
    const idx = filterKeys.indexOf(currentKey);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = (idx + 1) % filterKeys.length;
      setActiveFilter(filterKeys[nextIdx]);
      setDealTablePage(1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIdx = (idx - 1 + filterKeys.length) % filterKeys.length;
      setActiveFilter(filterKeys[prevIdx]);
      setDealTablePage(1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setActiveFilter(currentKey);
      setDealTablePage(1);
    }
  };

  // Step 3 Deal Table Filtering & Pagination
  const filteredDeals = useMemo(() => {
    if (!summaryData || !summaryData.deals) return [];
    let list = summaryData.deals;
    if (activeFilter !== 'all') {
      list = list.filter(d => d.status === activeFilter);
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
  }, [summaryData, activeFilter, dealTableSearch]);

  const paginatedDeals = useMemo(() => {
    const start = (dealTablePage - 1) * DEALS_PER_PAGE;
    return filteredDeals.slice(start, start + DEALS_PER_PAGE);
  }, [filteredDeals, dealTablePage]);

  const totalDealPages = Math.max(1, Math.ceil(filteredDeals.length / DEALS_PER_PAGE));

  const handleDealRowClick = (deal) => {
    const tx = [{
      id: deal.id,
      referenceId: deal.referenceId,
      billNumber: deal.bill_no || deal.referenceId,
      billDate: deal.date,
      companyName: deal.companyName,
      candidateName: deal.candidateName,
      positionName: deal.positionName,
      bdMemberName: deal.bdMemberName,
      teamLeaderName: deal.teamLeaderName,
      franchiseeName: deal.franchiseeName,
      totalBillAmt: deal.amount,
      amount: deal.amount,
      status: deal.status,
      rawStatus: deal.raw_status,
      info: deal.raw_status,
      industry: deal.industry
    }];
    setAuditTransactions(tx);
    setAuditPanelTitle(`Enquiry Audit #${deal.referenceId}`);
    setAuditPanelSubtitle(`${deal.companyName} • ${deal.positionName || 'Placement Mandate'}`);
    setIsAuditPanelOpen(true);
  };

  const handleOpenFullAudit = () => {
    if (!summaryData?.deals) return;
    const txs = summaryData.deals.map(d => ({
      id: d.id,
      referenceId: d.referenceId,
      billNumber: d.bill_no || d.referenceId,
      billDate: d.date,
      companyName: d.companyName,
      candidateName: d.candidateName,
      positionName: d.positionName,
      bdMemberName: d.bdMemberName,
      teamLeaderName: d.teamLeaderName,
      franchiseeName: d.franchiseeName,
      totalBillAmt: d.amount,
      amount: d.amount,
      status: d.status,
      rawStatus: d.raw_status,
      info: d.raw_status,
      industry: d.industry
    }));
    setAuditTransactions(txs);
    setAuditPanelTitle(`${summaryData.display_name || 'Portfolio'} Audit`);
    setAuditPanelSubtitle(`${selectedFy} • ${summaryData.totals?.all?.count || 0} Total Mandates`);
    setIsAuditPanelOpen(true);
  };

  // Live Company Breakdown State (for Macro Multiplier Execution Plan)
  const [companyBreakdown, setCompanyBreakdown] = useState(null);
  const [companyBreakdownLoading, setCompanyBreakdownLoading] = useState(false);

  // Prediction & Scenario state
  const [predictionData, setPredictionData] = useState(null);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [predictionError, setPredictionError] = useState(null);
  const [overrideRate, setOverrideRate] = useState('');
  const [forecastTab, setForecastTab] = useState('target'); // 'target' (Aspirational Goal) | 'inertia' (Historical Trend)
  const [activeScenarioMultiplier, setActiveScenarioMultiplier] = useState(2); // 1, 2, 3, 4, 5

  // Goal Mode & Interactive Placements Target Controls
  const [targetControlMode, setTargetControlMode] = useState('rate'); // 'rate' | 'placements'
  const [targetPlacementCount, setTargetPlacementCount] = useState('');
  const [goalModalParams, setGoalModalParams] = useState(null);

  // Target History & Modals state
  const [targetsList, setTargetsList] = useState([]);
  const [targetsLoading, setTargetsLoading] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [activeOutcomeTarget, setActiveOutcomeTarget] = useState(null);
  const [viewingLetter, setViewingLetter] = useState(null);
  const [letterCopied, setLetterCopied] = useState(false);

  // Pagination
  const [historyPage, setHistoryPage] = useState(1);
  const ITEMS_PER_PAGE = 6;

  // In-memory client cache refs for instantaneous rendering
  const rosterCacheRef = useRef({});
  const predictionCacheRef = useRef({});

  // 1. Fetch Dynamic Roster from backend with SWR
  const fetchRoster = async () => {
    if (rosterCacheRef.current[entityType]) {
      setServerRoster(rosterCacheRef.current[entityType]);
    } else {
      setRosterLoading(true);
    }
    try {
      const data = await fetchJsonWithApiKey(`${API_BASE_URL}/growth-targets/roster?entity_type=${entityType}`);
      const list = Array.isArray(data?.roster) ? data.roster : (Array.isArray(data) ? data : []);
      if (list.length > 0) {
        rosterCacheRef.current[entityType] = list;
        setServerRoster(list);
      }
    } catch (err) {
      console.warn("Could not load dynamic roster, falling back to local context:", err);
    } finally {
      setRosterLoading(false);
    }
  };

  useEffect(() => {
    fetchRoster();
  }, [entityType]);

  // Fetch live Company-Wide Breakdown by Team Leader for Overall Company mode
  useEffect(() => {
    if (entityType === 'company') {
      setCompanyBreakdownLoading(true);
      fetchWithApiKey(`${API_BASE_URL}/growth-targets/company-breakdown`)
        .then(res => {
          if (res && res.ok) return res.json();
        })
        .then(data => {
          if (data && data.team_leaders) {
            setCompanyBreakdown(data);
          }
        })
        .catch(err => console.warn("Notice: Live company breakdown API notice:", err))
        .finally(() => setCompanyBreakdownLoading(false));
    }
  }, [entityType]);

  // Build entity options combining server roster and context fallbacks
  const entityOptions = useMemo(() => {
    if (entityType === 'company') {
      let liveDeals = 0;
      let liveRev = 0;
      if (transactions && transactions.length > 0) {
        transactions.forEach(tx => {
          if (tx.type !== 'credit_note' && tx.info !== 'CN') {
            liveDeals += 1;
            liveRev += parseFloat(tx.totalBillAmt || tx.amount || 0);
          }
        });
      }
      return [
        { 
          id: 'comp-overall', 
          name: 'Overall Company', 
          type: 'company', 
          role: 'Total Agency Portfolio', 
          total_deals: liveDeals, 
          total_revenue: liveRev 
        }
      ];
    }

    if (serverRoster && serverRoster.length > 0) {
      return serverRoster;
    }

    if (entityType === 'franchisee') {
      const base = (franchisees && franchisees.length > 0)
        ? franchisees.map(f => ({ id: String(f.id), name: f.name || f.nameAsPerAgreement, type: 'franchisee', role: 'Franchise Partner', total_revenue: f.revenue || 0, total_deals: f.deals || 0 }))
        : [];
      return base;
    } else if (entityType === 'bd_agent') {
      const base = (bdAgents && bdAgents.length > 0)
        ? bdAgents.map(b => ({ id: String(b.id), name: b.name, type: 'bd_agent', role: 'BD Specialist', total_revenue: b.grossRevenue || 0, total_deals: b.deals || 0 }))
        : [];
      return base;
    } else if (entityType === 'team_leader') {
      const base = (teamLeaders && teamLeaders.length > 0)
        ? teamLeaders.map(t => ({ id: String(t.id), name: t.name, type: 'team_leader', role: t.role || 'Team Leader', total_revenue: t.grossRevenue || t.target || 0, total_deals: t.deals || 0 }))
        : [];
      return base;
    } else {
      return [];
    }
  }, [entityType, serverRoster, franchisees, bdAgents, teamLeaders, transactions]);

  // Set default selected entity if empty or switched tabs
  useEffect(() => {
    if (entityType === 'company') {
      setSelectedEntityId('comp-overall');
    } else if (entityOptions.length > 0) {
      const exists = entityOptions.some(e => e.id === selectedEntityId || e.name === selectedEntityId);
      if (!exists || selectedEntityId === 'comp-overall') {
        setSelectedEntityId(entityOptions[0].id);
      }
    }
  }, [entityType, entityOptions, selectedEntityId]);

  const selectedEntity = useMemo(() => {
    return entityOptions.find(e => e.id === selectedEntityId || e.name === selectedEntityId) || entityOptions[0] || null;
  }, [entityOptions, selectedEntityId]);

  // Fetch prediction data (5 years) whenever entity or rate changes with resilient SWR
  const fetchPrediction = async (customRateVal) => {
    if (!selectedEntity) return;
    const cacheKey = `${entityType}_${selectedEntity.id || selectedEntity.name}_${customRateVal !== undefined ? customRateVal : ''}`;
    const storageKey = `fintective_predict_${cacheKey}`;
    
    // Check in-memory or sessionStorage cache first for instantaneous rendering
    if (predictionCacheRef.current[cacheKey]) {
      setPredictionData(predictionCacheRef.current[cacheKey]);
    } else {
      try {
        const stored = sessionStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          predictionCacheRef.current[cacheKey] = parsed;
          setPredictionData(parsed);
        } else {
          setPredictionLoading(true);
        }
      } catch {
        setPredictionLoading(true);
      }
    }
    setPredictionError(null);

    try {
      const rateParam = (customRateVal !== undefined && customRateVal !== '') ? `&rate=${customRateVal}` : '';
      const url = `${API_BASE_URL}/growth-targets/predict?entity_type=${entityType}&entity_id=${encodeURIComponent(selectedEntity.id || selectedEntity.name)}&entity_name=${encodeURIComponent(selectedEntity.name || '')}${rateParam}&periods=5`;
      
      const data = await fetchJsonWithApiKey(url);
      if (data) {
        predictionCacheRef.current[cacheKey] = data;
        try {
          sessionStorage.setItem(storageKey, JSON.stringify(data));
        } catch {}
        setPredictionData(data);
        setPredictionError(null);

        if (data.insufficient_data || data.projection_status === 'insufficient_data') {
          setOverrideRate('');
        } else if (customRateVal === undefined || customRateVal === '') {
          // If historical CAGR is positive, use it as default target (capped at +35% for initial baseline). If negative, default goal target rate to +15.0%
          const histCagr = data.historical_cagr_pct;
          const defaultTargetRate = (histCagr !== undefined && histCagr !== null && histCagr > 0) ? Math.min(35, histCagr) : 15;
          setOverrideRate(String(defaultTargetRate));
        }
      }
    } catch (err) {
      console.warn("Notice: growth prediction API offline / unreachable, using local entity records:", err);
      // Only show error banner if we have absolutely no prediction data to render
      if (!predictionCacheRef.current[cacheKey]) {
        setPredictionError('Unable to connect to live API server. Rendering roadmap using local ledger records.');
      }
    } finally {
      setPredictionLoading(false);
    }
  };

  // Fetch targets list
  const fetchTargets = async () => {
    if (!selectedEntity) return;
    setTargetsLoading(true);

    // 1. Instant local storage hydration
    let localTargets = [];
    try {
      const savedRaw = localStorage.getItem('saarthi_growth_targets');
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw);
        if (Array.isArray(parsed)) {
          const entKey = (selectedEntity.id || selectedEntity.name || '').toLowerCase();
          const entName = (selectedEntity.name || '').toLowerCase();
          localTargets = parsed.filter(t => {
            const tId = (t.entity_id || '').toLowerCase();
            const tName = (t.entity_name || '').toLowerCase();
            const tType = (t.entity_type || '').toLowerCase();
            return (tType === entityType.toLowerCase()) && (tId === entKey || tName === entName || (tId.includes(entKey) && entKey.length > 3));
          });
        }
      }
    } catch (e) {
      console.warn('Error reading local targets:', e);
    }

    if (localTargets.length > 0) {
      setTargetsList(localTargets);
    }

    // 2. Fetch live server targets and merge
    try {
      const url = `${API_BASE_URL}/growth-targets?entity_type=${entityType}&entity_id=${encodeURIComponent(selectedEntity.id || selectedEntity.name)}&entity_name=${encodeURIComponent(selectedEntity.name || '')}`;
      const res = await fetchWithApiKey(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const serverIds = new Set(data.map(t => t.id));
          const merged = [...data, ...localTargets.filter(t => !serverIds.has(t.id))];
          setTargetsList(merged);
        }
      }
    } catch (err) {
      console.warn("Using local targets storage:", err);
    } finally {
      setTargetsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedEntity) {
      fetchPrediction();
      fetchTargets();
    }
  }, [entityType, selectedEntityId]);

  const handleRateChange = (newRate) => {
    setOverrideRate(newRate);
    if (newRate !== '' && !isNaN(Number(newRate))) {
      fetchPrediction(newRate);
    }
  };

  const handleResetRate = () => {
    const histCagr = predictionData?.historical_cagr_pct;
    const defaultRate = (histCagr !== undefined && histCagr !== null && histCagr > 0) ? Math.min(35, histCagr) : 15;
    setOverrideRate(String(defaultRate));
    fetchPrediction(String(defaultRate));
    if (baseDealsCount > 0) {
      const impliedDeals = Math.max(1, Math.round(baseDealsCount * (1 + defaultRate / 100)));
      setTargetPlacementCount(String(impliedDeals));
    }
  };

  const handleCopyLetter = (text) => {
    navigator.clipboard.writeText(text);
    setLetterCopied(true);
    setTimeout(() => setLetterCopied(false), 2500);
  };

  const activeTarget = useMemo(() => {
    return targetsList.find(t => t.status === 'active') || null;
  }, [targetsList]);

  // Historical series for TrajectoryLineChart
  const chartHistorical = useMemo(() => {
    if (predictionData?.historical_series && predictionData.historical_series.length > 0) {
      return predictionData.historical_series;
    }
    if (entityType === 'company') {
      return [];
    }
    const baseRev = selectedEntity?.total_revenue || selectedEntity?.revenue || 0;
    const baseD = selectedEntity?.total_deals || selectedEntity?.deals_count || 0;
    if (baseRev === 0 && baseD === 0) {
      return [];
    }
    return [
      { period: 'FY 2025-26', revenue: baseRev, deals_count: baseD }
    ];
  }, [entityType, predictionData, selectedEntity]);

  // Effective base revenue strictly from real database historical inflow with local fallback
  const effectiveBaseRevenue = useMemo(() => {
    if (entityType === 'company') {
      if (companyBreakdown?.total_billing && companyBreakdown.total_billing > 0) {
        return companyBreakdown.total_billing;
      }
      if (predictionData?.base_revenue && predictionData.base_revenue > 0) {
        return predictionData.base_revenue;
      }
      if (chartHistorical.length > 0 && chartHistorical[chartHistorical.length - 1].revenue > 0) {
        return chartHistorical[chartHistorical.length - 1].revenue;
      }
      let liveRev = 0;
      (transactions || []).forEach(tx => {
        if (tx.type === 'income' && (tx.category === 'Recruitment' || tx.category === 'Recruitment Fee')) {
          liveRev += parseFloat(tx.totalBillAmt || tx.amount || 0);
        }
      });
      return liveRev;
    }
    if (predictionData?.base_revenue && predictionData.base_revenue > 0) {
      return predictionData.base_revenue;
    }
    if (chartHistorical.length > 0 && chartHistorical[chartHistorical.length - 1].revenue > 0) {
      return chartHistorical[chartHistorical.length - 1].revenue;
    }
    if (selectedEntity?.total_revenue && selectedEntity.total_revenue > 0) {
      return selectedEntity.total_revenue;
    }
    if (selectedEntity?.revenue && selectedEntity.revenue > 0) {
      return selectedEntity.revenue;
    }
    return 0;
  }, [entityType, predictionData, chartHistorical, selectedEntity, transactions, companyBreakdown]);

  // Base deals count & present actuals
  const baseDealsCount = useMemo(() => {
    if (entityType === 'company') {
      if (companyBreakdown?.total_deals && companyBreakdown.total_deals > 0) {
        return companyBreakdown.total_deals;
      }
      if (chartHistorical.length > 0 && chartHistorical[chartHistorical.length - 1].deals_count > 0) {
        return chartHistorical[chartHistorical.length - 1].deals_count;
      }
      let liveDeals = 0;
      (transactions || []).forEach(tx => {
        if (tx.type === 'income' && (tx.category === 'Recruitment' || tx.category === 'Recruitment Fee')) {
          liveDeals += 1;
        }
      });
      return liveDeals;
    }
    if (chartHistorical.length > 0 && chartHistorical[chartHistorical.length - 1].deals_count > 0) {
      return chartHistorical[chartHistorical.length - 1].deals_count;
    }
    return selectedEntity?.total_deals || selectedEntity?.deals_count || 0;
  }, [entityType, chartHistorical, selectedEntity, transactions, companyBreakdown]);

  // Present Closed Deals & Ticket Size Metrics
  const presentDealsCount = useMemo(() => {
    if (entityType === 'company') {
      if (companyBreakdown?.total_deals && companyBreakdown.total_deals > 0) {
        return companyBreakdown.total_deals;
      }
      if (chartHistorical.length > 0 && chartHistorical[chartHistorical.length - 1].deals_count > 0) {
        return chartHistorical[chartHistorical.length - 1].deals_count;
      }
      let liveDeals = 0;
      (transactions || []).forEach(tx => {
        if (tx.type === 'income' && (tx.category === 'Recruitment' || tx.category === 'Recruitment Fee')) {
          liveDeals += 1;
        }
      });
      return liveDeals > 0 ? liveDeals : baseDealsCount;
    }
    if (chartHistorical.length > 0 && chartHistorical[chartHistorical.length - 1].deals_count > 0) {
      return chartHistorical[chartHistorical.length - 1].deals_count;
    }
    return selectedEntity?.total_deals || selectedEntity?.deals_count || baseDealsCount || 0;
  }, [entityType, chartHistorical, selectedEntity, baseDealsCount, transactions, companyBreakdown]);

  const presentMonthlyDeals = useMemo(() => {
    return (presentDealsCount / 12).toFixed(1);
  }, [presentDealsCount]);

  const avgDealValue = useMemo(() => {
    return presentDealsCount > 0 ? Math.round(effectiveBaseRevenue / presentDealsCount) : 0;
  }, [effectiveBaseRevenue, presentDealsCount]);

  // Historical CAGR
  const historicalCagrPct = useMemo(() => {
    return predictionData?.historical_cagr_pct ?? 0;
  }, [predictionData]);

  const isHistoricalDeclining = historicalCagrPct < 0;

  // Target Growth Rate (R) in percentage for forward aspirational goal setting
  const targetRatePct = useMemo(() => {
    if (overrideRate !== '' && overrideRate !== null && overrideRate !== undefined) {
      return parseFloat(overrideRate) || 0;
    }
    if (historicalCagrPct > 0) {
      return historicalCagrPct;
    }
    return 0;
  }, [overrideRate, historicalCagrPct]);

  // Handle placement target change
  const handlePlacementCountChange = (countVal) => {
    setTargetPlacementCount(countVal);
    const count = parseFloat(countVal) || 0;
    if (baseDealsCount > 0 && count > 0) {
      const impliedGrowth = ((count / baseDealsCount) - 1) * 100;
      const roundedRate = String(parseFloat(impliedGrowth.toFixed(1)));
      setOverrideRate(roundedRate);
      fetchPrediction(roundedRate);
    }
  };

  // Sync targetPlacementCount when entity, base deals, or rate changes
  useEffect(() => {
    if (presentDealsCount > 0) {
      const implied = Math.max(1, Math.round(presentDealsCount * (1 + targetRatePct / 100)));
      setTargetPlacementCount(String(implied));
    }
  }, [selectedEntityId, presentDealsCount, targetRatePct]);

  const targetRequiredDeals = useMemo(() => {
    return presentDealsCount > 0 ? Math.max(1, Math.round(presentDealsCount * (1 + targetRatePct / 100))) : 0;
  }, [presentDealsCount, targetRatePct]);

  const targetMonthlyDeals = useMemo(() => {
    return (targetRequiredDeals / 12).toFixed(1);
  }, [targetRequiredDeals]);

  const incrementalDeals = useMemo(() => {
    return targetRequiredDeals - presentDealsCount;
  }, [targetRequiredDeals, presentDealsCount]);

  // Inertia Growth Rate (R) in percentage (pure historical extrapolation)
  const inertiaRatePct = historicalCagrPct;

  const isInsufficientData = Boolean(
    predictionData?.insufficient_data || 
    predictionData?.projection_status === 'insufficient_data' ||
    effectiveBaseRevenue <= 0
  );

  // Helper generator for 5-Year Projections
  const computeProjections = (rateVal) => {
    if (isInsufficientData || effectiveBaseRevenue <= 0 || rateVal === null || rateVal === undefined) {
      return [];
    }
    const base = effectiveBaseRevenue;
    const r = rateVal / 100;
    const baseD = baseDealsCount > 0 ? baseDealsCount : 0;
    let cum = 0;
    return [1, 2, 3, 4, 5].map(t => {
      const multiplier = Math.pow(1 + r, t);
      const projVal = base * multiplier;
      const growthPct = (multiplier - 1) * 100;
      cum += projVal;
      return {
        year_index: t,
        period_label: `Year +${t}`,
        projected_revenue: Math.round(projVal),
        growth_pct: parseFloat(growthPct.toFixed(1)),
        incremental_gain: Math.round(projVal - base),
        projected_deals: Math.max(1, Math.round(baseD * multiplier)),
        cumulative_revenue: Math.round(cum)
      };
    });
  };

  const targetProjections = useMemo(() => computeProjections(targetRatePct), [isInsufficientData, effectiveBaseRevenue, targetRatePct, baseDealsCount]);
  const inertiaProjections = useMemo(() => computeProjections(inertiaRatePct), [isInsufficientData, effectiveBaseRevenue, inertiaRatePct, baseDealsCount]);
  const activeProjections = forecastTab === 'target' ? targetProjections : inertiaProjections;

  // Trajectory Sparkline points for each target milestone
  const getTargetSparklinePoints = (target) => {
    const targetPct = Number(target.growth_pct_target_pct) || 15;
    if (target.status === 'completed' && target.actual_growth_pct_pct !== null) {
      const act = Number(target.actual_growth_pct_pct);
      const start = 100;
      return [start, start + act * 0.25, start + act * 0.55, start + act * 0.85, start + act];
    }
    return [100, 100 + targetPct * 0.2, 100 + targetPct * 0.45, 100 + targetPct * 0.7];
  };

  const productivity = predictionData?.productivity_score;

  // Live audited net retention rate from CRM (ourShare / totalBillAmt)
  // Replaces the inaccurate 43.75% hardcoded placeholder
  // Formula: SUM(ourShare) / SUM(totalBillAmt) across all invoices with filled ourShare
  const netRetentionRate = useMemo(() => {
    if (companyBreakdown?.net_retention_rate && companyBreakdown.net_retention_rate > 0) {
      return companyBreakdown.net_retention_rate;  // live from DB e.g. 0.1913
    }
    return DEFAULT_COMPANY_SHARE_RATE;  // standard 25% company retained share
  }, [companyBreakdown]);

  // Scale chart data formatted for BarChart (1x to 5x)
  const scaleChartData = useMemo(() => {
    if (isInsufficientData || effectiveBaseRevenue <= 0) {
      return [];
    }
    return [1, 2, 3, 4, 5].map(mult => {
      const base = effectiveBaseRevenue;
      return {
        label: `${mult}x`,
        revenue: base * mult,
        netRetention: Math.round(base * mult * netRetentionRate)
      };
    });
  }, [isInsufficientData, effectiveBaseRevenue, netRetentionRate]);

  // Live Team Leader Quotas and Franchise Distribution for Macro Multiplier
  const liveTeamLeaderQuotas = useMemo(() => {
    // 1. If backend API returned live breakdown, use it directly
    if (companyBreakdown?.team_leaders && companyBreakdown.team_leaders.length > 0) {
      return companyBreakdown.team_leaders.map(tl => ({
        name: tl.name,
        activeFranchises: tl.active_franchises || 1,
        billingStores: tl.billing_stores || tl.active_franchises,
        baseDeals: tl.deals || 1,
        baseBilling: tl.billing || 0,
        share: tl.share_of_billing || 0.25
      }));
    }

    // 2. Otherwise compute dynamically from live FinanceContext transactions & franchisees
    const EXCLUSIONS = new Set(['head office', 'head  - office', 'unknown', 'prospect', 'old . tl', 'pune . office', '']);

    // Map registered active franchises from franchisees context
    const franCountByTl = {};
    (franchisees || []).forEach(f => {
      const tlName = (f.teamLeaderName || f.owner || '').trim();
      if (tlName && !EXCLUSIONS.has(tlName.toLowerCase()) && (f.status === 'Active' || !f.status)) {
        const clean = tlName.replace(/\s+/g, ' ');
        franCountByTl[clean.toLowerCase()] = (franCountByTl[clean.toLowerCase()] || 0) + 1;
      }
    });

    // Aggregate deals and billing from transactions context
    const tlMap = {};
    let totalValidBilling = 0;
    (transactions || []).forEach(tx => {
      const rawTl = (tx.teamLeader || tx.teamLeaderName || '').trim();
      if (!rawTl || EXCLUSIONS.has(rawTl.toLowerCase())) return;
      const cleanTl = rawTl.replace(/\s+/g, ' ');
      const lower = cleanTl.toLowerCase();

      if (!tlMap[lower]) {
        tlMap[lower] = {
          name: cleanTl,
          deals: 0,
          billing: 0,
          uniqueFranchises: new Set()
        };
      }

      const isCN = tx.type === 'credit_note' || tx.info === 'CN';
      if (!isCN) {
        tlMap[lower].deals += 1;
        const amt = parseFloat(tx.totalBillAmt || tx.amount || 0);
        tlMap[lower].billing += amt;
        totalValidBilling += amt;
        if (tx.franchiseName || tx.franchiseeName) {
          tlMap[lower].uniqueFranchises.add((tx.franchiseName || tx.franchiseeName).trim().toLowerCase());
        }
      }
    });

    const list = Object.values(tlMap).map(item => {
      const lower = item.name.toLowerCase();
      const registeredCount = franCountByTl[lower] || 0;
      const activeFranchises = registeredCount > 0 ? registeredCount : Math.max(1, item.uniqueFranchises.size);
      const share = totalValidBilling > 0 ? item.billing / totalValidBilling : 0.25;

      return {
        name: item.name,
        activeFranchises,
        billingStores: item.uniqueFranchises.size || activeFranchises,
        baseDeals: item.deals,
        baseBilling: item.billing,
        share
      };
    });

    if (list.length > 0) {
      list.sort((a, b) => b.baseDeals - a.baseDeals);
      return list;
    }

    return [];
  }, [companyBreakdown, transactions, franchisees]);

  return (
    <div className="bd-performance-page animate-fade-in" style={{ paddingBottom: '40px' }}>
      <style>{`
        #growth-type-select:focus-visible,
        #growth-name-search:focus-visible,
        #growth-fy-select:focus-visible,
        .growth-selector-btn:focus-visible {
          outline: 2px solid var(--accent-teal, #0F6E56) !important;
          outline-offset: 1px;
        }
      `}</style>
      
      {/* Page Title & Subtitle */}
      <div style={{ marginBottom: '18px' }}>
        <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: '700', color: 'var(--text-main)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Award size={26} color="var(--accent-teal)" />
          Growth targets
        </h2>
        <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
          Goals, progress and where you're heading
        </span>
      </div>

      {/* Step 2 Accessible Selectors Toolbar */}
      <div 
        className="growth-selectors-card"
        style={{
          background: '#FFFFFF',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          padding: '16px 20px',
          marginBottom: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px', flex: '1 1 auto' }}>
            
            {/* 1. Type Selector */}
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: '150px' }}>
              <label 
                htmlFor="growth-type-select" 
                style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '6px' }}
              >
                Type
              </label>
              <select
                id="growth-type-select"
                value={type}
                onChange={(e) => handleTypeChange(e.target.value)}
                style={{
                  height: '40px',
                  padding: '0 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: '#FFFFFF',
                  color: 'var(--text-main)',
                  fontSize: '0.88rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                <option value="bd">BD Specialist</option>
                <option value="tl">Team Leader</option>
                <option value="franchise">Franchise Partner</option>
                <option value="all">All</option>
              </select>
            </div>

            {/* 2. Name Searchable Select */}
            <div 
              ref={nameSelectContainerRef} 
              style={{ display: 'flex', flexDirection: 'column', position: 'relative', minWidth: '240px', flex: '1 1 240px', maxWidth: '380px' }}
            >
              <label 
                htmlFor="growth-name-search" 
                style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '6px' }}
              >
                Name
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="growth-name-search"
                  type="text"
                  role="combobox"
                  aria-expanded={isNameDropdownOpen}
                  aria-autocomplete="list"
                  aria-controls="growth-name-listbox"
                  placeholder={displayName}
                  value={isNameDropdownOpen ? nameSearchQuery : displayName}
                  onFocus={() => { setIsNameDropdownOpen(true); setNameSearchQuery(''); }}
                  onChange={(e) => setNameSearchQuery(e.target.value)}
                  onKeyDown={handleNameKeyDown}
                  style={{
                    width: '100%',
                    height: '40px',
                    padding: '0 32px 0 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: '#FFFFFF',
                    color: 'var(--text-main)',
                    fontSize: '0.88rem',
                    fontWeight: '500',
                    boxSizing: 'border-box'
                  }}
                />
                <div style={{ position: 'absolute', right: '10px', top: '12px', pointerEvents: 'none', color: 'var(--text-muted)' }}>
                  <ChevronDown size={16} />
                </div>
              </div>

              {/* Dropdown Options */}
              {isNameDropdownOpen && (
                <ul
                  id="growth-name-listbox"
                  role="listbox"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    maxHeight: '260px',
                    overflowY: 'auto',
                    background: '#FFFFFF',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
                    zIndex: 50,
                    margin: '4px 0 0 0',
                    padding: '4px',
                    listStyle: 'none'
                  }}
                >
                  {visibleNameOptions.length === 0 ? (
                    <li style={{ padding: '10px 12px', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                      No matching names found
                    </li>
                  ) : (
                    visibleNameOptions.map((opt, idx) => {
                      const isSelected = selectedName === opt.id || selectedName === opt.name;
                      const isHighlighted = highlightedIndex === idx;
                      return (
                        <li
                          key={opt.id || opt.name}
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => handleSelectName(opt)}
                          onMouseEnter={() => setHighlightedIndex(idx)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '4px',
                            fontSize: '0.86rem',
                            fontWeight: isSelected ? '700' : '400',
                            color: isSelected ? 'var(--accent-teal)' : 'var(--text-main)',
                            background: isHighlighted ? 'rgba(15, 110, 86, 0.08)' : (isSelected ? 'rgba(15, 110, 86, 0.04)' : 'transparent'),
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <span>{opt.name}</span>
                          {opt.role && <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{opt.role}</span>}
                        </li>
                      );
                    })
                  )}
                </ul>
              )}
            </div>

            {/* 3. FY Selector */}
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: '130px' }}>
              <label 
                htmlFor="growth-fy-select" 
                style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '6px' }}
              >
                FY
              </label>
              <select
                id="growth-fy-select"
                value={selectedFy}
                onChange={(e) => handleFyChange(e.target.value)}
                style={{
                  height: '40px',
                  padding: '0 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: '#FFFFFF',
                  color: 'var(--text-main)',
                  fontSize: '0.88rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                <option value="FY 2026-27">FY 2026-27</option>
                <option value="FY 2025-26">FY 2025-26</option>
                <option value="FY 2024-25">FY 2024-25</option>
                <option value="FY 2023-24">FY 2023-24</option>
              </select>
            </div>
          </div>

          {/* 4. [Set goal] Action Button */}
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-primary growth-selector-btn"
              onClick={() => setIsGoalModalOpen(true)}
              style={{
                height: '40px',
                padding: '0 18px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'var(--accent-teal)',
                color: '#FFFFFF',
                fontWeight: '600',
                fontSize: '0.86rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 6px rgba(15, 110, 86, 0.25)'
              }}
            >
              <Target size={16} />
              Set goal
            </button>
          </div>
        </div>

        {/* Live Accessibility Screen-Reader Announcement */}
        <div aria-live="polite" aria-atomic="true" style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}>
          {ariaAnnouncement}
        </div>
      </div>

      {/* =========================================================================
          STEP 3: PAGE CONTENT (FILTERS, SUMMARY LINE, STATUS VIEW, PLAN, COMPARE)
          ========================================================================= */}

      {/* 1. Live Headline Sentence on Top */}
      {summaryData?.headline && (
        <div 
          style={{
            background: 'linear-gradient(90deg, rgba(15, 110, 86, 0.08) 0%, rgba(37, 99, 235, 0.05) 100%)',
            border: '1px solid rgba(15, 110, 86, 0.22)',
            borderRadius: '8px',
            padding: '10px 16px',
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} color="var(--accent-teal)" />
            <span style={{ fontSize: '0.92rem', fontWeight: '700', color: 'var(--text-main)' }}>
              {summaryData.headline}
            </span>
          </div>
          <button
            type="button"
            onClick={handleOpenFullAudit}
            style={{
              padding: '4px 10px',
              borderRadius: '5px',
              border: '1px solid var(--accent-teal)',
              background: '#FFFFFF',
              color: 'var(--accent-teal)',
              fontSize: '0.74rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            Full Portfolio Audit <ChevronRight size={13} />
          </button>
        </div>
      )}

      {/* 2. FILTER ROW (single-select radio group) */}
      <div 
        role="radiogroup" 
        aria-label="Enquiry status filter"
        style={{
          background: '#FFFFFF',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          padding: '10px 14px',
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
        }}
      >
        <span style={{ fontSize: '0.76rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: '4px' }}>
          Filter Status:
        </span>

        {/* Option 1: All */}
        {(() => {
          const isAct = activeFilter === 'all';
          const cnt = summaryData?.totals?.all?.count ?? 0;
          return (
            <button
              type="button"
              role="radio"
              aria-checked={isAct}
              tabIndex={isAct ? 0 : -1}
              onClick={() => { setActiveFilter('all'); setDealTablePage(1); }}
              onKeyDown={(e) => handleFilterKeyDown(e, 'all')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '20px',
                border: isAct ? '2px solid var(--accent-teal)' : '1px solid var(--border-color)',
                background: isAct ? 'rgba(15, 110, 86, 0.12)' : '#FFFFFF',
                color: isAct ? 'var(--accent-teal)' : 'var(--text-main)',
                fontSize: '0.82rem',
                fontWeight: isAct ? '700' : '500',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {isAct && <Check size={14} color="var(--accent-teal)" />}
              <span>All · {cnt}</span>
            </button>
          );
        })()}

        {/* Option 2: Invoices (Green) */}
        {(() => {
          const isAct = activeFilter === 'invoiced';
          const cnt = summaryData?.totals?.invoiced?.count ?? 0;
          const rev = summaryData?.totals?.invoiced?.revenue ?? 0;
          return (
            <button
              type="button"
              role="radio"
              aria-checked={isAct}
              tabIndex={isAct ? 0 : -1}
              onClick={() => { setActiveFilter('invoiced'); setDealTablePage(1); }}
              onKeyDown={(e) => handleFilterKeyDown(e, 'invoiced')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '20px',
                border: isAct ? '2px solid #10B981' : '1px solid var(--border-color)',
                background: isAct ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.05)',
                color: isAct ? '#065F46' : 'var(--text-main)',
                fontSize: '0.82rem',
                fontWeight: isAct ? '700' : '500',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {isAct && <Check size={14} color="#065F46" />}
              <span>Invoices · {cnt} · {formatCurrency(rev)}</span>
            </button>
          );
        })()}

        {/* Option 3: Progressed (Blue) */}
        {(() => {
          const isAct = activeFilter === 'progressed';
          const cnt = summaryData?.totals?.progressed?.count ?? 0;
          const rev = summaryData?.totals?.progressed?.revenue ?? 0;
          return (
            <button
              type="button"
              role="radio"
              aria-checked={isAct}
              tabIndex={isAct ? 0 : -1}
              onClick={() => { setActiveFilter('progressed'); setDealTablePage(1); }}
              onKeyDown={(e) => handleFilterKeyDown(e, 'progressed')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '20px',
                border: isAct ? '2px solid #2563EB' : '1px solid var(--border-color)',
                background: isAct ? 'rgba(37, 99, 235, 0.15)' : 'rgba(37, 99, 235, 0.05)',
                color: isAct ? '#1E40AF' : 'var(--text-main)',
                fontSize: '0.82rem',
                fontWeight: isAct ? '700' : '500',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {isAct && <Check size={14} color="#1E40AF" />}
              <span>Progressed · {cnt} · {formatCurrency(rev)}</span>
            </button>
          );
        })()}

        {/* Option 4: Cancelled (Red) */}
        {(() => {
          const isAct = activeFilter === 'cancelled';
          const cnt = summaryData?.totals?.cancelled?.count ?? 0;
          const rev = summaryData?.totals?.cancelled?.revenue ?? 0;
          return (
            <button
              type="button"
              role="radio"
              aria-checked={isAct}
              tabIndex={isAct ? 0 : -1}
              onClick={() => { setActiveFilter('cancelled'); setDealTablePage(1); }}
              onKeyDown={(e) => handleFilterKeyDown(e, 'cancelled')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '20px',
                border: isAct ? '2px solid #EF4444' : '1px solid var(--border-color)',
                background: isAct ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.05)',
                color: isAct ? '#991B1B' : 'var(--text-main)',
                fontSize: '0.82rem',
                fontWeight: isAct ? '700' : '500',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {isAct && <Check size={14} color="#991B1B" />}
              <span>Cancelled · {cnt} · {formatCurrency(rev)}</span>
            </button>
          );
        })()}

        {/* Option 5: Other (if any) */}
        {summaryData?.totals?.other?.count > 0 && (() => {
          const isAct = activeFilter === 'other';
          const cnt = summaryData.totals.other.count;
          const rev = summaryData.totals.other.revenue;
          return (
            <button
              type="button"
              role="radio"
              aria-checked={isAct}
              tabIndex={isAct ? 0 : -1}
              onClick={() => { setActiveFilter('other'); setDealTablePage(1); }}
              onKeyDown={(e) => handleFilterKeyDown(e, 'other')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '20px',
                border: isAct ? '2px solid #6B7280' : '1px solid var(--border-color)',
                background: isAct ? 'rgba(107, 114, 128, 0.15)' : '#FFFFFF',
                color: isAct ? '#374151' : 'var(--text-main)',
                fontSize: '0.82rem',
                fontWeight: isAct ? '700' : '500',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {isAct && <Check size={14} color="#374151" />}
              <span>Other · {cnt} · {formatCurrency(rev)}</span>
            </button>
          );
        })()}
      </div>

      {/* 3. SUMMARY LINE (below filter, no cards) */}
      {(() => {
        const curTotals = summaryData?.totals?.[activeFilter] || { revenue: 0, count: 0, avg_deal: 0 };
        const deltaPct = activeFilter === 'invoiced'
          ? summaryData?.deltas_vs_prior?.invoiced_revenue_pct
          : (activeFilter === 'progressed'
              ? summaryData?.deltas_vs_prior?.progressed_revenue_pct
              : (activeFilter === 'cancelled'
                  ? summaryData?.deltas_vs_prior?.cancelled_revenue_pct
                  : summaryData?.deltas_vs_prior?.all_revenue_pct));

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 6px 16px 6px', fontSize: '0.88rem', color: 'var(--text-main)', flexWrap: 'wrap' }}>
            <span>
              Revenue <strong>{formatCurrency(curTotals.revenue)}</strong>
            </span>
            {deltaPct !== null && deltaPct !== undefined ? (
              <span style={{ fontSize: '0.78rem', fontWeight: '700', color: deltaPct >= 0 ? '#0F6E56' : '#DC2626' }}>
                ({deltaPct >= 0 ? `↑ ${deltaPct}%` : `↓ ${Math.abs(deltaPct)}%`} vs last year)
              </span>
            ) : (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                (No prior year comparison)
              </span>
            )}
            <span style={{ color: 'var(--text-muted)' }}>·</span>
            <span>
              <strong>{curTotals.count}</strong> deals
            </span>
            <span style={{ color: 'var(--text-muted)' }}>·</span>
            <span style={{ color: 'var(--text-muted)' }}>
              Avg <strong style={{ color: 'var(--text-main)' }}>{formatCurrency(curTotals.avg_deal)}</strong> per deal
            </span>
          </div>
        );
      })()}

      {/* 4. MAIN STATUS AREA: Funnel Bar + Shared Timeline + Deal Table */}
      
      {/* 4a. Thin Funnel Bar (When All is active) */}
      {activeFilter === 'all' && summaryData?.funnel && (
        <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px 18px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px', fontSize: '0.8rem' }}>
            <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>
              Mandate Funnel Progression
            </span>
            <div style={{ display: 'flex', gap: '14px', fontSize: '0.76rem' }}>
              <span style={{ color: '#2563EB', fontWeight: '600' }}>
                ● Progressed: {summaryData.funnel.progressed_count} ({summaryData.funnel.progressed_pct}%)
              </span>
              <span style={{ color: '#0F6E56', fontWeight: '600' }}>
                ● Invoiced: {summaryData.funnel.invoiced_count} ({summaryData.funnel.invoiced_pct}%)
              </span>
              <span style={{ color: '#DC2626', fontWeight: '600' }}>
                ● Cancelled: {summaryData.funnel.cancelled_count} ({summaryData.funnel.cancelled_pct}%)
              </span>
            </div>
          </div>
          <div style={{ height: '8px', width: '100%', background: 'var(--bg-main)', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: `${summaryData.funnel.progressed_pct}%`, height: '100%', background: '#2563EB' }} title={`Progressed: ${summaryData.funnel.progressed_pct}%`} />
            <div style={{ width: `${summaryData.funnel.invoiced_pct}%`, height: '100%', background: '#10B981' }} title={`Invoiced: ${summaryData.funnel.invoiced_pct}%`} />
            <div style={{ width: `${summaryData.funnel.cancelled_pct}%`, height: '100%', background: '#EF4444' }} title={`Cancelled: ${summaryData.funnel.cancelled_pct}%`} />
          </div>
        </div>
      )}

      {/* 4b. Monthly 12-Month Timeline (Apr to Mar) */}
      {summaryData?.monthly_series && summaryData.monthly_series.length > 0 && (
        <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px 18px', marginBottom: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-main)' }}>
              {activeFilter === 'all' 
                ? `Shared 12-Month Timeline (${selectedFy})` 
                : `${activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)} Monthly Trend (${selectedFy})`}
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Fiscal Year Run-Rate (Apr - Mar)
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '6px', overflowX: 'auto', minWidth: '600px' }}>
            {summaryData.monthly_series.map((m, idx) => {
              const activeCount = activeFilter === 'all' ? m.all : m[activeFilter];
              const activeRev = activeFilter === 'all' ? m.all_revenue : m[`${activeFilter}_revenue`];
              const maxCount = Math.max(...summaryData.monthly_series.map(s => activeFilter === 'all' ? s.all : s[activeFilter]), 1);
              const barHeightPct = Math.min(100, Math.round((activeCount / maxCount) * 100));

              return (
                <div 
                  key={idx}
                  style={{
                    background: 'var(--bg-main)',
                    borderRadius: '6px',
                    padding: '8px 4px',
                    textAlign: 'center',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '110px'
                  }}
                >
                  <span style={{ fontSize: '0.7rem', fontWeight: '600', color: 'var(--text-muted)' }}>
                    {m.month_label.split(' ')[0]}
                  </span>

                  <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', margin: '6px 0' }}>
                    {activeFilter === 'all' ? (
                      <div style={{ width: '12px', height: `${Math.max(12, barHeightPct * 0.55)}px`, display: 'flex', flexDirection: 'column-reverse', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: `${m.all > 0 ? (m.invoiced / m.all) * 100 : 0}%`, background: '#10B981' }} title={`Invoices: ${m.invoiced}`} />
                        <div style={{ height: `${m.all > 0 ? (m.progressed / m.all) * 100 : 0}%`, background: '#2563EB' }} title={`Progressed: ${m.progressed}`} />
                        <div style={{ height: `${m.all > 0 ? (m.cancelled / m.all) * 100 : 0}%`, background: '#EF4444' }} title={`Cancelled: ${m.cancelled}`} />
                      </div>
                    ) : (
                      <div 
                        style={{
                          width: '12px',
                          height: `${Math.max(8, barHeightPct * 0.55)}px`,
                          borderRadius: '3px',
                          background: activeFilter === 'invoiced' ? '#10B981' : (activeFilter === 'progressed' ? '#2563EB' : '#EF4444')
                        }}
                        title={`${activeCount} deals`}
                      />
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <strong style={{ fontSize: '0.78rem', color: 'var(--text-main)' }}>
                      {activeCount}
                    </strong>
                    <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>
                      {activeRev > 0 ? formatLakhs(activeRev) : '₹0'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4c. Deal Table */}
      <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px 18px', marginBottom: '22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Briefcase size={16} color="var(--accent-teal)" />
              <span>
                {activeFilter === 'all' ? 'All Mandates & Closed Placements' : `${activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)} Deals`}
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '400' }}>
                ({filteredDeals.length} deals)
              </span>
            </h3>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Click any row to open the complete commercial audit panel.
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search deals..."
                value={dealTableSearch}
                onChange={(e) => { setDealTableSearch(e.target.value); setDealTablePage(1); }}
                style={{
                  height: '34px',
                  padding: '0 12px 0 30px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.78rem',
                  outline: 'none',
                  width: '180px'
                }}
              />
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
            </div>
          </div>
        </div>

        {/* Table Content */}
        {filteredDeals.length === 0 ? (
          <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
            No deals found for this selection ({activeFilter}).
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px', fontWeight: '700', color: 'var(--text-muted)' }}>Date</th>
                    <th style={{ padding: '10px 12px', fontWeight: '700', color: 'var(--text-muted)' }}>Ref #</th>
                    <th style={{ padding: '10px 12px', fontWeight: '700', color: 'var(--text-muted)' }}>Client / Company</th>
                    <th style={{ padding: '10px 12px', fontWeight: '700', color: 'var(--text-muted)' }}>Mandate / Role</th>
                    <th style={{ padding: '10px 12px', fontWeight: '700', color: 'var(--text-muted)' }}>BD / TL</th>
                    <th style={{ padding: '10px 12px', fontWeight: '700', color: 'var(--text-muted)', textAlign: 'right' }}>Amount (₹)</th>
                    {activeFilter === 'all' && (
                      <th style={{ padding: '10px 12px', fontWeight: '700', color: 'var(--text-muted)', textAlign: 'center' }}>Status</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {paginatedDeals.map((deal) => {
                    const stColor = deal.status === 'invoiced' ? '#065F46' : (deal.status === 'progressed' ? '#1E40AF' : '#991B1B');
                    const stBg = deal.status === 'invoiced' ? 'rgba(16, 185, 129, 0.15)' : (deal.status === 'progressed' ? 'rgba(37, 99, 235, 0.15)' : 'rgba(239, 68, 68, 0.15)');

                    return (
                      <tr
                        key={deal.id}
                        onClick={() => handleDealRowClick(deal)}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          cursor: 'pointer',
                          transition: 'background 0.15s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(15, 110, 86, 0.04)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        title="Click to open audit panel"
                      >
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {deal.date || '—'}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: '600', color: 'var(--accent-teal)' }}>
                          {deal.referenceId}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: '600', color: 'var(--text-main)' }}>
                          {deal.companyName}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-main)' }}>
                          {deal.positionName || 'Executive Mandate'}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                          {deal.bdMemberName || deal.teamLeaderName || '—'}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: 'var(--text-main)' }}>
                          {formatCurrency(deal.amount)}
                        </td>
                        {activeFilter === 'all' && (
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '0.72rem',
                              fontWeight: '700',
                              background: stBg,
                              color: stColor,
                              textTransform: 'capitalize'
                            }}>
                              {deal.status}
                            </span>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalDealPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Showing {(dealTablePage - 1) * DEALS_PER_PAGE + 1}–{Math.min(filteredDeals.length, dealTablePage * DEALS_PER_PAGE)} of {filteredDeals.length} deals
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    disabled={dealTablePage <= 1}
                    onClick={() => setDealTablePage(p => Math.max(1, p - 1))}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '5px',
                      border: '1px solid var(--border-color)',
                      background: dealTablePage <= 1 ? 'var(--bg-main)' : '#FFFFFF',
                      color: dealTablePage <= 1 ? 'var(--text-muted)' : 'var(--text-main)',
                      fontSize: '0.75rem',
                      cursor: dealTablePage <= 1 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Previous
                  </button>
                  <span style={{ fontSize: '0.78rem', padding: '4px 8px', color: 'var(--text-main)', fontWeight: '600' }}>
                    {dealTablePage} / {totalDealPages}
                  </span>
                  <button
                    type="button"
                    disabled={dealTablePage >= totalDealPages}
                    onClick={() => setDealTablePage(p => Math.min(totalDealPages, p + 1))}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '5px',
                      border: '1px solid var(--border-color)',
                      background: dealTablePage >= totalDealPages ? 'var(--bg-main)' : '#FFFFFF',
                      color: dealTablePage >= totalDealPages ? 'var(--text-muted)' : 'var(--text-main)',
                      fontSize: '0.75rem',
                      cursor: dealTablePage >= totalDealPages ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* STEP 4: MONEY BOX (Admin and Manager only; collapsible, real per-deal shares, reconciliation) */}
      {isAdminOrManager && summaryData?.money_box && (() => {
        const mb = summaryData.money_box;
        return (
          <details 
            style={{ 
              background: '#FFFFFF', 
              border: '1px solid var(--border-color)', 
              borderRadius: '10px', 
              padding: '16px 20px', 
              marginBottom: '22px' 
            }}
          >
            <summary 
              style={{ 
                cursor: 'pointer', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                listStyle: 'none', 
                userSelect: 'none', 
                gap: '12px', 
                flexWrap: 'wrap' 
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(15, 110, 86, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Landmark size={18} color="var(--accent-teal)" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: '700', color: 'var(--text-main)' }}>
                      Money Box — Financial Margin & Real Surplus
                    </h3>
                    <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '4px', background: '#FEF3C7', color: '#92400E', fontWeight: '700' }}>
                      Admin & Manager Only
                    </span>
                  </div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Real per-deal revenue shares, person earnings, allocated overhead, estimated corporate tax, and net retained.
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.84rem' }}>
                <span>Net: <strong style={{ color: mb.net >= 0 ? '#0F6E56' : '#DC2626' }}>{formatCurrency(mb.net)}</strong></span>
                <span>Surplus: <strong style={{ color: mb.surplus >= 0 ? '#0F6E56' : '#DC2626' }}>{formatCurrency(mb.surplus)}</strong></span>
                <ChevronDown size={16} color="var(--text-muted)" />
              </div>
            </summary>

            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
              {fixedSalaryStatusMsg && (
                <div style={{ 
                  marginBottom: '14px', 
                  padding: '8px 12px', 
                  borderRadius: '6px', 
                  fontSize: '0.78rem',
                  background: fixedSalaryStatusMsg.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  color: fixedSalaryStatusMsg.type === 'success' ? '#065F46' : '#991B1B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <span>{fixedSalaryStatusMsg.text}</span>
                  <button type="button" onClick={() => setFixedSalaryStatusMsg(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'inherit' }}>
                    <X size={14} />
                  </button>
                </div>
              )}

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                <tbody>
                  {/* 1. Revenue (gross billed) */}
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '10px 8px', color: 'var(--text-main)', fontWeight: '600' }}>
                      Revenue (gross billed)
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '700', color: 'var(--text-main)' }}>
                      {formatCurrency(mb.revenue)}
                    </td>
                  </tr>

                  {/* 2. Our share */}
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '10px 8px', color: 'var(--text-main)' }}>
                      <span style={{ fontWeight: '600' }}>Our share</span>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                        (company's portion of that revenue)
                      </span>
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                      <div style={{ fontWeight: '700', color: '#0F6E56' }}>
                        {formatCurrency(mb.our_share)}
                      </div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }} title="Real per-deal database shares; unverified fallback to 25% default rate">
                        ({mb.verified_count} verified, {mb.unverified_count} unverified)
                      </span>
                    </td>
                  </tr>

                  {/* 3. - Earnings (salary + incentive) */}
                  <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(0, 0, 0, 0.01)' }}>
                    <td style={{ padding: '10px 8px', color: 'var(--text-main)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: '600' }}>− Earnings (salary + incentive)</span>
                        <div style={{ display: 'inline-flex', borderRadius: '5px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                          <button
                            type="button"
                            onClick={() => setMoneyBoxMode('live')}
                            style={{
                              padding: '2px 8px',
                              fontSize: '0.72rem',
                              fontWeight: '700',
                              background: moneyBoxMode === 'live' ? 'var(--accent-teal)' : '#FFFFFF',
                              color: moneyBoxMode === 'live' ? '#FFFFFF' : 'var(--text-muted)',
                              border: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            Live ▾
                          </button>
                          <button
                            type="button"
                            onClick={() => setMoneyBoxMode('fixed')}
                            style={{
                              padding: '2px 8px',
                              fontSize: '0.72rem',
                              fontWeight: '700',
                              background: moneyBoxMode === 'fixed' ? 'var(--accent-teal)' : '#FFFFFF',
                              color: moneyBoxMode === 'fixed' ? '#FFFFFF' : 'var(--text-muted)',
                              border: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            Fixed
                          </button>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                      {moneyBoxMode === 'live' ? (
                        mb.earnings?.status === 'not_set' || mb.earnings?.amount === null ? (
                          <div>
                            <span style={{ color: '#DC2626', fontWeight: '700' }}>Not set</span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>
                              (0 of {mb.earnings?.total_months || 12} months entered in cost performance)
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>
                              {formatCurrency(mb.earnings.amount)}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>
                              ({mb.earnings.label})
                            </span>
                          </div>
                        )
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Monthly fixed:</span>
                          <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '2px 6px', background: '#FFFFFF' }}>
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginRight: '4px' }}>₹</span>
                            <input
                              type="number"
                              min="0"
                              placeholder="e.g. 50000"
                              value={fixedSalaryInput}
                              onChange={e => setFixedSalaryInput(e.target.value)}
                              style={{ width: '85px', border: 'none', outline: 'none', fontSize: '0.78rem' }}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handleSaveFixedSalary}
                            disabled={isSavingFixedSalary}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '4px',
                              background: 'var(--accent-teal)',
                              color: '#FFFFFF',
                              border: 'none',
                              fontSize: '0.72rem',
                              fontWeight: '700',
                              cursor: isSavingFixedSalary ? 'not-allowed' : 'pointer'
                            }}
                          >
                            {isSavingFixedSalary ? 'Saving...' : 'Save Fixed'}
                          </button>
                          <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', background: '#EFF6FF', color: '#1D4ED8', fontWeight: '700' }}>
                            Fixed (manual)
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>

                  {/* 4. - Other costs */}
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '10px 8px', color: 'var(--text-main)' }}>
                      <span style={{ fontWeight: '600' }}>− Other costs</span>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                        (TL allocation, travel, overhead share)
                      </span>
                      <span 
                        title={mb.other_costs?.tooltip} 
                        style={{ marginLeft: '6px', cursor: 'help', fontSize: '0.76rem', color: 'var(--accent-teal)' }}
                      >
                        ℹ️
                      </span>
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '600', color: 'var(--text-main)' }}>
                      {formatCurrency(mb.other_costs?.amount || 0)}
                    </td>
                  </tr>

                  {/* 5. = Net */}
                  <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(15, 110, 86, 0.03)' }}>
                    <td style={{ padding: '12px 8px' }}>
                      <strong style={{ fontSize: '0.96rem', color: 'var(--text-main)' }}>= Net</strong>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                        (Earnings + Other costs = Total Report Cost · Matches Cost of Performance)
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                      <strong style={{ fontSize: '1.05rem', color: mb.net >= 0 ? '#0F6E56' : '#DC2626' }}>
                        {formatCurrency(mb.net)}
                      </strong>
                    </td>
                  </tr>

                  {/* 6. - Tax (estimate, 25%) */}
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '10px 8px', color: 'var(--text-main)' }}>
                      <span style={{ fontWeight: '600' }}>− Tax (estimate, {DEFAULT_ESTIMATED_TAX_RATE * 100}%)</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                        (Configurable shared rate; ₹0 if Net ≤ 0)
                      </span>
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '600', color: 'var(--text-main)' }}>
                      {formatCurrency(mb.tax?.amount || 0)}
                    </td>
                  </tr>

                  {/* 7. = Surplus */}
                  <tr style={{ background: mb.surplus >= 0 ? 'rgba(15, 110, 86, 0.08)' : 'rgba(220, 38, 38, 0.08)' }}>
                    <td style={{ padding: '14px 8px' }}>
                      <strong style={{ fontSize: '1.02rem', color: 'var(--text-main)' }}>= Surplus</strong>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                        (Net margin retained after estimated tax)
                      </span>
                    </td>
                    <td style={{ padding: '14px 8px', textAlign: 'right' }}>
                      <strong style={{ fontSize: '1.18rem', color: mb.surplus >= 0 ? '#0F6E56' : '#DC2626' }}>
                        {formatCurrency(mb.surplus)}
                      </strong>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div style={{ marginTop: '12px', fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <span>Reconciliation test verified: Net = Our share − Earnings − Other costs.</span>
                <span>Tax rate: {DEFAULT_ESTIMATED_TAX_RATE * 100}% standard corporate estimate.</span>
              </div>
            </div>
          </details>
        );
      })()}

      {/* 5. PLAN SECTION: Goals Table, Pace to FY End, Needed Pace */}
      <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px 20px', marginBottom: '22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Target size={16} color="var(--accent-teal)" />
              <span>Financial Growth Plan & Performance Targets</span>
            </h3>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Appraisal benchmarks, current run-rate trajectory, and required pace to hit milestone quotas.
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsGoalModalOpen(true)}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: '1px solid var(--accent-teal)',
              background: 'rgba(15, 110, 86, 0.08)',
              color: 'var(--accent-teal)',
              fontSize: '0.76rem',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Plus size={14} /> Set / Adjust Target
          </button>
        </div>

        {/* Goals Table */}
        {(() => {
          const selfTarget = targetsList.find(t => t.target_author === 'self') || null;
          const ownerTarget = targetsList.find(t => t.target_author === 'owner' || (!t.target_author && t.entity_type !== 'company')) || null;
          const closedDeals = summaryData?.totals?.invoiced?.count ?? presentDealsCount;
          const closedRev = summaryData?.totals?.invoiced?.revenue ?? effectiveBaseRevenue;

          const selfDealsTarget = selfTarget?.target_placements || Math.round(Math.max(1, closedDeals) * 1.2);
          const selfRevTarget = selfTarget?.target_revenue || Math.round(closedRev * 1.2);
          const ownerDealsTarget = ownerTarget?.target_placements || Math.round(Math.max(1, closedDeals) * 1.25);
          const ownerRevTarget = ownerTarget?.target_revenue || Math.round(closedRev * 1.25);

          const selfPct = Math.round((closedDeals / Math.max(1, selfDealsTarget)) * 100);
          const ownerPct = Math.round((closedDeals / Math.max(1, ownerDealsTarget)) * 100);

          const monthsRemaining = summaryData?.pace?.months_remaining ?? 5;
          const dealsNeeded = Math.max(0, ownerDealsTarget - closedDeals);
          const neededMonthlyPace = monthsRemaining > 0 ? (dealsNeeded / monthsRemaining).toFixed(1) : 0;

          return (
            <>
              <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                      <th style={{ padding: '10px 14px', fontWeight: '700', color: 'var(--text-muted)' }}>Target Category</th>
                      <th style={{ padding: '10px 14px', fontWeight: '700', color: 'var(--text-muted)' }}>Goal Volume</th>
                      <th style={{ padding: '10px 14px', fontWeight: '700', color: 'var(--text-muted)' }}>Target Billing</th>
                      <th style={{ padding: '10px 14px', fontWeight: '700', color: 'var(--text-muted)' }}>Realized So Far</th>
                      <th style={{ padding: '10px 14px', fontWeight: '700', color: 'var(--text-muted)' }}>Attainment %</th>
                      <th style={{ padding: '10px 14px', fontWeight: '700', color: 'var(--text-muted)', textAlign: 'right' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px 14px', fontWeight: '700', color: 'var(--accent-teal)' }}>
                        👤 Own Commitment (Self-Pledge)
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: '600', color: 'var(--text-main)' }}>
                        {selfDealsTarget} deals
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-main)' }}>
                        {formatCurrency(selfRevTarget)}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: '600', color: '#0F6E56' }}>
                        {closedDeals} deals ({formatCurrency(closedRev)})
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ flex: 1, height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden', minWidth: '60px' }}>
                            <div style={{ width: `${Math.min(100, selfPct)}%`, height: '100%', background: selfPct >= 100 ? '#10B981' : '#F59E0B' }} />
                          </div>
                          <span style={{ fontWeight: '700', color: selfPct >= 100 ? '#10B981' : '#F59E0B' }}>
                            {selfPct}%
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', background: selfPct >= 100 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(234, 179, 8, 0.15)', color: selfPct >= 100 ? '#065F46' : '#92400E', fontWeight: '700' }}>
                          {selfPct >= 100 ? 'Achieved 🎉' : 'In Progress'}
                        </span>
                      </td>
                    </tr>

                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px 14px', fontWeight: '700', color: '#2563EB' }}>
                        👑 Company Quota (Leadership Benchmark)
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: '600', color: 'var(--text-main)' }}>
                        {ownerDealsTarget} deals
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-main)' }}>
                        {formatCurrency(ownerRevTarget)}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: '600', color: '#0F6E56' }}>
                        {closedDeals} deals ({formatCurrency(closedRev)})
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ flex: 1, height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden', minWidth: '60px' }}>
                            <div style={{ width: `${Math.min(100, ownerPct)}%`, height: '100%', background: ownerPct >= 100 ? '#10B981' : '#2563EB' }} />
                          </div>
                          <span style={{ fontWeight: '700', color: ownerPct >= 100 ? '#10B981' : '#2563EB' }}>
                            {ownerPct}%
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', background: ownerPct >= 100 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(37, 99, 235, 0.15)', color: ownerPct >= 100 ? '#065F46' : '#1E40AF', fontWeight: '700' }}>
                          {ownerPct >= 100 ? 'Quota Met ⭐' : 'In Progress'}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Pace Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                <div style={{ background: 'var(--bg-main)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: '700', color: 'var(--text-muted)' }}>CURRENT PACE</span>
                    {summaryData?.pace?.is_low_volume && (
                      <span title="Based on limited sample size (<10 closed deals)." style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(234, 179, 8, 0.2)', color: '#92400E', fontWeight: '600' }}>
                        Rough estimate (few deals)
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '2px' }}>
                    ~{summaryData?.pace?.current_monthly_pace ?? 0} deals/mo → <strong>{summaryData?.pace?.projected_total_by_fy_end ?? closedDeals} by FY end</strong>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Method: Extrapolated from actual closed deals across {summaryData?.pace?.months_elapsed || 7} months elapsed in {selectedFy}.
                  </span>
                </div>

                <div style={{ background: 'var(--bg-main)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: '700', color: 'var(--text-muted)' }}>NEEDED PACE TO HIT GOAL</span>
                    <span style={{ fontSize: '0.68rem', color: '#2563EB', fontWeight: '700' }}>
                      {monthsRemaining} months remaining
                    </span>
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#2563EB', marginBottom: '2px' }}>
                    ~{neededMonthlyPace} deals/mo
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Remaining requirement: {dealsNeeded} more closed deals needed by March 31 to satisfy quota.
                  </span>
                </div>
              </div>
            </>
          );
        })()}
      </div>

      {/* 6. COMPARE SECTION: 2-Column Benchmark Table */}
      <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px 20px', marginBottom: '22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={16} color="var(--accent-teal)" />
              <span>Performance Benchmark Comparison</span>
            </h3>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Compare this profile against historical performance or organizational team average for {selectedFy}.
            </span>
          </div>

          <div style={{ display: 'flex', background: 'var(--bg-main)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <button
              type="button"
              onClick={() => setActiveBenchmark('prior_year')}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                border: 'none',
                background: activeBenchmark === 'prior_year' ? '#FFFFFF' : 'transparent',
                color: activeBenchmark === 'prior_year' ? 'var(--accent-teal)' : 'var(--text-muted)',
                fontWeight: activeBenchmark === 'prior_year' ? '700' : '500',
                fontSize: '0.76rem',
                cursor: 'pointer',
                boxShadow: activeBenchmark === 'prior_year' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              vs Prior Year ({summaryData?.prior_fy?.fy || 'FY 25-26'})
            </button>
            <button
              type="button"
              onClick={() => setActiveBenchmark('team_average')}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                border: 'none',
                background: activeBenchmark === 'team_average' ? '#FFFFFF' : 'transparent',
                color: activeBenchmark === 'team_average' ? 'var(--accent-teal)' : 'var(--text-muted)',
                fontWeight: activeBenchmark === 'team_average' ? '700' : '500',
                fontSize: '0.76rem',
                cursor: 'pointer',
                boxShadow: activeBenchmark === 'team_average' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              vs Team Average ({summaryData?.comparisons?.team_average?.active_members || 1} peers)
            </button>
          </div>
        </div>

        {/* 2-Column Comparison Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px', fontWeight: '700', color: 'var(--text-muted)' }}>Financial & Operational Metric</th>
                <th style={{ padding: '10px 14px', fontWeight: '700', color: 'var(--text-main)' }}>
                  Current Profile ({summaryData?.display_name || 'Selected'})
                </th>
                <th style={{ padding: '10px 14px', fontWeight: '700', color: 'var(--accent-teal)' }}>
                  {activeBenchmark === 'prior_year' ? `Prior Year (${summaryData?.prior_fy?.fy || 'FY 25-26'})` : 'Team Average Benchmark'}
                </th>
                <th style={{ padding: '10px 14px', fontWeight: '700', color: 'var(--text-muted)' }}>Variance / Delta</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const thisComp = summaryData?.comparisons?.this_period || {};
                const benchComp = activeBenchmark === 'prior_year' 
                  ? (summaryData?.comparisons?.prior_period || {}) 
                  : (summaryData?.comparisons?.team_average || {});

                const rows = [
                  {
                    name: 'Closed Placement Volume',
                    current: `${thisComp.closed_deals || 0} deals`,
                    bench: `${benchComp.closed_deals || 0} deals`,
                    delta: (thisComp.closed_deals || 0) - (benchComp.closed_deals || 0),
                    isUnitDeals: true
                  },
                  {
                    name: 'Realized Revenue',
                    current: formatCurrency(thisComp.revenue || 0),
                    bench: formatCurrency(benchComp.revenue || 0),
                    deltaPct: benchComp.revenue > 0 ? (((thisComp.revenue - benchComp.revenue) / benchComp.revenue) * 100).toFixed(1) : null
                  },
                  {
                    name: 'Average Mandate Ticket Size',
                    current: formatCurrency(thisComp.avg_deal || 0),
                    bench: formatCurrency(benchComp.avg_deal || 0),
                    deltaPct: benchComp.avg_deal > 0 ? (((thisComp.avg_deal - benchComp.avg_deal) / benchComp.avg_deal) * 100).toFixed(1) : null
                  },
                  {
                    name: 'Cancellation Rate',
                    current: `${thisComp.cancelled_pct ?? 0}%`,
                    bench: `${benchComp.cancelled_pct ?? '—'}%`,
                    deltaPct: benchComp.cancelled_pct ? ((thisComp.cancelled_pct - benchComp.cancelled_pct)).toFixed(1) : null,
                    invertSentiment: true
                  }
                ];

                return rows.map((r, i) => {
                  let varianceEl = <span style={{ color: 'var(--text-muted)' }}>—</span>;
                  if (r.deltaPct !== null && r.deltaPct !== undefined) {
                    const num = parseFloat(r.deltaPct);
                    const isPositive = r.invertSentiment ? num < 0 : num >= 0;
                    varianceEl = (
                      <span style={{ fontWeight: '700', color: isPositive ? '#0F6E56' : '#DC2626' }}>
                        {num >= 0 ? `+${num}%` : `${num}%`} {isPositive ? 'Better' : 'Shortfall'}
                      </span>
                    );
                  } else if (r.isUnitDeals) {
                    const isPos = r.delta >= 0;
                    varianceEl = (
                      <span style={{ fontWeight: '700', color: isPos ? '#0F6E56' : '#DC2626' }}>
                        {r.delta >= 0 ? `+${r.delta}` : r.delta} deals
                      </span>
                    );
                  }

                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '10px 14px', fontWeight: '600', color: 'var(--text-main)' }}>
                        {r.name}
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: '700', color: 'var(--text-main)' }}>
                        {r.current}
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--accent-teal)', fontWeight: '600' }}>
                        {r.bench}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {varianceEl}
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7. DETAILS SECTION (Collapsed <details>) */}
      <details
        className="growth-details-collapsible"
        style={{
          background: '#FFFFFF',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          padding: '14px 18px',
          marginBottom: '16px'
        }}
      >
        <summary style={{ cursor: 'pointer', fontWeight: '700', color: 'var(--text-main)', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px', outline: 'none' }}>
          <span>▸ Details & Historical CAGR Audit (Collapsed)</span>
        </summary>
        <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
            <div>
              <span style={{ fontSize: '0.84rem', fontWeight: '700', color: 'var(--text-main)', display: 'block' }}>
                Historical CAGR & Track Record
              </span>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Audited compound annual growth rate across completed fiscal cycles.
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ padding: '6px 12px', borderRadius: '6px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-muted)', marginRight: '6px' }}>Audited CAGR:</span>
                <strong style={{ color: historicalCagrPct >= 0 ? '#0F6E56' : '#DC2626' }}>
                  {historicalCagrPct >= 0 ? '+' : ''}{historicalCagrPct}%
                </strong>
                {predictionData?.confidence === 'insufficient_data' && (
                  <span title="Few deals recorded in historical ledger" style={{ marginLeft: '6px', fontSize: '0.68rem', color: '#92400E', background: 'rgba(234, 179, 8, 0.2)', padding: '1px 5px', borderRadius: '4px' }}>
                    Few deals warning
                  </span>
                )}
              </div>
            </div>
          </div>
          <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.45' }}>
            Note: CAGR calculation reflects compound annual rate of change from the earliest audited transaction cycle to the most recently certified annual closing.
          </p>
        </div>
      </details>

      {/* 8. ADVANCED SECTION (Collapsed <details>) */}
      <details 
        className="advanced-alignment-section" 
        style={{
          background: '#FFFFFF',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          padding: '14px 18px',
          marginBottom: '20px'
        }}
      >
        <summary style={{ cursor: 'pointer', fontWeight: '700', color: 'var(--text-main)', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px', outline: 'none' }}>
          <span>▸ Advanced: Scorecard, Scenarios & Target Memoranda</span>
        </summary>
        <div style={{ marginTop: '16px' }}>
          {/* Performance Intelligence Scorecard (Who is Working Well - hidden for overall company) */}
          {entityType !== 'company' && productivity && (
            <div className="dashboard-card" style={{ marginBottom: '24px', background: 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-main) 100%)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(15, 110, 86, 0.12)', color: 'var(--accent-teal)' }}>
                    <Zap size={20} />
                  </div>
                  <div>
                    <h3 className="card-title" style={{ margin: 0 }}>
                      Performance Intelligence Scorecard
                    </h3>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Evaluates deal velocity, revenue per month, momentum, and mandate consistency.
                    </span>
                  </div>
                </div>

                {/* Overall Badge */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  background: productivity.badge_key === 'top_performer' ? 'rgba(16, 185, 129, 0.15)' : (productivity.badge_key === 'consistent_producer' ? 'rgba(59, 130, 246, 0.15)' : (productivity.badge_key === 'rising_talent' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(239, 68, 68, 0.15)')),
                  border: `1px solid ${productivity.badge_key === 'top_performer' ? 'rgba(16, 185, 129, 0.3)' : (productivity.badge_key === 'consistent_producer' ? 'rgba(59, 130, 246, 0.3)' : (productivity.badge_key === 'rising_talent' ? 'rgba(234, 179, 8, 0.3)' : 'rgba(239, 68, 68, 0.3)'))}`
                }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: '800', color: 'var(--text-main)' }}>
                    {productivity.badge}
                  </span>
                  <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--accent-teal)', borderLeft: '1px solid var(--border-color)', paddingLeft: '8px' }}>
                    Index: {productivity.productivity_index}/100
                  </span>
                </div>
              </div>

              {/* 4 Component Score Bars */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                {/* 1. Volume Score */}
                <div style={{ background: 'var(--bg-main)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.76rem', fontWeight: '700', color: 'var(--text-muted)' }}>📦 Deal Volume (35%)</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--text-main)' }}>{productivity.components?.volume ?? 50}%</span>
                  </div>
                  <div style={{ height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden', marginBottom: '6px' }}>
                    <div style={{ width: `${productivity.components?.volume ?? 50}%`, height: '100%', background: '#10b981', borderRadius: '3px' }}></div>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Benchmarked against peer P90 deal velocity
                  </span>
                </div>

                {/* 2. Revenue Score */}
                <div style={{ background: 'var(--bg-main)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.76rem', fontWeight: '700', color: 'var(--text-muted)' }}>💰 Revenue Contribution (30%)</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--text-main)' }}>{productivity.components?.revenue ?? 50}%</span>
                  </div>
                  <div style={{ height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden', marginBottom: '6px' }}>
                    <div style={{ width: `${productivity.components?.revenue ?? 50}%`, height: '100%', background: '#0F6E56', borderRadius: '3px' }}></div>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Audited monthly billable billing inflow
                  </span>
                </div>

                {/* 3. Momentum Score */}
                <div style={{ background: 'var(--bg-main)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.76rem', fontWeight: '700', color: 'var(--text-muted)' }}>🚀 Growth Momentum (20%)</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--text-main)' }}>{productivity.components?.momentum ?? 65}%</span>
                  </div>
                  <div style={{ height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden', marginBottom: '6px' }}>
                    <div style={{ width: `${productivity.components?.momentum ?? 65}%`, height: '100%', background: '#3b82f6', borderRadius: '3px' }}></div>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Recent 3-month vs prior 3-month acceleration
                  </span>
                </div>

                {/* 4. Consistency Score */}
                <div style={{ background: 'var(--bg-main)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.76rem', fontWeight: '700', color: 'var(--text-muted)' }}>🎯 Deal Regularity (15%)</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--text-main)' }}>{productivity.components?.consistency ?? 50}%</span>
                  </div>
                  <div style={{ height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden', marginBottom: '6px' }}>
                    <div style={{ width: `${productivity.components?.consistency ?? 50}%`, height: '100%', background: '#8b5cf6', borderRadius: '3px' }}></div>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Monthly placement stability across cycles
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Dual Goal Alignment & Appraisal Review (Self-Commitment vs. Owner Quota) */}
          {entityType !== 'company' && selectedEntity && (() => {
            const selfTarget = targetsList.find(t => t.target_author === 'self') || null;
            const ownerTarget = targetsList.find(t => t.target_author === 'owner' || (!t.target_author && t.entity_type !== 'company')) || null;
            const selfDealsTarget = selfTarget?.target_placements || Math.round(presentDealsCount * 1.2);
            const selfRevTarget = selfTarget?.target_revenue || Math.round(effectiveBaseRevenue * 1.2);
            const ownerDealsTarget = ownerTarget?.target_placements || Math.round(presentDealsCount * 1.25);
            const ownerRevTarget = ownerTarget?.target_revenue || Math.round(effectiveBaseRevenue * 1.25);

            const selfPctAchieved = Math.round((presentDealsCount / Math.max(1, selfDealsTarget)) * 100);
            const ownerPctAchieved = Math.round((presentDealsCount / Math.max(1, ownerDealsTarget)) * 100);

            return (
              <div className="dashboard-card" style={{ marginBottom: '22px', border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h3 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
                      <Target size={18} color="var(--accent-teal)" />
                      <span>Dual Goal Alignment: Self-Commitment vs. Owner Quota</span>
                    </h3>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Appraisal alignment between {selectedEntity?.name}'s personal pledge and Management's benchmark.
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => {
                        setGoalModalParams({ growthPct: 20, placements: Math.round(presentDealsCount * 1.2), targetAuthor: 'self' });
                        setIsGoalModalOpen(true);
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--accent-teal)',
                        background: 'rgba(15, 110, 86, 0.08)',
                        color: 'var(--accent-teal)',
                        fontSize: '0.76rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      👤 {selfTarget ? 'Update Self-Goal' : '+ Log Self-Goal'}
                    </button>
                    <button
                      onClick={() => {
                        setGoalModalParams({ growthPct: 25, placements: Math.round(presentDealsCount * 1.25), targetAuthor: 'owner' });
                        setIsGoalModalOpen(true);
                      }}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: 'none',
                        background: '#2563EB',
                        color: '#ffffff',
                        fontSize: '0.76rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      👑 {ownerTarget ? 'Update Owner Quota' : '+ Assign Owner Quota'}
                    </button>
                  </div>
                </div>

                {/* Side-by-Side Dual Goal Comparison Columns */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px', marginBottom: '16px' }}>
                  
                  {/* Column 1: BD Self-Commitment */}
                  <div style={{ background: 'var(--bg-main)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)', borderLeft: '4px solid var(--accent-teal)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.84rem', fontWeight: '800', color: 'var(--accent-teal)' }}>
                          👤 BD Self-Commitment
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(Personal Pledge)</span>
                      </div>
                      <span style={{ fontSize: '0.68rem', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', background: selfTarget ? 'rgba(15, 110, 86, 0.12)' : 'rgba(0,0,0,0.06)', color: selfTarget ? 'var(--accent-teal)' : 'var(--text-muted)' }}>
                        {selfTarget ? 'Active Pledge' : 'Default Model (+20%)'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '1.45rem', fontWeight: '800', color: 'var(--text-main)' }}>
                        {selfDealsTarget} deals
                      </span>
                      <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--accent-teal)' }}>
                        ({formatCurrency(selfRevTarget)})
                      </span>
                    </div>

                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 10px 0', lineHeight: '1.4', fontStyle: selfTarget ? 'italic' : 'normal' }}>
                      "{selfTarget?.guidelines || 'Personal commitment to scale candidate submissions and convert high-probability mandates.'}"
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Self-Pledge Progress:</span>
                      <strong style={{ color: presentDealsCount >= selfDealsTarget ? '#10B981' : '#F59E0B' }}>
                        {presentDealsCount} / {selfDealsTarget} ({selfPctAchieved}%)
                      </strong>
                    </div>
                  </div>

                  {/* Column 2: Owner / Leadership Quota */}
                  <div style={{ background: 'var(--bg-main)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)', borderLeft: '4px solid #2563EB' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.84rem', fontWeight: '800', color: '#1D4ED8' }}>
                          👑 Owner / Leadership Quota
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(Company Directive)</span>
                      </div>
                      <span style={{ fontSize: '0.68rem', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', background: ownerTarget ? 'rgba(37, 99, 235, 0.12)' : 'rgba(0,0,0,0.06)', color: ownerTarget ? '#1D4ED8' : 'var(--text-muted)' }}>
                        {ownerTarget ? 'Executive Quota' : 'Standard Quota (+25%)'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '1.45rem', fontWeight: '800', color: 'var(--text-main)' }}>
                        {ownerDealsTarget} deals
                      </span>
                      <span style={{ fontSize: '0.82rem', fontWeight: '600', color: '#2563EB' }}>
                        ({formatCurrency(ownerRevTarget)})
                      </span>
                    </div>

                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 10px 0', lineHeight: '1.4', fontStyle: ownerTarget ? 'italic' : 'normal' }}>
                      "{ownerTarget?.guidelines || 'Required commercial volume to justify annual compensation increment and star bonus bracket.'}"
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Management Quota Progress:</span>
                      <strong style={{ color: presentDealsCount >= ownerDealsTarget ? '#10B981' : '#2563EB' }}>
                        {presentDealsCount} / {ownerDealsTarget} ({ownerPctAchieved}%)
                      </strong>
                    </div>
                  </div>

                </div>

                {/* Performance Variance & Alignment Summary Ribbon */}
                <div style={{
                  background: presentDealsCount >= ownerDealsTarget 
                    ? 'rgba(16, 185, 129, 0.08)' 
                    : (presentDealsCount >= selfDealsTarget ? 'rgba(15, 110, 86, 0.05)' : 'rgba(234, 179, 8, 0.06)'),
                  borderRadius: '8px',
                  border: `1px solid ${presentDealsCount >= ownerDealsTarget ? 'rgba(16, 185, 129, 0.25)' : 'var(--border-color)'}`,
                  padding: '10px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem' }}>
                    <Sparkles size={16} color="var(--accent-teal)" />
                    <span style={{ color: 'var(--text-main)', fontWeight: '600' }}>
                      Actual Performance: <strong>{presentDealsCount} closed deals</strong> ({formatCurrency(effectiveBaseRevenue)} billing)
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '0.76rem' }}>
                    <span>
                      Self-Goal Alignment: <strong style={{ color: selfPctAchieved >= 100 ? '#10B981' : '#F59E0B' }}>
                        {selfPctAchieved >= 100 ? `Exceeded Self Pledge (+${selfPctAchieved - 100}%) 🎉` : `${selfPctAchieved}% of Self Target`}
                      </strong>
                    </span>
                    <span>
                      Owner Quota Alignment: <strong style={{ color: ownerPctAchieved >= 100 ? '#10B981' : '#2563EB' }}>
                        {ownerPctAchieved >= 100 ? `Exceeded Management Quota (+${ownerPctAchieved - 100}%) ⭐` : `${ownerPctAchieved}% of Leadership Quota`}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </details>

      {/* Present Actuals & Deal Velocity Baseline Ribbon */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderLeft: '4px solid var(--accent-teal)',
        borderRadius: '10px',
        padding: '14px 18px',
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ padding: '6px', background: 'rgba(15, 110, 86, 0.12)', borderRadius: '6px', color: 'var(--accent-teal)' }}>
              <Briefcase size={18} />
            </div>
            <div>
              <span style={{ fontSize: '0.88rem', fontWeight: '800', color: 'var(--text-main)', display: 'block' }}>
                {entityType === 'company' 
                  ? '🏢 Present Agency Baseline: Audited Ground Truth Inflow' 
                  : `Present Actuals: ${selectedEntity?.name} ${selectedEntity?.role ? `(${selectedEntity.role})` : ''}`}
              </span>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                {entityType === 'company'
                  ? 'Aggregated audited metrics across all active Team Leaders, Franchises, and BDs'
                  : 'Audited baseline metrics used as ground truth for forward target setting'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '0.82rem' }}>
            <div style={{ background: 'var(--bg-main)', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem', fontWeight: '600' }}>ANNUAL VOLUME</span>
              <strong style={{ color: '#0F6E56', fontSize: '0.95rem' }}>{presentDealsCount} Deals/yr</strong>
            </div>

            <div style={{ background: 'var(--bg-main)', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem', fontWeight: '600' }}>MONTHLY VELOCITY</span>
              <strong style={{ color: '#2563EB', fontSize: '0.95rem' }}>~{presentMonthlyDeals} deals/mo</strong>
            </div>

            <div style={{ background: 'var(--bg-main)', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem', fontWeight: '600' }}>AVG TICKET SIZE</span>
              <strong style={{ color: '#B7791F', fontSize: '0.95rem' }}>{formatCurrency(avgDealValue)}/deal</strong>
            </div>

            <div style={{ background: 'var(--bg-main)', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem', fontWeight: '600' }}>ANNUAL BILLING</span>
              <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>{formatCurrency(effectiveBaseRevenue)}</strong>
            </div>
          </div>
        </div>

        {/* Year-by-Year Deal Closing Breakdown */}
        {chartHistorical.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: '700' }}>History:</span>
            {chartHistorical.map((h, i) => (
              <div key={i} style={{ fontSize: '0.74rem', fontWeight: '600', padding: '4px 10px', borderRadius: '6px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}>
                <span>{h.period?.replace('FY ', '')}: </span>
                <strong style={{ color: '#0F6E56' }}>{h.deals_count || 0} deals</strong>
                <span style={{ color: 'var(--text-muted)', marginLeft: '4px' }}>({formatLakhs(h.revenue)})</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5-Year Forward Predictive Model & Scale Simulator */}
      <div className="dashboard-card" style={{ marginBottom: '24px' }}>
        
        {/* Performance Acceleration Alert Banner (When historical CAGR is declining) */}
        {!isInsufficientData && !predictionLoading && !predictionError && isHistoricalDeclining && (
          <div style={{
            background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.08) 0%, rgba(249, 115, 22, 0.05) 100%)',
            border: '1px solid rgba(239, 68, 68, 0.28)',
            borderRadius: '10px',
            padding: '14px 18px',
            marginBottom: '18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', maxWidth: '720px' }}>
              <div style={{ padding: '6px', background: 'rgba(239, 68, 68, 0.15)', borderRadius: '6px', color: '#dc2626', marginTop: '2px' }}>
                <AlertCircle size={20} />
              </div>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: '800', color: '#991b1b', marginBottom: '2px' }}>
                  ⚠️ Performance Acceleration Alert: Historical Trajectory is Declining ({historicalCagrPct}%)
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#7f1d1d', lineHeight: '1.45' }}>
                  {selectedEntity?.name}'s historical run-rate indicates a compounding volume contraction ({historicalCagrPct}%/yr), projecting annual billing to compress from {formatCurrency(effectiveBaseRevenue)} down to {formatCurrency(inertiaProjections[4]?.projected_revenue || 0)} by Year 5 if no intervention occurs. 
                  Below, passive inertia is separated from your <strong>Aspirational Target</strong> plan.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {forecastTab === 'inertia' ? (
                <button
                  onClick={() => {
                    setForecastTab('target');
                    if (overrideRate === '' || parseFloat(overrideRate) <= 0) {
                      setOverrideRate('15');
                    }
                  }}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'var(--accent-teal)',
                    color: '#ffffff',
                    fontSize: '0.78rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Zap size={13} />
                  Switch to +15% Recovery Plan
                </button>
              ) : (
                <button
                  onClick={() => {
                    setGoalModalParams({
                      growthPct: 15,
                      placements: Math.max(1, Math.round(baseDealsCount * 1.15)),
                      targetRevenue: effectiveBaseRevenue * 1.15
                    });
                    setIsGoalModalOpen(true);
                  }}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#dc2626',
                    color: '#ffffff',
                    fontSize: '0.78rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Target size={13} />
                  Set +15% Turnaround Target
                </button>
              )}
            </div>
          </div>
        )}

        {/* Header & Mode Switcher */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '4px' }}>
              <h3 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} color="var(--accent-teal)" />
                5-Year Forward Horizon (Years 1 to 5)
              </h3>

              {/* Distinct Mode Switcher: Target vs Inertia */}
              {!isInsufficientData && !predictionLoading && !predictionError && (
                <div style={{ display: 'inline-flex', background: 'var(--bg-main)', borderRadius: '6px', padding: '3px', border: '1px solid var(--border-color)' }}>
                  <button
                    type="button"
                    onClick={() => setForecastTab('target')}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '4px',
                      border: 'none',
                      background: forecastTab === 'target' ? 'var(--accent-teal)' : 'transparent',
                      color: forecastTab === 'target' ? '#ffffff' : 'var(--text-muted)',
                      fontSize: '0.74rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <Target size={12} />
                    🎯 Aspirational Target (Intervention Plan)
                  </button>
                  <button
                    type="button"
                    onClick={() => setForecastTab('inertia')}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '4px',
                      border: 'none',
                      background: forecastTab === 'inertia' ? (isHistoricalDeclining ? '#dc2626' : 'var(--accent-teal)') : 'transparent',
                      color: forecastTab === 'inertia' ? '#ffffff' : 'var(--text-muted)',
                      fontSize: '0.74rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <TrendingDown size={12} />
                    📉 Historical Trend (If Unchanged)
                  </button>
                </div>
              )}
            </div>

            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {forecastTab === 'target'
                ? `Aspirational growth roadmap (Years 1 to 5) calculated from your specified growth velocity (+${targetRatePct}%) or deal placement targets.`
                : `Passive CAGR run-rate (${historicalCagrPct}%/yr) based on historical performance — showing risk exposure if no intervention occurs.`}
            </span>
          </div>

          {/* Interactive Target & Rate Controls (Visible in Target Mode) */}
          {!isInsufficientData && !predictionLoading && !predictionError && forecastTab === 'target' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {/* Target Mode Toggle */}
              <div style={{ display: 'flex', background: 'var(--bg-main)', borderRadius: '6px', padding: '2px', border: '1px solid var(--border-color)' }}>
                <button
                  type="button"
                  onClick={() => setTargetControlMode('rate')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '4px',
                    border: 'none',
                    background: targetControlMode === 'rate' ? 'var(--accent-teal)' : 'transparent',
                    color: targetControlMode === 'rate' ? '#ffffff' : 'var(--text-muted)',
                    fontSize: '0.76rem',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  📈 Rate %
                </button>
                <button
                  type="button"
                  onClick={() => setTargetControlMode('placements')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '4px',
                    border: 'none',
                    background: targetControlMode === 'placements' ? 'var(--accent-teal)' : 'transparent',
                    color: targetControlMode === 'placements' ? '#ffffff' : 'var(--text-muted)',
                    fontSize: '0.76rem',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  🎯 Placements Goal
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Extended Deal-Aware Target Controls Bar */}
        {!isInsufficientData && !predictionLoading && !predictionError && forecastTab === 'target' && (
          <div style={{
            background: 'var(--bg-main)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '18px'
          }}>
            {targetControlMode === 'placements' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)' }}>Current Velocity:</span>
                      <strong style={{ fontSize: '0.86rem', color: 'var(--text-main)' }}>
                        {presentDealsCount} deals/yr (~{presentMonthlyDeals}/mo)
                      </strong>
                    </div>
                    <ArrowRight size={15} color="var(--text-muted)" />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--accent-teal)' }}>Target Deals:</span>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        max="5000"
                        placeholder="e.g. 229"
                        value={targetPlacementCount}
                        onChange={(e) => handlePlacementCountChange(e.target.value)}
                        style={{
                          width: '84px',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '2px solid var(--accent-teal)',
                          background: 'var(--bg-card)',
                          color: 'var(--text-main)',
                          fontWeight: '800',
                          fontSize: '0.92rem',
                          textAlign: 'center'
                        }}
                      />
                      <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-main)' }}>deals/yr</span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                        (~{(Number(targetPlacementCount || presentDealsCount) / 12).toFixed(1)} deals/mo)
                      </span>
                    </div>
                  </div>

                  {/* Velocity Delta & Revenue Projection */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.8rem', fontWeight: '700', flexWrap: 'wrap' }}>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '5px',
                      background: Number(targetPlacementCount || presentDealsCount) >= presentDealsCount ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                      color: Number(targetPlacementCount || presentDealsCount) >= presentDealsCount ? '#0F6E56' : '#dc2626'
                    }}>
                      {Number(targetPlacementCount || presentDealsCount) >= presentDealsCount ? '+' : ''}
                      {Number(targetPlacementCount || presentDealsCount) - presentDealsCount} deals ({targetRatePct >= 0 ? '+' : ''}{targetRatePct}% YoY)
                    </span>
                    <span style={{ color: 'var(--accent-teal)' }}>
                      Projected Revenue: {formatLakhs(effectiveBaseRevenue * (1 + targetRatePct / 100))}
                    </span>
                  </div>
                </div>

                {/* Relative Increments Presets from Present Actuals */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', paddingTop: '8px', borderTop: '1px dashed var(--border-color)' }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                    Quick Targets from Present ({presentDealsCount} deals):
                  </span>
                  {[
                    { label: `+10% (${Math.round(presentDealsCount * 1.10)} deals)`, count: Math.round(presentDealsCount * 1.10) },
                    { label: `+15% (${Math.round(presentDealsCount * 1.15)} deals)`, count: Math.round(presentDealsCount * 1.15) },
                    { label: `+25% (${Math.round(presentDealsCount * 1.25)} deals)`, count: Math.round(presentDealsCount * 1.25) },
                    { label: `+50% (${Math.round(presentDealsCount * 1.50)} deals)`, count: Math.round(presentDealsCount * 1.50) },
                    { label: `+75% (${Math.round(presentDealsCount * 1.75)} deals)`, count: Math.round(presentDealsCount * 1.75) }
                  ].map((preset, pIdx) => (
                    <button
                      key={pIdx}
                      type="button"
                      onClick={() => handlePlacementCountChange(String(preset.count))}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '4px',
                        border: targetPlacementCount === String(preset.count) ? '1px solid var(--accent-teal)' : '1px solid var(--border-color)',
                        background: targetPlacementCount === String(preset.count) ? 'rgba(15, 110, 86, 0.12)' : 'var(--bg-card)',
                        color: targetPlacementCount === String(preset.count) ? 'var(--accent-teal)' : 'var(--text-main)',
                        fontSize: '0.74rem',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)' }}>
                      Current Baseline: <strong style={{ color: 'var(--text-main)' }}>{presentDealsCount} deals/yr ({formatCurrency(effectiveBaseRevenue)})</strong>
                    </span>
                    <ArrowRight size={15} color="var(--text-muted)" />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--accent-teal)' }}>Target Growth (R):</span>
                      <input
                        type="number"
                        step="0.5"
                        min="-50"
                        max="500"
                        value={overrideRate}
                        onChange={(e) => handleRateChange(e.target.value)}
                        style={{
                          width: '78px',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '2px solid var(--accent-teal)',
                          background: 'var(--bg-card)',
                          color: 'var(--text-main)',
                          fontWeight: '800',
                          fontSize: '0.92rem',
                          textAlign: 'center'
                        }}
                      />
                      <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-main)' }}>%</span>
                      <button
                        type="button"
                        onClick={handleResetRate}
                        title="Reset to Baseline Target (+15% or positive CAGR)"
                        style={{
                          padding: '5px 8px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-card)',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          fontSize: '0.74rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                      >
                        <RotateCcw size={11} />
                        Reset
                      </button>
                    </div>
                  </div>

                  {/* Required Closures Calculation */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8rem', fontWeight: '700', flexWrap: 'wrap' }}>
                    <span style={{ color: '#2563EB', background: 'rgba(37, 99, 235, 0.08)', padding: '4px 10px', borderRadius: '5px' }}>
                      Required Closures: <strong>{targetRequiredDeals} deals/yr</strong> (~{targetMonthlyDeals}/mo)
                    </span>
                    <span style={{ color: '#0F6E56' }}>
                      ({incrementalDeals >= 0 ? '+' : ''}{incrementalDeals} net deals)
                    </span>
                  </div>
                </div>

                {/* Quick Rate Presets */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', paddingTop: '8px', borderTop: '1px dashed var(--border-color)' }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                    Target Growth Presets:
                  </span>
                  {[10, 15, 20, 25, 50, 100].map(r => {
                    const reqD = Math.round(presentDealsCount * (1 + r / 100));
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => handleRateChange(String(r))}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '4px',
                          border: overrideRate === String(r) ? '1px solid var(--accent-teal)' : '1px solid var(--border-color)',
                          background: overrideRate === String(r) ? 'rgba(15, 110, 86, 0.12)' : 'var(--bg-card)',
                          color: overrideRate === String(r) ? 'var(--accent-teal)' : 'var(--text-main)',
                          fontSize: '0.74rem',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        +{r}% ({reqD} deals)
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {predictionLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Auditing 5-year forecast and historical baseline for {selectedEntity?.name}...
          </div>
        ) : (
          <>
            {predictionError && !predictionData && (
              <div style={{ padding: '10px 14px', background: '#FDF2F2', border: '1px solid #F8B4B4', borderRadius: '8px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={16} color="#E02424" />
                  <span style={{ fontSize: '0.78rem', color: '#9B1C1C' }}>{predictionError}</span>
                </div>
                <button
                  onClick={() => fetchPrediction(overrideRate)}
                  style={{ padding: '4px 10px', borderRadius: '5px', border: '1px solid #E02424', background: '#FFFFFF', color: '#9B1C1C', fontWeight: '600', fontSize: '0.72rem', cursor: 'pointer' }}
                >
                  Retry Sync
                </button>
              </div>
            )}

            {predictionData?.is_new_hire && (
              <div style={{ padding: '10px 14px', background: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234, 179, 8, 0.25)', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Zap size={16} color="#b45309" />
                <span style={{ fontSize: '0.78rem', color: '#92400e', fontWeight: '600' }}>
                  ⚡ Rapid Onboarding Mode: Projections and milestones for {selectedEntity?.name} are modeled from benchmark targets (+{targetRatePct}%) to establish an immediate performance roadmap.
                </span>
              </div>
            )}

            {/* 1. Trajectory Line Chart for Historical Baseline & 5-Year Forward Path */}
            <TrajectoryLineChart
              historical={chartHistorical}
              projected={activeProjections}
              confidence={predictionData?.confidence || 'high'}
              isDeclining={forecastTab === 'inertia' && isHistoricalDeclining}
              projLabel={forecastTab === 'target' ? '5-Yr Target Roadmap' : 'Historical Inertia Path'}
            />

            {/* 5-Year Forward Horizon Cards (Year +1 through Year +5) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(195px, 1fr))', gap: '12px', marginBottom: '24px' }}>
              {activeProjections.map((proj, idx) => {
                const isDecliningCard = proj.growth_pct < 0;
                return (
                  <div
                    key={idx}
                    style={{
                      background: 'var(--bg-main)',
                      padding: '14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)',
                      borderTop: `3px solid ${
                        isDecliningCard 
                          ? '#dc2626' 
                          : (idx === 4 ? '#8b5cf6' : (idx >= 2 ? '#3b82f6' : 'var(--accent-teal)'))
                      }`,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-main)' }}>
                          {forecastTab === 'target' ? `${proj.period_label} Target` : `${proj.period_label} Baseline`}
                        </span>
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: '700',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: isDecliningCard ? '#FDE8E8' : '#E6F4EA',
                          color: isDecliningCard ? '#C81E1E' : '#0F6E56'
                        }}>
                          {proj.growth_pct >= 0 ? '+' : ''}{proj.growth_pct}% {forecastTab === 'target' ? 'Target' : 'Inertia'}
                        </span>
                      </div>
                      
                      <div style={{ 
                        fontSize: '1.15rem', 
                        fontWeight: '800', 
                        color: isDecliningCard ? '#C81E1E' : '#0F6E56', 
                        marginBottom: '4px' 
                      }}>
                        {formatCurrency(proj.projected_revenue)}
                      </div>

                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '10px' }}>
                        <span>
                          {forecastTab === 'target' ? 'Target Closures: ' : 'Projected Volume: '}
                          <strong style={{ color: isDecliningCard ? '#dc2626' : '#2563EB', fontSize: '0.8rem' }}>
                            {proj.projected_deals} deals/yr
                          </strong>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: '4px' }}>
                            (~{(proj.projected_deals / 12).toFixed(1)}/mo)
                          </span>
                        </span>
                        
                        <span style={{ color: proj.projected_deals >= presentDealsCount ? '#0F6E56' : '#dc2626', fontSize: '0.68rem', fontWeight: '600' }}>
                          {proj.projected_deals >= presentDealsCount ? '+' : ''}{proj.projected_deals - presentDealsCount} deals vs present baseline
                        </span>
                        
                        {/* Fix #2: Distinct styling for cumulative totals */}
                        {forecastTab === 'target' ? (
                          <span style={{ color: 'var(--text-main)', fontWeight: '600' }}>
                            5-Yr Cumulative: <strong style={{ color: '#0F6E56' }}>{formatLakhs(proj.cumulative_revenue)}</strong>
                          </span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ color: '#64748b', fontSize: '0.68rem' }}>
                              5-Yr Running Total: <strong style={{ color: 'var(--text-main)' }}>{formatLakhs(proj.cumulative_revenue)}</strong>
                            </span>
                            {isDecliningCard && (
                              <span style={{ color: '#dc2626', fontSize: '0.68rem', fontWeight: '600' }}>
                                Annual Loss vs Base: -{formatLakhs(Math.abs(proj.incremental_gain))}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Direct Goal Setter / Turnaround Button */}
                    <button
                      onClick={() => {
                        setGoalModalParams({
                          growthPct: forecastTab === 'target' ? proj.growth_pct : 15,
                          placements: forecastTab === 'target' ? proj.projected_deals : Math.max(1, Math.round(baseDealsCount * 1.15)),
                          targetRevenue: forecastTab === 'target' ? proj.projected_revenue : effectiveBaseRevenue * 1.15
                        });
                        setIsGoalModalOpen(true);
                      }}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: forecastTab === 'target' ? '1px dashed var(--accent-teal)' : '1px solid rgba(220, 38, 38, 0.3)',
                        background: forecastTab === 'target' ? 'rgba(15, 110, 86, 0.06)' : 'rgba(239, 68, 68, 0.06)',
                        color: forecastTab === 'target' ? 'var(--accent-teal)' : '#dc2626',
                        fontSize: '0.72rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        transition: 'background 0.2s'
                      }}
                    >
                      {forecastTab === 'target' ? (
                        <>
                          <Target size={12} />
                          Set Year +{proj.year_index} Goal
                        </>
                      ) : (
                        <>
                          <Zap size={12} />
                          Intervene & Set Goal
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Strategic Scale Simulator Callout */}
            <div style={{
              background: isHistoricalDeclining 
                ? 'linear-gradient(90deg, rgba(15, 110, 86, 0.08) 0%, rgba(59, 130, 246, 0.05) 100%)'
                : 'rgba(15, 110, 86, 0.05)',
              border: '1px solid rgba(15, 110, 86, 0.2)',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{ padding: '6px', background: 'rgba(15, 110, 86, 0.12)', borderRadius: '6px', color: 'var(--accent-teal)' }}>
                <Sparkles size={18} />
              </div>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '2px' }}>
                  {entityType === 'company' 
                    ? '🏢 Overall Company Scale Goal (2x, 3x, 5x Portfolio Growth)' 
                    : `💡 Individual Growth Roadmap (${selectedEntity?.name || 'Selected Profile'})`}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.45' }}>
                  {entityType === 'company' ? (
                    <>
                      Sets macro growth multiplier across the total agency portfolio. Scaling from <strong>2x to 5x</strong> grows the gross billing target up to <strong>{formatCurrency(effectiveBaseRevenue * 5)}</strong>. The company margin (ourShare) at 5x = <strong>{formatCurrency(Math.round(effectiveBaseRevenue * 5 * netRetentionRate))}</strong> — Saarthi's cut after franchisee royalties ({(netRetentionRate * 100).toFixed(1)}% of gross).
                    </>
                  ) : (
                    <>
                      Targeting a {targetRatePct}% YoY growth rate requires closing <strong>{targetRequiredDeals} deals/year</strong> (~{targetMonthlyDeals} deals/month), generating an incremental <strong>+{formatCurrency(Math.max(0, effectiveBaseRevenue * (targetRatePct / 100)))}</strong> in revenue contribution.
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Flat Scale Multiplier Scenarios (Exclusively for Overall Company) */}
            {entityType === 'company' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <h5 style={{ margin: 0, fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-main)' }}>
                  🏢 Overall Company Scale Multiplier Scenarios (1x → 5x Production Velocity)
                </h5>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[1, 2, 3, 4, 5].map(mult => (
                    <button
                      key={mult}
                      onClick={() => setActiveScenarioMultiplier(mult)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: activeScenarioMultiplier === mult ? '1px solid var(--accent-teal)' : '1px solid var(--border-color)',
                        background: activeScenarioMultiplier === mult ? 'var(--accent-teal)' : 'var(--bg-main)',
                        color: activeScenarioMultiplier === mult ? '#ffffff' : 'var(--text-main)',
                        fontSize: '0.74rem',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      {mult}x Company Scale
                    </button>
                  ))}
                </div>
              </div>

              {/* Scale Multiplier BarChart */}
              <div style={{ background: 'var(--bg-main)', borderRadius: '10px', padding: '14px 16px', border: '1px solid var(--border-color)', marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.76rem', fontWeight: '700', color: 'var(--text-main)' }}>Scale Level Comparison (1x → 5x)</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Gross Billing Volume vs Net Contribution</span>
                </div>
                <BarChart
                  data={scaleChartData}
                  series1Key="revenue"
                  series2Key="netRetention"
                  series1Label="Gross Billing Target"
                  series2Label="Company Margin (ourShare)"
                  series1Color="#10b981"
                  series2Color="#0F6E56"
                  height={120}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
                {[1, 2, 3, 4, 5].map(mult => {
                  const key = `scale${mult}x`;
                  const scaledDeals = presentDealsCount * mult;
                  const scRevenue = effectiveBaseRevenue * mult;
                  const scNet = Math.round(scRevenue * netRetentionRate);
                  const isSelected = activeScenarioMultiplier === mult;

                  return (
                    <div
                      key={key}
                      onClick={() => setActiveScenarioMultiplier(mult)}
                      style={{
                        padding: '12px',
                        borderRadius: '8px',
                        border: isSelected ? '2px solid var(--accent-teal)' : '1px solid var(--border-color)',
                        background: isSelected ? 'rgba(15, 110, 86, 0.04)' : 'var(--bg-main)',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                        <span style={{ fontSize: '0.74rem', fontWeight: '700', color: isSelected ? 'var(--accent-teal)' : 'var(--text-muted)' }}>
                          {mult}x {mult === 1 ? 'Current Base' : 'Scale'}
                        </span>
                        <span style={{ fontSize: '0.68rem', fontWeight: '700', color: '#2563EB', background: 'rgba(37, 99, 235, 0.08)', padding: '1px 5px', borderRadius: '3px' }}>
                          {scaledDeals} deals
                        </span>
                      </div>
                      <div style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '2px' }}>
                        {formatCurrency(scRevenue)}
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>
                        Company Margin: {formatCurrency(scNet)} <span style={{ opacity: 0.7 }}>({(netRetentionRate * 100).toFixed(1)}%)</span>
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Company Macro Multiplier Execution Plan across Team Leaders */}
              <div style={{ background: 'var(--bg-card)', borderRadius: '10px', border: '1px solid var(--border-color)', padding: '16px', marginTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <h6 style={{ margin: 0, fontSize: '0.86rem', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>🎯 Execution Plan: How Team Leaders Deliver {activeScenarioMultiplier}x Scale ({formatCurrency(effectiveBaseRevenue * activeScenarioMultiplier)})</span>
                      <span style={{ fontSize: '0.68rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>
                        ● Live CRM Synced
                      </span>
                    </h6>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      Target quotas calculated dynamically from live CRM database ({liveTeamLeaderQuotas.length} active Team Leaders) to achieve {presentDealsCount * activeScenarioMultiplier} annual placements (~{Math.round((presentDealsCount * activeScenarioMultiplier) / 12)} deals/month).
                    </span>
                  </div>
                  <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '4px', background: 'rgba(15, 110, 86, 0.12)', color: 'var(--accent-teal)', fontWeight: '700' }}>
                    Macro Multiplier: {activeScenarioMultiplier}.0x
                  </span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left' }}>
                        <th style={{ padding: '8px 10px' }}>Team Leader</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>Active Franchises</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>Current Deals (Live)</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>{activeScenarioMultiplier}x Target Deals</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Target Billing</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>Franchise Productivity Needed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {liveTeamLeaderQuotas.map((tl, idx) => {
                        const targetDeals = Math.round(tl.baseDeals * activeScenarioMultiplier);
                        const targetBilling = Math.round((effectiveBaseRevenue > 0 ? effectiveBaseRevenue : 95000000) * activeScenarioMultiplier * tl.share);
                        const monthlyPerStore = (targetDeals / Math.max(1, tl.activeFranchises) / 12).toFixed(2);

                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '10px', fontWeight: '700', color: 'var(--text-main)' }}>
                              <div>{tl.name}</div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '400' }}>
                                {(tl.share * 100).toFixed(1)}% of agency volume
                              </div>
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              <span style={{ color: '#2563EB', fontWeight: '700' }}>{tl.activeFranchises} stores</span>
                              {tl.billingStores && tl.billingStores !== tl.activeFranchises && (
                                <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                  ({tl.billingStores} active billing)
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: '600' }}>{tl.baseDeals} deals</td>
                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: '800', color: '#10B981' }}>{targetDeals} deals</td>
                            <td style={{ padding: '10px', textAlign: 'right', fontWeight: '700' }}>{formatCurrency(targetBilling)}</td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(37, 99, 235, 0.08)', color: '#2563EB', fontWeight: '700' }}>
                                {monthlyPerStore} deals/store/mo
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>

      {/* Target History & Outcome Tracking Table */}
      <div className="dashboard-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 className="card-title" style={{ margin: 0 }}>Target Milestones & Performance Registry</h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Historical growth targets, official target letters, and audited actuals for {selectedEntity?.name}.
            </span>
          </div>

          <button
            className="btn btn-secondary"
            onClick={() => setIsGoalModalOpen(true)}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: '600',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-card)',
              color: 'var(--text-main)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Plus size={14} />
            Set New Target
          </button>
        </div>

        {targetsLoading ? (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Loading targets registry...
          </div>
        ) : targetsList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 20px', background: 'var(--bg-main)', borderRadius: '10px', border: '1px dashed var(--border-color)' }}>
            <Award size={32} color="var(--text-muted)" style={{ marginBottom: '8px' }} />
            <h4 style={{ margin: '0 0 6px 0', color: 'var(--text-main)', fontSize: '0.95rem' }}>No Targets Established Yet</h4>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Formalize the first annual growth milestone and generate an official performance memo for {selectedEntity?.name}.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => setIsGoalModalOpen(true)}
              style={{ padding: '7px 16px', borderRadius: '6px', border: 'none', background: 'var(--accent-teal)', color: '#ffffff', fontWeight: '600', fontSize: '0.82rem', cursor: 'pointer' }}
            >
              Establish Target Now
            </button>
          </div>
        ) : (() => {
          const safePage = Math.min(Math.max(1, historyPage), Math.max(1, Math.ceil(targetsList.length / ITEMS_PER_PAGE)));
          const paginatedTargets = targetsList.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

          return (
            <div>
              <div className="table-responsive">
                <table className="data-table" style={{ fontSize: '0.82rem' }}>
                  <thead>
                    <tr>
                      <th>Period Horizon</th>
                      <th>Goal Type</th>
                      <th>Growth Target & Progress</th>
                      <th>Trajectory</th>
                      {entityType === 'bd_agent' && <th>Target Salary</th>}
                      <th>Status</th>
                      <th>Actual Achieved</th>
                      <th>Variance & Realization</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTargets.map(t => {
                      const isCompleted = t.status === 'completed';
                      const variance = isCompleted && t.actual_growth_pct_pct !== null ? (t.actual_growth_pct_pct - t.growth_pct_target_pct) : null;
                      const isOver = variance !== null && variance >= 0;

                      return (
                        <tr key={t.id}>
                          <td className="font-bold">
                            <div style={{ color: 'var(--text-main)' }}>{t.period_start} → {t.period_end}</div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ID: {t.id}</span>
                          </td>
                          <td>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '0.7rem',
                              fontWeight: '700',
                              background: t.target_author === 'self' ? 'rgba(15, 110, 86, 0.1)' : 'rgba(37, 99, 235, 0.1)',
                              color: t.target_author === 'self' ? 'var(--accent-teal)' : '#2563EB',
                              border: `1px solid ${t.target_author === 'self' ? 'rgba(15, 110, 86, 0.2)' : 'rgba(37, 99, 235, 0.2)'}`
                            }}>
                              {t.target_author === 'self' ? '👤 Self-Pledge' : '👑 Owner Quota'}
                            </span>
                          </td>
                          <td>
                            {isCompleted ? (
                              <TargetVsActualBar
                                targetPct={Number(t.growth_pct_target_pct) || 0}
                                actualPct={t.actual_growth_pct_pct !== null ? Number(t.actual_growth_pct_pct) : 0}
                                width={130}
                              />
                            ) : (
                              <div>
                                <span style={{ fontWeight: '700', color: 'var(--accent-teal)', fontSize: '0.88rem' }}>
                                  +{t.growth_pct_target_pct}%
                                </span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Target Rate</span>
                              </div>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Sparkline
                                points={getTargetSparklinePoints(t)}
                                width={85}
                                height={22}
                                positive={!isCompleted || isOver}
                              />
                            </div>
                          </td>
                          {entityType === 'bd_agent' && (
                            <td style={{ fontWeight: '600', color: 'var(--text-main)' }}>
                              {t.salary_target ? formatCurrency(t.salary_target) : '—'}
                            </td>
                          )}
                          <td>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.72rem',
                              fontWeight: '600',
                              backgroundColor: isCompleted ? '#E6F4EA' : 'rgba(15, 110, 86, 0.1)',
                              color: isCompleted ? '#0F6E56' : 'var(--accent-teal)'
                            }}>
                              {isCompleted ? 'Completed & Audited' : 'Active Tracking'}
                            </span>
                          </td>
                          <td>
                            {isCompleted ? (
                              <div>
                                <strong style={{ color: isOver ? '#0F6E56' : '#A8402E', fontSize: '0.88rem' }}>
                                  {t.actual_growth_pct_pct >= 0 ? '+' : ''}{t.actual_growth_pct_pct}%
                                </strong>
                                {t.actual_value && (
                                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                    {formatCurrency(t.actual_value)}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Pending cycle end</span>
                            )}
                          </td>
                          <td>
                            {isCompleted && variance !== null ? (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.75rem',
                                fontWeight: '700',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: isOver ? '#E6F4EA' : '#FCE8E6',
                                color: isOver ? '#0F6E56' : '#A8402E'
                              }}>
                                {isOver ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                {variance >= 0 ? '+' : ''}{variance.toFixed(1)}% {isOver ? 'Over Goal' : 'Shortfall'}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>—</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                              {t.target_letter_text && (
                                <button
                                  onClick={() => setViewingLetter({ title: `Target Memo: ${t.entity_name}`, content: t.target_letter_text })}
                                  style={{
                                    padding: '4px 8px',
                                    borderRadius: '5px',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-main)',
                                    color: 'var(--text-main)',
                                    fontSize: '0.72rem',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                  }}
                                  title="View Target Letter"
                                >
                                  Target Memo
                                </button>
                              )}

                              {!isCompleted ? (
                                <button
                                  onClick={() => setActiveOutcomeTarget(t)}
                                  style={{
                                    padding: '4px 8px',
                                    borderRadius: '5px',
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
                              ) : (
                                t.outcome_letter_text && (
                                  <button
                                    onClick={() => setViewingLetter({ title: `Outcome Audit: ${t.entity_name}`, content: t.outcome_letter_text })}
                                    style={{
                                      padding: '4px 8px',
                                      borderRadius: '5px',
                                      border: '1px solid #0F6E56',
                                      background: 'rgba(15, 110, 86, 0.08)',
                                      color: '#0F6E56',
                                      fontSize: '0.72rem',
                                      fontWeight: '600',
                                      cursor: 'pointer'
                                    }}
                                    title="View Outcome Audit Memo"
                                  >
                                    Audit Memo
                                  </button>
                                )
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <Pagination
                currentPage={safePage}
                totalItems={targetsList.length}
                pageSize={ITEMS_PER_PAGE}
                onPageChange={setHistoryPage}
                itemName="target milestones"
              />
            </div>
          );
        })()}
      </div>

      {/* Goal Setter Modal */}
      {isGoalModalOpen && (
        <GoalSetterModal
          isOpen={isGoalModalOpen}
          onClose={() => {
            setIsGoalModalOpen(false);
            setGoalModalParams(null);
          }}
          entityType={entityType}
          entity={selectedEntity}
          initialGrowthPct={goalModalParams?.growthPct}
          initialTargetPlacements={goalModalParams?.placements}
          initialTargetRevenue={goalModalParams?.targetRevenue}
          initialTargetAuthor={goalModalParams?.targetAuthor}
          onTargetCreated={(newTarget) => {
            setTargetsList(prev => [newTarget, ...prev.filter(t => t.id !== newTarget.id)]);
            fetchTargets();
            fetchPrediction();
          }}
        />
      )}

      {/* Outcome Recorder Modal */}
      {activeOutcomeTarget && (
        <OutcomeRecorderModal
          isOpen={Boolean(activeOutcomeTarget)}
          onClose={() => setActiveOutcomeTarget(null)}
          target={activeOutcomeTarget}
          onOutcomeRecorded={(updated) => {
            setTargetsList(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t));
            fetchTargets();
          }}
        />
      )}

      {/* Letter Viewer Dialog */}
      {viewingLetter && (
        <div className="modal-backdrop" onClick={() => setViewingLetter(null)}>
          <div
            className="modal-content animate-slide-up"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '720px', width: '92%', maxHeight: '82vh', display: 'flex', flexDirection: 'column' }}
          >
            <div className="modal-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-main)', fontWeight: '700' }}>
                {viewingLetter.title}
              </h4>
              <button className="close-btn" onClick={() => setViewingLetter(null)} aria-label="Close modal">
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, position: 'relative', backgroundColor: 'var(--bg-main)' }}>
              <pre style={{
                background: '#FFFFFF',
                padding: '16px 18px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                fontSize: '0.8rem',
                fontFamily: 'Consolas, Monaco, monospace',
                whiteSpace: 'pre-wrap',
                lineHeight: '1.55',
                color: '#1B2321',
                margin: 0
              }}>
                {viewingLetter.content}
              </pre>
            </div>

            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)' }}>
              <button
                onClick={() => handleCopyLetter(viewingLetter.content)}
                style={{
                  padding: '7px 14px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: letterCopied ? '#E6F4EA' : '#FFFFFF',
                  color: letterCopied ? '#0F6E56' : 'var(--text-main)',
                  fontSize: '0.78rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                {letterCopied ? <Check size={14} /> : <Copy size={14} />}
                {letterCopied ? 'Copied to Clipboard!' : 'Copy Letter Text'}
              </button>

              <button
                className="btn btn-primary"
                onClick={() => setViewingLetter(null)}
                style={{ padding: '7px 18px', borderRadius: '6px', border: 'none', background: 'var(--accent-teal)', color: '#ffffff', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drill-down Audit Panel */}
      <AuditPanel
        isOpen={isAuditPanelOpen}
        onClose={() => setIsAuditPanelOpen(false)}
        title={auditPanelTitle}
        subtitle={auditPanelSubtitle}
        entityType={type}
        transactions={auditTransactions}
        periodLabel={selectedFy}
      />
    </div>
  );
};

export default GrowthTracking;
