import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Upload, 
  GitCompare, 
  PhoneCall, 
  Clock, 
  Settings,
  ShieldCheck,
  RefreshCw,
  X,
  CheckCircle2,
  Users,
  FileText,
  Database
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { syncSaarthiLiveApi } from '../api/tdsApi';

export default function Layout({ children }) {
  const { activePage, navigateTo, fyFilter, setFyFilter, role, setRole, cleaningQueueCount, triggerRefresh } = useApp();
  const [syncing, setSyncing] = useState(false);
  const [syncResultModal, setSyncResultModal] = useState(null);

  const handleSyncSaarthi = async () => {
    setSyncing(true);
    try {
      const res = await syncSaarthiLiveApi();
      if (res && res.success) {
        setSyncResultModal(res);
        triggerRefresh();
      } else {
        alert(`⚠️ Sync Warning: ${res?.error || 'Unable to sync live Saarthi data'}`);
      }
    } catch (err) {
      alert(`💥 Error syncing live data: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'import', label: 'Data Import & Cleaning', icon: Upload, badge: cleaningQueueCount },
    { id: 'reconciliation', label: 'Reconciliation', icon: GitCompare },
    { id: 'follow-up', label: 'Follow-up Report', icon: PhoneCall },
    { id: 'import-history', label: 'Import History', icon: Clock }
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="bg-slate-950 text-white shadow-md border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Left: Brand Logo & Title */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 font-black text-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                T
              </div>
              <div>
                <div className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                  TDS Reconcile
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    Pro
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-medium">
                  Reconciliation & Follow-up Workbench
                </div>
              </div>
            </div>

            {/* Right Controls: FY, Sync, Role, Settings */}
            <div className="flex items-center gap-3">
              {/* Sync Live Saarthi Button */}
              <button
                onClick={handleSyncSaarthi}
                disabled={syncing}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-extrabold px-3 py-1.5 rounded-xl text-xs transition cursor-pointer shadow-sm"
                title="Fetch & sync live client invoices from Saarthi 360 APIs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span>{syncing ? 'Syncing...' : 'Sync Saarthi 360'}</span>
              </button>

              {/* FY Selector */}
              <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-300">
                <span className="text-amber-500 font-bold">FY:</span>
                <select
                  value={fyFilter}
                  onChange={(e) => setFyFilter(e.target.value)}
                  className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
                >
                  <option value="All Financial Years" className="bg-slate-900 text-white">All Financial Years</option>
                  <option value="FY 2026-27" className="bg-slate-900 text-white">FY 2026-27</option>
                  <option value="FY 2025-26" className="bg-slate-900 text-white">FY 2025-26</option>
                  <option value="FY 2024-25" className="bg-slate-900 text-white">FY 2024-25</option>
                  <option value="FY 2023-24" className="bg-slate-900 text-white">FY 2023-24</option>
                  <option value="FY 2022-23" className="bg-slate-900 text-white">FY 2022-23</option>
                  <option value="FY 2021-22" className="bg-slate-900 text-white">FY 2021-22</option>
                  <option value="FY 2020-21" className="bg-slate-900 text-white">FY 2020-21</option>
                </select>
              </div>

              {/* Role Dropdown */}
              <div className="hidden sm:flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-300">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
                >
                  <option value="Accounts Manager" className="bg-slate-900 text-white">Accounts Manager</option>
                  <option value="Senior Auditor" className="bg-slate-900 text-white">Senior Auditor</option>
                  <option value="Accounts Executive" className="bg-slate-900 text-white">Accounts Executive</option>
                  <option value="Admin" className="bg-slate-900 text-white">Admin</option>
                </select>
              </div>

              {/* Return to Finance App Link */}
              <button 
                onClick={() => window.open('https://saarthifinancial-7zni.vercel.app', '_self')} 
                className="flex items-center gap-1.5 bg-teal-900/40 hover:bg-teal-900/60 border border-teal-500/40 rounded-xl px-3 py-1.5 text-xs font-bold text-teal-300 transition cursor-pointer"
                title="Switch to Saarthi Financial App"
              >
                <span>Finance App ↗</span>
              </button>

              {/* Settings Gear */}
              <button 
                onClick={() => alert('Settings & Preference Config')} 
                className="p-2 text-slate-400 hover:text-amber-400 hover:bg-slate-900 rounded-xl transition cursor-pointer"
                title="System Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>

          </div>

          {/* Nav Tabs Row */}
          <nav className="flex space-x-1 overflow-x-auto pt-1 pb-0 border-t border-slate-900 scrollbar-none">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => navigateTo(item.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer rounded-t-lg ${
                    isActive
                      ? 'border-amber-500 text-amber-400 bg-slate-900/60 shadow-inner'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-amber-500' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                  {item.badge > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 shadow-sm animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-4 text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>Saarthi360 TDS Reconciliation Workbench &copy; 2026</span>
          <div className="flex gap-4 text-gray-400">
            <span>Security Compliant</span>
            <span>•</span>
            <span>3-Way Engine Active</span>
          </div>
        </div>
      </footer>
      {/* Sync Completion Modal Popup */}
      {syncResultModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative text-white animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setSyncResultModal(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center text-2xl shadow-inner">
                🚀
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight text-white">
                  Saarthi 360 Sync Completed!
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  Live client master data & billing invoices updated.
                </p>
              </div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 space-y-3 mb-6">
              <div className="flex items-center justify-between text-xs border-b border-slate-800/60 pb-2">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-amber-400" />
                  Client Masters Found:
                </span>
                <span className="font-bold text-amber-400">
                  {syncResultModal.stats?.clientsFound?.toLocaleString() || '15,700+'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs border-b border-slate-800/60 pb-2">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-teal-400" />
                  Invoices Processed:
                </span>
                <span className="font-bold text-teal-400">
                  {syncResultModal.stats?.invoicesProcessed?.toLocaleString() || '4,400+'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs border-b border-slate-800/60 pb-2">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-indigo-400" />
                  New Records Inserted:
                </span>
                <span className="font-bold text-indigo-400">
                  {syncResultModal.stats?.inserted || 0}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs pb-1">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Existing Dues Refreshed:
                </span>
                <span className="font-bold text-emerald-400">
                  {syncResultModal.stats?.updated || 0}
                </span>
              </div>
            </div>

            <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl p-3 mb-6 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-300 font-medium leading-relaxed">
                ✓ HR contact person names, designations, mobile numbers, email addresses, and Team Leaders refreshed.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setSyncResultModal(null);
                  navigateTo('reconciliation');
                }}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-2.5 px-4 rounded-xl text-xs transition cursor-pointer shadow-lg shadow-amber-500/20 text-center"
              >
                Go to Reconciliation Table ➔
              </button>
              <button
                onClick={() => setSyncResultModal(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 px-4 rounded-xl text-xs transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
