import React, { useState, useContext } from 'react';
import { FinanceContext, API_BASE_URL } from '../context/FinanceContext';
import { X, RefreshCw, Globe, CheckCircle2, AlertTriangle, Play, Database, Server, Check } from 'lucide-react';

const SyncModal = ({ isOpen, onClose }) => {
  const { syncWithSaarthi, fetchAllData } = useContext(FinanceContext);
  const [syncLogs, setSyncLogs] = useState([]);
  const [status, setStatus] = useState('idle'); // idle, loading, success, error
  const [syncStats, setSyncStats] = useState(null);

  if (!isOpen) return null;

  const addLog = (message, type = 'info') => {
    setSyncLogs((prev) => [...prev, { time: new Date().toLocaleTimeString(), message, type }]);
  };

  const handleSaarthiLiveSync = async () => {
    setStatus('loading');
    setSyncLogs([]);
    setSyncStats(null);
    addLog('Connecting to Saarthi Live CRM endpoints (api.sarthi360.in)...', 'info');
    
    try {
      addLog('Initiating multi-channel sync for Enquiries, Invoices, Franchisees, Expenses, Clients & Legals...', 'info');
      const result = await syncWithSaarthi();
      
      if (result.success) {
        const d = result.data || {};
        setSyncStats(d);
        addLog(`✅ Franchisees Synced: ${d.franchisees || 0} records`, 'success');
        addLog(`✅ Enquiries Synced: ${d.enquiries || 0} records`, 'success');
        addLog(`✅ Invoices Synced: ${d.invoices || 0} records`, 'success');
        addLog(`✅ Live Expenses Synced: ${d.expenses || 0} records`, 'success');
        addLog(`✅ Clients Master Synced: ${d.clients || 0} records`, 'success');
        addLog(`✅ Legal Records Synced: ${d.legals || 0} records`, 'success');
        if (d.errors && d.errors.length > 0) {
          d.errors.forEach(err => addLog(`⚠️ Notice: ${err}`, 'warning'));
        }
        addLog(`🎉 All Saarthi CRM records written to MySQL (crm_db) in ${(d.duration_seconds || 0).toFixed(2)}s!`, 'success');
        setStatus('success');
      } else {
        addLog(`💥 Sync failed: ${result.error || 'Server error'}`, 'error');
        setStatus('error');
      }
    } catch (err) {
      addLog(`💥 Connection Error: ${err.message}`, 'error');
      setStatus('error');
    }
  };

  return (
    <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
      <div className="modal-container sync-modal animate-slide-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px', width: '92%' }}>
        <div className="modal-header">
          <div className="modal-header-title">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RefreshCw className={status === 'loading' ? 'spinning' : ''} size={20} color="#38bdf8" />
              <span>Saarthi 360 CRM Live Sync Center</span>
            </h3>
            <span className="modal-subtitle">Synchronize live recruitment, invoice, client, and expense streams directly into Aiven MySQL</span>
          </div>
          <button className="modal-close-btn" onClick={onClose} disabled={status === 'loading'}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '1.5rem' }}>
          
          {/* Main Sync Trigger Box */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '10px',
            padding: '16px',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Database size={16} color="#38bdf8" />
                <span>Sync All Saarthi CRM Endpoints</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '3px' }}>
                Fetches Enquiries, Invoices, Franchisees, Expenses, Clients & Legals directly from <code>api.sarthi360.in</code>
              </div>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleSaarthiLiveSync}
              disabled={status === 'loading'}
              style={{
                background: 'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)',
                boxShadow: '0 4px 12px rgba(14, 165, 233, 0.3)',
                padding: '10px 18px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                minWidth: '140px',
                justifyContent: 'center'
              }}
            >
              <RefreshCw className={status === 'loading' ? 'spinning' : ''} size={15} />
              {status === 'loading' ? 'Syncing...' : 'Start Live Sync'}
            </button>
          </div>

          {/* Metrics summary cards (when synced) */}
          {syncStats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '1.25rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '8px 12px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block' }}>Invoices</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#38bdf8' }}>{syncStats.invoices || 0}</span>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '8px 12px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block' }}>Enquiries</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#818cf8' }}>{syncStats.enquiries || 0}</span>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '8px 12px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block' }}>Franchisees</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#34d399' }}>{syncStats.franchisees || 0}</span>
              </div>
            </div>
          )}

          {/* Connection Logs Console */}
          <div style={{
            background: '#070d1e',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px',
            padding: '12px',
            height: '210px',
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            color: '#cbd5e1'
          }}>
            <div style={{
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              paddingBottom: '6px',
              marginBottom: '8px',
              color: '#64748b',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Server size={12} color="#94a3b8" />
                <span>SAARTHI CRM SYNC ENGINE CONSOLE</span>
              </span>
              <span style={{
                color: status === 'loading' ? '#f59e0b' : status === 'success' ? '#10b981' : status === 'error' ? '#ef4444' : '#64748b',
                fontWeight: 'bold'
              }}>
                STATUS: {status.toUpperCase()}
              </span>
            </div>

            {syncLogs.length === 0 ? (
              <div style={{ color: '#64748b', padding: '24px 0', textAlign: 'center' }}>
                Ready to sync. Click "Start Live Sync" to fetch live data from Saarthi 360 CRM and update MySQL.
              </div>
            ) : (
              syncLogs.map((log, index) => {
                let color = '#94a3b8';
                if (log.type === 'success') color = '#34d399';
                if (log.type === 'error') color = '#f87171';
                if (log.type === 'warning') color = '#fbbf24';
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
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginTop: '1rem',
              background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.25)',
              padding: '10px 14px',
              borderRadius: '8px'
            }}>
              <CheckCircle2 color="#34d399" size={22} />
              <div style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>
                <strong style={{ color: '#34d399' }}>Live CRM Sync Complete!</strong> Database tables updated and all dashboard analytics refreshed.
              </div>
            </div>
          )}

          {status === 'error' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginTop: '1rem',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.25)',
              padding: '10px 14px',
              borderRadius: '8px'
            }}>
              <AlertTriangle color="#f87171" size={22} />
              <div style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>
                <strong style={{ color: '#f87171' }}>Sync Failed.</strong> Please check backend server connection or Aiven database connectivity.
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ padding: '1rem 1.5rem', background: 'rgba(255,255,255,0.01)', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={status === 'loading'}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SyncModal;
