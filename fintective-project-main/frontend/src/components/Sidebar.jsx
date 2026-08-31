import React, { useContext } from 'react';
import { FinanceContext } from '../context/FinanceContext';
import { 
  LayoutDashboard, 
  PlusCircle, 
  MinusCircle, 
  Users, 
  TrendingUp, 
  TrendingDown, 
  FileSpreadsheet, 
  Settings,
  Briefcase,
  Globe,
  LogOut
} from 'lucide-react';

const Sidebar = ({ activePage, setActivePage, setIsSettingsOpen }) => {
  const { userRole, currentUser, logout, activeModule, setActiveModule } = useContext(FinanceContext);

  const handleModuleChange = (moduleName) => {
    setActiveModule(moduleName);
    setActivePage('dashboard'); // Reset page to dashboard to prevent routing bugs
  };

  // Define menu items for each module
  const franchiseBdItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, section: 'Overview' },
    { id: 'franchisees', name: 'Franchisees', icon: Users, section: 'Analytics' },
    { id: 'bd-performance', name: 'BD performance', icon: TrendingUp, section: 'Analytics' },
    { id: 'tl-performance', name: 'TL performance', icon: Users, section: 'Analytics' },
    { id: 'roi-tracker', name: 'Runway & ROI', icon: Briefcase, section: 'Analytics' },
    { id: 'cash-outflow', name: 'Cash outflow', icon: TrendingDown, section: 'Analytics' },
    { id: 'reports', name: 'Reports', icon: FileSpreadsheet, section: 'Analytics' }
  ];

  const jobPortalItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, section: 'Overview' },
    { id: 'portal-analytics', name: 'Portal Analytics', icon: Globe, section: 'Analytics' },
    { id: 'cash-outflow', name: 'Cash Outflow', icon: TrendingDown, section: 'Analytics' },
    { id: 'reports', name: 'Reports', icon: FileSpreadsheet, section: 'Analytics' }
  ];

  const menuItems = activeModule === 'franchise_bd_revenue' ? franchiseBdItems : jobPortalItems;

  // Hide specific admin-only directories if view role is restricted
  const allowedItems = menuItems.filter(item => {
    if (userRole === 'admin') return true;
    const adminOnlyTabs = ['franchisees', 'bd-performance', 'tl-performance', 'cash-outflow', 'portal-analytics', 'roi-tracker'];
    return !adminOnlyTabs.includes(item.id);
  });

  // Group items by section
  const sections = ['Overview', 'Analytics'];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-logo" style={{ background: activeModule === 'job_portal' ? 'linear-gradient(135deg, #ea580c, #f97316)' : 'linear-gradient(135deg, var(--accent-teal), #06b6d4)', boxShadow: activeModule === 'job_portal' ? '0 0 15px rgba(234, 88, 12, 0.4)' : '0 0 15px rgba(13, 148, 136, 0.4)' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"></line>
            <line x1="12" y1="20" x2="12" y2="4"></line>
            <line x1="6" y1="20" x2="6" y2="14"></line>
          </svg>
        </div>
        <div className="brand-text">
          <h2>Saarthi</h2>
          <span>Finance</span>
        </div>
      </div>

      {/* High-Fidelity Module Switcher Selector */}
      <div className="module-switcher-wrapper" style={{ padding: '8px 12px 14px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <span className="section-title" style={{ paddingLeft: 0, marginBottom: '6px' }}>Active Module</span>
        <div className="module-switcher-pill" style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '3px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <button 
            onClick={() => handleModuleChange('franchise_bd_revenue')}
            style={{
              flex: 1,
              background: activeModule === 'franchise_bd_revenue' ? 'rgba(13, 148, 136, 0.2)' : 'transparent',
              color: activeModule === 'franchise_bd_revenue' ? '#2dd4bf' : 'var(--text-sidebar-muted)',
              border: 'none',
              padding: '6px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'var(--transition-smooth)'
            }}
          >
            Franchise/BD
          </button>
          <button 
            onClick={() => handleModuleChange('job_portal')}
            style={{
              flex: 1,
              background: activeModule === 'job_portal' ? 'rgba(234, 88, 12, 0.2)' : 'transparent',
              color: activeModule === 'job_portal' ? '#ff7849' : 'var(--text-sidebar-muted)',
              border: 'none',
              padding: '6px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'var(--transition-smooth)'
            }}
          >
            Job Portal
          </button>
        </div>

        {/* Dedicated Standalone TDS Reconciliation App Button */}
        <div style={{ marginTop: '10px' }}>
          <button 
            onClick={() => window.open('https://saarthifinancial-l7f7.vercel.app', '_self')}
            title="Open TDS Reconciliation App"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justify: 'space-between',
              background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.25), rgba(168, 85, 247, 0.15))',
              color: '#d8b4fe',
              border: '1px solid rgba(168, 85, 247, 0.4)',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 10px rgba(147, 51, 234, 0.2)'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ background: '#9333ea', color: '#fff', padding: '2px 5px', borderRadius: '4px', fontSize: '9px', fontWeight: '900' }}>TDS</span>
              Reconciliation App
            </span>
            <span style={{ fontSize: '13px', fontWeight: 'bold' }}>↗</span>
          </button>
        </div>
      </div>

      <div className="sidebar-menu-wrapper">
        {sections.map(section => (
          <div className="menu-section" key={section}>
            <span className="section-title">{section}</span>
            <ul className="menu-list">
              {allowedItems
                .filter(item => item.section === section)
                .map(item => {
                  const Icon = item.icon;
                  const isActive = activePage === item.id;
                  const activeColor = activeModule === 'job_portal' ? '#ff7849' : '#2dd4bf';
                  const activeBg = activeModule === 'job_portal' ? 'rgba(234, 88, 12, 0.15)' : 'var(--accent-teal-glow)';
                  
                  return (
                    <li key={item.id}>
                      <button 
                        className={`menu-item ${isActive ? 'active' : ''}`}
                        onClick={() => setActivePage(item.id)}
                        style={{
                          backgroundColor: isActive ? activeBg : '',
                          color: isActive ? activeColor : ''
                        }}
                      >
                        <Icon size={18} className="menu-icon" style={{ stroke: isActive ? activeColor : '' }} />
                        <span>{item.name}</span>
                      </button>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <button className="menu-item settings-btn" onClick={() => setIsSettingsOpen(true)}>
          <Settings size={18} className="menu-icon" />
          <span>Settings</span>
        </button>

        <button className="menu-item settings-btn" onClick={logout} style={{ color: '#ef4444' }}>
          <LogOut size={18} className="menu-icon" style={{ stroke: '#ef4444' }} />
          <span style={{ color: '#ef4444' }}>Log Out</span>
        </button>
        
        <div className="user-profile">
          <div className="avatar" style={{ background: activeModule === 'job_portal' ? 'linear-gradient(135deg, #ea580c, #f97316)' : 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
            {currentUser?.name ? currentUser.name.charAt(0) : 'U'}
          </div>
          <div className="user-info">
            <span className="user-name">{currentUser?.name || 'User'}</span>
            <span className="user-org">
              {userRole === 'admin' ? 'Admin Portal' : userRole.startsWith('franchise_') ? 'Franchise Owner' : 'BD Agent'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
