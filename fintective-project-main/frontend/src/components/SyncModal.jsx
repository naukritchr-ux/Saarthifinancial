import React, { useState, useContext } from 'react';
import { FinanceContext, API_BASE_URL } from '../context/FinanceContext';
import { X, RefreshCw, Globe, CheckCircle2, AlertTriangle, Play } from 'lucide-react';

const SyncModal = ({ isOpen, onClose }) => {
  const { addTransaction, transactions } = useContext(FinanceContext);
  const [apiUrl, setApiUrl] = useState(`${API_BASE_URL}/transactions`);
  const [syncLogs, setSyncLogs] = useState([]);
  const [status, setStatus] = useState('idle'); // idle, loading, success, error
  const [importedCount, setImportedCount] = useState(0);

  if (!isOpen) return null;

  const addLog = (message, type = 'info') => {
    setSyncLogs((prev) => [...prev, { time: new Date().toLocaleTimeString(), message, type }]);
  };

  const handleRealFetch = async () => {
    setStatus('loading');
    setSyncLogs([]);
    addLog(`Initiating HTTP request to ${apiUrl}...`, 'info');
    
    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`HTTP Error: status ${response.status}`);
      }
      
      addLog('Connection established successfully. Fetching payload...', 'info');
      const data = await response.json();
      
      addLog(`Received transaction payload. Validating ${Array.isArray(data) ? data.length : 0} items...`, 'info');
      
      if (!Array.isArray(data)) {
        throw new Error('Invalid data format. Expected an array of transactions.');
      }

      let count = 0;
      data.forEach((item) => {
        // Validate transaction schema
        if (item.title && item.amount && item.type) {
          addTransaction({
            title: item.title,
            amount: parseFloat(item.amount) || 0,
            type: item.type === 'income' ? 'income' : 'expense',
            category: item.category || 'Other',
            subCategory: item.subCategory || 'API Sync',
            date: item.date || new Date().toISOString().split('T')[0],
            paymentMode: item.paymentMode || 'Net Banking',
            referenceId: item.referenceId || `SYNC-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
            description: item.description || 'Imported via API Sync from main site.'
          });
          count++;
        }
      });

      setImportedCount(count);
      addLog(`Import complete! Successfully saved ${count} entries to local storage.`, 'success');
      setStatus('success');
    } catch (err) {
      addLog(`Fetch failed: ${err.message}`, 'error');
      addLog('Suggestion: Check server CORS configuration or endpoint format.', 'warning');
      setStatus('error');
    }
  };

  const handleSimulatedFetch = () => {
    setStatus('loading');
    setSyncLogs([]);
    
    const steps = [
      { msg: 'Connecting to Saarthi Central Main Database...', type: 'info', delay: 400 },
      { msg: 'Authentication token verified (admin-session).', type: 'success', delay: 800 },
      { msg: 'Downloading latest cash ledger transaction logs...', type: 'info', delay: 1300 },
      { msg: 'Received 4 new ledger transactions.', type: 'info', delay: 1800 },
      { msg: 'Reconciling transaction balances down to the single rupee...', type: 'info', delay: 2200 },
      { msg: 'Importing Nagpur Hub franchisee royalties: +₹65,000.00', type: 'success', delay: 2500 },
      { msg: 'Importing Job Portal subscription revenue: +₹1,24,500.00', type: 'success', delay: 2800 },
      { msg: 'Importing Portal Recruiter subscription overhead: -₹16,000.00', type: 'warning', delay: 3100 },
      { msg: 'Sync complete! Recalculating cash flows...', type: 'success', delay: 3400 }
    ];

    steps.forEach((step) => {
      setTimeout(() => {
        addLog(step.msg, step.type);
        if (step.msg.startsWith('Sync complete')) {
          // Actually insert mock records to test UI update
          const today = new Date().toISOString().split('T')[0];
          
          addTransaction({
            title: 'Nagpur Central Hub - Royalty Sync',
            amount: 65000.00,
            type: 'income',
            category: 'Franchisee fee',
            subCategory: 'Royalty Sync',
            date: today,
            paymentMode: 'Net Banking',
            referenceId: `REF-SYNC-${Date.now().toString().slice(-4)}A`,
            description: 'Automated live sync of Nagpur royalties from main site.'
          });

          addTransaction({
            title: 'Job Portal - Bulk Subscription Sync',
            amount: 124500.00,
            type: 'income',
            category: 'Job portal',
            subCategory: 'Package Sales',
            date: today,
            paymentMode: 'Credit Card',
            referenceId: `REF-SYNC-${Date.now().toString().slice(-4)}B`,
            description: 'Job portal subscription sales batches fetched from main site.'
          });

          addTransaction({
            title: 'LinkedIn Recruiter Licenses Sync',
            amount: 16000.00,
            type: 'expense',
            category: 'Portal subscriptions',
            subCategory: 'Recruiter Seats',
            date: today,
            paymentMode: 'Credit Card',
            referenceId: `REF-SYNC-${Date.now().toString().slice(-4)}C`,
            description: 'Recruiter seat billing automatically imported.'
          });

          setImportedCount(3);
          setStatus('success');
        }
      }, step.delay);
    });
  };

  return (
    <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
      <div className="modal-container sync-modal animate-slide-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px', width: '90%' }}>
        <div className="modal-header">
          <div className="modal-header-title">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RefreshCw className={status === 'loading' ? 'spinning' : ''} size={20} />
              <span>Main Site Data Sync Center</span>
            </h3>
            <span className="modal-subtitle">Fetch transaction amounts and synchronize ledgers in real-time</span>
          </div>
          <button className="modal-close-btn" onClick={onClose} disabled={status === 'loading'}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '1.5rem' }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 'bold', color: '#94a3b8' }}>
              <Globe size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
              Main Site REST API Endpoint URL
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://saarthiapps.com/api/v1/finance/transactions"
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  color: '#f8fafc',
                  fontSize: '0.85rem'
                }}
                disabled={status === 'loading'}
              />
              <button
                className="btn btn-primary"
                onClick={handleRealFetch}
                disabled={status === 'loading' || !apiUrl.trim()}
                style={{ minWidth: '100px' }}
              >
                Sync URL
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>No API setup? Test the sync workflow:</span>
            <button
              onClick={handleSimulatedFetch}
              disabled={status === 'loading'}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '6px 12px', border: '1px dashed var(--accent-teal)', color: '#2dd4bf' }}
            >
              <Play size={12} />
              Simulate Live Fetch
            </button>
          </div>

          {/* Connection Logs Console */}
          <div style={{ background: '#0b132b', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '12px', height: '200px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.75rem', color: '#cbd5e1' }}>
            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px', marginBottom: '8px', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
              <span>SYSTEM CONNECTION LOGS</span>
              <span>STATUS: {status.toUpperCase()}</span>
            </div>
            {syncLogs.length === 0 ? (
              <div style={{ color: '#64748b', padding: '12px 0', textAlign: 'center' }}>Console idle. Click sync button above to establish connection.</div>
            ) : (
              syncLogs.map((log, index) => {
                let color = '#94a3b8';
                if (log.type === 'success') color = '#10b981';
                if (log.type === 'error') color = '#ef4444';
                if (log.type === 'warning') color = '#f59e0b';
                return (
                  <div key={index} style={{ marginBottom: '4px', lineHeight: '1.4' }}>
                    <span style={{ color: '#475569', marginRight: '6px' }}>[{log.time}]</span>
                    <span style={{ color }}>{log.message}</span>
                  </div>
                );
              })
            )}
          </div>

          {status === 'success' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '1rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', padding: '10px 12px', borderRadius: '6px' }}>
              <CheckCircle2 color="#10b981" size={20} />
              <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                <strong style={{ color: '#10b981' }}>Success!</strong> Imported {importedCount} new entries. Net cash balance has been recalculated.
              </div>
            </div>
          )}

          {status === 'error' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '1rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: '10px 12px', borderRadius: '6px' }}>
              <AlertTriangle color="#ef4444" size={20} />
              <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                <strong style={{ color: '#ef4444' }}>Sync Failed.</strong> Could not fetch data. Please try the <strong>Simulate Live Fetch</strong> option.
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ padding: '1rem 1.5rem', background: 'rgba(255,255,255,0.01)', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={status === 'loading'}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SyncModal;
