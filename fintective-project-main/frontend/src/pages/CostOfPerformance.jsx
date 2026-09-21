import React, { useState, useEffect, useMemo, useContext } from 'react';
import { FinanceContext, API_BASE_URL } from '../context/FinanceContext';
import { fetchWithApiKey } from '../utils/apiClient';
import { formatCurrency, formatLakhs, formatDate } from '../utils/formatters';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  Users, 
  Building, 
  MapPin, 
  Briefcase, 
  Layers, 
  Sliders, 
  Download, 
  Printer, 
  Search, 
  ArrowUpDown, 
  ChevronRight, 
  X, 
  Info, 
  ShieldAlert, 
  Sparkles,
  HelpCircle,
  FileText
} from 'lucide-react';
import Pagination from '../components/Pagination';

const CostOfPerformance = () => {
  const { currentUser } = useContext(FinanceContext);

  // Core State
  const [activeDimension, setActiveDimension] = useState('bd'); // 'bd' | 'tl' | 'franchise' | 'city' | 'industry'
  const [selectedMonth, setSelectedMonth] = useState('2026-08');
  const [availableMonths, setAvailableMonths] = useState(['2026-08', '2026-07', '2026-06', '2026-05', '2026-04', '2026-03']);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Sorting
  const [sortField, setSortField] = useState('net_contribution');
  const [sortAsc, setSortAsc] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Drilldown Modal
  const [drilldownItem, setDrilldownItem] = useState(null);
  const [drilldownData, setDrilldownData] = useState([]);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [bdLossData, setBdLossData] = useState(null);
  const [activeDrillTab, setActiveDrillTab] = useState('invoices'); // 'invoices' | 'loss_forensics'

  // Cost Input Modal
  const [isInputModalOpen, setIsInputModalOpen] = useState(false);
  const [costInputs, setCostInputs] = useState({
    overhead: { admin_team_salary: 45000, marketing_team_salary: 35000, rent: 30000, other_admin_expense: 10000 },
    bd_costs: [],
    tl_costs: [],
    tl_roster: [],
    allocation_basis: 'revenue_share'
  });
  const [savingInputs, setSavingInputs] = useState(false);

  // User role security
  const userRole = (currentUser?.role || 'head_office').toLowerCase();

  // 1. Fetch Available Months
  useEffect(() => {
    fetchWithApiKey(`${API_BASE_URL}/cost-performance/available-months`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.months && data.months.length > 0) {
          setAvailableMonths(data.months);
          if (!data.months.includes(selectedMonth)) {
            setSelectedMonth(data.months[0]);
          }
        }
      })
      .catch(err => console.warn('Could not load available months:', err));
  }, []);

  // 2. Fetch Live Report Data
  const fetchReport = () => {
    setLoading(true);
    setError(null);
    const url = `${API_BASE_URL}/cost-performance/report?dimension=${activeDimension}&month=${selectedMonth}&role=${encodeURIComponent(userRole)}`;

    fetchWithApiKey(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (data.success) {
          setReportData(data);
          // Set default sort for dimension
          if (activeDimension === 'tl') {
            setSortField('net_contribution_per_franchise');
            setSortAsc(false);
          } else {
            setSortField('net_contribution');
            setSortAsc(false);
          }
          setCurrentPage(1);
        } else {
          setError(data.error || 'Failed to load report data');
        }
      })
      .catch(err => {
        console.error('Error fetching cost report:', err);
        setError(err.message || 'Network error');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchReport();
  }, [activeDimension, selectedMonth, userRole]);

  // 3. Load Cost Inputs for Editing
  const loadCostInputs = () => {
    fetchWithApiKey(`${API_BASE_URL}/cost-performance/inputs?month=${selectedMonth}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setCostInputs({
            overhead: data.overhead || { admin_team_salary: 45000, marketing_team_salary: 35000, rent: 30000, other_admin_expense: 10000 },
            bd_costs: data.bd_costs || [],
            tl_costs: data.tl_costs || [],
            tl_roster: data.tl_roster || [],
            allocation_basis: data.allocation_basis || 'revenue_share'
          });
          setIsInputModalOpen(true);
        }
      })
      .catch(err => console.error('Error loading cost inputs:', err));
  };

  // 4. Save Cost Inputs
  const handleSaveCostInputs = (e) => {
    e.preventDefault();
    setSavingInputs(true);
    fetchWithApiKey(`${API_BASE_URL}/cost-performance/inputs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        month: selectedMonth,
        ...costInputs
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setIsInputModalOpen(false);
          fetchReport();
        } else {
          alert(`Error saving inputs: ${data.error}`);
        }
      })
      .catch(err => alert(`Network error: ${err.message}`))
      .finally(() => setSavingInputs(false));
  };

  // 5. Open Drilldown Modal
  const handleOpenDrilldown = (item) => {
    setDrilldownItem(item);
    setDrilldownLoading(true);
    setActiveDrillTab('invoices');
    setBdLossData(null);

    // Fetch underlying invoices
    fetchWithApiKey(`${API_BASE_URL}/cost-performance/drilldown?dimension=${activeDimension}&value=${encodeURIComponent(item.dimension_value)}&month=${selectedMonth}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setDrilldownData(data.drilldown_items || []);
        }
      })
      .catch(err => console.error('Drilldown error:', err))
      .finally(() => setDrilldownLoading(false));

    // If BD dimension, also fetch loss forensics
    if (activeDimension === 'bd') {
      fetchWithApiKey(`${API_BASE_URL}/cost-performance/bd-loss-forensics?bd_name=${encodeURIComponent(item.dimension_value)}&month=${selectedMonth}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setBdLossData(data);
          }
        })
        .catch(err => console.error('Loss forensics error:', err));
    }
  };

  // Filter & Sort Rows
  const filteredRows = useMemo(() => {
    if (!reportData || !reportData.rows) return [];
    let list = [...reportData.rows];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(r => (r.dimension_value || '').toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

    return list;
  }, [reportData, searchTerm, sortField, sortAsc]);

  // Aggregates for Top Summary
  const totals = useMemo(() => {
    if (!reportData || !reportData.rows) return { billed: 0, companyShare: 0, executionCost: 0, churnCost: 0, netContribution: 0, totalEnquiries: 0 };
    return reportData.rows.reduce((acc, r) => {
      acc.billed += (r.total_billed || 0);
      acc.companyShare += (r.company_share || 0);
      acc.executionCost += (r.total_cost || 0);
      acc.churnCost += (r.churn_cost || 0);
      acc.netContribution += (r.net_contribution || 0);
      acc.totalEnquiries += (r.enquiries_handled || 0);
      return acc;
    }, { billed: 0, companyShare: 0, executionCost: 0, churnCost: 0, netContribution: 0, totalEnquiries: 0 });
  }, [reportData]);

  const avgSurplusPerEnquiry = totals.totalEnquiries > 0 ? (totals.netContribution / totals.totalEnquiries) : 0;
  const companyRoiMultiple = totals.executionCost > 0 ? (totals.companyShare / totals.executionCost) : 0;

  // Sorting Toggle Handler
  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // CSV Export Handler
  const handleExportCSV = () => {
    if (!filteredRows || filteredRows.length === 0) return;

    let headers = [];
    if (activeDimension === 'bd') {
      headers = ['BD Specialist', 'Placements', 'Enquiries Handled', 'New Clients', 'Company Share (INR)', 'CAC (INR)', 'Cost of Execution (INR)', 'Rev/Enquiry', 'Exp/Enquiry', 'Net Surplus/Enquiry', 'Churn Cost (INR)', 'Net Contribution (INR)', 'ROI Multiple', 'Tier'];
    } else if (activeDimension === 'tl') {
      headers = ['Team Leader', 'Placements', 'Enquiries Handled', 'Company Share (INR)', 'Active Franchises', 'Rev/Franchise (INR)', 'Cost/Franchise (INR)', 'Net Contribution/Franchise (INR)', 'Net Surplus/Enquiry', 'Tier'];
    } else if (activeDimension === 'franchise') {
      headers = ['Franchise Partner', 'Placements', 'Total Billed (INR)', 'Company Share (INR)', 'Franchisee Payout (INR)', 'Credit Note Reversals (INR)', 'Churn Cost (INR)'];
    } else {
      headers = [activeDimension === 'city' ? 'Client City' : 'Industry Sector', 'Placements', 'Company Share (INR)', 'CAC (INR)', 'Cost of Execution (INR)', 'Net Contribution (INR)', 'Tier'];
    }

    const rows = filteredRows.map(r => {
      if (activeDimension === 'bd') {
        return [
          `"${r.dimension_value}"`, r.placements, r.enquiries_handled, r.new_clients, r.company_share, r.cac, r.cost_of_execution, r.rev_per_enquiry, r.exp_per_enquiry, r.net_surplus_per_enquiry, r.churn_cost, r.net_contribution, `${r.roi_multiple}x`, `"${r.tier}"`
        ];
      } else if (activeDimension === 'tl') {
        return [
          `"${r.dimension_value}"`, r.placements, r.enquiries_handled, r.company_share, r.active_franchise_count, r.rev_per_franchise, r.cost_per_franchise, r.net_contribution_per_franchise, r.net_surplus_per_enquiry, `"${r.tier}"`
        ];
      } else if (activeDimension === 'franchise') {
        return [
          `"${r.dimension_value}"`, r.placements, r.total_billed, r.company_share, r.franchisee_payout, r.credit_note_reversals, r.churn_cost
        ];
      } else {
        return [
          `"${r.dimension_value}"`, r.placements, r.company_share, r.cac, r.cost_of_execution, r.net_contribution, `"${r.tier}"`
        ];
      }
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Cost_of_Performance_${activeDimension}_${selectedMonth}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const paginatedRows = filteredRows.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="cost-performance-page animate-fade-in" style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto' }}>
      
      {/* 1. Header Banner & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-main)', letterSpacing: '-0.5px' }}>
              Cost of Performance & Unit Economics
            </h1>
            <span style={{ 
              background: 'linear-gradient(135deg, rgba(15, 110, 86, 0.15), rgba(15, 110, 86, 0.05))', 
              color: 'var(--accent-teal, #0F6E56)', 
              border: '1px solid rgba(15, 110, 86, 0.3)',
              padding: '3px 10px', 
              borderRadius: '20px', 
              fontSize: '0.75rem', 
              fontWeight: '700' 
            }}>
              TCHR Spec v1.0
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
            Measuring true acquisition cost, execution cost, loss forensics, and net commercial worth across 5 dimensions.
          </p>
        </div>

        {/* Global Controls: Month, Cost Input, Exports */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          
          {/* Month Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-card)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Month:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-main)',
                fontSize: '0.88rem',
                fontWeight: '700',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="all">All Complete Periods</option>
              {availableMonths.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Cost Data Timestamp Badge */}
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--bg-card)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            {reportData?.cost_data_version || 'Live CRM Data'}
          </div>

          {/* Cost Input Button (Head Office / Admin only) */}
          {userRole === 'head_office' && (
            <button
              onClick={loadCostInputs}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid var(--accent-teal, #0F6E56)',
                background: 'rgba(15, 110, 86, 0.08)',
                color: 'var(--accent-teal, #0F6E56)',
                fontSize: '0.84rem',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Sliders size={15} />
              <span>Cost & Overhead Inputs</span>
            </button>
          )}

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-card)',
              color: 'var(--text-main)',
              fontSize: '0.84rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            <Download size={15} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 2. Top Summary KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        
        {/* Company Share (Total Revenue Inflow) */}
        <div style={{ background: 'var(--bg-card)', padding: '18px 20px', borderRadius: '12px', border: '1px solid var(--border-color)', borderLeft: '4px solid #0F6E56', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Company Share (ourShare)
            </span>
            <DollarSign size={18} color="#0F6E56" />
          </div>
          <div style={{ fontSize: '1.55rem', fontWeight: '800', color: 'var(--text-main)' }}>
            {formatCurrency(totals.companyShare)}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Gross Billing: {formatCurrency(totals.billed)}
          </div>
        </div>

        {/* Cost of Execution */}
        {userRole !== 'franchise_partner' && (
          <div style={{ background: 'var(--bg-card)', padding: '18px 20px', borderRadius: '12px', border: '1px solid var(--border-color)', borderLeft: '4px solid #3B82F6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Cost of Execution
              </span>
              <Layers size={18} color="#3B82F6" />
            </div>
            <div style={{ fontSize: '1.55rem', fontWeight: '800', color: '#3B82F6' }}>
              {formatCurrency(totals.executionCost)}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Direct Salaries + Overhead ({reportData?.allocation_basis || 'Rev Share'})
            </div>
          </div>
        )}

        {/* Churn Cost & Leakage */}
        <div style={{ background: 'var(--bg-card)', padding: '18px 20px', borderRadius: '12px', border: '1px solid var(--border-color)', borderLeft: '4px solid #A8402E' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Cost of Losing Clients (Churn)
            </span>
            <AlertTriangle size={18} color="#A8402E" />
          </div>
          <div style={{ fontSize: '1.55rem', fontWeight: '800', color: '#A8402E' }}>
            {formatCurrency(totals.churnCost)}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Reversed Credit Notes & Lost Deal Sunk CAC
          </div>
        </div>

        {/* Net Commercial Contribution */}
        {userRole !== 'franchise_partner' && (
          <div style={{ background: 'var(--bg-card)', padding: '18px 20px', borderRadius: '12px', border: '1px solid var(--border-color)', borderLeft: '4px solid #10B981' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Net Contribution (True Worth)
              </span>
              <TrendingUp size={18} color="#10B981" />
            </div>
            <div style={{ fontSize: '1.55rem', fontWeight: '800', color: totals.netContribution >= 0 ? '#10B981' : '#A8402E' }}>
              {formatCurrency(totals.netContribution)}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              ROI Multiple: <strong style={{ color: companyRoiMultiple >= 2.5 ? '#10B981' : '#A8402E' }}>{companyRoiMultiple.toFixed(2)}x</strong>
            </div>
          </div>
        )}

        {/* Effort Unit Economics */}
        {userRole !== 'franchise_partner' && (
          <div style={{ background: 'var(--bg-card)', padding: '18px 20px', borderRadius: '12px', border: '1px solid var(--border-color)', borderLeft: '4px solid #8B5CF6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Net Surplus / Enquiry (Effort)
              </span>
              <Sparkles size={18} color="#8B5CF6" />
            </div>
            <div style={{ fontSize: '1.55rem', fontWeight: '800', color: avgSurplusPerEnquiry >= 0 ? '#8B5CF6' : '#A8402E' }}>
              {formatCurrency(avgSurplusPerEnquiry)}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Across {totals.totalEnquiries} total handled leads
            </div>
          </div>
        )}
      </div>

      {/* 3. Five Operational Dimension Navigation Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
        
        {/* Dimension Sub-Tabs */}
        <div style={{ display: 'flex', background: 'var(--bg-card)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-color)', gap: '4px' }}>
          {[
            { key: 'bd', label: 'BD-wise', icon: Users },
            { key: 'tl', label: 'Team Leader-wise', icon: Building },
            { key: 'franchise', label: 'Franchise-wise', icon: Layers },
            { key: 'city', label: 'City-wise', icon: MapPin },
            { key: 'industry', label: 'Industry-wise', icon: Briefcase }
          ].map(tab => {
            const IconComponent = tab.icon;
            const isActive = activeDimension === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveDimension(tab.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '7px',
                  border: 'none',
                  background: isActive ? 'var(--accent-teal, #0F6E56)' : 'transparent',
                  color: isActive ? '#ffffff' : 'var(--text-muted)',
                  fontWeight: isActive ? '700' : '500',
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <IconComponent size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-card)', padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', minWidth: '260px' }}>
          <Search size={15} color="var(--text-muted)" />
          <input
            type="text"
            placeholder={`Search ${activeDimension.toUpperCase()}...`}
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-main)',
              fontSize: '0.86rem',
              outline: 'none',
              width: '100%'
            }}
          />
          {searchTerm && (
            <X size={14} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setSearchTerm('')} />
          )}
        </div>
      </div>

      {/* 4. Ranked Dimension Table */}
      <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)' }}>
        
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ margin: '0 auto 12px auto' }}></div>
            <span>Fetching live unit economics & cost metrics...</span>
          </div>
        ) : error ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#A8402E' }}>
            <AlertTriangle size={32} style={{ marginBottom: '8px' }} />
            <div style={{ fontWeight: '700', fontSize: '1rem' }}>{error}</div>
            <button className="btn btn-primary" onClick={fetchReport} style={{ marginTop: '12px' }}>Retry</button>
          </div>
        ) : filteredRows.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Info size={32} style={{ marginBottom: '8px', opacity: 0.6 }} />
            <div style={{ fontWeight: '600' }}>No records found for {activeDimension.toUpperCase()} in {selectedMonth}</div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border-color)' }}>
                  
                  {/* Dimension Name */}
                  <th 
                    onClick={() => handleSort('dimension_value')}
                    style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '700', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>{activeDimension === 'bd' ? 'BD Specialist' : activeDimension === 'tl' ? 'Team Leader' : activeDimension === 'franchise' ? 'Franchise Partner' : activeDimension === 'city' ? 'Client City' : 'Industry Sector'}</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>

                  {/* Placements */}
                  <th 
                    onClick={() => handleSort('placements')}
                    style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '700', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      <span>Placements</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>

                  {/* Enquiries Handled (BD & TL) */}
                  {(activeDimension === 'bd' || activeDimension === 'tl') && (
                    <th 
                      onClick={() => handleSort('enquiries_handled')}
                      style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '700', color: 'var(--text-muted)', cursor: 'pointer' }}
                      title="All enquiries handled (closed, cancelled, on hold, in progress)"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                        <span>Total Enquiries</span>
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                  )}

                  {/* Company Share */}
                  <th 
                    onClick={() => handleSort('company_share')}
                    style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '700', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      <span>Company Share</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>

                  {/* TL Network Normalization Columns */}
                  {activeDimension === 'tl' && (
                    <>
                      <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '700', color: 'var(--text-muted)' }}>
                        Active Franchises
                      </th>
                      <th 
                        onClick={() => handleSort('rev_per_franchise')}
                        style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '700', color: 'var(--text-muted)', cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                          <span>Rev / Franchise</span>
                          <ArrowUpDown size={12} />
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSort('net_contribution_per_franchise')}
                        style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '800', color: 'var(--accent-teal, #0F6E56)', cursor: 'pointer' }}
                        title="Normalized Net Contribution per Active Franchise (Default TL Sort)"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                          <span>Net Contrib / Franchise ★</span>
                          <ArrowUpDown size={12} />
                        </div>
                      </th>
                    </>
                  )}

                  {/* Cost Columns (Protected from Franchise role) */}
                  {userRole !== 'franchise_partner' && activeDimension !== 'tl' && (
                    <>
                      <th 
                        onClick={() => handleSort('cac')}
                        style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '700', color: 'var(--text-muted)', cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                          <span>CAC</span>
                          <ArrowUpDown size={12} />
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSort('cost_of_execution')}
                        style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '700', color: 'var(--text-muted)', cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                          <span>Cost of Execution</span>
                          <ArrowUpDown size={12} />
                        </div>
                      </th>
                    </>
                  )}

                  {/* Per-Enquiry Unit Economics (BD & TL) */}
                  {userRole !== 'franchise_partner' && (activeDimension === 'bd' || activeDimension === 'tl') && (
                    <th 
                      onClick={() => handleSort('net_surplus_per_enquiry')}
                      style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '700', color: '#8B5CF6', cursor: 'pointer' }}
                      title="Net Surplus per Enquiry handled (Revenue/Enquiry - Expense/Enquiry)"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                        <span>Net Surplus/Enquiry</span>
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                  )}

                  {/* Churn Cost */}
                  <th 
                    onClick={() => handleSort('churn_cost')}
                    style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '700', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      <span>Churn Cost</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>

                  {/* Net Contribution (Worth) */}
                  {userRole !== 'franchise_partner' && (
                    <th 
                      onClick={() => handleSort('net_contribution')}
                      style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '800', color: 'var(--text-main)', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                        <span>Net Contribution</span>
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                  )}

                  {/* ROI Tier */}
                  {userRole !== 'franchise_partner' && (
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '700', color: 'var(--text-muted)', width: '150px' }}>
                      Performance Tier
                    </th>
                  )}

                  {/* Actions */}
                  <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '600', color: 'var(--text-muted)', width: '90px' }}>
                    Audit
                  </th>
                </tr>
              </thead>

              <tbody>
                {paginatedRows.map((r, idx) => {
                  const isNetPositive = (r.net_contribution || 0) >= 0;
                  return (
                    <tr 
                      key={r.dimension_value || idx}
                      onClick={() => handleOpenDrilldown(r)}
                      style={{ 
                        borderBottom: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        transition: 'background 0.1s ease'
                      }}
                      className="hover-row"
                    >
                      
                      {/* Name */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '0.88rem' }}>
                          {r.dimension_value}
                        </div>
                        {activeDimension === 'bd' && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Lost Deals: {formatCurrency(r.cancelled_losses || 0)}
                          </div>
                        )}
                      </td>

                      {/* Placements */}
                      <td style={{ padding: '14px 14px', textAlign: 'right', fontWeight: '600' }}>
                        {r.placements}
                      </td>

                      {/* Enquiries Handled */}
                      {(activeDimension === 'bd' || activeDimension === 'tl') && (
                        <td style={{ padding: '14px 14px', textAlign: 'right', color: 'var(--text-muted)' }}>
                          {r.enquiries_handled}
                        </td>
                      )}

                      {/* Company Share */}
                      <td style={{ padding: '14px 14px', textAlign: 'right', fontWeight: '700', color: 'var(--text-main)' }}>
                        {formatCurrency(r.company_share)}
                      </td>

                      {/* TL Specific Columns */}
                      {activeDimension === 'tl' && (
                        <>
                          <td style={{ padding: '14px 14px', textAlign: 'right', color: 'var(--text-muted)' }}>
                            {r.active_franchise_count} franchises
                          </td>
                          <td style={{ padding: '14px 14px', textAlign: 'right', fontWeight: '600' }}>
                            {formatCurrency(r.rev_per_franchise)}
                          </td>
                          <td style={{ padding: '14px 14px', textAlign: 'right', fontWeight: '800', color: r.net_contribution_per_franchise >= 0 ? 'var(--accent-teal, #0F6E56)' : '#A8402E' }}>
                            {formatCurrency(r.net_contribution_per_franchise)}
                          </td>
                        </>
                      )}

                      {/* Cost of Execution & CAC */}
                      {userRole !== 'franchise_partner' && activeDimension !== 'tl' && (
                        <>
                          <td style={{ padding: '14px 14px', textAlign: 'right', color: 'var(--text-muted)' }}>
                            {formatCurrency(r.cac)}
                          </td>
                          <td style={{ padding: '14px 14px', textAlign: 'right', color: '#3B82F6', fontWeight: '600' }}>
                            {formatCurrency(r.cost_of_execution)}
                          </td>
                        </>
                      )}

                      {/* Net Surplus per Enquiry */}
                      {userRole !== 'franchise_partner' && (activeDimension === 'bd' || activeDimension === 'tl') && (
                        <td style={{ padding: '14px 14px', textAlign: 'right', fontWeight: '700', color: r.net_surplus_per_enquiry >= 0 ? '#8B5CF6' : '#A8402E' }}>
                          {r.net_surplus_per_enquiry > 0 ? '+' : ''}{formatCurrency(r.net_surplus_per_enquiry)}
                        </td>
                      )}

                      {/* Churn Cost */}
                      <td style={{ padding: '14px 14px', textAlign: 'right', color: '#A8402E', fontWeight: '600' }}>
                        {formatCurrency(r.churn_cost)}
                      </td>

                      {/* Net Contribution */}
                      {userRole !== 'franchise_partner' && (
                        <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '800', color: isNetPositive ? '#10B981' : '#A8402E', fontSize: '0.92rem' }}>
                          {isNetPositive ? '+' : ''}{formatCurrency(r.net_contribution)}
                        </td>
                      )}

                      {/* ROI Tier Badge */}
                      {userRole !== 'franchise_partner' && (
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '0.72rem',
                            fontWeight: '700',
                            background: r.tier_badge === 'star' ? 'rgba(16, 185, 129, 0.15)' : r.tier_badge === 'profitable' ? 'rgba(59, 130, 246, 0.15)' : r.tier_badge === 'diluter' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: r.tier_badge === 'star' ? '#10B981' : r.tier_badge === 'profitable' ? '#3B82F6' : r.tier_badge === 'diluter' ? '#B7791F' : '#A8402E',
                            border: `1px solid ${r.tier_badge === 'star' ? 'rgba(16, 185, 129, 0.3)' : r.tier_badge === 'profitable' ? 'rgba(59, 130, 246, 0.3)' : r.tier_badge === 'diluter' ? 'rgba(234, 179, 8, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                          }}>
                            {r.tier} ({r.roi_multiple}x)
                          </span>
                        </td>
                      )}

                      {/* Drilldown Arrow */}
                      <td style={{ padding: '14px 14px', textAlign: 'center' }}>
                        <button 
                          style={{ background: 'transparent', border: 'none', color: 'var(--accent-teal, #0F6E56)', cursor: 'pointer', padding: '4px' }}
                          title="Click to view underlying placements and lost deal forensics"
                        >
                          <ChevronRight size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {filteredRows.length > ITEMS_PER_PAGE && (
          <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
            <Pagination
              currentPage={currentPage}
              totalItems={filteredRows.length}
              pageSize={ITEMS_PER_PAGE}
              onPageChange={setCurrentPage}
              itemName="records"
            />
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 5. DRILLDOWN AUDIT & LOSS FORENSICS MODAL                                  */}
      {/* ========================================================================= */}
      {drilldownItem && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            width: '100%',
            maxWidth: '1050px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            
            {/* Modal Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)' }}>
                    {drilldownItem.dimension_value}
                  </h3>
                  <span style={{ fontSize: '0.78rem', background: 'rgba(15, 110, 86, 0.1)', color: 'var(--accent-teal, #0F6E56)', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>
                    {activeDimension.toUpperCase()} • {selectedMonth}
                  </span>
                </div>
                <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  Underlying placements, revenue breakdowns, and loss forensic audit trail.
                </p>
              </div>

              <button 
                onClick={() => setDrilldownItem(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Sub-Tabs (Invoices vs Loss Forensics) */}
            <div style={{ padding: '12px 24px 0 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '16px' }}>
              <button
                onClick={() => setActiveDrillTab('invoices')}
                style={{
                  padding: '8px 14px',
                  border: 'none',
                  borderBottom: activeDrillTab === 'invoices' ? '2px solid var(--accent-teal, #0F6E56)' : '2px solid transparent',
                  background: 'transparent',
                  color: activeDrillTab === 'invoices' ? 'var(--accent-teal, #0F6E56)' : 'var(--text-muted)',
                  fontWeight: activeDrillTab === 'invoices' ? '700' : '500',
                  fontSize: '0.86rem',
                  cursor: 'pointer'
                }}
              >
                Delivered Placements & Invoices ({drilldownData.length})
              </button>

              {activeDimension === 'bd' && (
                <button
                  onClick={() => setActiveDrillTab('loss_forensics')}
                  style={{
                    padding: '8px 14px',
                    border: 'none',
                    borderBottom: activeDrillTab === 'loss_forensics' ? '2px solid #A8402E' : '2px solid transparent',
                    background: 'transparent',
                    color: activeDrillTab === 'loss_forensics' ? '#A8402E' : 'var(--text-muted)',
                    fontWeight: activeDrillTab === 'loss_forensics' ? '700' : '500',
                    fontSize: '0.86rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <AlertTriangle size={15} />
                  <span>Loss Forensics & Cancelled Deals ({bdLossData?.lost_deals?.length || 0})</span>
                </button>
              )}
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', overflowY: 'auto' }}>
              
              {/* Tab 1: Delivered Invoices */}
              {activeDrillTab === 'invoices' && (
                <div>
                  {drilldownLoading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Loading placement invoices...
                    </div>
                  ) : drilldownData.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No individual invoice records logged for this month.
                    </div>
                  ) : (
                    <div className="table-responsive" style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                      <table className="data-table" style={{ width: '100%', fontSize: '0.82rem' }}>
                        <thead>
                          <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ padding: '10px 14px', textAlign: 'left' }}>Bill No</th>
                            <th style={{ padding: '10px 14px', textAlign: 'left' }}>Date</th>
                            <th style={{ padding: '10px 14px', textAlign: 'left' }}>Client Company</th>
                            <th style={{ padding: '10px 14px', textAlign: 'left' }}>Candidate Position</th>
                            <th style={{ padding: '10px 14px', textAlign: 'right' }}>Total Billed</th>
                            <th style={{ padding: '10px 14px', textAlign: 'right' }}>Company Share</th>
                            <th style={{ padding: '10px 14px', textAlign: 'right' }}>Franchisee Share</th>
                          </tr>
                        </thead>
                        <tbody>
                          {drilldownData.map(inv => (
                            <tr key={inv.invoice_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '10px 14px', fontWeight: '700', color: 'var(--text-main)' }}>
                                {inv.billNumber || `INV-${inv.invoice_id}`}
                              </td>
                              <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                                {formatDate(inv.billDate)}
                              </td>
                              <td style={{ padding: '10px 14px', fontWeight: '600' }}>
                                {inv.companyName || 'Direct Client'}
                              </td>
                              <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                                {inv.positionName || 'Executive Role'}
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '600' }}>
                                {formatCurrency(inv.gross_billed)}
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700', color: 'var(--accent-teal, #0F6E56)' }}>
                                {formatCurrency(inv.our_share)}
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-muted)' }}>
                                {formatCurrency(inv.franchisee_share)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: BD Loss Forensics */}
              {activeDrillTab === 'loss_forensics' && bdLossData && (
                <div>
                  
                  {/* Loss Summary Pills */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ background: 'rgba(168, 64, 46, 0.08)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(168, 64, 46, 0.2)' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#A8402E', textTransform: 'uppercase' }}>Total Loss Amount</span>
                      <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#A8402E', marginTop: '2px' }}>
                        {formatCurrency(bdLossData.total_loss)}
                      </div>
                    </div>

                    <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cancelled / Rejected</span>
                      <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)', marginTop: '2px' }}>
                        {bdLossData.cancelled_count} deals
                      </div>
                    </div>

                    <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Internally Closed</span>
                      <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)', marginTop: '2px' }}>
                        {bdLossData.internally_closed_count} deals
                      </div>
                    </div>

                    <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>On Hold / Stagnant</span>
                      <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)', marginTop: '2px' }}>
                        {bdLossData.on_hold_count} deals
                      </div>
                    </div>
                  </div>

                  {/* Lost Deals Table */}
                  <div className="table-responsive" style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                    <table className="data-table" style={{ width: '100%', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border-color)' }}>
                          <th style={{ padding: '10px 14px', textAlign: 'left' }}>Enquiry ID</th>
                          <th style={{ padding: '10px 14px', textAlign: 'left' }}>Client Company</th>
                          <th style={{ padding: '10px 14px', textAlign: 'left' }}>Position</th>
                          <th style={{ padding: '10px 14px', textAlign: 'left' }}>Franchise Assigned</th>
                          <th style={{ padding: '10px 14px', textAlign: 'left' }}>Loss Reason / Status</th>
                          <th style={{ padding: '10px 14px', textAlign: 'right' }}>Lost Placement Fee</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bdLossData.lost_deals.map(deal => (
                          <tr key={deal.enquiry_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '10px 14px', fontWeight: '700', color: 'var(--text-main)' }}>
                              #{deal.enquiry_id}
                            </td>
                            <td style={{ padding: '10px 14px', fontWeight: '600' }}>
                              {deal.companyName || 'Corporate Client'}
                            </td>
                            <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                              {deal.positionName || 'N/A'}
                            </td>
                            <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                              {deal.franchiseeName || 'Direct'}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.72rem',
                                fontWeight: '700',
                                background: deal.enquiryStatus === 'cancelled' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                                color: deal.enquiryStatus === 'cancelled' ? '#A8402E' : '#B7791F'
                              }}>
                                {deal.enquiryStatus?.replace(/_/g, ' ').toUpperCase()}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700', color: '#A8402E' }}>
                              {formatCurrency(deal.placementFees)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. COST & OVERHEAD INPUT MODAL (ADMIN / HEAD OFFICE ONLY)                 */}
      {/* ========================================================================= */}
      {isInputModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            width: '100%',
            maxWidth: '850px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '28px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)'
          }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)' }}>
                  Monthly Cost & Overhead Configuration
                </h3>
                <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  Set salaries, shared overhead pools, and allocation rules for {selectedMonth}.
                </p>
              </div>
              <button onClick={() => setIsInputModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveCostInputs}>
              
              {/* 1. Shared Overhead Pool */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.92rem', fontWeight: '700', color: 'var(--text-main)' }}>
                  1. Shared Overhead Pool ({selectedMonth})
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Admin Team Salary (₹)</label>
                    <input 
                      type="number"
                      className="form-control"
                      value={costInputs.overhead.admin_team_salary || 0}
                      onChange={(e) => setCostInputs({
                        ...costInputs,
                        overhead: { ...costInputs.overhead, admin_team_salary: parseFloat(e.target.value) || 0 }
                      })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Marketing Team Salary (₹)</label>
                    <input 
                      type="number"
                      className="form-control"
                      value={costInputs.overhead.marketing_team_salary || 0}
                      onChange={(e) => setCostInputs({
                        ...costInputs,
                        overhead: { ...costInputs.overhead, marketing_team_salary: parseFloat(e.target.value) || 0 }
                      })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Commercial Rent (₹)</label>
                    <input 
                      type="number"
                      className="form-control"
                      value={costInputs.overhead.rent || 0}
                      onChange={(e) => setCostInputs({
                        ...costInputs,
                        overhead: { ...costInputs.overhead, rent: parseFloat(e.target.value) || 0 }
                      })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Other Admin Expenses (₹)</label>
                    <input 
                      type="number"
                      className="form-control"
                      value={costInputs.overhead.other_admin_expense || 0}
                      onChange={(e) => setCostInputs({
                        ...costInputs,
                        overhead: { ...costInputs.overhead, other_admin_expense: parseFloat(e.target.value) || 0 }
                      })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)' }}
                    />
                  </div>
                </div>
              </div>

              {/* 2. Allocation Rule */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.92rem', fontWeight: '700', color: 'var(--text-main)' }}>
                  2. Overhead Allocation Rule
                </h4>
                <div style={{ display: 'flex', gap: '16px' }}>
                  {[
                    { id: 'revenue_share', label: 'Pro-Rata Revenue Share (Recommended)' },
                    { id: 'placement_count', label: 'Pro-Rata Placement Count' },
                    { id: 'headcount', label: 'Equal Headcount Share' }
                  ].map(rule => (
                    <label key={rule.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.84rem' }}>
                      <input 
                        type="radio"
                        name="allocation_basis"
                        value={rule.id}
                        checked={costInputs.allocation_basis === rule.id}
                        onChange={(e) => setCostInputs({ ...costInputs, allocation_basis: e.target.value })}
                      />
                      <span>{rule.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setIsInputModalOpen(false)}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingInputs}
                  style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: 'var(--accent-teal, #0F6E56)', color: '#ffffff', fontWeight: '700', cursor: 'pointer' }}
                >
                  {savingInputs ? 'Saving Live...' : 'Save & Recalculate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CostOfPerformance;
