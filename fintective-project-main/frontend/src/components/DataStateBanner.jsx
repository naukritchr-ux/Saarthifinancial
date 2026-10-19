import React, { useContext } from 'react';
import { FinanceContext } from '../context/FinanceContext';
import { AlertTriangle, AlertCircle, RefreshCw, KeyRound, ServerOff, Clock } from 'lucide-react';

export const DataStateBanner = () => {
  const {
    dataState,
    lastSyncedAt,
    authError,
    connectionProgress,
    fetchAllData,
    isBackgroundSyncing,
    backendHealth
  } = useContext(FinanceContext);

  // When data is live, do not show any warning banner
  if (dataState === 'live') {
    return null;
  }

  const renderBannerContent = () => {
    switch (dataState) {
      case 'auth_error':
        return {
          bg: '#fef2f2',
          border: '#f87171',
          text: '#991b1b',
          icon: <KeyRound size={18} color="#dc2626" />,
          title: 'Authentication Error — Missing or Invalid API Key',
          description: authError || 'API rejected request with 401 Unauthorized. Verify VITE_API_KEY in your environment configuration.',
          actionText: 'Retry Auth'
        };

      case 'routing_error':
        return {
          bg: '#fef2f2',
          border: '#f87171',
          text: '#991b1b',
          icon: <AlertTriangle size={18} color="#dc2626" />,
          title: 'Configuration Error — API Returned HTML',
          description: 'API endpoint returned HTML (SPA catch-all rewrite). Check Vercel rewrites and ensure VITE_API_URL points to the backend server.',
          actionText: 'Retry'
        };

      case 'connecting':
        return {
          bg: '#f0f9ff',
          border: '#7dd3fc',
          text: '#075985',
          icon: <RefreshCw size={18} color="#0284c7" className="animate-spin" />,
          title: 'Connecting to Backend Server...',
          description: `Waking up Render backend (${connectionProgress?.elapsedSec || 0}s elapsed). Hosted instances spin down after inactivity and may take 30–50s to cold-start. Please wait...`,
          actionText: null
        };

      case 'cached':
        return {
          bg: '#fffbeb',
          border: '#fcd34d',
          text: '#92400e',
          icon: <Clock size={18} color="#d97706" />,
          title: 'Showing Saved Data (Backend Offline)',
          description: `Backend is unreachable. Displaying saved data from ${lastSyncedAt || 'a previous sync'}. Live synchronization is paused.`,
          actionText: 'Retry Connection'
        };

      case 'crm_limited':
        return {
          bg: '#fff7ed',
          border: '#fdba74',
          text: '#9a3412',
          icon: <AlertCircle size={18} color="#ea580c" />,
          title: 'Limited Data Mode (Direct CRM API)',
          description: 'Backend is offline. Viewing raw recruitment data directly from api.sarthi360.in. Exclusions, deduplication, and ML models are unavailable in this mode.',
          actionText: 'Reconnect Backend'
        };

      case 'sample':
      default:
        return {
          bg: '#fef2f2',
          border: '#ef4444',
          text: '#991b1b',
          icon: <ServerOff size={18} color="#dc2626" />,
          title: 'Sample Data. Not Real Numbers',
          description: 'Both the backend server and live CRM APIs are unreachable. Displaying sample numbers for UI preview. DO NOT use these figures for business decisions.',
          actionText: 'Retry Sync'
        };
    }
  };

  const banner = renderBannerContent();

  return (
    <div
      role="alert"
      id="fintective-data-state-banner"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        padding: '10px 16px',
        margin: '0 0 16px 0',
        borderRadius: '8px',
        backgroundColor: banner.bg,
        border: `1.5px solid ${banner.border}`,
        color: banner.text,
        fontSize: '13px',
        fontWeight: '500',
        boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 300px' }}>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          {banner.icon}
        </div>
        <div>
          <strong style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '2px' }}>
            {banner.title}
          </strong>
          <span style={{ fontSize: '12px', opacity: 0.95 }}>
            {banner.description}
          </span>
          {backendHealth?.lastChecked && (
            <span style={{ fontSize: '11px', display: 'block', marginTop: '2px', opacity: 0.75 }}>
              Database Host: {backendHealth.host || 'Unknown'} • DB Connected: {backendHealth.isDbConnected ? 'Yes' : 'No'}
            </span>
          )}
        </div>
      </div>

      {banner.actionText && (
        <button
          onClick={() => fetchAllData(true)}
          disabled={isBackgroundSyncing}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#ffffff',
            color: banner.text,
            border: `1px solid ${banner.border}`,
            borderRadius: '6px',
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: isBackgroundSyncing ? 'not-allowed' : 'pointer',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            transition: 'background-color 0.15s ease'
          }}
        >
          <RefreshCw size={12} className={isBackgroundSyncing ? 'animate-spin' : ''} />
          {isBackgroundSyncing ? 'Checking...' : banner.actionText}
        </button>
      )}
    </div>
  );
};

export default DataStateBanner;
