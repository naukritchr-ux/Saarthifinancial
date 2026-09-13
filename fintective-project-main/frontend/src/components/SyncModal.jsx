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
      
      if (result.success && result.data?.ok !== false) {
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
        // Refresh dashboard data after successful sync
        fetchAllData();
      } else {
        const errMsg = result.error || result.data?.error || (result.data?.errors && result.data.errors.join(', ')) || 'Live sync failed or was rejected by backend.';
        addLog(`❌ Sync Failed: ${errMsg}`, 'error');
        setStatus('error');
      }
    } catch (err) {
      addLog(`💥 Connection/Sync Error: ${err.message}`, 'error');
      setStatus('error');
    }
  };

  return (
    <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
      <div className="modal-container sync-modal animate-slide-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px', width: '92%', backgroundColor: '#FFFFFF', border: '1px solid #E3E5E0', color: '#1B2321', borderRadius: '14px', boxShadow: '0 20px 45px -10px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
        <div className="modal-header" style={{ borderBottom: '1px solid #E3E5E0', padding: '18px 24px', backgroundColor: '#FAFBFA', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="modal-header-title">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1B2321', margin: 0, fontSize: '1.05rem', fontWeight: '700' }}>
              <RefreshCw className={status === 'loading' ? 'spinning' : ''} size={19} style={{ stroke: '#0F6E56' }} />
              <span>Saarthi 360 CRM Live Sync Center</span>
            </h3>
            <span className="modal-subtitle" style={{ color: '#6B7268', fontSize: '0.8rem', display: 'block', marginTop: '2px' }}>
              Synchronize live recruitment, invoice, client, and expense streams directly into Aiven MySQL
            </span>
          </div>
          <button className="modal-close-btn" onClick={onClose} disabled={status === 'loading'} style={{ background: '#F1F3F0', border: 'none', color: '#1B2321', cursor: 'pointer', borderRadius: '6px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '20px 24px' }}>
          
          {/* Main Sync Trigger Box */}
          <div style={{
            background: '#F6F7F4',
            border: '1px solid #E3E5E0',
            borderRadius: '10px',
            padding: '16px',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div>
              <div style={{ fontSize: '0.92rem', fontWeight: '700', color: '#1B2321', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Database size={16} color="#0F6E56" />
                <span>Sync All Saarthi CRM Endpoints</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#6B7268', marginTop: '3px' }}>
                Fetches Enquiries, Invoices, Franchisees, Expenses, Clients & Legals directly from <code>api.sarthi360.in</code>
              </div>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleSaarthiLiveSync}
              disabled={status === 'loading'}
              style={{
                backgroundColor: '#0F6E56',
                color: '#FFFFFF',
                border: 'none',
                boxShadow: '0 2px 6px rgba(15, 110, 86, 0.25)',
                padding: '10px 18px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                minWidth: '140px',
                justifyContent: 'center',
                borderRadius: '8px',
                cursor: status === 'loading' ? 'not-allowed' : 'pointer'
              }}
            >
              <RefreshCw className={status === 'loading' ? 'spinning' : ''} size={15} />
              {status === 'loading' ? 'Syncing...' : 'Start Live Sync'}
            </button>
          </div>

          {/* Metrics summary cards (when synced) */}
          {syncStats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '1.25rem' }}>
              <div style={{ background: '#FFFFFF', border: '1px solid #E3E5E0', borderRadius: '8px', padding: '10px 12px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: '#6B7268', display: 'block', fontWeight: '500' }}>Invoices</span>
                <span style={{ fontSize: '1.15rem', fontWeight: '700', color: '#0F6E56' }}>{syncStats.invoices || 0}</span>
              </div>
              <div style={{ background: '#FFFFFF', border: '1px solid #E3E5E0', borderRadius: '8px', padding: '10px 12px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: '#6B7268', display: 'block', fontWeight: '500' }}>Enquiries</span>
                <span style={{ fontSize: '1.15rem', fontWeight: '700', color: '#22314F' }}>{syncStats.enquiries || 0}</span>
              </div>
              <div style={{ background: '#FFFFFF', border: '1px solid #E3E5E0', borderRadius: '8px', padding: '10px 12px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: '#6B7268', display: 'block', fontWeight: '500' }}>Franchisees</span>
                <span style={{ fontSize: '1.15rem', fontWeight: '700', color: '#B7791F' }}>{syncStats.franchisees || 0}</span>
              </div>
            </div>
          )}

          {/* Connection Logs Console */}
          <div style={{
            background: '#1B2321',
            border: '1px solid #2D3A37',
            borderRadius: '8px',
            padding: '12px',
            height: '200px',
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            color: '#E3E5E0'
          }}>
            <div style={{
              borderBottom: '1px solid #2D3A37',
              paddingBottom: '6px',
              marginBottom: '8px',
              color: '#8A9692',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Server size={12} color="#8A9692" />
                <span>SAARTHI CRM SYNC ENGINE CONSOLE</span>
              </span>
              <span style={{
                color: status === 'loading' ? '#F59E0B' : status === 'success' ? '#10B981' : status === 'error' ? '#EF4444' : '#8A9692',
                fontWeight: 'bold'
              }}>
                STATUS: {status.toUpperCase()}
              </span>
            </div>

            {syncLogs.length === 0 ? (
              <div style={{ color: '#8A9692', padding: '24px 0', textAlign: 'center' }}>
                Ready to sync. Click "Start Live Sync" to fetch live data from Saarthi 360 CRM and update MySQL.
              </div>
            ) : (
              syncLogs.map((log, index) => {
                let color = '#CBD5E1';
                if (log.type === 'success') color = '#34D399';
                if (log.type === 'error') color = '#F87171';
                if (log.type === 'warning') color = '#FBBF24';
                return (
                  <div key={index} style={{ marginBottom: '4px', lineHeight: '1.4' }}>
                    <span style={{ color: '#64748B', marginRight: '6px' }}>[{log.time}]</span>
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
              background: '#E6F4EA',
              border: '1px solid #CEEAD6',
              padding: '10px 14px',
              borderRadius: '8px'
            }}>
              <CheckCircle2 color="#0F6E56" size={20} />
              <div style={{ fontSize: '0.85rem', color: '#0F6E56' }}>
                <strong>Live CRM Sync Complete!</strong> Database tables updated and all dashboard analytics refreshed.
              </div>
            </div>
          )}

          {status === 'error' && (
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              marginTop: '1rem',
              background: '#FDF2F2',
              border: '1px solid #F8D7DA',
              padding: '10px 14px',
              borderRadius: '8px'
            }}>
              <AlertTriangle color="#A8402E" size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '0.85rem', color: '#A8402E', flex: 1 }}>
                <strong>Sync Failed.</strong>{' '}
                {syncLogs.filter(l => l.type === 'error').map(l => l.message.replace('❌ Sync Failed: ', '')).join(' ')||'Please check backend server connection or Aiven database connectivity.'}
              </div>
              <button
                onClick={handleSaarthiLiveSync}
                style={{ background: '#F8D7DA', border: '1px solid #F5C6CB', borderRadius: '6px', color: '#A8402E', padding: '4px 10px', fontSize: '0.78rem', cursor: 'pointer', flexShrink: 0, fontWeight: '600' }}
              >
                Retry
              </button>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ padding: '14px 24px', background: '#F8F9FA', borderTop: '1px solid #E3E5E0', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={status === 'loading'} style={{ backgroundColor: '#FFFFFF', border: '1px solid #D1D5DB', color: '#374151', padding: '8px 16px', borderRadius: '8px', fontWeight: '500', cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SyncModal;
