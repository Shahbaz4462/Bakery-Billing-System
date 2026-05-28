import React, { useState, useEffect } from 'react';
import Login from './pages/Login';
import Navigation from './components/Navigation';
import BillingPOS from './pages/BillingPOS';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Approvals from './pages/Approvals';
import HistoryLogs from './pages/HistoryLogs';
import Settings from './pages/Settings';
import EmployeeManagement from './pages/EmployeeManagement';
import { FaExclamationCircle } from 'react-icons/fa';

export default function App() {
  const [user, setUser] = useState(null);
  const [language, setLanguage] = useState('en');
  const [activeTab, setActiveTab] = useState('pos');
  const [settings, setSettings] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  // Load Settings from DB and set Theme on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user]);

  const fetchSettings = async () => {
    try {
      const rows = await window.electronAPI.query('SELECT * FROM settings');
      const settingsMap = {};
      rows.forEach(r => {
        settingsMap[r.key] = r.value;
      });
      setSettings(settingsMap);
    } catch (e) {
      console.error('Failed to load system settings:', e);
      addNotification('Settings db query failed.', 'error');
    }
  };

  const addNotification = (message, type = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    
    // Auto-remove notification after 4 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  };

  const handleLoginSuccess = (loggedInUser, selectedLanguage) => {
    setUser(loggedInUser);
    setLanguage(selectedLanguage);
    addNotification(`Welcome back, ${loggedInUser.username}!`, 'success');
  };

  const handleLogout = async () => {
    if (!user) return;
    try {
      const logQuery = 'INSERT INTO audit_logs (user_id, action, details) VALUES (?, "logout", ?)';
      await window.electronAPI.run(logQuery, [user.id, `User signed out from POS desk.`]);
    } catch (e) {
      console.error('Logout audit log failed:', e);
    }
    setUser(null);
    setActiveTab('pos');
    addNotification('Session logged out securely.', 'info');
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Render Login page if not authenticated
  if (!user) {
    return (
      <>
        <Login onLoginSuccess={handleLoginSuccess} />
        {/* Render standalone notifications on login screen */}
        <div className="toast-container">
          {notifications.map(n => (
            <div key={n.id} className={`toast-alert ${n.type}`}>
              <FaExclamationCircle />
              <span>{n.message}</span>
            </div>
          ))}
        </div>
      </>
    );
  }

  // Render main POS workspace
  return (
    <div className="app-container">
      
      {/* Sidebar Navigation */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onLogout={handleLogout}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
      />

      {/* Main Workspace Frame */}
      <div className="main-content">
        <div className="content-body">
          {activeTab === 'pos' && (
            <BillingPOS
              user={user}
              settings={settings}
              addNotification={addNotification}
              language={language}
            />
          )}

          {activeTab === 'dashboard' && user.role === 'owner' && (
            <Dashboard
              user={user}
              addNotification={addNotification}
            />
          )}

          {activeTab === 'inventory' && (
            <Inventory
              user={user}
              addNotification={addNotification}
            />
          )}

          {activeTab === 'approvals' && user.role === 'owner' && (
            <Approvals
              user={user}
              addNotification={addNotification}
            />
          )}

          {activeTab === 'history' && (
            <HistoryLogs
              user={user}
              addNotification={addNotification}
            />
          )}

          {activeTab === 'employees' && user.role === 'owner' && (
            <EmployeeManagement
              user={user}
              addNotification={addNotification}
            />
          )}

          {activeTab === 'settings' && (
            <Settings
              user={user}
              settings={settings}
              fetchSettings={fetchSettings}
              addNotification={addNotification}
              toggleTheme={toggleTheme}
              currentTheme={theme}
            />
          )}
        </div>
      </div>

      {/* Modern Micro-animated Toast Containers */}
      <div className="toast-container">
        {notifications.map(n => (
          <div key={n.id} className={`toast-alert ${n.type}`}>
            <FaExclamationCircle />
            <span>{n.message}</span>
          </div>
        ))}
      </div>

    </div>
  );
}
