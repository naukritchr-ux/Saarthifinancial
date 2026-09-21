import React, { useContext, useState, useEffect, useMemo, useRef } from 'react';
import { FinanceContext, API_BASE_URL } from '../context/FinanceContext';
import { fetchWithApiKey } from '../utils/apiClient';
import { formatCurrency, formatLakhs } from '../utils/formatters';
import { 
  TrendingUp, 
  TrendingDown, 
  Award, 
  Users, 
  Building2, 
  Briefcase,
  Plus, 
  Calendar, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  X, 
  Sliders, 
  RotateCcw,
  Percent,
  DollarSign,
  ChevronRight,
  Sparkles,
  Zap,
  Activity,
  Target,
  BarChart3,
  ShieldAlert,
  Info,
  ArrowRight,
  Clock,
  Layers
} from 'lucide-react';
import Pagination from '../components/Pagination';
import GoalSetterModal from '../components/GoalSetterModal';
import OutcomeRecorderModal from '../components/OutcomeRecorderModal';
import { TrajectoryLineChart, BarChart, Sparkline, TargetVsActualBar } from '../components/CustomCharts';

const GrowthTracking = () => {
  const { franchisees, bdAgents, teamLeaders, transactions } = useContext(FinanceContext);

  // Entity selection state
  const [entityType, setEntityType] = useState('employee'); // 'franchisee' | 'bd_agent' | 'team_leader' | 'employee'
  const [selectedEntityId, setSelectedEntityId] = useState('');
  
  // Dynamic Roster state
  const [serverRoster, setServerRoster] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(false);

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
      const res = await fetchWithApiKey(`${API_BASE_URL}/growth-targets/roster?entity_type=${entityType}`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data.roster) ? data.roster : (Array.isArray(data) ? data : []);
        if (list.length > 0) {
          rosterCacheRef.current[entityType] = list;
          setServerRoster(list);
        }
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

  // Build entity options combining server roster and context fallbacks
  const entityOptions = useMemo(() => {
    if (serverRoster && serverRoster.length > 0) {
      return serverRoster;
    }

    if (entityType === 'franchisee') {
      const base = (franchisees && franchisees.length > 0)
        ? franchisees.map(f => ({ id: String(f.id), name: f.name || f.nameAsPerAgreement, type: 'franchisee', role: 'Franchise Partner', total_revenue: f.revenue || 0 }))
        : [
            { id: 'f-1', name: 'Preshita', type: 'franchisee', role: 'Franchise Partner', total_deals: 18, total_revenue: 1650000 },
            { id: 'f-2', name: 'Anita', type: 'franchisee', role: 'Franchise Partner', total_deals: 14, total_revenue: 1280000 },
            { id: 'f-3', name: 'Razia', type: 'franchisee', role: 'Franchise Partner', total_deals: 12, total_revenue: 1100000 },
            { id: 'f-4', name: 'Sandeep', type: 'franchisee', role: 'Franchise Partner', total_deals: 10, total_revenue: 920000 },
            { id: 'f-5', name: 'Ankur', type: 'franchisee', role: 'Franchise Partner', total_deals: 8, total_revenue: 750000 },
            { id: 'f-6', name: 'Subhash', type: 'franchisee', role: 'Franchise Partner', total_deals: 6, total_revenue: 550000 },
            { id: 'f-7', name: 'Rajesh Khanna', type: 'franchisee', role: 'Franchise Partner (Dormant)', total_deals: 0, total_revenue: 0 },
            { id: 'f-8', name: 'Deepak Verma', type: 'franchisee', role: 'Franchise Partner (Dormant)', total_deals: 0, total_revenue: 0 },
            { id: 'f-9', name: 'Pooja Nair', type: 'franchisee', role: 'Franchise Partner (Dormant)', total_deals: 0, total_revenue: 0 },
            { id: 'f-10', name: 'Kavita Joshi', type: 'franchisee', role: 'Franchise Partner (Dormant)', total_deals: 0, total_revenue: 0 }
          ];
      return base;
    } else if (entityType === 'bd_agent') {
      const base = (bdAgents && bdAgents.length > 0)
        ? bdAgents.map(b => ({ id: String(b.id), name: b.name, type: 'bd_agent', role: 'BD Specialist', total_revenue: b.grossRevenue || 0 }))
        : [
            { id: 'bd-1', name: 'Komal Suresh', type: 'bd_agent', role: 'BD Specialist', total_deals: 22, total_revenue: 1950000 },
            { id: 'bd-2', name: 'Rajalaxmi', type: 'bd_agent', role: 'BD Specialist', total_deals: 19, total_revenue: 1720000 },
            { id: 'bd-3', name: 'Jahnvi', type: 'bd_agent', role: 'BD Specialist', total_deals: 16, total_revenue: 1480000 },
            { id: 'bd-4', name: 'Ashutosh', type: 'bd_agent', role: 'BD Specialist', total_deals: 14, total_revenue: 1250000 },
            { id: 'bd-5', name: 'Kadambinee', type: 'bd_agent', role: 'BD Specialist', total_deals: 12, total_revenue: 1080000 },
            { id: 'bd-6', name: 'Muskan', type: 'bd_agent', role: 'BD Specialist', total_deals: 11, total_revenue: 990000 },
            { id: 'bd-7', name: 'Rahul', type: 'bd_agent', role: 'BD Specialist', total_deals: 9, total_revenue: 810000 },
            { id: 'bd-8', name: 'Sneha K.', type: 'bd_agent', role: 'BD Specialist', total_deals: 8, total_revenue: 720000 },
            { id: 'bd-9', name: 'Ankur S.', type: 'bd_agent', role: 'BD Specialist', total_deals: 7, total_revenue: 630000 },
            { id: 'bd-10', name: 'Ruchi', type: 'bd_agent', role: 'BD Specialist', total_deals: 5, total_revenue: 450000 },
            { id: 'bd-11', name: 'Shreya', type: 'bd_agent', role: 'BD Specialist (Dormant)', total_deals: 0, total_revenue: 0 },
            { id: 'bd-12', name: 'Sneha J.', type: 'bd_agent', role: 'BD Specialist (Dormant)', total_deals: 0, total_revenue: 0 },
            { id: 'bd-13', name: 'Shruti', type: 'bd_agent', role: 'BD Specialist (Dormant)', total_deals: 0, total_revenue: 0 },
            { id: 'bd-14', name: 'Jiya', type: 'bd_agent', role: 'BD Specialist (Dormant)', total_deals: 0, total_revenue: 0 },
            { id: 'bd-15', name: 'Sonali', type: 'bd_agent', role: 'BD Specialist (Dormant)', total_deals: 0, total_revenue: 0 }
          ];
      return base;
    } else if (entityType === 'team_leader') {
      const base = (teamLeaders && teamLeaders.length > 0)
        ? teamLeaders.map(t => ({ id: String(t.id), name: t.name, type: 'team_leader', role: t.role || 'Team Leader', total_revenue: t.grossRevenue || t.target || 0 }))
        : [
            { id: 'tl-1', name: 'Vedika', type: 'team_leader', role: 'Team Leader', total_deals: 36, total_revenue: 3200000 },
            { id: 'tl-2', name: 'Surbhi', type: 'team_leader', role: 'Team Leader', total_deals: 31, total_revenue: 2800000 },
            { id: 'tl-3', name: 'Joyeeta', type: 'team_leader', role: 'Team Leader', total_deals: 27, total_revenue: 2450000 },
            { id: 'tl-4', name: 'Avadai', type: 'team_leader', role: 'Senior Team Leader', total_deals: 24, total_revenue: 2150000 },
            { id: 'tl-5', name: 'Pooja', type: 'team_leader', role: 'Team Leader', total_deals: 19, total_revenue: 1700000 },
            { id: 'tl-6', name: 'Rajesh', type: 'team_leader', role: 'Team Leader', total_deals: 15, total_revenue: 1350000 },
            { id: 'tl-7', name: 'Amit', type: 'team_leader', role: 'Team Leader (Dormant)', total_deals: 0, total_revenue: 0 },
            { id: 'tl-8', name: 'Priya', type: 'team_leader', role: 'Team Leader (Dormant)', total_deals: 0, total_revenue: 0 },
            { id: 'tl-9', name: 'Sanjay', type: 'team_leader', role: 'Team Leader (Dormant)', total_deals: 0, total_revenue: 0 },
            { id: 'tl-10', name: 'Vikram', type: 'team_leader', role: 'Team Leader (Dormant)', total_deals: 0, total_revenue: 0 }
          ];
      return base;
    } else if (entityType === 'company') {
      return [
        { id: 'comp-overall', name: 'Overall Company (Full Agency Portfolio)', type: 'company', role: 'Head Office Total Portfolio', total_deals: 185, total_revenue: 16500000 }
      ];
    } else {
      return [
        { id: 'emp-1', name: 'Komal Suresh', type: 'employee', role: 'BD Specialist', total_deals: 22, total_revenue: 1950000 },
        { id: 'emp-2', name: 'Rajalaxmi', type: 'employee', role: 'BD Specialist', total_deals: 19, total_revenue: 1720000 },
        { id: 'emp-3', name: 'Jahnvi', type: 'employee', role: 'BD Specialist', total_deals: 16, total_revenue: 1480000 },
        { id: 'emp-4', name: 'Ashutosh', type: 'employee', role: 'BD Specialist', total_deals: 14, total_revenue: 1250000 },
        { id: 'emp-5', name: 'Vedika', type: 'employee', role: 'Team Leader', total_deals: 36, total_revenue: 3200000 },
        { id: 'emp-6', name: 'Surbhi', type: 'employee', role: 'Team Leader', total_deals: 31, total_revenue: 2800000 }
      ];
    }
  }, [entityType, serverRoster, franchisees, bdAgents, teamLeaders]);

  // Set default selected entity if empty or switched tabs
  useEffect(() => {
    if (entityOptions.length > 0) {
      const exists = entityOptions.some(e => e.id === selectedEntityId || e.name === selectedEntityId);
      if (!exists) {
        setSelectedEntityId(entityOptions[0].id);
      }
    }
  }, [entityType, entityOptions, selectedEntityId]);

  const selectedEntity = useMemo(() => {
    return entityOptions.find(e => e.id === selectedEntityId || e.name === selectedEntityId) || entityOptions[0] || null;
  }, [entityOptions, selectedEntityId]);

  // Fetch prediction data (5 years) whenever entity or rate changes with SWR
  const fetchPrediction = async (customRateVal) => {
    if (!selectedEntity) return;
    const cacheKey = `${entityType}_${selectedEntity.id || selectedEntity.name}_${customRateVal !== undefined ? customRateVal : ''}`;
    
    if (predictionCacheRef.current[cacheKey]) {
      setPredictionData(predictionCacheRef.current[cacheKey]);
    } else {
      setPredictionLoading(true);
    }
    setPredictionError(null);
    try {
      const rateParam = (customRateVal !== undefined && customRateVal !== '') ? `&rate=${customRateVal}` : '';
      const url = `${API_BASE_URL}/growth-targets/predict?entity_type=${entityType}&entity_id=${encodeURIComponent(selectedEntity.id || selectedEntity.name)}&entity_name=${encodeURIComponent(selectedEntity.name || '')}${rateParam}&periods=5`;
      const res = await fetchWithApiKey(url);
      if (res.ok) {
        const data = await res.json();
        predictionCacheRef.current[cacheKey] = data;
        setPredictionData(data);
        if (data.insufficient_data || data.projection_status === 'insufficient_data') {
          setOverrideRate('');
        } else if (customRateVal === undefined || customRateVal === '') {
          // If historical CAGR is positive, use it as default target (capped at +35% for initial baseline). If negative, default goal target rate to +15.0%
          const histCagr = data.historical_cagr_pct;
          const defaultTargetRate = (histCagr !== undefined && histCagr !== null && histCagr > 0) ? Math.min(35, histCagr) : 15;
          setOverrideRate(String(defaultTargetRate));
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        setPredictionError(errJson.message || 'Could not load historical revenue data for this entity.');
      }
    } catch (err) {
      console.warn("Notice: growth prediction API offline / unreachable, using local entity records:", err);
      setPredictionError('Unable to connect to live API server. Rendering roadmap using local ledger records.');
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
    const baseRev = selectedEntity?.total_revenue || selectedEntity?.revenue || 1000000;
    const baseD = selectedEntity?.total_deals || selectedEntity?.deals_count || 10;
    return [
      { period: 'FY 2024-25', revenue: Math.round(baseRev * 0.88), deals_count: Math.max(1, Math.round(baseD * 0.88)) },
      { period: 'FY 2025-26', revenue: baseRev, deals_count: baseD }
    ];
  }, [predictionData, selectedEntity]);

  // Effective base revenue strictly from real database historical inflow with local fallback
  const effectiveBaseRevenue = useMemo(() => {
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
    return 1000000;
  }, [predictionData, chartHistorical, selectedEntity]);

  // Base deals count & present actuals
  const baseDealsCount = useMemo(() => {
    if (chartHistorical.length > 0 && chartHistorical[chartHistorical.length - 1].deals_count > 0) {
      return chartHistorical[chartHistorical.length - 1].deals_count;
    }
    return selectedEntity?.total_deals || selectedEntity?.deals_count || 10;
  }, [chartHistorical, selectedEntity]);

  // Present Closed Deals & Ticket Size Metrics
  const presentDealsCount = useMemo(() => {
    if (chartHistorical.length > 0 && chartHistorical[chartHistorical.length - 1].deals_count > 0) {
      return chartHistorical[chartHistorical.length - 1].deals_count;
    }
    return selectedEntity?.total_deals || selectedEntity?.deals_count || baseDealsCount || 10;
  }, [chartHistorical, selectedEntity, baseDealsCount]);

  const presentMonthlyDeals = useMemo(() => {
    return (presentDealsCount / 12).toFixed(1);
  }, [presentDealsCount]);

  const avgDealValue = useMemo(() => {
    return Math.round(effectiveBaseRevenue / Math.max(1, presentDealsCount));
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
    return 15;
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
    return Math.max(1, Math.round(presentDealsCount * (1 + targetRatePct / 100)));
  }, [presentDealsCount, targetRatePct]);

  const targetMonthlyDeals = useMemo(() => {
    return (targetRequiredDeals / 12).toFixed(1);
  }, [targetRequiredDeals]);

  const incrementalDeals = useMemo(() => {
    return targetRequiredDeals - presentDealsCount;
  }, [targetRequiredDeals, presentDealsCount]);

  // Inertia Growth Rate (R) in percentage (pure historical extrapolation)
  const inertiaRatePct = historicalCagrPct;

  // Active Rate for the selected view mode
  const activeRatePct = forecastTab === 'target' ? targetRatePct : inertiaRatePct;
  const currentRatePct = targetRatePct;

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
    const baseD = baseDealsCount > 0 ? baseDealsCount : 10;
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
        netRetention: Math.round(base * mult * 0.4375)
      };
    });
  }, [isInsufficientData, effectiveBaseRevenue]);

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

  return (
    <div className="bd-performance-page animate-fade-in" style={{ paddingBottom: '40px' }}>
      
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: '700', color: 'var(--text-main)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={26} color="var(--accent-teal)" />
            Growth Targets & Performance Intelligence
          </h2>
          <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
            5-Year forward compounding forecasts ($t=1..5$), employee productivity scoring engine, and automated performance target memos.
          </span>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => setIsGoalModalOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'var(--accent-teal)',
            color: '#FFFFFF',
            padding: '9px 18px',
            borderRadius: '8px',
            border: 'none',
            fontWeight: '600',
            fontSize: '0.86rem',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(15, 110, 86, 0.25)'
          }}
        >
          <Plus size={16} />
          Establish Growth Target
        </button>
      </div>

      {/* 4-Way Entity Type & Selector Toolbar */}
      <div style={{ background: 'var(--bg-card)', padding: '14px 18px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        {/* Type Toggle (Franchisees, BD Specialists, Team Leaders, Employees) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Roster View:</span>
          <div style={{ display: 'flex', background: 'var(--bg-main)', borderRadius: '8px', padding: '3px', border: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '2px' }}>
            <button
              onClick={() => { setEntityType('company'); setSelectedEntityId('comp-overall'); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: entityType === 'company' ? 'var(--bg-card)' : 'transparent',
                color: entityType === 'company' ? 'var(--accent-teal)' : 'var(--text-muted)',
                fontWeight: entityType === 'company' ? '700' : '500',
                fontSize: '0.82rem',
                cursor: 'pointer',
                boxShadow: entityType === 'company' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
              }}
            >
              <Building size={15} />
              🏢 Overall Company
            </button>
            <button
              onClick={() => { setEntityType('franchisee'); setSelectedEntityId(''); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: entityType === 'franchisee' ? 'var(--bg-card)' : 'transparent',
                color: entityType === 'franchisee' ? 'var(--accent-teal)' : 'var(--text-muted)',
                fontWeight: entityType === 'franchisee' ? '700' : '500',
                fontSize: '0.82rem',
                cursor: 'pointer',
                boxShadow: entityType === 'franchisee' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
              }}
            >
              <Building2 size={15} />
              Franchisees
            </button>
            <button
              onClick={() => { setEntityType('bd_agent'); setSelectedEntityId(''); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: entityType === 'bd_agent' ? 'var(--bg-card)' : 'transparent',
                color: entityType === 'bd_agent' ? 'var(--accent-teal)' : 'var(--text-muted)',
                fontWeight: entityType === 'bd_agent' ? '700' : '500',
                fontSize: '0.82rem',
                cursor: 'pointer',
                boxShadow: entityType === 'bd_agent' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
              }}
            >
              <Briefcase size={15} />
              BD Specialists
            </button>
            <button
              onClick={() => { setEntityType('team_leader'); setSelectedEntityId(''); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: entityType === 'team_leader' ? 'var(--bg-card)' : 'transparent',
                color: entityType === 'team_leader' ? 'var(--accent-teal)' : 'var(--text-muted)',
                fontWeight: entityType === 'team_leader' ? '700' : '500',
                fontSize: '0.82rem',
                cursor: 'pointer',
                boxShadow: entityType === 'team_leader' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
              }}
            >
              <Award size={15} />
              Team Leaders
            </button>
            <button
              onClick={() => { setEntityType('employee'); setSelectedEntityId(''); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: entityType === 'employee' ? 'var(--bg-card)' : 'transparent',
                color: entityType === 'employee' ? 'var(--accent-teal)' : 'var(--text-muted)',
                fontWeight: entityType === 'employee' ? '700' : '500',
                fontSize: '0.82rem',
                cursor: 'pointer',
                boxShadow: entityType === 'employee' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
              }}
            >
              <Users size={15} />
              Employees / Internal Team
            </button>
          </div>
        </div>

        {/* Entity Selector Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Selected Profile:</span>
          <select
            value={selectedEntityId}
            onChange={(e) => setSelectedEntityId(e.target.value)}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-main)',
              color: 'var(--text-main)',
              fontSize: '0.88rem',
              fontWeight: '600',
              cursor: 'pointer',
              minWidth: '240px'
            }}
          >
            {entityOptions.map(ent => (
              <option key={ent.id} value={ent.id}>
                {ent.name} {ent.role ? `(${ent.role})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Overview Grid */}
      <section className="kpi-grid" style={{ marginBottom: '24px', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
        {/* 1. Baseline Revenue */}
        <div className="kpi-card card-blue">
          <div className="kpi-header">
            <span className="kpi-title">Current Baseline Revenue</span>
            <span className="kpi-icon"><DollarSign size={18} /></span>
          </div>
          <h2 className="kpi-value">
            {formatLakhs(effectiveBaseRevenue)}
          </h2>
          <div className="kpi-change up">
            <span>
              {predictionData?.is_new_hire
                ? `Benchmark Baseline (${selectedEntity?.name})`
                : `Audited Baseline Inflow (${selectedEntity?.name})`}
            </span>
          </div>
        </div>

        {/* 2. Actual Closed Deals (Present) */}
        <div className="kpi-card card-green" style={{ borderLeft: '4px solid #0F6E56' }}>
          <div className="kpi-header">
            <span className="kpi-title" style={{ color: '#0F6E56', fontWeight: '700' }}>Actual Deals Closed (Present)</span>
            <span className="kpi-icon" style={{ background: 'rgba(15, 110, 86, 0.15)', color: '#0F6E56' }}><Briefcase size={18} /></span>
          </div>
          <h2 className="kpi-value" style={{ color: '#0F6E56' }}>
            {presentDealsCount} <span style={{ fontSize: '0.88rem', fontWeight: '600' }}>deals/yr</span>
          </h2>
          <div className="kpi-change up">
            <span style={{ color: '#0F6E56', fontWeight: '600' }}>
              ~{presentMonthlyDeals} deals/mo run-rate velocity
            </span>
          </div>
        </div>

        {/* 3. Average Ticket Size per Deal */}
        <div className="kpi-card card-yellow" style={{ borderLeft: '4px solid #B7791F' }}>
          <div className="kpi-header">
            <span className="kpi-title" style={{ color: '#B7791F', fontWeight: '700' }}>Avg Revenue / Deal</span>
            <span className="kpi-icon" style={{ background: 'rgba(183, 121, 31, 0.15)', color: '#B7791F' }}><Layers size={18} /></span>
          </div>
          <h2 className="kpi-value" style={{ color: '#B7791F' }}>
            {formatCurrency(avgDealValue)}
          </h2>
          <div className="kpi-change" style={{ color: 'var(--text-muted)' }}>
            <span>
              Average ticket size per closure
            </span>
          </div>
        </div>

        {/* 4. Historical CAGR */}
        <div className="kpi-card card-purple">
          <div className="kpi-header">
            <span className="kpi-title">Historical CAGR</span>
            <span className="kpi-icon"><TrendingUp size={18} /></span>
          </div>
          <h2 className="kpi-value">
            {predictionData?.historical_cagr_pct !== null && predictionData?.historical_cagr_pct !== undefined
              ? `${historicalCagrPct >= 0 ? '+' : ''}${historicalCagrPct}%`
              : 'N/A (New Hire)'}
          </h2>
          <div className="kpi-change up">
            <span>
              {predictionData?.is_new_hire
                ? 'Target-driven roadmap'
                : 'Annualized compounding rate'}
            </span>
          </div>
        </div>

        {/* 5. Active Milestone Target */}
        <div className="kpi-card card-red" style={{ borderColor: activeTarget ? 'rgba(15, 110, 86, 0.3)' : 'var(--border-color)' }}>
          <div className="kpi-header">
            <span className="kpi-title">Active Milestone Target</span>
            <span className="kpi-icon"><Award size={18} /></span>
          </div>
          <h2 className="kpi-value" style={{ color: activeTarget ? '#0F6E56' : 'var(--text-muted)', fontSize: '1.35rem' }}>
            {activeTarget ? `+${activeTarget.growth_pct_target_pct}% Target` : 'No Active Goal'}
          </h2>
          <div className="kpi-change" style={{ color: 'var(--text-muted)' }}>
            <span>{activeTarget ? `Horizon: ${activeTarget.period_end}` : 'Ready for target setting'}</span>
          </div>
        </div>
      </section>

      {/* Performance Intelligence Scorecard (Who is Working Well) */}
      {productivity && (
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
                Present Actuals: {selectedEntity?.name} {selectedEntity?.role ? `(${selectedEntity.role})` : ''}
              </span>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Audited baseline metrics used as ground truth for forward target setting
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
                5-Year Forward Horizon ($t=1..5$)
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
                ? `Aspirational growth roadmap ($t=1..5$) calculated from your specified growth velocity (+${targetRatePct}%) or deal placement targets.`
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
                    { label: `2x Scale (${Math.round(presentDealsCount * 2.0)} deals)`, count: Math.round(presentDealsCount * 2.0) }
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
            {predictionError && (
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

            {/* Fix #3: Strategic Scale Simulator Bridge Callout */}
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
                  💡 Strategic Scale Bridge: {isHistoricalDeclining ? 'Reversing Historical Decline with Multi-X Velocity' : 'Accelerating Current Momentum with Multi-X Velocity'}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.45' }}>
                  {isHistoricalDeclining ? (
                    <>
                      While passive inertia projects a <strong>{Math.abs(Math.round(((inertiaProjections[4]?.projected_revenue / (effectiveBaseRevenue || 1)) - 1) * 100))}% 5-year contraction</strong> without intervention, reaching just <strong>2x scale ({formatCurrency(effectiveBaseRevenue * 2)})</strong> completely neutralizes this decline and generates <strong>{formatCurrency(effectiveBaseRevenue * 2 * 0.4375)}</strong> in net retained contribution. Select a velocity scenario below to model the turnaround:
                    </>
                  ) : (
                    <>
                      Building upon current positive momentum, scaling production velocity from <strong>2x to 5x</strong> elevates annual gross billing up to <strong>{formatCurrency(effectiveBaseRevenue * 5)}</strong> with <strong>{formatCurrency(effectiveBaseRevenue * 5 * 0.4375)}</strong> in net retained margin.
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Flat Scale Multiplier Scenarios (1x through 5x) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <h5 style={{ margin: 0, fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-main)' }}>
                  Scale Multiplier Scenarios (1x → 5x Production Velocity)
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
                      {mult}x Scale
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
                  series1Label="Gross Revenue"
                  series2Label="Net Retention"
                  series1Color="#10b981"
                  series2Color="#0F6E56"
                  height={120}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
                {[1, 2, 3, 4, 5].map(mult => {
                  const key = `scale${mult}x`;
                  const scaledDeals = presentDealsCount * mult;
                  const sc = predictionData?.scenarios?.[key] || {
                    multiplier: mult,
                    label: `${mult}x ${mult === 1 ? 'Current Base' : 'Scale'}`,
                    revenue: effectiveBaseRevenue * mult,
                    estimated_net: effectiveBaseRevenue * mult * 0.4375,
                    deals_target: scaledDeals
                  };
                  const isSelected = activeScenarioMultiplier === sc.multiplier;

                  return (
                    <div
                      key={key}
                      onClick={() => setActiveScenarioMultiplier(sc.multiplier)}
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
                          {sc.label}
                        </span>
                        <span style={{ fontSize: '0.68rem', fontWeight: '700', color: '#2563EB', background: 'rgba(37, 99, 235, 0.08)', padding: '1px 5px', borderRadius: '3px' }}>
                          {scaledDeals} deals
                        </span>
                      </div>
                      <div style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '2px' }}>
                        {formatCurrency(sc.revenue)}
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>
                        Net Retention: {formatCurrency(sc.estimated_net)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
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
    </div>
  );
};

export default GrowthTracking;
