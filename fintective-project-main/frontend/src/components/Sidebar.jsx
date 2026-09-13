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
  LogOut,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const Sidebar = ({ activePage, setActivePage, setIsSettingsOpen }) => {
  const { userRole, currentUser, logout, activeModule, setActiveModule, isSidebarOpen, toggleSidebar } = useContext(FinanceContext);

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
    <>
      {/* Edge Flap Toggle Button */}
      <button 
        className={`sidebar-flap-toggle ${!isSidebarOpen ? 'collapsed' : ''}`}
        onClick={toggleSidebar}
        title={isSidebarOpen ? "Close Sidebar Flap" : "Open Sidebar Flap"}
        aria-label="Toggle Sidebar Flap"
      >
        {isSidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-logo" style={{ background: 'linear-gradient(135deg, var(--accent-teal), #22314f)', boxShadow: '0 2px 8px rgba(15, 110, 86, 0.2)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"></line>
            <line x1="12" y1="20" x2="12" y2="4"></line>
            <line x1="6" y1="20" x2="6" y2="14"></line>
          </svg>
        </div>
        <div className="brand-text">
          <h2 style={{ color: 'var(--text-sidebar)', fontWeight: '700', fontSize: '18px', letterSpacing: '-0.02em', margin: 0 }}>Fintective</h2>
          <span style={{ color: 'var(--text-sidebar-muted)', fontSize: '11px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Intelligence</span>
        </div>
      </div>

      {/* High-Fidelity Module Switcher Selector */}
      <div className="module-switcher-wrapper" style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-color)' }}>
        <span className="section-title" style={{ paddingLeft: 0, marginBottom: '6px', color: 'var(--text-sidebar-muted)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Module</span>
        <div className="module-switcher-pill" style={{ display: 'flex', background: 'var(--bg-sidebar-hover)', borderRadius: '6px', padding: '2px', border: '1px solid var(--border-color)' }}>
          <button 
            onClick={() => handleModuleChange('franchise_bd_revenue')}
            style={{
              flex: 1,
              background: activeModule === 'franchise_bd_revenue' ? '#ffffff' : 'transparent',
              color: activeModule === 'franchise_bd_revenue' ? 'var(--accent-teal)' : 'var(--text-sidebar-muted)',
              border: 'none',
              padding: '6px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: activeModule === 'franchise_bd_revenue' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              transition: 'var(--transition-smooth)'
            }}
          >
            Franchise/BD
          </button>
          <button 
            onClick={() => handleModuleChange('job_portal')}
            style={{
              flex: 1,
              background: activeModule === 'job_portal' ? '#ffffff' : 'transparent',
              color: activeModule === 'job_portal' ? 'var(--accent-teal)' : 'var(--text-sidebar-muted)',
              border: 'none',
              padding: '6px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: activeModule === 'job_portal' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              transition: 'var(--transition-smooth)'
            }}
          >
            Job Portal
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
                  
                  return (
                    <li key={item.id}>
                      <button 
                        className={`menu-item ${isActive ? 'active' : ''}`}
                        onClick={() => setActivePage(item.id)}
                        style={{
                          backgroundColor: isActive ? 'rgba(15, 110, 86, 0.08)' : 'transparent',
                          color: isActive ? 'var(--accent-teal)' : 'var(--text-sidebar)',
                          borderLeft: isActive ? '3px solid var(--accent-teal)' : '3px solid transparent',
                          borderRadius: '0 6px 6px 0',
                          fontWeight: isActive ? '600' : '500'
                        }}
                      >
                        <Icon size={18} className="menu-icon" style={{ stroke: isActive ? 'var(--accent-teal)' : 'var(--text-sidebar-muted)' }} />
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
          <Settings size={18} className="menu-icon" style={{ stroke: 'var(--text-sidebar-muted)' }} />
          <span>Settings</span>
        </button>

        <button className="menu-item settings-btn" onClick={logout} style={{ color: 'var(--color-expense)' }}>
          <LogOut size={18} className="menu-icon" style={{ stroke: 'var(--color-expense)' }} />
          <span style={{ color: 'var(--color-expense)' }}>Log Out</span>
        </button>
        
        <div className="user-profile">
          <div className="avatar" style={{ background: 'var(--accent-teal)', color: '#ffffff', fontWeight: '700' }}>
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
    </>
  );
};

export default Sidebar;
