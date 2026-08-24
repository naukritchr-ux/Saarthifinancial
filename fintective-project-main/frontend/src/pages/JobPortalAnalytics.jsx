import React, { useContext, useState } from 'react';
import { FinanceContext } from '../context/FinanceContext';
import { formatCurrency, formatLakhs, formatDate } from '../utils/formatters';
import { Globe, Plus, ShieldCheck, MapPin, X, ArrowUpRight, ArrowDownRight, TrendingUp, CreditCard, Users, Briefcase } from 'lucide-react';

const JobPortalAnalytics = () => {
  const { transactions, selectedMonth } = useContext(FinanceContext);
  const [showAddForm, setShowAddForm] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [packageType, setPackageType] = useState('Standard Premium');
  const [amountPaid, setAmountPaid] = useState('');

  // Initial mock list of active recruiter clients (stored in state for interactivity)
  const [clients, setClients] = useState([
    { id: 'c-1', company: 'Wipro Technologies', industry: 'IT Services', package: 'Enterprise Unlimited', amount: 83200, activeSeats: 12, status: 'Active' },
    { id: 'c-2', company: 'TCS QA Hub', industry: 'Quality Assurance', package: 'Standard Premium', amount: 55000, activeSeats: 6, status: 'Active' },
    { id: 'c-3', company: 'Cognizant Pune', industry: 'Consulting', package: 'Enterprise Unlimited', amount: 67500, activeSeats: 10, status: 'Active' },
    { id: 'c-4', company: 'Infosys Central', industry: 'IT Services', package: 'Basic Recruitment', amount: 45000, activeSeats: 4, status: 'Active' },
    { id: 'c-5', company: 'Persistent Systems', industry: 'Software Dev', package: 'Standard Premium', amount: 35000, activeSeats: 5, status: 'Inactive' }
  ]);

  // Handle adding new employer/recruiter account
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!companyName.trim() || !industry.trim() || !amountPaid) {
      alert('Please fill in all fields.');
      return;
    }

    const newClient = {
      id: `c-${Date.now()}`,
      company: companyName,
      industry,
      package: packageType,
      amount: parseFloat(amountPaid) || 0,
      activeSeats: packageType.includes('Enterprise') ? 10 : 5,
      status: 'Active'
    };

    setClients((prev) => [newClient, ...prev]);
    setCompanyName('');
    setIndustry('');
    setAmountPaid('');
    setShowAddForm(false);
    alert(`Employer account for "${companyName}" has been successfully registered!`);
  };

  // Filter current portal transactions
  const portalTxs = transactions.filter(tx => {
    const isPortalCat = tx.category === 'Job portal' || tx.category === 'Portal subscriptions';
    if (!isPortalCat) return false;
    
    if (selectedMonth === 'All Months') return true;
    const date = new Date(tx.date);
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const txMonthYear = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    return txMonthYear === selectedMonth;
  });

  const revenue = portalTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const costs = portalTxs.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const netContribution = revenue - costs;
  const marginPct = revenue > 0 ? (netContribution / revenue) * 100 : 0;

  // Render visual segments for packages
  const activeClientsCount = clients.filter(c => c.status === 'Active').length;
  const totalActiveSeats = clients.filter(c => c.status === 'Active').reduce((sum, c) => sum + c.activeSeats, 0);

  return (
    <div className="job-portal-analytics-page animate-fade-in">
      {/* Overview Cards */}
      <section className="kpi-grid">
        <div className="kpi-card card-blue">
          <div className="kpi-header">
            <span className="kpi-title">Portal Inflows (Sub/Credits) â€¢ {selectedMonth}</span>
            <span className="kpi-icon"><Globe size={18} /></span>
          </div>
          <h2 className="kpi-value">{formatCurrency(revenue)}</h2>
          <div className="kpi-change up">
            <span>Employer Package Credit Sales</span>
          </div>
        </div>

        <div className="kpi-card card-red">
          <div className="kpi-header">
            <span className="kpi-title">Portal Overhead (Licenses & Servers)</span>
            <span className="kpi-icon"><CreditCard size={18} /></span>
          </div>
          <h2 className="kpi-value">{formatCurrency(costs)}</h2>
          <div className="kpi-change down">
            <span>Fixed Platform Costs</span>
          </div>
        </div>

        <div className="kpi-card card-green">
          <div className="kpi-header">
            <span className="kpi-title">Net Portal Cash (Profit)</span>
            <span className="kpi-icon"><ShieldCheck size={18} /></span>
          </div>
          <h2 className="kpi-value">{formatCurrency(netContribution)}</h2>
          <div className={`kpi-change ${netContribution >= 0 ? 'up' : 'down'}`}>
            <span>{marginPct.toFixed(1)}% Operating Profit Margin</span>
          </div>
        </div>
      </section>

      {/* Main Charts & Directory */}
      <div className="charts-grid-row">
        {/* Portal Engagement Visualizer */}
        <div className="dashboard-card flex-1">
          <h3 className="card-title">Portal Operations Metrics</h3>
          <div className="card-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1rem' }}>
            
            <div className="portal-stat-bar-item">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem' }}>
                <span className="font-bold">Active Recruiter Accounts</span>
                <span>{activeClientsCount} Companies</span>
              </div>
              <div className="budget-bar-track">
                <div className="budget-bar-fill" style={{ width: '78%', background: 'linear-gradient(90deg, #3b82f6, #06b6d4)' }}></div>
              </div>
            </div>

            <div className="portal-stat-bar-item">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem' }}>
                <span className="font-bold">Active Recruiter Licenses (Seats)</span>
                <span>{totalActiveSeats} / 50 Premium Seats</span>
              </div>
              <div className="budget-bar-track">
                <div className="budget-bar-fill" style={{ width: `${(totalActiveSeats/50)*100}%`, background: 'linear-gradient(90deg, #10b981, #34d399)' }}></div>
              </div>
            </div>

            <div className="portal-stat-bar-item">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem' }}>
                <span className="font-bold">Candidate Resume Searches Utilized</span>
                <span>4,120 / 5,000 queries</span>
              </div>
              <div className="budget-bar-track">
                <div className="budget-bar-fill" style={{ width: '82%', background: 'linear-gradient(90deg, #f59e0b, #fbbf24)' }}></div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Average Order Value</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#f8fafc' }}>â‚¹61,200</span>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Customer LTV (Annual)</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#f8fafc' }}>â‚¹2,45,000</span>
              </div>
            </div>

          </div>
        </div>

        {/* Recruiter Directory Table */}
        <div className="dashboard-card flex-1">
          <div className="card-header-flex">
            <h3 className="card-title">Recruiter Subscriptions</h3>
            <button 
              className="btn btn-primary"
              onClick={() => setShowAddForm(!showAddForm)}
            >
              <Plus size={16} />
              <span>Add Recruiter</span>
            </button>
          </div>

          {showAddForm && (
            <form onSubmit={handleSubmit} className="inline-add-form animate-fade-in" style={{ marginBottom: '1.25rem' }}>
              <h4>Register Recruiter Account</h4>
              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Company Name</label>
                  <input 
                    type="text" 
                    value={companyName} 
                    onChange={(e) => setCompanyName(e.target.value)} 
                    placeholder="e.g. Amazon Hub Pune" 
                    required 
                  />
                </div>
                <div className="form-group flex-1">
                  <label>Industry</label>
                  <input 
                    type="text" 
                    value={industry} 
                    onChange={(e) => setIndustry(e.target.value)} 
                    placeholder="e.g. IT Services" 
                    required 
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Package Tier</label>
                  <select value={packageType} onChange={(e) => setPackageType(e.target.value)}>
                    <option value="Enterprise Unlimited">Enterprise Unlimited</option>
                    <option value="Standard Premium">Standard Premium</option>
                    <option value="Basic Recruitment">Basic Recruitment</option>
                  </select>
                </div>
                <div className="form-group flex-1">
                  <label>Amount Paid (â‚¹)</label>
                  <input 
                    type="number" 
                    value={amountPaid} 
                    onChange={(e) => setAmountPaid(e.target.value)} 
                    placeholder="55000" 
                    required 
                  />
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Account</button>
              </div>
            </form>
          )}

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employer Company</th>
                  <th>Industry</th>
                  <th>Tier</th>
                  <th>Paid Amount</th>
                  <th>Recruiter Seats</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(c => (
                  <tr key={c.id}>
                    <td className="font-bold">{c.company}</td>
                    <td>{c.industry}</td>
                    <td style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{c.package}</td>
                    <td className="font-bold text-teal text-right">{formatCurrency(c.amount)}</td>
                    <td className="text-center">{c.activeSeats}</td>
                    <td>
                      <span className={`status-badge ${c.status.toLowerCase()}`}>
                        {c.status}
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
  );
};

export default JobPortalAnalytics;
