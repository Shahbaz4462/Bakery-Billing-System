import React, { useState, useEffect } from 'react';
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
  FaUsers,
  FaBars,
  FaTimes
} from 'react-icons/fa';

export default function Navigation({ activeTab, setActiveTab, user, onLogout, collapsed, setCollapsed }) {
  const isOwner = user?.role === 'owner';
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  
  // Check screen size for responsive behavior
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Dynamic navigation items based on user permissions/role
  const navItems = [
    { id: 'pos', name: 'POS', fullName: 'Billing / POS', icon: <FaCashRegister />, show: true },
    { id: 'dashboard', name: 'Analytics', fullName: 'Sales Analytics', icon: <FaChartBar />, show: isOwner },
    { id: 'inventory', name: 'Stock', fullName: 'Inventory / Stock', icon: <FaWarehouse />, show: true },
    { id: 'employees', name: 'Staff', fullName: 'Employee Mgmt', icon: <FaUsers />, show: isOwner },
    { id: 'approvals', name: 'Approvals', fullName: 'Pending Approvals', icon: <FaClipboardCheck />, show: isOwner },
    { id: 'history', name: 'History', fullName: 'Revision Logs', icon: <FaHistory />, show: true },
    { id: 'settings', name: 'Settings', fullName: 'System Settings', icon: <FaCog />, show: true }
  ];

  const filteredItems = navItems.filter(item => item.show);
  
  // Mobile: Show only first 4 items in bottom nav, rest in overflow menu
  const mobileNavItems = filteredItems.slice(0, 4);
  const overflowItems = filteredItems.slice(4);

  // Mobile Bottom Navigation
  if (isMobile) {
    return (
      <>
        <div className="sidebar" style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-around',
          alignItems: 'center',
          gap: '4px',
          padding: '8px 4px',
          height: '70px'
        }}>
          {mobileNavItems.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  backgroundColor: isActive ? 'rgba(var(--accent-primary-rgb), 0.1)' : 'transparent',
                  color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  fontWeight: isActive ? '700' : '500',
                  flex: 1,
                  maxWidth: '80px',
                  transition: 'all var(--transition-fast)',
                  border: 'none'
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>{item.icon}</span>
                <span style={{ fontSize: '0.65rem', whiteSpace: 'nowrap' }}>{item.name}</span>
              </button>
            );
          })}
          
          {/* More button for overflow items */}
          {overflowItems.length > 0 && (
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                backgroundColor: showMobileMenu ? 'rgba(var(--accent-primary-rgb), 0.1)' : 'transparent',
                color: showMobileMenu ? 'var(--accent-primary)' : 'var(--text-secondary)',
                flex: 1,
                maxWidth: '80px',
                border: 'none'
              }}
            >
              <span style={{ fontSize: '1.2rem' }}><FaBars /></span>
              <span style={{ fontSize: '0.65rem' }}>More</span>
            </button>
          )}
        </div>
        
        {/* Mobile overflow menu */}
        {showMobileMenu && (
          <div style={{
            position: 'fixed',
            bottom: '80px',
            left: '16px',
            right: '16px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 1001,
            padding: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FaUserCircle style={{ fontSize: '1.5rem', color: 'var(--text-secondary)' }} />
                <div>
                  <div style={{ fontWeight: '700', fontSize: '0.9rem', textTransform: 'capitalize' }}>{user?.username || 'User'}</div>
                  <span style={{ 
                    fontSize: '0.65rem', 
                    fontWeight: '700', 
                    color: user?.role === 'owner' ? 'var(--success)' : 'var(--accent-primary)',
                    textTransform: 'uppercase'
                  }}>
                    {user?.role === 'owner' ? 'Admin' : 'Employee'}
                  </span>
                </div>
              </div>
              <button onClick={() => setShowMobileMenu(false)} style={{ color: 'var(--text-tertiary)', cursor: 'pointer', background: 'none', border: 'none' }}>
                <FaTimes size={18} />
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {overflowItems.map(item => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => { setActiveTab(item.id); setShowMobileMenu(false); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      backgroundColor: isActive ? 'rgba(var(--accent-primary-rgb), 0.1)' : 'transparent',
                      color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      fontWeight: isActive ? '700' : '500',
                      border: 'none',
                      width: '100%',
                      textAlign: 'left'
                    }}
                  >
                    <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
                    <span>{item.fullName}</span>
                  </button>
                );
              })}
              
              <button
                onClick={onLogout}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  color: 'var(--danger)',
                  fontWeight: '600',
                  backgroundColor: 'rgba(239, 68, 68, 0.05)',
                  border: 'none',
                  width: '100%',
                  textAlign: 'left',
                  marginTop: '8px'
                }}
              >
                <FaSignOutAlt />
                <span>Logout</span>
              </button>
            </div>
          </div>
        )}
        
        {/* Backdrop for mobile menu */}
        {showMobileMenu && (
          <div 
            onClick={() => setShowMobileMenu(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: '80px',
              backgroundColor: 'rgba(0,0,0,0.3)',
              zIndex: 1000
            }}
          />
        )}
      </>
    );
  }

  // Desktop Sidebar Navigation
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
        {filteredItems.map(item => {
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
                transition: 'all var(--transition-fast)',
                border: 'none'
              }}
              className="nav-btn"
            >
              <span style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{item.icon}</span>
              {!collapsed && <span style={{ fontSize: '0.925rem' }}>{item.fullName}</span>}
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
            transition: 'all var(--transition-fast)',
            border: 'none'
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
