import React, { useContext, useState, useEffect } from 'react';
import { FinanceContext } from '../context/FinanceContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import { Search, Trash2, Printer, Filter, X, Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

const Reports = () => {
  const { moduleFilteredTransactions: transactions, deleteTransaction, selectedMonth, selectedYear, activeModule, bdAgents, franchisees } = useContext(FinanceContext);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterPayment, setFilterPayment] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  
  const [activeTab, setActiveTab] = useState('ledger'); // 'ledger' or 'ml'
  const [mlData, setMlData] = useState(null);
  const [mlLoading, setMlLoading] = useState(false);
  const [mlError, setMlError] = useState(null);

  useEffect(() => {
    if (activeTab === 'ml' && !mlData) {
      setMlLoading(true);
      fetch('http://localhost:5000/api/ml/insights')
        .then(res => {
          if (!res.ok) throw new Error('Failed to load ML predictive insights. Make sure the backend Flask server is running.');
          return res.json();
        })
        .then(data => {
          setMlData(data);
          setMlLoading(false);
        })
        .catch(err => {
          setMlError(err.message);
          setMlLoading(false);
        });
    }
  }, [activeTab, mlData]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterType, filterCategory, filterPayment, selectedMonth]);

  const categories = activeModule === 'job_portal'
    ? ['Job portal', 'Portal subscriptions', 'Marketing', 'Other']
    : [
        'Recruitment',
        'Franchisee fee',
        'Salaries',
        'BD commissions',
        'Marketing',
        'Office & infra',
        'Other'
      ];

  // Apply filters
  const filteredTxs = transactions.filter(tx => {
    // 1. Month filter (aligned with topbar selection)
    if (selectedMonth !== 'All Months') {
      const date = new Date(tx.date);
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const txMonthYear = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
      if (txMonthYear !== selectedMonth) return false;
    }

    // 1B. Year filter
    if (selectedYear !== 'All Years') {
      if (tx.financialYear && tx.financialYear !== 'N/A') {
        if (tx.financialYear !== selectedYear) return false;
      } else {
        const d = new Date(tx.date);
        if (!isNaN(d.getTime())) {
          const y = d.getFullYear();
          const m = d.getMonth();
          const fy = m >= 3 ? `${y}-${y+1}` : `${y-1}-${y}`;
          if (fy !== selectedYear) return false;
        }
      }
    }

    // 2. Search Query
    const query = searchQuery.toLowerCase();
    const titleMatch = tx.title.toLowerCase().includes(query);
    const descMatch = (tx.description || '').toLowerCase().includes(query);
    const subMatch = (tx.subCategory || '').toLowerCase().includes(query);
    const refMatch = (tx.referenceId || '').toLowerCase().includes(query);
    if (!titleMatch && !descMatch && !subMatch && !refMatch) return false;

    // 3. Filter Type
    if (filterType !== 'all' && tx.type !== filterType) return false;

    // 4. Filter Category
    if (filterCategory !== 'all' && tx.category !== filterCategory) return false;

    // 5. Filter Payment Mode
    if (filterPayment !== 'all' && (tx.paymentMode || 'Cash') !== filterPayment) return false;

    return true;
  });

  // Calculate dynamic filtered totals down to the rupee
  const totalFilteredIncome = filteredTxs
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalFilteredExpense = filteredTxs
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const filteredNet = totalFilteredIncome - totalFilteredExpense;

  const handlePrint = () => {
    window.print();
  };

  // CSV Exporter - exact details client-side
  const handleExportCSV = () => {
    const headers = ['Date', 'Title', 'Type', 'Category', 'Sub-Category', 'BD Agent', 'Franchisee', 'Payment Mode', 'Reference ID', 'Amount (INR)', 'Description'];
    const rows = filteredTxs.map(tx => {
      const agent = bdAgents ? bdAgents.find(a => a.id === tx.bdAgentId) : null;
      const franchisee = franchisees ? franchisees.find(f => f.id === tx.franchiseeId) : null;
      return [
        tx.date,
        `"${tx.title.replace(/"/g, '""')}"`,
        tx.type,
        tx.category,
        tx.subCategory || 'General',
        agent ? `"${agent.name.replace(/"/g, '""')}"` : '',
        franchisee ? `"${franchisee.name.replace(/"/g, '""')}"` : '',
        tx.paymentMode || 'Cash',
        tx.referenceId || '',
        tx.amount.toFixed(2),
        `"${(tx.description || '').replace(/"/g, '""')}"`
      ];
    });
    
    // Construct csv string
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" // UTF-8 BOM for Excel compatibility
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const fileSuffix = selectedMonth.replace(' ', '_');
    link.setAttribute("download", `Saarthi_Finance_Ledger_${fileSuffix}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setFilterType('all');
    setFilterCategory('all');
    setFilterPayment('all');
  };

  return (
    <div className="reports-page animate-fade-in">
      
      {/* Sub-tab navigation selector */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '24px', gap: '8px' }}>
        <button
          onClick={() => setActiveTab('ledger')}
          style={{
            borderRadius: '0',
            border: 'none',
            borderBottom: activeTab === 'ledger' ? '3px solid var(--accent-teal, #2dd4bf)' : 'none',
            padding: '12px 20px',
            background: 'none',
            color: activeTab === 'ledger' ? 'var(--accent-teal, #2dd4bf)' : '#94a3b8',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          General Transaction Ledger
        </button>
        <button
          onClick={() => setActiveTab('ml')}
          style={{
            borderRadius: '0',
            border: 'none',
            borderBottom: activeTab === 'ml' ? '3px solid var(--accent-teal, #2dd4bf)' : 'none',
            padding: '12px 20px',
            background: 'none',
            color: activeTab === 'ml' ? 'var(--accent-teal, #2dd4bf)' : '#94a3b8',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          AI & Machine Learning Insights
        </button>
      </div>

      {activeTab === 'ledger' && (
        <>
      {/* Search and Filters Header */}
      <div className="dashboard-card filters-card">
        <div className="filters-grid">
          
          <div className="filter-item search-bar-wrapper">
            <label><Search size={14} /> Search Details</label>
            <input
              type="text"
              placeholder="Search title, sub-category, reference #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="filter-item">
            <label><Filter size={14} /> Type</label>
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setFilterCategory('all');
              }}
            >
              <option value="all">All Types</option>
              <option value="income">Income Only</option>
              <option value="expense">Expenses Only</option>
            </select>
          </div>

          <div className="filter-item">
            <label><Filter size={14} /> Category</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="filter-item">
            <label><Filter size={14} /> Payment Mode</label>
            <select
              value={filterPayment}
              onChange={(e) => setFilterPayment(e.target.value)}
            >
              <option value="all">All Modes</option>
              <option value="UPI">UPI</option>
              <option value="Net Banking">Net Banking</option>
              <option value="Credit Card">Credit Card</option>
              <option value="Cash">Cash</option>
            </select>
          </div>

          <div className="filter-item flex-end">
            {(searchQuery || filterType !== 'all' || filterCategory !== 'all' || filterPayment !== 'all') && (
              <button className="btn btn-secondary btn-icon-only" title="Clear Filters" onClick={handleClearFilters}>
                <X size={16} />
              </button>
            )}
            <button className="btn btn-secondary" onClick={handleExportCSV} title="Export exact logs to Excel CSV">
              <Download size={16} />
              <span>Export CSV</span>
            </button>
            <button className="btn btn-secondary" onClick={handlePrint}>
              <Printer size={16} />
              <span>Print</span>
            </button>
          </div>

        </div>
      </div>

      {/* Dynamic Summary metrics based on filtered query */}
      <section className="filtered-summary-stats animate-fade-in">
        <div className="summary-stat-box">
          <span className="summary-stat-label">Filtered Inflows</span>
          <span className="summary-stat-val positive">{formatCurrency(totalFilteredIncome)}</span>
        </div>
        <div className="summary-stat-box">
          <span className="summary-stat-label">Filtered Outflows</span>
          <span className="summary-stat-val negative">{formatCurrency(totalFilteredExpense, true)}</span>
        </div>
        <div className="summary-stat-box">
          <span className="summary-stat-label">Net Filtered Cash</span>
          <span className={`summary-stat-val ${filteredNet >= 0 ? 'positive' : 'negative'}`}>
            {formatCurrency(filteredNet)}
          </span>
        </div>
      </section>

      {/* Transaction Ledger Table */}
      <div className="dashboard-card print-section">
        <div className="ledger-header">
          <h3 className="card-title">General Transaction Ledger ({selectedMonth})</h3>
          <span className="ledger-count">Showing {filteredTxs.length} items</span>
        </div>

        {filteredTxs.length === 0 ? (
          <div className="no-records-wrapper">
            <p className="no-data-text">No transaction logs match your filter settings.</p>
            <button className="btn btn-secondary" onClick={handleClearFilters}>Reset Filters</button>
          </div>
        ) : (
          (() => {
            const ITEMS_PER_PAGE = 20;
            const totalPages = Math.ceil(filteredTxs.length / ITEMS_PER_PAGE);
            const paginatedTxs = filteredTxs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

            return (
              <div>
                <div className="table-responsive">
                  <table className="data-table ledger-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Item Title & Sub-Category</th>
                        <th>Category</th>
                        <th>Payment Mode</th>
                        <th>Reference ID</th>
                        <th>Amount</th>
                        <th className="no-print">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedTxs.map(tx => {
                        const agent = bdAgents ? bdAgents.find(a => a.id === tx.bdAgentId) : null;
                        const franchisee = franchisees ? franchisees.find(f => f.id === tx.franchiseeId) : null;

                        return (
                          <tr key={tx.id}>
                            <td>{tx.date}</td>
                            <td>
                              <div className="ledger-tx-title font-bold">{tx.title}</div>
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '2px', alignItems: 'center' }}>
                                <span className="ledger-tx-subcategory">{tx.subCategory || 'General'}</span>
                                {agent && (
                                  <span style={{ fontSize: '0.7rem', padding: '1px 6px', backgroundColor: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa', borderRadius: '4px', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                                    BD: {agent.name}
                                  </span>
                                )}
                                {franchisee && (
                                  <span style={{ fontSize: '0.7rem', padding: '1px 6px', backgroundColor: 'rgba(45, 212, 191, 0.15)', color: '#2dd4bf', borderRadius: '4px', border: '1px solid rgba(45, 212, 191, 0.2)' }}>
                                    Franchisee: {franchisee.name}
                                  </span>
                                )}
                              </div>
                              {tx.description && <span className="ledger-tx-desc">{tx.description}</span>}
                            </td>
                             <td>
                               {tx.type === 'income' && tx.category === 'Recruitment' && tx.info && tx.info !== 'N/A' ? (
                                 <span className={`type-badge info-${tx.info.toLowerCase()}`} title="Status from Master CSV">
                                   {tx.info}
                                 </span>
                               ) : (
                                 <span className={`type-badge ${tx.type}`}>
                                   {tx.category}
                                 </span>
                               )}
                             </td>
                            <td className="font-bold">{tx.paymentMode || 'Cash'}</td>
                            <td><code className="ref-code">{tx.referenceId}</code></td>
                            <td className={`font-bold text-right ${tx.type === 'income' ? 'text-teal' : 'text-red'}`}>
                               {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                            </td>
                            <td className="text-center no-print">
                              <button 
                                className="btn-delete"
                                title="Delete entry"
                                onClick={() => {
                                  if (confirm(`Are you sure you want to delete the entry "${tx.title}" for â‚¹${tx.amount.toLocaleString()}?`)) {
                                    deleteTransaction(tx.id);
                                  }
                                }}
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (() => {
                  const buttonStyle = (disabled, active) => ({
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '32px',
                    height: '32px',
                    padding: '0 6px',
                    fontSize: '0.85rem',
                    backgroundColor: active ? 'var(--color-purple, #8b5cf6)' : (disabled ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.08)'),
                    color: active ? '#fff' : (disabled ? '#475569' : '#94a3b8'),
                    border: active ? 'none' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '6px',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                  });

                  return (
                    <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', padding: '12px 16px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                        Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredTxs.length)} of {filteredTxs.length} transactions
                      </span>
                      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                        {/* First Page */}
                        <button
                          type="button"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(1)}
                          style={buttonStyle(currentPage === 1, false)}
                          title="First Page"
                        >
                          <ChevronsLeft size={16} />
                        </button>
                        
                        {/* Prev Page */}
                        <button
                          type="button"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          style={buttonStyle(currentPage === 1, false)}
                          title="Previous Page"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        
                        {/* Page Numbers */}
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => {
                          if (totalPages > 6 && pageNum !== 1 && pageNum !== totalPages && Math.abs(pageNum - currentPage) > 1) {
                            if (pageNum === 2 && currentPage > 3) return <span key="dots-start" style={{ color: '#475569', padding: '0 4px', fontSize: '0.85rem' }}>...</span>;
                            if (pageNum === totalPages - 1 && currentPage < totalPages - 2) return <span key="dots-end" style={{ color: '#475569', padding: '0 4px', fontSize: '0.85rem' }}>...</span>;
                            return null;
                          }
                          return (
                            <button
                              key={pageNum}
                              type="button"
                              onClick={() => setCurrentPage(pageNum)}
                              style={buttonStyle(false, currentPage === pageNum)}
                            >
                              {pageNum}
                            </button>
                          );
                        })}

                        {/* Next Page */}
                        <button
                          type="button"
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          style={buttonStyle(currentPage === totalPages, false)}
                          title="Next Page"
                        >
                          <ChevronRight size={16} />
                        </button>

                        {/* Last Page */}
                        <button
                          type="button"
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage(totalPages)}
                          style={buttonStyle(currentPage === totalPages, false)}
                          title="Last Page"
                        >
                          <ChevronsRight size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })()
        )}
      </div>
      </>
      )}

      {activeTab === 'ml' && (
        <div className="ml-insights-wrapper animate-fade-in">
          {mlLoading && (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#94a3b8', fontWeight: 'bold' }}>
              Computing Machine Learning Models (K-Means & Isolation Forest)...
            </div>
          )}
          
          {mlError && (
            <div style={{ padding: '24px', backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', borderRadius: '12px', marginBottom: '24px' }}>
              <h4 style={{ fontWeight: 'bold', marginBottom: '8px' }}>Predictive Analytics Offline</h4>
              <p>{mlError}</p>
              <button 
                onClick={() => { setMlError(null); setMlData(null); }} 
                className="btn btn-secondary" 
                style={{ marginTop: '12px', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                Retry Connection
              </button>
            </div>
          )}

          {mlData && (
            <div>
              {/* Task 1: Anomaly Detection on Expenses & Invoices */}
              <div className="dashboard-card" style={{ marginBottom: '24px' }}>
                <h3 className="card-title" style={{ color: 'var(--accent-teal)', marginBottom: '8px' }}>Task 1: Anomaly Detection on Expenses & Invoices</h3>
                <p className="flow-subtitle" style={{ marginBottom: '20px' }}>
                  Runs an Isolation Forest outlier model over expense categories to catch spikes, duplicate charges, or service fee ratio variances automatically.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', alignItems: 'start' }}>
                  {/* Expense Outlier Chart */}
                  <div>
                    <span className="font-bold" style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'block', marginBottom: '8px' }}>Outlier Distribution Analysis</span>
                    <img 
                      src="http://localhost:5000/api/ml/plots/expense_anomalies.png" 
                      alt="Expense Outliers Analysis Chart"
                      style={{ width: '100%', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                  
                  {/* Anomaly Tables */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <h4 className="font-bold" style={{ fontSize: '0.9rem', color: '#ef4444', marginBottom: '8px' }}>Flagged Expense Outliers</h4>
                      {mlData.expense_anomalies && mlData.expense_anomalies.length > 0 ? (
                        <div className="table-responsive" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                          <table className="data-table" style={{ fontSize: '0.85rem' }}>
                            <thead>
                              <tr>
                                <th>Category</th>
                                <th>Particulars</th>
                                <th className="text-right">Amount (â‚¹)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {mlData.expense_anomalies.map((anom, i) => (
                                <tr key={i}>
                                  <td>{anom.category}</td>
                                  <td>{anom.particulars}</td>
                                  <td className="text-right font-bold text-red">â‚¹{anom.amount.toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p style={{ fontSize: '0.85rem', color: '#64748b' }}>No statistical anomalies found in expenses.</p>
                      )}
                    </div>

                    <div>
                      <h4 className="font-bold" style={{ fontSize: '0.9rem', color: '#ea580c', marginBottom: '8px' }}>Potential Duplicate Billings</h4>
                      {mlData.duplicate_billings && mlData.duplicate_billings.length > 0 ? (
                        <div className="table-responsive" style={{ maxHeight: '160px', overflowY: 'auto' }}>
                          <table className="data-table" style={{ fontSize: '0.85rem' }}>
                            <thead>
                              <tr>
                                <th>Date</th>
                                <th>Category</th>
                                <th className="text-right">Amount (â‚¹)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {mlData.duplicate_billings.map((dup, i) => (
                                <tr key={i}>
                                  <td>{dup.date}</td>
                                  <td>{dup.category}</td>
                                  <td className="text-right font-bold" style={{ color: '#ea580c' }}>â‚¹{dup.amount.toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p style={{ fontSize: '0.85rem', color: '#64748b' }}>No identical duplicate date/amounts flagged.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Task 2: Franchisee & Company Segmentation */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
                
                {/* Franchisee Segmentations */}
                <div className="dashboard-card">
                  <h3 className="card-title" style={{ color: 'var(--accent-teal)', marginBottom: '8px' }}>Franchisee Hub Segmentation</h3>
                  <p className="flow-subtitle" style={{ marginBottom: '16px' }}>
                    Clusters franchise locations by placement activity, enquiries, and billing output using K-Means ($K=3$).
                  </p>
                  
                  <img 
                    src="http://localhost:5000/api/ml/plots/franchise_segments.png" 
                    alt="Franchise Segments Chart"
                    style={{ width: '100%', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '16px' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />

                  <div className="table-responsive" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                    <table className="data-table" style={{ fontSize: '0.85rem' }}>
                      <thead>
                        <tr>
                          <th>Franchise Hub</th>
                          <th>Placements</th>
                          <th>Revenues</th>
                          <th>Segment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mlData.franchise_clusters && mlData.franchise_clusters.slice(0, 30).map((fran, i) => (
                          <tr key={i}>
                            <td className="font-bold">{fran.franchise}</td>
                            <td>{fran.placements} / {fran.enquiries}</td>
                            <td className="font-bold text-teal">â‚¹{fran.revenue.toLocaleString()}</td>
                            <td>
                              <span className="status-badge" style={{
                                backgroundColor: fran.cluster === 0 ? 'rgba(16, 185, 129, 0.1)' : (fran.cluster === 1 ? 'rgba(37, 99, 235, 0.1)' : 'rgba(239, 68, 68, 0.1)'),
                                color: fran.cluster === 0 ? '#10b981' : (fran.cluster === 1 ? '#3b82f6' : '#ef4444')
                              }}>
                                {fran.segment.split(' ')[0]}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Client Company Segmentations */}
                <div className="dashboard-card">
                  <h3 className="card-title" style={{ color: 'var(--accent-teal)', marginBottom: '8px' }}>Corporate Client Clustering</h3>
                  <p className="flow-subtitle" style={{ marginBottom: '16px' }}>
                    Groups corporate accounts by job volumes, placement rates, and average salaries using K-Means ($K=4$).
                  </p>
                  
                  <img 
                    src="http://localhost:5000/api/ml/plots/client_segments.png" 
                    alt="Client Segments Chart"
                    style={{ width: '100%', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '16px' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />

                  <div className="table-responsive" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                    <table className="data-table" style={{ fontSize: '0.85rem' }}>
                      <thead>
                        <tr>
                          <th>Client Company</th>
                          <th>Jobs</th>
                          <th>Billings</th>
                          <th>Segment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mlData.client_clusters && mlData.client_clusters.slice(0, 30).map((cli, i) => (
                          <tr key={i}>
                            <td className="font-bold">{cli.client}</td>
                            <td>{cli.placements} / {cli.jobs}</td>
                            <td className="font-bold text-teal">â‚¹{cli.billing.toLocaleString()}</td>
                            <td>
                              <span className="status-badge" style={{
                                backgroundColor: cli.cluster === 0 ? 'rgba(16, 185, 129, 0.1)' : (cli.cluster === 1 ? 'rgba(37, 99, 235, 0.1)' : (cli.cluster === 2 ? 'rgba(192, 132, 252, 0.1)' : 'rgba(239, 68, 68, 0.1)')),
                                color: cli.cluster === 0 ? '#10b981' : (cli.cluster === 1 ? '#3b82f6' : (cli.cluster === 2 ? '#c084fc' : '#ef4444'))
                              }}>
                                {cli.segment.split(' ')[0]}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Reports;
