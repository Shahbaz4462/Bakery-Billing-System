import React from 'react';
import { 
  FaCashRegister, 
  FaWarehouse, 
  FaClipboardCheck, 
  FaChartBar, 
  FaHistory, 
  FaCog, 
  FaSignOutAlt, 
  FaUserCircle,
  FaAngleLeft,
  FaAngleRight,
  FaFileInvoice,
  FaUsers
} from 'react-icons/fa';

export default function Navigation({ activeTab, setActiveTab, user, onLogout, collapsed, setCollapsed }) {
  const isOwner = user?.role === 'owner';
  
  // Dynamic navigation items based on user permissions/role
  const navItems = [
    { id: 'pos', name: 'Billing / POS', icon: <FaCashRegister />, show: true },
    { id: 'dashboard', name: 'Sales Analytics', icon: <FaChartBar />, show: isOwner },
    { id: 'inventory', name: 'Inventory / Stock', icon: <FaWarehouse />, show: true },
    { id: 'employees', name: 'Employee Mgmt', icon: <FaUsers />, show: isOwner },
    { id: 'approvals', name: 'Pending Approvals', icon: <FaClipboardCheck />, show: isOwner },
    { id: 'history', name: 'Revision Logs', icon: <FaHistory />, show: true },
    { id: 'settings', name: 'System Settings', icon: <FaCog />, show: true }
  ];

  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Sidebar Header */}
      <div style={{ 
        padding: '24px 20px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-color)',
        minHeight: '80px'
      }}>
        {!collapsed ? (
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FaFileInvoice /> BAKERY POS
            </h3>
            <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-tertiary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Offline Native
            </span>
          </div>
        ) : (
          <div style={{ fontSize: '1.5rem', color: 'var(--accent-primary)', width: '100%', textAlign: 'center' }}>
            <FaFileInvoice />
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div style={{ flex: 1, padding: '20px 10px', display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto' }}>
        {navItems.filter(item => item.show).map(item => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '12px 16px',
                borderRadius: 'var(--radius-sm)',
                width: '100%',
                cursor: 'pointer',
                textAlign: 'left',
                backgroundColor: isActive ? 'rgba(var(--accent-primary-rgb), 0.1)' : 'transparent',
                color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontWeight: isActive ? '700' : '500',
                transition: 'all var(--transition-fast)'
              }}
              className="nav-btn"
            >
              <span style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{item.icon}</span>
              {!collapsed && <span style={{ fontSize: '0.925rem' }}>{item.name}</span>}
            </button>
          );
        })}
      </div>

      {/* User Information Profile */}
      <div style={{ 
        padding: '16px 20px', 
        borderTop: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-tertiary)',
        display: 'flex', 
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '2rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
            <FaUserCircle />
          </div>
          {!collapsed && (
            <div style={{ overflow: 'hidden' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: '700', textTransform: 'capitalize', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {user?.username || 'Staff User'}
              </h4>
              <span style={{ 
                fontSize: '0.7rem', 
                fontWeight: '700', 
                color: user?.role === 'owner' ? 'var(--success)' : 'var(--accent-primary)',
                backgroundColor: user?.role === 'owner' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                padding: '2px 6px',
                borderRadius: '4px',
                textTransform: 'uppercase'
              }}>
                {user?.role === 'owner' ? 'Owner / Admin' : 'Employee'}
              </span>
            </div>
          )}
        </div>
        
        <button
          onClick={onLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: '10px',
            padding: '10px',
            width: '100%',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            color: 'var(--danger)',
            fontWeight: '600',
            fontSize: '0.9rem',
            backgroundColor: 'rgba(239, 68, 68, 0.05)',
            transition: 'all var(--transition-fast)'
          }}
          className="logout-btn"
        >
          <FaSignOutAlt />
          {!collapsed && <span>Logout Session</span>}
        </button>
      </div>

      {/* Collapse Toggle Button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          position: 'absolute',
          bottom: '85px',
          right: '-12px',
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: 'var(--shadow-sm)',
          color: 'var(--text-secondary)',
          zIndex: 110
        }}
      >
        {collapsed ? <FaAngleRight size={12} /> : <FaAngleLeft size={12} />}
      </button>
    </div>
  );
}
