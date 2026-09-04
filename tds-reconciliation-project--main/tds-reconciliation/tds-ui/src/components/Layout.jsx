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
    <div className="min-h-screen bg-[#EEF1F4] flex flex-col font-sans text-[#3A4048]">
      {/* Top Navbar - Muted Slate Blue Theme */}
      <header className="bg-[#3E4A5C] text-white shadow-sm border-b border-[#323D4D] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Left: Brand Logo & Title */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#6E8CA0] text-white font-black text-xl flex items-center justify-center shadow-xs">
                T
              </div>
              <div>
                <div className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                  TDS Reconcile
                  <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-[#6E8CA0] text-white border border-[#8FA3BF]/40">
                    Pro
                  </span>
                </div>
                <div className="text-[11px] text-[#DCE2E8] font-medium">
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
                className="flex items-center gap-1.5 bg-[#6E8CA0] hover:bg-[#5B788C] disabled:opacity-50 text-white font-extrabold px-3.5 py-1.5 rounded-xl text-xs transition cursor-pointer shadow-xs"
                title="Fetch & sync live client invoices from Saarthi 360 APIs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span>{syncing ? 'Syncing...' : 'Sync Saarthi 360'}</span>
              </button>

              {/* FY Selector */}
              <div className="flex items-center gap-1.5 bg-[#2E3745] border border-[#526075] rounded-xl px-3 py-1.5 text-xs font-bold text-white">
                <span className="text-[#8FA3BF] font-extrabold">FY:</span>
                <select
                  value={fyFilter}
                  onChange={(e) => setFyFilter(e.target.value)}
                  className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
                >
                  <option value="All Financial Years" className="bg-[#3E4A5C] text-white">All Financial Years</option>
                  <option value="FY 2026-27" className="bg-[#3E4A5C] text-white">FY 2026-27</option>
                  <option value="FY 2025-26" className="bg-[#3E4A5C] text-white">FY 2025-26</option>
                  <option value="FY 2024-25" className="bg-[#3E4A5C] text-white">FY 2024-25</option>
                  <option value="FY 2023-24" className="bg-[#3E4A5C] text-white">FY 2023-24</option>
                  <option value="FY 2022-23" className="bg-[#3E4A5C] text-white">FY 2022-23</option>
                  <option value="FY 2021-22" className="bg-[#3E4A5C] text-white">FY 2021-22</option>
                </select>
              </div>

              {/* Role Selector */}
              <div className="hidden sm:flex items-center gap-1.5 bg-[#2E3745] border border-[#526075] rounded-xl px-3 py-1.5 text-xs font-bold text-white">
                <Users className="w-3.5 h-3.5 text-[#8FA3BF]" />
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
                >
                  <option value="Accounts Lead" className="bg-[#3E4A5C] text-white">Accounts Lead</option>
                  <option value="Finance Manager" className="bg-[#3E4A5C] text-white">Finance Manager</option>
                  <option value="Auditor" className="bg-[#3E4A5C] text-white">Auditor</option>
                </select>
              </div>

              {/* Return to Finance App Link */}
              <button 
                onClick={() => window.open('https://saarthifinancial-7zni.vercel.app', '_self')} 
                className="flex items-center gap-1.5 bg-[#4F5D73] hover:bg-[#5C6C85] border border-[#6E8CA0] rounded-xl px-3 py-1.5 text-xs font-bold text-white transition cursor-pointer shadow-2xs"
                title="Switch to Saarthi Financial App"
              >
                <span>Finance App ↗</span>
              </button>

              {/* Settings Gear */}
              <button 
                onClick={() => alert('Settings & Preference Config')} 
                className="p-2 text-[#DCE2E8] hover:text-white hover:bg-[#4F5D73] rounded-xl transition cursor-pointer"
                title="System Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>

          </div>

          {/* Nav Tabs Row */}
          <nav className="flex space-x-1 overflow-x-auto pt-1 pb-0 border-t border-[#4F5D73]/60 scrollbar-none">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => navigateTo(item.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer rounded-t-lg ${
                    isActive
                      ? 'border-[#8FA3BF] text-white bg-[#6E8CA0] shadow-xs'
                      : 'border-transparent text-[#DCE2E8] hover:text-white hover:bg-[#4F5D73]/40'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#8FA3BF]'}`} />
                  <span>{item.label}</span>
                  {item.badge > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-[#8FA3BF] text-[#2E3745] shadow-xs">
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
      <footer className="bg-[#F6F8FA] border-t border-[#DCE2E8] py-4 text-center text-xs text-[#7A8794]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>Saarthi360 TDS Reconciliation Workbench &copy; 2026</span>
          <div className="flex gap-4 text-[#7A8794]">
            <span>Security Compliant</span>
            <span>•</span>
            <span>3-Way Engine Active</span>
          </div>
        </div>
      </footer>
      {/* Sync Completion Modal Popup */}
      {syncResultModal && (
        <div className="fixed inset-0 bg-[#3E4A5C]/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#F6F8FA] border border-[#DCE2E8] rounded-3xl max-w-md w-full p-6 shadow-2xl relative text-[#3A4048] animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setSyncResultModal(null)}
              className="absolute top-4 right-4 text-[#7A8794] hover:text-[#3A4048] p-1 rounded-lg hover:bg-[#EEF1F4] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-[#6E8CA0]/20 border border-[#6E8CA0]/30 text-[#6E8CA0] flex items-center justify-center text-2xl shadow-inner">
                🚀
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight text-[#3A4048]">
                  Saarthi 360 Sync Completed!
                </h3>
                <p className="text-xs text-[#7A8794] font-medium">
                  Live client master data & billing invoices updated.
                </p>
              </div>
            </div>

            <div className="bg-white border border-[#DCE2E8] rounded-2xl p-4 space-y-3 mb-6 shadow-2xs">
              <div className="flex items-center justify-between text-xs border-b border-[#DCE2E8] pb-2">
                <span className="text-[#7A8794] flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#6E8CA0]" />
                  Client Masters Found:
                </span>
                <span className="font-bold text-[#6E8CA0]">
                  {syncResultModal.stats?.clientsFound?.toLocaleString() || '15,700+'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs border-b border-[#DCE2E8] pb-2">
                <span className="text-[#7A8794] flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#8FA3BF]" />
                  Invoices Processed:
                </span>
                <span className="font-bold text-[#8FA3BF]">
                  {syncResultModal.stats?.invoicesProcessed?.toLocaleString() || '4,400+'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs border-b border-[#DCE2E8] pb-2">
                <span className="text-[#7A8794] flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-[#6E8CA0]" />
                  New Records Inserted:
                </span>
                <span className="font-bold text-[#6E8CA0]">
                  {syncResultModal.stats?.inserted || 0}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs pb-1">
                <span className="text-[#7A8794] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#7FA88A]" />
                  Existing Dues Refreshed:
                </span>
                <span className="font-bold text-[#7FA88A]">
                  {syncResultModal.stats?.updated || 0}
                </span>
              </div>
            </div>

            <div className="bg-[#7FA88A]/15 border border-[#7FA88A]/30 rounded-xl p-3 mb-6 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#3D6348] shrink-0 mt-0.5" />
              <p className="text-xs text-[#3D6348] font-medium leading-relaxed">
                ✓ HR contact person names, designations, mobile numbers, email addresses, and Team Leaders refreshed.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setSyncResultModal(null);
                  navigateTo('reconciliation');
                }}
                className="flex-1 bg-[#6E8CA0] hover:bg-[#5B788C] text-white font-black py-2.5 px-4 rounded-xl text-xs transition cursor-pointer shadow-md text-center"
              >
                Go to Reconciliation Table ➔
              </button>
              <button
                onClick={() => setSyncResultModal(null)}
                className="bg-[#EEF1F4] hover:bg-[#DCE2E8] text-[#3A4048] font-bold py-2.5 px-4 rounded-xl text-xs transition cursor-pointer border border-[#DCE2E8]"
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
