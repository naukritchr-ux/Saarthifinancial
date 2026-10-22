import React, { useState } from 'react';
import LedgerTab from './LedgerTab';
import MlInsightsTab from './MlInsightsTab';
import './Reports.css';

export default function Reports() {
  const [activeTab, setActiveTab] = useState('ledger'); // 'ledger' | 'ml'

  return (
    <div className="rep-page animate-fade-in">
      {/* Sub-tab Navigation */}
      <div className="rep-tab-nav no-print">
        <button
          type="button"
          className={`rep-tab-btn ${activeTab === 'ledger' ? 'active' : ''}`}
          onClick={() => setActiveTab('ledger')}
        >
          General Transaction Ledger
        </button>
        <button
          type="button"
          className={`rep-tab-btn ${activeTab === 'ml' ? 'active' : ''}`}
          onClick={() => setActiveTab('ml')}
        >
          AI & Machine Learning Insights
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'ledger' && <LedgerTab />}
      {activeTab === 'ml' && <MlInsightsTab />}
    </div>
  );
}
