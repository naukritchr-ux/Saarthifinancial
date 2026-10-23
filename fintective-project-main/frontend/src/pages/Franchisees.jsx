import React, { useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { FinanceContext, API_BASE_URL } from '../context/FinanceContext';
import { fetchWithApiKey } from '../utils/apiClient';
import { formatCurrency, formatLakhs, formatDate } from '../utils/formatters';
import { 
  Users, 
  Search, 
  Plus, 
  X, 
  ChevronRight, 
  AlertTriangle, 
  ExternalLink, 
  Calendar, 
  Building2, 
  Briefcase,
  TrendingUp,
  TrendingDown,
  Info
} from 'lucide-react';
import Pagination from '../components/Pagination';
import './Franchisees.css';

// --------------------------------------------------------------------------
// 1. Mini 12-Month Sparkline & MoM Trend Component
// --------------------------------------------------------------------------
function MiniTrendCell({ monthlySeries = [] }) {
  if (!monthlySeries || monthlySeries.length === 0) {
    return <span className="fran-zero-text">—</span>;
  }

  const values = monthlySeries.map(m => m.revenue || 0);
  const maxVal = Math.max(...values, 1);
  const hasAnyRevenue = values.some(v => v > 0);

  // Trailing two months for MoM trend
  const curr = values[values.length - 1] || 0;
  const prev = values[values.length - 2] || 0;

  let trendText = '—';
  let isPositive = true;
  let hasTrend = false;

  if (curr > 0 && prev > 0) {
    const diff = ((curr - prev) / prev) * 100;
    isPositive = diff >= 0;
    trendText = `${isPositive ? '↑' : '↓'} ${Math.abs(Math.round(diff))}%`;
    hasTrend = true;
  }

  if (!hasAnyRevenue) {
    return <span className="fran-zero-text">—</span>;
  }

  return (
    <div className="mini-trend-container">
      <svg width="68" height="22" className="mini-trend-svg" aria-label="12-month revenue trend">
        {values.map((v, idx) => {
          const barHeight = Math.max(2, Math.round((v / maxVal) * 18));
          const x = idx * 6;
          const y = 20 - barHeight;
          const isLatest = idx === values.length - 1;
          const fillColor = isLatest ? '#0f766e' : (v > 0 ? '#94a3b8' : '#e2e8f0');

          return (
            <rect
              key={idx}
              x={x}
              y={y}
              width="4"
              height={barHeight}
              rx="1"
              fill={fillColor}
            >
              <title>{monthlySeries[idx]?.label}: {formatCurrency(v)}</title>
            </rect>
          );
        })}
      </svg>
      <span className={`trend-arrow-text ${hasTrend ? (isPositive ? 'positive' : 'negative') : 'fran-zero-text'}`}>
        {trendText}
      </span>
    </div>
  );
}

// --------------------------------------------------------------------------
// 2. Right-Side Slide-in Drawer Component
// --------------------------------------------------------------------------
function FranchiseeDrawer({ franchisee, isOpen, onClose, setActivePage }) {
  const [placements, setPlacements] = useState([]);
  const [loadingPlacements, setLoadingPlacements] = useState(false);

  useEffect(() => {
    if (!isOpen || !franchisee) {
      setPlacements([]);
      return;
    }

    setLoadingPlacements(true);
    fetchWithApiKey(`${API_BASE_URL}/franchisees/${encodeURIComponent(franchisee.id)}/placements`)
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Failed to load placements');
      })
      .then(data => {
        if (data && data.placements) {
          setPlacements(data.placements);
        }
      })
      .catch(err => {
        console.error('Drawer placements load failed:', err);
      })
      .finally(() => {
        setLoadingPlacements(false);
      });
  }, [isOpen, franchisee]);

  if (!isOpen || !franchisee) return null;

  const navigateToTL = () => {
    if (franchisee.teamLeader) {
      sessionStorage.setItem('fintective_selected_tl', franchisee.teamLeader);
    }
    onClose();
    if (setActivePage) {
      setActivePage('tl-performance');
    }
  };

  const navigateToCostOfPerformance = () => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', `?tab=franchise&search=${encodeURIComponent(franchisee.name)}`);
    }
    onClose();
    if (setActivePage) {
      setActivePage('cost-performance');
    }
  };

  // Tenure calculation
  let tenureText = 'Unknown tenure';
  if (franchisee.onboardingDate) {
    try {
      const onb = new Date(franchisee.onboardingDate);
      const now = new Date();
      const diffYears = (now - onb) / (1000 * 60 * 60 * 24 * 365.25);
      if (diffYears >= 3) {
        tenureText = `${diffYears.toFixed(1)} yrs (3+ Years Veteran)`;
      } else if (diffYears >= 1) {
        tenureText = `${diffYears.toFixed(1)} yrs (< 3 Years Standard)`;
      } else {
        tenureText = `< 1 yr (New Hub)`;
      }
    } catch (e) {
      tenureText = 'On record';
    }
  }

  const values = (franchisee.monthlySeries || []).map(m => m.revenue || 0);
  const maxVal = Math.max(...values, 1);

  return (
    <div className="fran-drawer-backdrop" onClick={onClose}>
      <div className="fran-drawer-panel" onClick={e => e.stopPropagation()}>
        
        {/* Drawer Header */}
        <div className="fran-drawer-header">
          <div className="fran-drawer-header-info">
            <h2>{franchisee.name}</h2>
            <p>TL: {franchisee.teamLeader || 'Unassigned'} • Status: {franchisee.status}</p>
          </div>
          <button className="fran-drawer-close" onClick={onClose} aria-label="Close drawer">
            <X size={20} />
          </button>
        </div>

        {/* Drawer Content Body */}
        <div className="fran-drawer-body">

          {/* Quick Action Links */}
          <div className="fran-drawer-links">
            <button type="button" className="fran-action-link-btn" onClick={navigateToTL}>
              <span>Collections</span>
              <ChevronRight size={15} />
            </button>
            <button type="button" className="fran-action-link-btn" onClick={navigateToCostOfPerformance}>
              <span>Profitability</span>
              <ExternalLink size={14} />
            </button>
          </div>

          {/* Tenure & Split Matrix */}
          <div>
            <h3 className="fran-drawer-section-title">Commercial Agreement & Tenure Split</h3>
            <div className="fran-tenure-box">
              <div>
                <div className="fran-tenure-item-label">Onboarding Date</div>
                <div className="fran-tenure-item-val">
                  {franchisee.onboardingDate ? formatDate(franchisee.onboardingDate) : 'Not on record'}
                </div>
              </div>

              <div>
                <div className="fran-tenure-item-label">Calculated Tenure</div>
                <div className="fran-tenure-item-val">{tenureText}</div>
              </div>

              <div>
                <div className="fran-tenure-item-label">Tenure Split %</div>
                <div className="fran-tenure-item-val">
                  {franchisee.splitPct}% Hub / {(100 - franchisee.splitPct).toFixed(0)}% Saarthi
                  {franchisee.isSplitEstimated && (
                    <span className="estimated-badge" title="No onboarding date on record; default 75/25 applied">
                      Estimated
                    </span>
                  )}
                </div>
              </div>

              <div>
                <div className="fran-tenure-item-label">Last Placement</div>
                <div className="fran-tenure-item-val">
                  {franchisee.lastPlacementDate ? formatDate(franchisee.lastPlacementDate) : 'No clean placements'}
                </div>
              </div>
            </div>
            {franchisee.isSplitEstimated && (
              <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#b45309', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Info size={14} />
                <span>Onboarding agreement date missing in CRM. 75/25 standard tenure rate applied.</span>
              </div>
            )}
          </div>

          {/* 12-Month Trajectory */}
          <div>
            <h3 className="fran-drawer-section-title">12-Month Revenue Trajectory</h3>
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '90px' }}>
                {(franchisee.monthlySeries || []).map((m, idx) => {
                  const barH = Math.max(3, Math.round(((m.revenue || 0) / maxVal) * 75));
                  const isCurrent = idx === franchisee.monthlySeries.length - 1;
                  return (
                    <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                      <div
                        style={{
                          width: '100%',
                          height: `${barH}px`,
                          backgroundColor: isCurrent ? '#0f766e' : (m.revenue > 0 ? '#38bdf8' : '#e2e8f0'),
                          borderRadius: '3px 3px 0 0',
                          transition: 'height 0.2s ease'
                        }}
                        title={`${m.label}: ${formatCurrency(m.revenue)}`}
                      />
                      <span style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '4px', whiteSpace: 'nowrap' }}>
                        {m.label.split(' ')[0]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Recent Placements List */}
          <div>
            <h3 className="fran-drawer-section-title">
              Recent Placement Records {placements.length > 0 ? `(${placements.length})` : ''}
            </h3>
            {loadingPlacements ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                Loading placements...
              </div>
            ) : placements.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.82rem' }}>
                No clean placement records found for this franchisee.
              </div>
            ) : (
              <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <table className="drawer-placements-table">
                  <thead>
                    <tr>
                      <th>Candidate / Role</th>
                      <th>Company</th>
                      <th>Date</th>
                      <th style={{ textAlign: 'right' }}>Revenue</th>
                      <th style={{ textAlign: 'right' }}>Saarthi Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {placements.map(p => (
                      <tr key={p.id}>
                        <td>
                          <div style={{ fontWeight: '600', color: '#0f172a' }}>{p.candidateName}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{p.postOfCandidate}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: '500' }}>{p.companyName}</div>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{p.billNumber}</div>
                        </td>
                        <td style={{ whiteSpace: 'nowrap', color: '#64748b' }}>
                          {formatDate(p.billDate)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: '600', color: '#0f766e' }}>
                          {formatCurrency(p.revenueExGst)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: '600', color: '#334155' }}>
                          {formatCurrency(p.companyShare)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// 2.5. Dormant Franchisees Reactivation Ranking Component
// --------------------------------------------------------------------------
export function DormantReactivationSection({ 
  candidates = [], 
  summary = null, 
  loading = false, 
  monthlyCostGap = 0, 
  onSelectFranchisee 
}) {
  // Exclude never-activated hubs
  const eligibleCandidates = useMemo(() => {
    return (candidates || []).filter(c => (c.placements_l12m > 0 || c.total_lifetime_placements > 0));
  }, [candidates]);

  // Total potential monthly recovery (upper bound)
  const totalRecovery = summary?.total_potential_monthly_recovery ?? eligibleCandidates.reduce((sum, c) => sum + (c.expected_monthly_value || 0), 0);

  return (
    <div className="fran-reactivation-card" data-testid="dormant-reactivation-section">
      <div className="fran-reactivation-header">
        <div className="fran-reactivation-title-wrap">
          <h2 className="fran-reactivation-title">Dormant franchisees to reactivate</h2>
          <span 
            className="fran-ranking-badge" 
            title="Assumes the hub returns to its recent pace; upper bound, not a forecast."
            data-testid="ranking-badge"
          >
            <Info size={13} />
            <span>Rule-based ranking</span>
          </span>
        </div>
        <div className="fran-reactivation-meta">
          <span className="fran-recovery-total" data-testid="recovery-total">
            up to {formatCurrency(totalRecovery)}/month
          </span>
          {monthlyCostGap > 0 && (
            <span className="fran-cost-gap-note" data-testid="cost-gap-note">
              (monthly cost gap: {formatCurrency(monthlyCostGap)})
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="fran-reactivation-empty">Loading reactivation rankings...</div>
      ) : eligibleCandidates.length === 0 ? (
        <div className="fran-reactivation-empty" data-testid="reactivation-empty">
          No dormant franchise hubs currently eligible for reactivation.
        </div>
      ) : (
        <div className="fran-table-responsive">
          <table className="fran-reactivation-table" data-testid="reactivation-table">
            <thead>
              <tr>
                <th className="fran-rank-col">#</th>
                <th>Franchisee</th>
                <th>Last Placement</th>
                <th style={{ textAlign: 'right' }}>Placements (12M)</th>
                <th style={{ textAlign: 'right' }}>Avg Co. Share / Deal</th>
                <th style={{ textAlign: 'right' }}>Expected Monthly Value</th>
              </tr>
            </thead>
            <tbody>
              {eligibleCandidates.map((c, idx) => (
                <tr 
                  key={c.franchisee_id || idx}
                  onClick={() => onSelectFranchisee && onSelectFranchisee(c)}
                  data-testid="reactivation-row"
                >
                  <td className="fran-rank-col">{idx + 1}</td>
                  <td>
                    <div className="fran-name-cell">
                      <span className="fran-name-text">{c.franchisee_name}</span>
                    </div>
                    {c.explanation && (
                      <span className="fran-explanation-sub">{c.explanation}</span>
                    )}
                  </td>
                  <td className="fran-days-col">
                    {c.days_since_last_placement}d ago
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: '600' }}>
                    {c.placements_l12m}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {formatCurrency(c.avg_company_share)}
                  </td>
                  <td className="fran-expected-col">
                    {formatCurrency(c.expected_monthly_value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// 3. MAIN COMPONENT: Franchisees
// --------------------------------------------------------------------------
export default function Franchisees({ setActivePage }) {
  const { 
    selectedMonth, 
    setSelectedMonth, 
    selectedYear, 
    setSelectedYear,
    availableMonths = [],
    availableYears = [],
    addFranchisee,
    financeSummary
  } = useContext(FinanceContext);

  const [summaryData, setSummaryData] = useState({
    success: true,
    total_revenue_ex_gst: 0.0,
    total_company_share: 0.0,
    total_placements: 0,
    active_franchisees_count: 0,
    total_franchisees_count: 0,
    ledger: [],
    unmatched_names: []
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterChip, setFilterChip] = useState('all'); // 'all' | 'active' | 'inactive_90d' | 'new_1y'
  const [selectedTL, setSelectedTL] = useState('all');
  const [selectedSegment, setSelectedSegment] = useState('all');
  const [dismissAttention, setDismissAttention] = useState(false);

  // Drawer state
  const [selectedFranchisee, setSelectedFranchisee] = useState(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 12;

  // Add Franchisee modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFranName, setNewFranName] = useState('');
  const [newFranOwner, setNewFranOwner] = useState('');
  const [newFranDate, setNewFranDate] = useState(new Date().toISOString().split('T')[0]);

  // ML segments cache
  const [mlMap, setMlMap] = useState({});

  // Reactivation ranking state
  const [reactivationData, setReactivationData] = useState({ candidates: [], summary: null });
  const [loadingReactivation, setLoadingReactivation] = useState(false);

  // Fetch Rule-Based Franchisee Reactivation Ranking
  useEffect(() => {
    let isMounted = true;
    setLoadingReactivation(true);
    fetchWithApiKey(`${API_BASE_URL}/ml/franchisee-reactivation`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (isMounted && data && data.success) {
          setReactivationData({
            candidates: data.candidates || [],
            summary: data.summary || null
          });
        }
      })
      .catch(err => {
        console.warn('[Reactivation] Failed to load ranking:', err.message);
      })
      .finally(() => {
        if (isMounted) setLoadingReactivation(false);
      });
    return () => { isMounted = false; };
  }, []);

  const monthlyCostGap = useMemo(() => {
    if (!financeSummary) return 0;
    const exp = (financeSummary.operating_expenses || 0) + (financeSummary.salaries || 0);
    const ourShare = financeSummary.our_share || 0;
    return Math.max(0, (exp - ourShare) / 5);
  }, [financeSummary]);

  // 1. Fetch ML Insights for segment badges
  useEffect(() => {
    const cached = sessionStorage.getItem('fintective_ml_insights');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed?.franchise_clusters) {
          const map = {};
          parsed.franchise_clusters.forEach(c => {
            if (c.franchise) map[c.franchise.toLowerCase().trim()] = c.segment;
          });
          setMlMap(map);
          return;
        }
      } catch (e) {}
    }

    fetchWithApiKey(`${API_BASE_URL}/ml/insights`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.franchise_clusters) {
          const map = {};
          data.franchise_clusters.forEach(c => {
            if (c.franchise) map[c.franchise.toLowerCase().trim()] = c.segment;
          });
          setMlMap(map);
          try {
            sessionStorage.setItem('fintective_ml_insights', JSON.stringify(data));
          } catch (e) {}
        }
      })
      .catch(err => console.log('ML cluster fetch bypassed:', err));
  }, []);

  // 2. Compute date boundaries
  const getPeriodDates = useCallback((month, year) => {
    let start = '2018-01-01';
    let end = '2026-12-31';

    if (month && month !== 'All Months') {
      const parts = month.split(' ');
      const mName = parts[0];
      const yVal = parseInt(parts[1], 10);
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      const mIdx = monthNames.indexOf(mName);
      if (mIdx !== -1 && !isNaN(yVal)) {
        const startM = String(mIdx + 1).padStart(2, '0');
        start = `${yVal}-${startM}-01`;
        const lastDay = new Date(yVal, mIdx + 1, 0).getDate();
        end = `${yVal}-${startM}-${String(lastDay).padStart(2, '0')}`;
      }
    } else if (year && year !== 'All Years') {
      const parts = year.split('-');
      const yStart = parseInt(parts[0], 10);
      const yEnd = parseInt(parts[1], 10);
      if (!isNaN(yStart) && !isNaN(yEnd)) {
        const fullEndYear = yEnd < 100 ? 2000 + yEnd : yEnd;
        start = `${yStart}-04-01`;
        end = `${fullEndYear}-03-31`;
      }
    }
    return { start, end };
  }, []);

  // 3. Fetch Franchisee Summary
  const loadSummary = useCallback(() => {
    setLoading(true);
    setError(null);
    const { start, end } = getPeriodDates(selectedMonth, selectedYear);

    fetchWithApiKey(`${API_BASE_URL}/finance/franchisee-summary?start_date=${start}&end_date=${end}`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`Server returned HTTP ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        if (data && data.success) {
          setSummaryData(data);
        } else {
          throw new Error(data?.error || 'Failed to fetch franchisee summary');
        }
      })
      .catch(err => {
        console.error('Franchisee summary load error:', err);
        setError(err.message || 'Unable to load franchisee performance data');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedMonth, selectedYear, getPeriodDates]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, filterChip, selectedTL, selectedSegment]);

  // Extract unique Team Leaders and ML Segments for dropdowns
  const availableTLs = useMemo(() => {
    const set = new Set();
    (summaryData.ledger || []).forEach(f => {
      if (f.teamLeader && f.teamLeader !== 'Franchise Lead' && f.teamLeader !== 'N/A') {
        set.add(f.teamLeader);
      }
    });
    return Array.from(set).sort();
  }, [summaryData.ledger]);

  const availableSegments = useMemo(() => {
    const set = new Set();
    Object.values(mlMap).forEach(seg => {
      if (seg) set.add(seg);
    });
    return Array.from(set).sort();
  }, [mlMap]);

  // Inactive 90+ days hubs count for attention strip
  const hubsNoPlacement90d = useMemo(() => {
    return (summaryData.ledger || []).filter(f => f.daysSinceLastPlacement !== null && f.daysSinceLastPlacement > 90);
  }, [summaryData.ledger]);

  // Filtered Franchisees for table
  const filteredFranchisees = useMemo(() => {
    let list = summaryData.ledger || [];

    // Chip filter
    if (filterChip === 'active') {
      list = list.filter(f => f.isActive);
    } else if (filterChip === 'inactive_90d') {
      list = list.filter(f => f.daysSinceLastPlacement !== null && f.daysSinceLastPlacement > 90);
    } else if (filterChip === 'new_1y') {
      list = list.filter(f => f.isNew);
    }

    // Team Leader filter
    if (selectedTL !== 'all') {
      list = list.filter(f => f.teamLeader === selectedTL);
    }

    // Segment filter
    if (selectedSegment !== 'all') {
      list = list.filter(f => {
        const seg = mlMap[f.name.toLowerCase().trim()];
        return seg === selectedSegment;
      });
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(f => 
        f.name.toLowerCase().includes(q) ||
        (f.teamLeader && f.teamLeader.toLowerCase().includes(q))
      );
    }

    return list;
  }, [summaryData.ledger, filterChip, selectedTL, selectedSegment, searchQuery, mlMap]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredFranchisees.length / ITEMS_PER_PAGE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const paginatedFrans = filteredFranchisees.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  // Add Franchisee Handler
  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!newFranName.trim()) {
      alert('Franchisee name is required.');
      return;
    }

    fetchWithApiKey(`${API_BASE_URL}/franchisees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newFranName.trim(),
        owner: newFranOwner.trim() || 'Franchise Lead',
        onboardingDate: newFranDate
      })
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to register franchisee');
        return res.json();
      })
      .then(() => {
        setShowAddModal(false);
        setNewFranName('');
        setNewFranOwner('');
        loadSummary();
      })
      .catch(err => {
        alert(err.message || 'Error registering franchisee');
      });
  };

  return (
    <div className="franchisees-page">
      
      {/* 1. Header Bar: Title, FY, Month, Search, Add Button */}
      <div className="fran-header-bar">
        <div className="fran-title-group">
          <h1>
            <Building2 size={24} color="#0f766e" />
            Franchise Hubs
          </h1>
          <p className="fran-subtitle">
            Directory of registered franchise hubs, tenure splits, placements, and commercial revenue share
          </p>
        </div>

        <div className="fran-header-controls">
          {/* FY Dropdown */}
          <select
            className="fran-select"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            aria-label="Financial Year"
          >
            <option value="All Years">All Financial Years</option>
            {availableYears.map(yr => (
              <option key={yr} value={yr}>FY {yr}</option>
            ))}
          </select>

          {/* Month Dropdown */}
          <select
            className="fran-select"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            aria-label="Month"
          >
            <option value="All Months">All Months</option>
            {availableMonths.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          {/* Search Box */}
          <div className="fran-search-wrapper">
            <Search size={15} className="fran-search-icon" />
            <input
              type="text"
              className="fran-search-input"
              placeholder="Search hub or TL..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Add Franchisee Button */}
          <button 
            type="button" 
            className="btn-add-fran"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={16} />
            <span>Add Franchisee</span>
          </button>
        </div>
      </div>

      {/* 2. Three KPI Cards (No Sparklines) */}
      <div className="fran-kpi-grid">
        {/* Card 1: Active Franchisees */}
        <div className="fran-kpi-card">
          <div className="fran-kpi-label">
            <span>Active Franchisees</span>
            <Users size={16} color="#0f766e" />
          </div>
          <div className="fran-kpi-val">
            {summaryData.active_franchisees_count}{' '}
            <span style={{ fontSize: '1rem', fontWeight: '500', color: '#64748b' }}>
              of {summaryData.total_franchisees_count}
            </span>
          </div>
          <div className="fran-kpi-subtext">
            Placements active in current quarter
          </div>
        </div>

        {/* Card 2: Revenue Generated (ex-GST) */}
        <div className="fran-kpi-card">
          <div className="fran-kpi-label">
            <span>Revenue Generated (ex-GST)</span>
            <TrendingUp size={16} color="#0284c7" />
          </div>
          <div className="fran-kpi-val" style={{ color: '#0f766e' }}>
            {formatLakhs(summaryData.total_revenue_ex_gst)}
          </div>
          <div className="fran-kpi-subtext">
            Total commercial billing across hubs
          </div>
        </div>

        {/* Card 3: Company Share */}
        <div className="fran-kpi-card">
          <div className="fran-kpi-label">
            <span>Company Share</span>
            <Briefcase size={16} color="#7c3aed" />
          </div>
          <div className="fran-kpi-val" style={{ color: '#1e293b' }}>
            {formatLakhs(summaryData.total_company_share)}
          </div>
          <div className="fran-kpi-subtext">
            Saarthi retained earnings after hub split
          </div>
        </div>
      </div>

      {/* 3. Slim Dismissible Attention Strip: N hubs with no placement in 90+ days */}
      {!dismissAttention && hubsNoPlacement90d.length > 0 && (
        <div className="fran-attention-strip">
          <div className="fran-attention-content">
            <AlertTriangle size={16} />
            <span>
              <strong>{hubsNoPlacement90d.length} hubs</strong> with no placement in 90+ days.{' '}
              <button 
                type="button" 
                className="fran-attention-btn"
                onClick={() => setFilterChip('inactive_90d')}
              >
                [Show them]
              </button>
            </span>
          </div>
          <button 
            type="button" 
            className="fran-attention-close" 
            onClick={() => setDismissAttention(true)}
            aria-label="Dismiss notice"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* 4. Filter Bar: Filter Chips + TL Dropdown + Segment Dropdown */}
      <div className="fran-filter-bar">
        <div className="fran-chips-group">
          <button
            type="button"
            className={`fran-chip ${filterChip === 'all' ? 'active' : ''}`}
            onClick={() => setFilterChip('all')}
          >
            All ({summaryData.ledger?.length || 0})
          </button>
          <button
            type="button"
            className={`fran-chip ${filterChip === 'active' ? 'active' : ''}`}
            onClick={() => setFilterChip('active')}
          >
            Active ({summaryData.active_franchisees_count})
          </button>
          <button
            type="button"
            className={`fran-chip ${filterChip === 'inactive_90d' ? 'active' : ''}`}
            onClick={() => setFilterChip('inactive_90d')}
          >
            Inactive 90d+ ({hubsNoPlacement90d.length})
          </button>
          <button
            type="button"
            className={`fran-chip ${filterChip === 'new_1y' ? 'active' : ''}`}
            onClick={() => setFilterChip('new_1y')}
          >
            New &lt;1y ({(summaryData.ledger || []).filter(f => f.isNew).length})
          </button>
        </div>

        <div className="fran-dropdown-filters">
          {/* Team Leader Dropdown */}
          <select
            className="fran-select"
            value={selectedTL}
            onChange={(e) => setSelectedTL(e.target.value)}
            aria-label="Filter by Team Leader"
          >
            <option value="all">All Team Leaders</option>
            {availableTLs.map(tl => (
              <option key={tl} value={tl}>{tl}</option>
            ))}
          </select>

          {/* ML Segment Dropdown */}
          <select
            className="fran-select"
            value={selectedSegment}
            onChange={(e) => setSelectedSegment(e.target.value)}
            aria-label="Filter by Segment"
          >
            <option value="all">All Segments</option>
            {availableSegments.map(seg => (
              <option key={seg} value={seg}>{seg}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 4.5. Dormant Franchisees to Reactivate */}
      <DormantReactivationSection
        candidates={reactivationData.candidates}
        summary={reactivationData.summary}
        loading={loadingReactivation}
        monthlyCostGap={monthlyCostGap}
        onSelectFranchisee={(c) => {
          const matched = (summaryData.ledger || []).find(f => 
            f.name.toLowerCase().trim() === c.franchisee_name.toLowerCase().trim()
          );
          if (matched) {
            setSelectedFranchisee(matched);
          }
        }}
      />

      {/* 5. Main Franchisees Table */}
      <div className="fran-card-table">
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
            Loading franchise performance records...
          </div>
        ) : error ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#ef4444' }}>
            <p>{error}</p>
            <button type="button" className="btn btn-secondary" onClick={loadSummary}>
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="fran-table-responsive">
              <table className="fran-data-table">
                <thead>
                  <tr>
                    <th>Franchisee</th>
                    <th>TL</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Placements</th>
                    <th style={{ textAlign: 'right' }}>Revenue</th>
                    <th>Last Placement</th>
                    <th>12M Trend</th>
                    <th style={{ width: '40px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedFrans.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                        No franchise hubs match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    paginatedFrans.map(f => {
                      const seg = mlMap[f.name.toLowerCase().trim()];
                      return (
                        <tr 
                          key={f.id}
                          onClick={() => setSelectedFranchisee(f)}
                        >
                          {/* Franchisee Name + Segment */}
                          <td>
                            <div className="fran-name-cell">
                              <span className="fran-name-text">{f.name}</span>
                              {seg && (
                                <span className="fran-ml-tag">
                                  {seg.split(' ')[0]}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* TL */}
                          <td style={{ color: '#475569' }}>
                            {f.teamLeader || '—'}
                          </td>

                          {/* Status */}
                          <td>
                            <span className={`fran-status-pill ${f.status}`}>
                              {f.status}
                            </span>
                          </td>

                          {/* Placements */}
                          <td style={{ textAlign: 'right', fontWeight: '600' }} className={f.placements > 0 ? '' : 'fran-zero-text'}>
                            {f.placements > 0 ? f.placements : '0'}
                          </td>

                          {/* Revenue */}
                          <td style={{ textAlign: 'right', fontWeight: '700' }} className={f.revenueExGst > 0 ? '' : 'fran-zero-text'}>
                            {f.revenueExGst > 0 ? formatCurrency(f.revenueExGst) : '—'}
                          </td>

                          {/* Last Placement */}
                          <td style={{ whiteSpace: 'nowrap', color: f.lastPlacementDate ? '#334155' : '#94a3b8' }}>
                            {f.lastPlacementDate ? formatDate(f.lastPlacementDate) : '—'}
                          </td>

                          {/* 12-Month Trend Sparkline */}
                          <td>
                            <MiniTrendCell monthlySeries={f.monthlySeries} />
                          </td>

                          {/* Chevron */}
                          <td className="fran-chevron-cell">
                            <ChevronRight size={16} />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {filteredFranchisees.length > 0 && (
              <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0' }}>
                <Pagination
                  currentPage={safePage}
                  totalItems={filteredFranchisees.length}
                  pageSize={ITEMS_PER_PAGE}
                  onPageChange={setPage}
                  itemName="franchise hubs"
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* 6. Right-Side Slide-in Drawer */}
      <FranchiseeDrawer
        franchisee={selectedFranchisee}
        isOpen={Boolean(selectedFranchisee)}
        onClose={() => setSelectedFranchisee(null)}
        setActivePage={setActivePage}
      />

      {/* 7. Add Franchisee Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-container animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>Add New Franchise Hub</h3>
              <button className="close-btn" onClick={() => setShowAddModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} style={{ padding: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '6px' }}>
                  Hub Name (As Per Agreement) *
                </label>
                <input
                  type="text"
                  required
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  placeholder="e.g. Pune Hub Consultancy"
                  value={newFranName}
                  onChange={(e) => setNewFranName(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '6px' }}>
                  Assigned Team Leader / Owner
                </label>
                <input
                  type="text"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  placeholder="e.g. Surbhi Vinod Jain"
                  value={newFranOwner}
                  onChange={(e) => setNewFranOwner(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '6px' }}>
                  Agreement Onboarding Date
                </label>
                <input
                  type="date"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  value={newFranDate}
                  onChange={(e) => setNewFranDate(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: '#0f766e', borderColor: '#0f766e' }}>
                  Save Franchisee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
