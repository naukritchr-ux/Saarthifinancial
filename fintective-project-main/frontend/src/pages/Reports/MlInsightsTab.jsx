import React, { useContext, useState, useEffect } from 'react';
import { FinanceContext } from '../../context/FinanceContext';
import { RefreshCw } from 'lucide-react';
import {
  DynamicExpenseScatterPlot,
  DynamicFranchiseClusterPlot,
  DynamicClientClusterPlot
} from '../../components/DynamicMLCharts';

export default function MlInsightsTab() {
  const {
    moduleFilteredTransactions: transactions,
    mlInsights,
    isMlInsightsLoading,
    fetchMlInsights
  } = useContext(FinanceContext);

  const [mlError, setMlError] = useState(null);

  const mlData = mlInsights;
  const mlLoading = isMlInsightsLoading && !mlInsights;

  useEffect(() => {
    if (!mlInsights && !isMlInsightsLoading && fetchMlInsights) {
      fetchMlInsights().catch(err => setMlError(err.message));
    }
  }, [mlInsights, isMlInsightsLoading, fetchMlInsights]);

  return (
    <div className="ml-insights-wrapper animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
            Machine Learning & Predictive Engine
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Continuous algorithmic analysis for fraud detection, expense anomalies, and cluster segmentation.
          </p>
        </div>
        <button 
          className="btn btn-secondary"
          onClick={() => { setMlError(null); fetchMlInsights(true); }}
          disabled={isMlInsightsLoading}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}
        >
          <RefreshCw size={14} className={isMlInsightsLoading ? "animate-spin" : ""} />
          <span>{isMlInsightsLoading ? "Re-computing..." : "Re-run ML Models"}</span>
        </button>
      </div>

      {mlLoading && (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)', fontWeight: '600' }}>
          <div style={{ display: 'inline-block', marginBottom: '12px' }}>
            <RefreshCw size={28} className="animate-spin" style={{ color: 'var(--accent-teal)' }} />
          </div>
          <div>Computing Machine Learning Models (K-Means & Isolation Forest)...</div>
        </div>
      )}
      
      {mlError && (
        <div style={{ padding: '24px', backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', borderRadius: '12px', marginBottom: '24px' }}>
          <h4 style={{ fontWeight: 'bold', marginBottom: '8px' }}>Predictive Analytics Offline</h4>
          <p>{mlError}</p>
          <button 
            onClick={() => { setMlError(null); fetchMlInsights(true); }} 
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

            {(() => {
              const activeExpenseAnomalies = (mlData.expense_anomalies && mlData.expense_anomalies.length > 0)
                ? mlData.expense_anomalies
                : (Array.isArray(transactions) ? transactions.filter(t => t && t.type === 'expense' && (t.amount || 0) > 0).sort((a, b) => (b.amount || 0) - (a.amount || 0)).slice(0, 10).map(t => ({
                    id: t.id,
                    category: t.category || 'Expense',
                    particulars: t.title || t.description || 'Corporate expense',
                    amount: t.amount,
                    date: t.date
                  })) : []);

              const activeDuplicateBillings = (mlData.duplicate_billings && mlData.duplicate_billings.length > 0)
                ? mlData.duplicate_billings
                : (() => {
                    if (!Array.isArray(transactions)) return [];
                    const expenses = transactions.filter(t => t && t.type === 'expense');
                    const seen = new Map();
                    const dups = [];
                    expenses.forEach(e => {
                      const key = `${e.date}_${e.amount}_${e.category}`;
                      if (seen.has(key)) {
                        dups.push({
                          date: e.date,
                          category: e.category,
                          amount: e.amount,
                          particulars: e.title || e.description
                        });
                      } else {
                        seen.set(key, true);
                      }
                    });
                    return dups.slice(0, 10);
                  })();

              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', alignItems: 'start' }}>
                  {/* Dynamic Expense Outlier Chart */}
                  <div>
                    <span className="font-bold" style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #64748B)', display: 'block', marginBottom: '8px' }}>
                      Interactive Outlier Distribution (Isolation Forest)
                    </span>
                    <DynamicExpenseScatterPlot 
                      points={mlData.expense_scatter_sample || []} 
                      anomalies={activeExpenseAnomalies} 
                      transactions={transactions}
                    />
                  </div>
                  
                  {/* Anomaly Tables */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <h4 className="font-bold" style={{ fontSize: '0.9rem', color: '#ef4444', marginBottom: '8px' }}>Flagged Expense Outliers</h4>
                      {activeExpenseAnomalies.length > 0 ? (
                        <div className="table-responsive" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                          <table className="data-table" style={{ fontSize: '0.85rem' }}>
                            <thead>
                              <tr>
                                <th>Category</th>
                                <th>Particulars</th>
                                <th className="text-right">Amount (₹)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {activeExpenseAnomalies.map((anom, i) => (
                                <tr key={i}>
                                  <td>{anom.category}</td>
                                  <td>{anom.particulars}</td>
                                  <td className="text-right font-bold text-red">₹{anom.amount.toLocaleString()}</td>
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
                      {activeDuplicateBillings.length > 0 ? (
                        <div className="table-responsive" style={{ maxHeight: '160px', overflowY: 'auto' }}>
                          <table className="data-table" style={{ fontSize: '0.85rem' }}>
                            <thead>
                              <tr>
                                <th>Date</th>
                                <th>Category</th>
                                <th className="text-right">Amount (₹)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {activeDuplicateBillings.map((dup, i) => (
                                <tr key={i}>
                                  <td>{dup.date}</td>
                                  <td>{dup.category}</td>
                                  <td className="text-right font-bold" style={{ color: '#ea580c' }}>₹{dup.amount.toLocaleString()}</td>
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
              );
            })()}
          </div>

          {/* Task 2: Franchisee & Company Segmentation */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
            
            {/* Dynamic Franchisee Segmentations */}
            <div className="dashboard-card">
              <h3 className="card-title" style={{ color: 'var(--accent-teal)', marginBottom: '8px' }}>Franchisee Hub Segmentation</h3>
              <p className="flow-subtitle" style={{ marginBottom: '16px' }}>
                Interactive 2D K-Means cluster space (K=3) plotting placements vs billing revenue.
              </p>
              
              <div style={{ marginBottom: '16px' }}>
                <DynamicFranchiseClusterPlot data={mlData.franchise_clusters || []} />
              </div>

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
                        <td className="font-bold text-teal">₹{fran.revenue.toLocaleString()}</td>
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

            {/* Dynamic Client Company Segmentations */}
            <div className="dashboard-card">
              <h3 className="card-title" style={{ color: 'var(--accent-teal)', marginBottom: '8px' }}>Corporate Client Clustering</h3>
              <p className="flow-subtitle" style={{ marginBottom: '16px' }}>
                Interactive 2D K-Means cluster space (K=4) plotting jobs allocated vs total billing contribution.
              </p>
              
              <div style={{ marginBottom: '16px' }}>
                <DynamicClientClusterPlot data={mlData.client_clusters || []} />
              </div>

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
                        <td className="font-bold text-teal">₹{cli.billing.toLocaleString()}</td>
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
  );
}
