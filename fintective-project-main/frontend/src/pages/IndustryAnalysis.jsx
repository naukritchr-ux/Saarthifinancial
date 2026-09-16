import React, { useContext, useState, useMemo } from 'react';
import { FinanceContext } from '../context/FinanceContext';
import { formatCurrency, formatLakhs } from '../utils/formatters';
import IndustryPredictiveTab from '../components/IndustryPredictiveTab';
import { 
  Briefcase, 
  Users, 
  TrendingUp, 
  Layers, 
  PieChart, 
  Sparkles, 
  Target, 
  Building2, 
  Filter, 
  CheckCircle2,
  HelpCircle
} from 'lucide-react';

const IndustryAnalysis = () => {
  const { transactions, franchisees, bdAgents, selectedMonth, selectedYear } = useContext(FinanceContext);

  // Active perspective tab: 'franchisee' | 'bd'
  const [activeTab, setActiveTab] = useState('franchisee');
  
  // Specific Entity Filters
  const [selectedFranchisee, setSelectedFranchisee] = useState('all');
  const [selectedBd, setSelectedBd] = useState('all');

  // Derive active Franchisee object for onboarding date
  const activeFranchiseeObj = useMemo(() => {
    if (selectedFranchisee === 'all') return null;
    return (franchisees || []).find(f => (f.name || '').toLowerCase() === selectedFranchisee.toLowerCase()) || null;
  }, [selectedFranchisee, franchisees]);

  // Unique list of active franchisees with deal count
  const franchiseeOptions = useMemo(() => {
    const list = [...(franchisees || [])];
    const existing = new Set(list.map(f => (f.name || '').toLowerCase()));
    (transactions || []).forEach(t => {
      const fName = (t.franchiseeName || '').trim();
      if (fName && fName.toLowerCase() !== 'unknown' && !existing.has(fName.toLowerCase())) {
        existing.add(fName.toLowerCase());
        list.push({ id: `f-tx-${fName}`, name: fName, onboardingDate: '2025-01-01' });
      }
    });
    return list;
  }, [franchisees, transactions]);

  // Unique list of active BD specialists with deal count
  const bdOptions = useMemo(() => {
    const list = [...(bdAgents || [])];
    const existing = new Set(list.map(b => (b.name || '').toLowerCase()));
    (transactions || []).forEach(t => {
      const bName = (t.bdAgentName || '').trim();
      if (bName && bName.toLowerCase() !== 'unknown' && !existing.has(bName.toLowerCase())) {
        existing.add(bName.toLowerCase());
        list.push({ id: `bd-tx-${bName}`, name: bName });
      }
    });
    return list;
  }, [bdAgents, transactions]);

  return (
    <div className="industry-analysis-page animate-fade-in" style={{ paddingBottom: '30px' }}>
      
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '22px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #0F6E56, #22314F)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 10px rgba(15, 110, 86, 0.25)'
            }}>
              <Briefcase size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: '800', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                Industry Breakdown & Predictive Potential
              </h2>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Multi-sector revenue intelligence, conversion efficiency, and predictive run-rate modeling
              </span>
            </div>
          </div>
        </div>

        {/* Perspective Tab Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <button
            onClick={() => setActiveTab('franchisee')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'franchisee' ? 'var(--accent-teal, #0F6E56)' : 'transparent',
              color: activeTab === 'franchisee' ? '#ffffff' : 'var(--text-muted)',
              fontWeight: activeTab === 'franchisee' ? '700' : '500',
              fontSize: '0.86rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <Layers size={15} />
            Franchisees Perspective
          </button>

          <button
            onClick={() => setActiveTab('bd')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'bd' ? 'var(--accent-teal, #0F6E56)' : 'transparent',
              color: activeTab === 'bd' ? '#ffffff' : 'var(--text-muted)',
              fontWeight: activeTab === 'bd' ? '700' : '500',
              fontSize: '0.86rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <TrendingUp size={15} />
            BD Specialists Perspective
          </button>
        </div>
      </div>

      {/* Filter Toolbar Card */}
      <div style={{
        background: 'var(--bg-card)',
        padding: '14px 18px',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            {activeTab === 'franchisee' ? 'Filter Franchisee Hub:' : 'Filter BD Executive:'}
          </span>
          
          {activeTab === 'franchisee' ? (
            <select
              value={selectedFranchisee}
              onChange={(e) => setSelectedFranchisee(e.target.value)}
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
              <option value="all">Network-wide (All Franchisee Hubs)</option>
              {franchiseeOptions.map(f => (
                <option key={f.id || f.name} value={f.name}>
                  {f.name} {f.city ? `(${f.city})` : ''}
                </option>
              ))}
            </select>
          ) : (
            <select
              value={selectedBd}
              onChange={(e) => setSelectedBd(e.target.value)}
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
              <option value="all">Company-wide (All BD Specialists)</option>
              {bdOptions.map(b => (
                <option key={b.id || b.name} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Quick Context Summary Tag */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.80rem', color: 'var(--text-muted)' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0F6E56', display: 'inline-block' }}></span>
          <span>
            {activeTab === 'franchisee' 
              ? (selectedFranchisee === 'all' ? 'Analyzing all partner franchise networks with 70/75% split rules' : `Focusing on ${selectedFranchisee} Hub performance`)
              : (selectedBd === 'all' ? 'Analyzing all BD specialists and conversion pipelines' : `Focusing on ${selectedBd} deal pipelines`)}
          </span>
        </div>
      </div>

      {/* Main Predictive Potential Panel */}
      <div className="dashboard-card animate-fade-in" style={{ padding: '24px' }}>
        {activeTab === 'franchisee' ? (
          <IndustryPredictiveTab
            transactions={transactions}
            entityType="franchisee"
            entityName={selectedFranchisee}
            onboardingDate={activeFranchiseeObj?.onboardingDate}
          />
        ) : (
          <IndustryPredictiveTab
            transactions={transactions}
            entityType="bd"
            entityName={selectedBd}
          />
        )}
      </div>

    </div>
  );
};

export default IndustryAnalysis;
