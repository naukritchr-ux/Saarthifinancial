import React from 'react';
import { 
  LayoutDashboard, 
  Upload, 
  GitCompare, 
  PhoneCall, 
  Clock, 
  Settings,
  ShieldCheck
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function Layout({ children }) {
  const { activePage, navigateTo, fyFilter, setFyFilter, role, setRole, cleaningQueueCount } = useApp();

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

            {/* Right Controls: FY, Role, Settings */}
            <div className="flex items-center gap-3">
              {/* FY Selector */}
              <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-300">
                <span className="text-amber-500 font-bold">FY:</span>
                <select
                  value={fyFilter}
                  onChange={(e) => setFyFilter(e.target.value)}
                  className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
                >
                  <option value="All Financial Years" className="bg-slate-900 text-white">All Financial Years</option>
                  <option value="2024-25" className="bg-slate-900 text-white">FY 2024-25</option>
                  <option value="2023-24" className="bg-slate-900 text-white">FY 2023-24</option>
                  <option value="2022-23" className="bg-slate-900 text-white">FY 2022-23</option>
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
    </div>
  );
}
