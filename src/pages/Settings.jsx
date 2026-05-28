import React, { useState, useEffect } from 'react';
import bcrypt from 'bcryptjs';
import { 
  FaCog, 
  FaPrint, 
  FaDatabase, 
  FaUsers, 
  FaSave, 
  FaUnlock, 
  FaLock, 
  FaKey, 
  FaUserPlus, 
  FaMoon, 
  FaSun 
} from 'react-icons/fa';

export default function Settings({ user, settings, fetchSettings, addNotification, toggleTheme, currentTheme }) {
  // Store Details Form state
  const [storeForm, setStoreForm] = useState({
    bakery_name: '', bakery_address: '', bakery_phone: '', bakery_tax_no: '', bakery_tax_rate: '',
    receipt_header: '', receipt_footer: '', receipt_paper_size: '80mm', receipt_printer_name: '',
    auto_backup_on_close: 'true', auto_backup_path: ''
  });

  // Printer options list
  const [printersList, setPrintersList] = useState([]);

  // Cashiers / Employee Accounts (Owner only)
  const [employees, setEmployees] = useState([]);
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [empForm, setEmpForm] = useState({ username: '', password: '', role: 'employee' });
  const [empPermissions, setEmpPermissions] = useState({
    create_bill: true, search_bill: true, update_bill_limited: true,
    request_inventory: true, request_product: true, view_stock: true,
    print_bill: true, switch_language: true
  });

  // Pass reset modal state
  const [resetPassUser, setResetPassUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassModal, setShowPassModal] = useState(false);

  const isOwner = user.role === 'owner';

  useEffect(() => {
    if (settings) {
      setStoreForm({
        bakery_name: settings.bakery_name || '',
        bakery_address: settings.bakery_address || '',
        bakery_phone: settings.bakery_phone || '',
        bakery_tax_no: settings.bakery_tax_no || '',
        bakery_tax_rate: settings.bakery_tax_rate || '0',
        receipt_header: settings.receipt_header || '',
        receipt_footer: settings.receipt_footer || '',
        receipt_paper_size: settings.receipt_paper_size || '80mm',
        receipt_printer_name: settings.receipt_printer_name || '',
        auto_backup_on_close: settings.auto_backup_on_close || 'true',
        auto_backup_path: settings.auto_backup_path || ''
      });
    }
    fetchPrinters();
    if (isOwner) {
      fetchEmployees();
    }
  }, [settings]);

  const fetchPrinters = async () => {
    try {
      const list = await window.electronAPI.getPrinters();
      setPrintersList(list);
    } catch (e) {
      console.error('Failed to get system printer list:', e);
    }
  };

  const fetchEmployees = async () => {
    try {
      const rows = await window.electronAPI.query('SELECT * FROM users ORDER BY created_at DESC');
      setEmployees(rows);
    } catch (e) {
      console.error('Failed to query users list:', e);
    }
  };

  // Save Bakery settings
  const handleStoreFormSubmit = async (e) => {
    e.preventDefault();
    try {
      const queries = [];
      Object.keys(storeForm).forEach(key => {
        queries.push({
          sql: 'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP',
          params: [key, storeForm[key], storeForm[key]]
        });
      });

      // Audit Log
      queries.push({
        sql: 'INSERT INTO audit_logs (user_id, action, details) VALUES (?, "manage_settings", ?)',
        params: [user.id, 'Updated store specifications and printing targets.']
      });

      await window.electronAPI.transaction(queries);
      addNotification('Settings saved successfully!', 'success');
      fetchSettings(); // reload state inside main App
    } catch (err) {
      console.error('Failed to save settings:', err);
      addNotification('Failed to update system settings.', 'error');
    }
  };

  // Database Backup routine
  const handleBackupNow = async () => {
    try {
      const defaultName = `bakery_backup_${new Date().toISOString().slice(0,10)}.db`;
      const saveRes = await window.electronAPI.showSaveDialog({
        title: 'Save Encrypted Database Backup',
        defaultPath: defaultName,
        filters: [{ name: 'SQLite DB Files', extensions: ['db'] }]
      });

      if (saveRes.canceled || !saveRes.filePath) return;

      addNotification('Compiling local backup copies...', 'info');
      const backupRes = await window.electronAPI.backupDatabase(saveRes.filePath);
      
      if (backupRes.success) {
        // Log backup action
        const logQuery = 'INSERT INTO audit_logs (user_id, action, details) VALUES (?, "backup_database", ?)';
        await window.electronAPI.run(logQuery, [user.id, `Created database backup at: ${saveRes.filePath}`]);
        addNotification('Offline database backup created successfully!', 'success');
      } else {
        addNotification(`Backup failure: ${backupRes.error}`, 'error');
      }
    } catch (e) {
      console.error('Backup error:', e);
      addNotification('Failed to execute backup routine.', 'error');
    }
  };

  // Database Restore routine
  const handleRestoreNow = async () => {
    if (!window.confirm('WARNING: Restoring will overwrite all current sales, billing history and user accounts with the backup file data. Are you sure you want to proceed?')) {
      return;
    }

    try {
      const openRes = await window.electronAPI.showOpenDialog({
        title: 'Select Database Backup File to Restore',
        properties: ['openFile'],
        filters: [{ name: 'SQLite DB Files', extensions: ['db'] }]
      });

      if (openRes.canceled || openRes.filePaths.length === 0) return;
      const srcPath = openRes.filePaths[0];

      addNotification('Locking database session & importing backup data...', 'info');
      const restoreRes = await window.electronAPI.restoreDatabase(srcPath);

      if (restoreRes.success) {
        addNotification('System database restored successfully! The app will reload.', 'success');
        // Delay and reload session
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        addNotification(`Restore failed: ${restoreRes.error}`, 'error');
      }
    } catch (e) {
      console.error('Restore error:', e);
      addNotification('Failed to execute restore procedure.', 'error');
    }
  };

  // Owner: Register Employee Cashier Account
  const handleAddEmployeeSubmit = async (e) => {
    e.preventDefault();
    if (!empForm.username || !empForm.password) {
      addNotification('Please enter username and password.', 'warning');
      return;
    }

    try {
      const checkRows = await window.electronAPI.query('SELECT COUNT(*) as count FROM users WHERE username = ?', [empForm.username.toLowerCase()]);
      if (checkRows[0].count > 0) {
        addNotification('Username already exists.', 'warning');
        return;
      }

      // Hash password using pure-JS bcryptjs
      const hash = bcrypt.hashSync(empForm.password, 10);
      
      // Map active permissions to array
      const permsArray = Object.keys(empPermissions).filter(key => empPermissions[key]);
      const permsString = JSON.stringify(permsArray);

      const sql = 'INSERT INTO users (username, password_hash, role, permissions, status) VALUES (?, ?, ?, ?, "active")';
      await window.electronAPI.run(sql, [empForm.username.toLowerCase(), hash, empForm.role, permsString]);
      
      // Log Action
      const logQuery = 'INSERT INTO audit_logs (user_id, action, details) VALUES (?, "create_employee", ?)';
      await window.electronAPI.run(logQuery, [user.id, `Created cashier account: ${empForm.username}.`]);

      addNotification(`Cashier account ${empForm.username} created successfully!`, 'success');
      setShowAddEmployeeModal(false);
      setEmpForm({ username: '', password: '', role: 'employee' });
      fetchEmployees();
    } catch (e) {
      console.error('Employee creation failed:', e);
      addNotification('Failed to create account.', 'error');
    }
  };

  // Lock / Unlock Employee Account
  const toggleEmployeeLock = async (emp) => {
    if (emp.id === user.id) {
      addNotification('You cannot lock your own owner account!', 'warning');
      return;
    }

    const newStatus = emp.status === 'active' ? 'locked' : 'active';
    try {
      const sql = 'UPDATE users SET status = ? WHERE id = ?';
      await window.electronAPI.run(sql, [newStatus, emp.id]);
      
      const logSql = 'INSERT INTO audit_logs (user_id, action, details) VALUES (?, "edit_employee", ?)';
      await window.electronAPI.run(logSql, [user.id, `${newStatus === 'locked' ? 'Locked' : 'Unlocked'} account of cashier: ${emp.username}`]);

      addNotification(`Account ${emp.username} ${newStatus === 'locked' ? 'locked' : 'unlocked'}.`, 'info');
      fetchEmployees();
    } catch (e) {
      console.error('Failed to change user status:', e);
    }
  };

  // Reset Cashier Password
  const handleResetPass = (emp) => {
    setResetPassUser(emp);
    setNewPassword('');
    setShowPassModal(true);
  };

  const handleResetPassSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword.trim()) return;

    try {
      const hash = bcrypt.hashSync(newPassword, 10);
      const sql = 'UPDATE users SET password_hash = ? WHERE id = ?';
      await window.electronAPI.run(sql, [hash, resetPassUser.id]);
      
      const logSql = 'INSERT INTO audit_logs (user_id, action, details) VALUES (?, "edit_employee", ?)';
      await window.electronAPI.run(logSql, [user.id, `Reset password of cashier: ${resetPassUser.username}`]);

      addNotification(`Password for ${resetPassUser.username} updated successfully!`, 'success');
      setShowPassModal(false);
    } catch (e) {
      console.error('Failed to reset pass:', e);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
      
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: '800' }}>System Settings</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Configure shop details, printing nodes, backups, and cashiers</p>
        </div>

        {/* Theme Toggle Button */}
        <button 
          onClick={toggleTheme}
          className="btn btn-secondary"
          style={{ padding: '10px 16px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          {currentTheme === 'dark' ? (
            <><FaSun style={{ color: 'var(--warning)' }} /> Light Mode</>
          ) : (
            <><FaMoon style={{ color: 'var(--accent-primary)' }} /> Dark Mode</>
          )}
        </button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: isOwner ? '1.5fr 1fr' : '1fr',
        gap: '24px'
      }}>
        
        {/* Left Column: Store Details and Printing settings Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div className="standard-card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FaCog /> Bakery Profile Specifications
            </h3>

            <form onSubmit={handleStoreFormSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              
              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Bakery Name *</label>
                <input type="text" value={storeForm.bakery_name} onChange={(e) => setStoreForm({ ...storeForm, bakery_name: e.target.value })} className="input-field" disabled={!isOwner} required />
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Contact Numbers *</label>
                <input type="text" value={storeForm.bakery_phone} onChange={(e) => setStoreForm({ ...storeForm, bakery_phone: e.target.value })} className="input-field" disabled={!isOwner} required />
              </div>

              <div className="input-group" style={{ margin: 0, gridColumn: 'span 2' }}>
                <label className="input-label">Shop Address *</label>
                <input type="text" value={storeForm.bakery_address} onChange={(e) => setStoreForm({ ...storeForm, bakery_address: e.target.value })} className="input-field" disabled={!isOwner} required />
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Tax / GST Reg Number</label>
                <input type="text" value={storeForm.bakery_tax_no} onChange={(e) => setStoreForm({ ...storeForm, bakery_tax_no: e.target.value })} className="input-field" disabled={!isOwner} />
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Tax Rate (%)</label>
                <input type="number" step="0.1" value={storeForm.bakery_tax_rate} onChange={(e) => setStoreForm({ ...storeForm, bakery_tax_rate: e.target.value })} className="input-field" disabled={!isOwner} />
              </div>

              <h4 style={{ gridColumn: 'span 2', fontSize: '0.925rem', marginTop: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}><FaPrint /> Printing & Formatting Customization</h4>

              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Select Thermal Printer</label>
                <select 
                  value={storeForm.receipt_printer_name} 
                  onChange={(e) => setStoreForm({ ...storeForm, receipt_printer_name: e.target.value })} 
                  className="input-field"
                  style={{ cursor: 'pointer' }}
                >
                  <option value="">Default System Printer</option>
                  {printersList.map((p, idx) => (
                    <option key={idx} value={p.name}>{p.name} {p.isDefault ? '(Default)' : ''}</option>
                  ))}
                </select>
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Paper Width size</label>
                <select 
                  value={storeForm.receipt_paper_size} 
                  onChange={(e) => setStoreForm({ ...storeForm, receipt_paper_size: e.target.value })} 
                  className="input-field"
                  style={{ cursor: 'pointer' }}
                >
                  <option value="80mm">80mm Thermal width (Recommended)</option>
                  <option value="58mm">58mm Thermal width</option>
                </select>
              </div>

              <div className="input-group" style={{ margin: 0, gridColumn: 'span 2' }}>
                <label className="input-label">Custom Header message</label>
                <input type="text" value={storeForm.receipt_header} onChange={(e) => setStoreForm({ ...storeForm, receipt_header: e.target.value })} className="input-field" disabled={!isOwner} placeholder="e.g. WELCOME TO CHOUDHRY BAKERY" />
              </div>

              <div className="input-group" style={{ margin: 0, gridColumn: 'span 2' }}>
                <label className="input-label">Footer Terms & Note</label>
                <textarea 
                  value={storeForm.receipt_footer} 
                  onChange={(e) => setStoreForm({ ...storeForm, receipt_footer: e.target.value })} 
                  className="input-field" 
                  disabled={!isOwner}
                  style={{ height: '80px', padding: '10px 12px' }}
                  placeholder="Return terms..." 
                />
              </div>

              {isOwner && (
                <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <button type="submit" className="btn btn-success"><FaSave /> Save System Specifications</button>
                </div>
              )}

            </form>
          </div>

          {/* Database Backup & Restore Card */}
          <div className="standard-card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FaDatabase /> Local Database Backup & Restore
            </h3>
            
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '15px' }}>
              Create encrypted backups of your bakery's sales history, inventories and settings to a local hard drive or external USB.
            </p>

            <div style={{ display: 'flex', gap: '15px' }}>
              <button onClick={handleBackupNow} className="btn btn-primary" style={{ display: 'flex', gap: '8px' }}>
                <FaDatabase /> Backup Database Now
              </button>
              
              {isOwner && (
                <button onClick={handleRestoreNow} className="btn btn-danger" style={{ display: 'flex', gap: '8px' }}>
                  <FaDatabase /> Import & Restore DB
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Right Column: Cashiers / User Accounts Control (Owner only) */}
        {isOwner && (
          <div className="standard-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FaUsers /> Cashier Accounts
              </h3>
              <button 
                onClick={() => { setShowAddEmployeeModal(true); setEmpForm({ username: '', password: '', role: 'employee' }); }} 
                className="btn btn-primary"
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                <FaUserPlus /> Add Cashier
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '580px' }}>
              {employees.map(emp => (
                <div 
                  key={emp.id}
                  style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    backgroundColor: emp.status === 'locked' ? 'rgba(239, 68, 68, 0.02)' : 'transparent',
                    opacity: emp.status === 'locked' ? 0.75 : 1
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: '1rem', textTransform: 'capitalize' }}>{emp.username}</strong>
                      <span style={{ 
                        fontSize: '0.7rem', 
                        fontWeight: 'bold',
                        marginLeft: '8px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: emp.role === 'owner' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                        color: emp.role === 'owner' ? 'var(--success)' : 'var(--accent-primary)'
                      }}>
                        {emp.role.toUpperCase()}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={() => toggleEmployeeLock(emp)}
                        style={{ color: emp.status === 'locked' ? 'var(--danger)' : 'var(--success)', cursor: 'pointer' }}
                        title={emp.status === 'locked' ? 'Unlock Account' : 'Lock Account'}
                      >
                        {emp.status === 'locked' ? <FaLock /> : <FaUnlock />}
                      </button>
                      <button 
                        onClick={() => handleResetPass(emp)}
                        style={{ color: 'var(--text-secondary)', cursor: 'pointer' }}
                        title="Reset password"
                      >
                        <FaKey />
                      </button>
                    </div>
                  </div>
                  
                  <div style={{ fontSize: '0.725rem', color: 'var(--text-tertiary)' }}>
                    Permissions: {emp.permissions}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Modal: Add Employee */}
      {showAddEmployeeModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="standard-card" style={{ width: '100%', maxWidth: '550px', padding: '24px', backgroundColor: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '1.1rem' }}><FaUserPlus /> Register New Employee Cashier</h3>
              <button onClick={() => setShowAddEmployeeModal(false)} style={{ cursor: 'pointer', color: 'var(--text-tertiary)' }}><FaTimes size={18} /></button>
            </div>
            
            <form onSubmit={handleAddEmployeeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              
              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Username *</label>
                <input type="text" value={empForm.username} onChange={(e) => setEmpForm({ ...empForm, username: e.target.value })} className="input-field" placeholder="e.g. malik" required />
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Login Password *</label>
                <input type="password" value={empForm.password} onChange={(e) => setEmpForm({ ...empForm, password: e.target.value })} className="input-field" placeholder="Minimum 6 characters..." required />
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">System Role *</label>
                <select value={empForm.role} onChange={(e) => setEmpForm({ ...empForm, role: e.target.value })} className="input-field" required>
                  <option value="employee">Employee (Limited Access POS Cashier)</option>
                  <option value="owner">Owner / Administrator (Full Clearance Access)</option>
                </select>
              </div>

              {empForm.role === 'employee' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label className="input-label">Cashier Permissions Clearance</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.85rem' }}>
                    {Object.keys(empPermissions).map(key => (
                      <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={empPermissions[key]}
                          onChange={(e) => setEmpPermissions({ ...empPermissions, [key]: e.target.checked })}
                        />
                        <span style={{ textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowAddEmployeeModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-success">Register Cashier</button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Modal: Reset password */}
      {showPassModal && resetPassUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="standard-card" style={{ width: '100%', maxWidth: '400px', padding: '24px', backgroundColor: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '1.1rem' }}><FaKey /> Reset Cashier Password</h3>
              <button onClick={() => setShowPassModal(false)} style={{ cursor: 'pointer', color: 'var(--text-tertiary)' }}><FaTimes size={18} /></button>
            </div>
            
            <form onSubmit={handleResetPassSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">New Password for <strong>{resetPassUser.username}</strong> *</label>
                <input 
                  type="password" 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
                  className="input-field" 
                  placeholder="Enter new secure password..."
                  required 
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowPassModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-warning">Reset Password</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
