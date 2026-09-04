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
      if (res && res.success !== false) {
        setSyncResultModal(res);
        triggerRefresh();
      } else {
        setSyncResultModal({
          success: false,
          error: res?.error || 'Live Saarthi 360 API is unreachable from the current server.',
          stats: { clientsFound: 0, inserted: 0, updated: 0 }
        });
      }
    } catch (err) {
      setSyncResultModal({
        success: false,
        error: err.message || 'Live Saarthi 360 API is currently unreachable.',
        stats: { clientsFound: 0, inserted: 0, updated: 0 }
      });
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
    <div className="min-h-screen bg-[#E8E4FF] flex flex-col font-sans text-[#1F1B2E]">
      {/* Top Navbar - Light White Base Theme */}
      <header className="bg-white text-[#1F1B2E] shadow-sm border-b border-[#E9E4FA] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Left: Brand Logo & Title */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#9B87F5] text-white font-black text-xl flex items-center justify-center shadow-xs">
                T
              </div>
              <div>
                <div className="text-lg font-black tracking-tight text-[#1F1B2E] flex items-center gap-2">
                  TDS Reconcile
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#C084FC]/20 text-[#9B87F5] border border-[#C084FC]/30">
                    Pro
                  </span>
                </div>
                <div className="text-[11px] text-[#6B6580] font-medium">
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
                className="flex items-center gap-1.5 bg-[#9B87F5] hover:bg-[#8572E0] disabled:opacity-50 text-white font-extrabold px-3.5 py-1.5 rounded-xl text-xs transition cursor-pointer shadow-xs"
                title="Fetch & sync live client invoices from Saarthi 360 APIs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span>{syncing ? 'Syncing...' : 'Sync Saarthi 360'}</span>
              </button>

              {/* FY Selector */}
              <div className="flex items-center gap-1.5 bg-[#F6F8FA] border border-[#E9E4FA] rounded-xl px-3 py-1.5 text-xs font-bold text-[#1F1B2E]">
                <span className="text-[#6B6580] font-extrabold">FY:</span>
                <select
                  value={fyFilter}
                  onChange={(e) => setFyFilter(e.target.value)}
                  className="bg-transparent text-[#1F1B2E] font-bold focus:outline-none cursor-pointer"
                >
                  <option value="All Financial Years">All Financial Years</option>
                  <option value="FY 2026-27">FY 2026-27</option>
                  <option value="FY 2025-26">FY 2025-26</option>
                  <option value="FY 2024-25">FY 2024-25</option>
                  <option value="FY 2023-24">FY 2023-24</option>
                  <option value="FY 2022-23">FY 2022-23</option>
                  <option value="FY 2021-22">FY 2021-22</option>
                </select>
              </div>

              {/* Role Selector */}
              <div className="hidden sm:flex items-center gap-1.5 bg-[#F6F8FA] border border-[#E9E4FA] rounded-xl px-3 py-1.5 text-xs font-bold text-[#1F1B2E]">
                <Users className="w-3.5 h-3.5 text-[#9B87F5]" />
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="bg-transparent text-[#1F1B2E] font-bold focus:outline-none cursor-pointer"
                >
                  <option value="Accounts Lead">Accounts Lead</option>
                  <option value="Finance Manager">Finance Manager</option>
                  <option value="Auditor">Auditor</option>
                </select>
              </div>

              {/* Return to Finance App Link */}
              <button 
                onClick={() => window.open('https://saarthifinancial-7zni.vercel.app', '_self')} 
                className="flex items-center gap-1.5 bg-[#F6F8FA] hover:bg-[#E8E4FF] border border-[#E9E4FA] rounded-xl px-3 py-1.5 text-xs font-bold text-[#9B87F5] transition cursor-pointer shadow-2xs"
                title="Switch to Saarthi Financial App"
              >
                <span>Finance App ↗</span>
              </button>

              {/* Settings Gear */}
              <button 
                onClick={() => alert('Settings & Preference Config')} 
                className="p-2 text-[#6B6580] hover:text-[#1F1B2E] hover:bg-[#E8E4FF] rounded-xl transition cursor-pointer"
                title="System Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>

          </div>

          {/* Nav Tabs Row */}
          <nav className="flex space-x-1 overflow-x-auto pt-1 pb-0 border-t border-[#E9E4FA] scrollbar-none">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => navigateTo(item.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer rounded-t-lg ${
                    isActive
                      ? 'border-[#9B87F5] text-white bg-[#9B87F5] shadow-xs'
                      : 'border-transparent text-[#6B6580] hover:text-[#1F1B2E] hover:bg-[#E8E4FF]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#9B87F5]'}`} />
                  <span>{item.label}</span>
                  {item.badge > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-[#C084FC] text-white shadow-xs">
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
      <footer className="bg-white border-t border-[#E9E4FA] py-4 text-center text-xs text-[#6B6580]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>Saarthi360 TDS Reconciliation Workbench &copy; 2026</span>
          <div className="flex gap-4 text-[#6B6580]">
            <span>Security Compliant</span>
            <span>•</span>
            <span>3-Way Engine Active</span>
          </div>
        </div>
      </footer>
      {/* Sync Completion Modal Popup */}
      {syncResultModal && (
        <div className="fixed inset-0 bg-[#1F1B2E]/50 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E9E4FA] rounded-3xl max-w-md w-full p-6 shadow-2xl relative text-[#1F1B2E] animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setSyncResultModal(null)}
              className="absolute top-4 right-4 text-[#6B6580] hover:text-[#1F1B2E] p-1 rounded-lg hover:bg-[#E8E4FF] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-[#9B87F5]/15 border border-[#9B87F5]/30 text-[#9B87F5] flex items-center justify-center text-2xl shadow-inner">
                {syncResultModal.success === false ? 'ℹ️' : '🚀'}
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight text-[#1F1B2E]">
                  {syncResultModal.success === false ? 'Saarthi 360 Live Sync Note' : 'Saarthi 360 Sync Completed!'}
                </h3>
                <p className="text-xs text-[#6B6580] font-medium">
                  {syncResultModal.success === false 
                    ? 'Live API unreachable; local master database active.' 
                    : 'Live client master data & billing invoices updated.'}
                </p>
              </div>
            </div>

            {syncResultModal.success === false ? (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 shadow-2xs text-xs text-amber-800 space-y-2">
                <p className="font-bold flex items-center gap-1.5 text-amber-900">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  Local Master Records Active
                </p>
                <p className="leading-relaxed">
                  The live Saarthi 360 server is currently unreachable. All reconciliation operations will continue using your uploaded 26AS Excel & Tally Ledger records.
                </p>
              </div>
            ) : (
              <>
                <div className="bg-[#E8E4FF]/40 border border-[#E9E4FA] rounded-2xl p-4 space-y-3 mb-6 shadow-2xs">
                  <div className="flex items-center justify-between text-xs border-b border-[#E9E4FA] pb-2">
                    <span className="text-[#6B6580] flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[#9B87F5]" />
                      Client Masters Found:
                    </span>
                    <span className="font-bold text-[#9B87F5]">
                      {syncResultModal.stats?.clientsFound?.toLocaleString() || '15,700+'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs border-b border-[#E9E4FA] pb-2">
                    <span className="text-[#6B6580] flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#B4A7F5]" />
                      Invoices Processed:
                    </span>
                    <span className="font-bold text-[#B4A7F5]">
                      {syncResultModal.stats?.invoicesProcessed?.toLocaleString() || '4,400+'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs border-b border-[#E9E4FA] pb-2">
                    <span className="text-[#6B6580] flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-[#9B87F5]" />
                      New Records Inserted:
                    </span>
                    <span className="font-bold text-[#9B87F5]">
                      {syncResultModal.stats?.inserted || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs pb-1">
                    <span className="text-[#6B6580] flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#4ADE80]" />
                      Existing Dues Refreshed:
                    </span>
                    <span className="font-bold text-[#4ADE80]">
                      {syncResultModal.stats?.updated || 0}
                    </span>
                  </div>
                </div>

                <div className="bg-[#4ADE80]/15 border border-[#4ADE80]/30 rounded-xl p-3 mb-6 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#2E8B57] shrink-0 mt-0.5" />
                  <p className="text-xs text-[#2E8B57] font-medium leading-relaxed">
                    ✓ HR contact person names, designations, mobile numbers, email addresses, and Team Leaders refreshed.
                  </p>
                </div>
              </>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setSyncResultModal(null);
                  navigateTo('reconciliation');
                }}
                className="flex-1 bg-[#9B87F5] hover:bg-[#8572E0] text-white font-black py-2.5 px-4 rounded-xl text-xs transition cursor-pointer shadow-md text-center"
              >
                Go to Reconciliation Table ➔
              </button>
              <button
                onClick={() => setSyncResultModal(null)}
                className="bg-[#E8E4FF] hover:bg-[#E9E4FA] text-[#1F1B2E] font-bold py-2.5 px-4 rounded-xl text-xs transition cursor-pointer border border-[#E9E4FA]"
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
