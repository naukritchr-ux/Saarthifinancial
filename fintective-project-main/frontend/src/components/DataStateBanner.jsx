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
          title: 'Finance connection needs attention',
          description: authError || 'The finance data address is unavailable or returned a webpage. Please contact the application administrator.',
          actionText: 'Retry'
        };

      case 'connecting':
        return {
          bg: '#f0f9ff',
          border: '#7dd3fc',
          text: '#075985',
          icon: <RefreshCw size={18} color="#0284c7" className="animate-spin" />,
          title: 'Connecting to Backend Server...',
          description: 'Loading finance records. Each section will appear as its data becomes available.',
          actionText: null
        };

      case 'cached':
        return {
          bg: '#fffbeb',
          border: '#fcd34d',
          text: '#92400e',
          icon: <Clock size={18} color="#d97706" />,
          title: 'Showing Saved Data (Backend Offline)',
          description: `Showing saved records from ${lastSyncedAt || 'a previous sync'} while the connection is unavailable. These records may be out of date.`,
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

      case 'partial':
        return {
          bg: '#fffbeb', border: '#fcd34d', text: '#92400e',
          icon: <AlertTriangle size={18} color="#d97706" />,
          title: 'Some finance sections could not refresh',
          description: 'Available records are shown. Other sections may contain saved data or be unavailable; retry to refresh them.',
          actionText: 'Retry Missing Data'
        };

      case 'offline':
      case 'sample':
      default:
        return {
          bg: '#fef2f2',
          border: '#ef4444',
          text: '#991b1b',
          icon: <ServerOff size={18} color="#dc2626" />,
          title: 'Finance data unavailable',
          description: authError || 'The finance records could not be loaded. Empty figures are not verified zero balances. Please retry.',
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
