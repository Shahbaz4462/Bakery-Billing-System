import React, { useState, useEffect } from 'react';
import {
  FaUserPlus, FaUsers, FaEye, FaEdit, FaTrash, FaTimes, FaCheck,
  FaMoneyBillWave, FaCalendarAlt, FaPhone, FaMapMarkerAlt,
  FaLock, FaUserTie, FaPlus, FaHistory, FaArrowLeft
} from 'react-icons/fa';

const defaultPermissions = {
  owner: [
    'create_employee', 'edit_employee', 'assign_permissions',
    'approve_requests', 'access_bills', 'access_inventory',
    'update_bill', 'view_logs', 'view_reports', 'manage_settings'
  ],
  employee: [
    'create_bill', 'search_bill', 'update_bill_limited',
    'request_inventory', 'request_product', 'view_stock',
    'print_bill', 'switch_language'
  ]
};

export default function EmployeeManagement({ user, addNotification }) {
  const [view, setView] = useState('list'); // 'list' | 'create' | 'detail'
  const [employees, setEmployees] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);

  // Create form state
  const [form, setForm] = useState({
    full_name: '', username: '', password: '', confirm_password: '',
    phone: '', address: '', joining_date: new Date().toISOString().slice(0, 10),
    salary: '', role: 'employee', status: 'active'
  });
  const [formErrors, setFormErrors] = useState({});

  // Payment form state
  const [payForm, setPayForm] = useState({
    amount: '', payment_type: 'salary', payment_date: new Date().toISOString().slice(0, 10), notes: ''
  });
  const [showPayForm, setShowPayForm] = useState(false);

  // Edit mode
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const sql = `
        SELECT u.id, u.username, u.role, u.status, u.created_at,
               ep.full_name, ep.phone, ep.address, ep.joining_date, ep.salary,
               COALESCE((SELECT SUM(sp.amount) FROM salary_payments sp WHERE sp.employee_id = ep.id AND sp.payment_type != 'deduction'), 0) as total_paid,
               COALESCE((SELECT SUM(sp.amount) FROM salary_payments sp WHERE sp.employee_id = ep.id AND sp.payment_type = 'deduction'), 0) as total_deductions
        FROM users u
        LEFT JOIN employee_profiles ep ON ep.user_id = u.id
        WHERE u.id != ?
        ORDER BY u.created_at DESC
      `;
      const rows = await window.electronAPI.query(sql, [user.id]);
      setEmployees(rows);
    } catch (e) {
      console.error('Fetch employees error:', e);
      addNotification('Failed to load employees.', 'error');
    }
    setLoading(false);
  };

  const fetchPayments = async (empProfileId) => {
    try {
      const sql = `
        SELECT sp.*, u.username as paid_by_name
        FROM salary_payments sp
        JOIN users u ON u.id = sp.paid_by_user_id
        WHERE sp.employee_id = ?
        ORDER BY sp.payment_date DESC, sp.created_at DESC
      `;
      const rows = await window.electronAPI.query(sql, [empProfileId]);
      setPayments(rows);
    } catch (e) {
      console.error('Fetch payments error:', e);
      addNotification('Failed to load payment history.', 'error');
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!form.full_name.trim()) errors.full_name = 'Full name is required';
    if (!form.username.trim()) errors.username = 'Username is required';
    if (!editMode) {
      if (!form.password) errors.password = 'Password is required';
      if (form.password.length < 4) errors.password = 'Password must be at least 4 characters';
      if (form.password !== form.confirm_password) errors.confirm_password = 'Passwords do not match';
    } else if (form.password && form.password !== form.confirm_password) {
      errors.confirm_password = 'Passwords do not match';
    }
    if (!form.joining_date) errors.joining_date = 'Joining date is required';
    if (form.salary && isNaN(parseFloat(form.salary))) errors.salary = 'Salary must be a number';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateEmployee = async () => {
    if (!validateForm()) return;
    setLoading(true);
    try {
      if (editMode && selectedEmp) {
        // Update existing
        const updateUser = `UPDATE users SET username = ?, role = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        await window.electronAPI.run(updateUser, [form.username, form.role, form.status, selectedEmp.id]);

        if (form.password) {
          // Hash via a separate IPC if available, else store plain (we'll use a trick below)
          const updatePass = `UPDATE users SET password_hash = ? WHERE id = ?`;
          // Use bcrypt via IPC
          const hashed = await window.electronAPI.hashPassword(form.password);
          await window.electronAPI.run(updatePass, [hashed, selectedEmp.id]);
        }

        const updateProfile = `
          UPDATE employee_profiles SET full_name=?, phone=?, address=?, joining_date=?, salary=?
          WHERE user_id=?
        `;
        await window.electronAPI.run(updateProfile, [
          form.full_name, form.phone, form.address, form.joining_date,
          parseFloat(form.salary) || 0, selectedEmp.id
        ]);

        addNotification(`Employee "${form.full_name}" updated successfully!`, 'success');
        await window.electronAPI.run(
          `INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'edit_employee', ?)`,
          [user.id, `Updated employee: ${form.username}`]
        );
      } else {
        // Create new
        const hashed = await window.electronAPI.hashPassword(form.password);
        const perms = JSON.stringify(defaultPermissions[form.role] || defaultPermissions.employee);

        const res = await window.electronAPI.run(
          `INSERT INTO users (username, password_hash, role, status, permissions) VALUES (?, ?, ?, ?, ?)`,
          [form.username.trim(), hashed, form.role, form.status, perms]
        );
        const newUserId = res.lastID;

        await window.electronAPI.run(
          `INSERT INTO employee_profiles (user_id, full_name, phone, address, joining_date, salary) VALUES (?, ?, ?, ?, ?, ?)`,
          [newUserId, form.full_name.trim(), form.phone.trim(), form.address.trim(),
           form.joining_date, parseFloat(form.salary) || 0]
        );

        await window.electronAPI.run(
          `INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'create_employee', ?)`,
          [user.id, `Created new employee: ${form.username}`]
        );

        addNotification(`Employee "${form.full_name}" created! Login: ${form.username}`, 'success');
      }

      resetForm();
      setView('list');
      await fetchEmployees();
    } catch (e) {
      console.error('Save employee error:', e);
      if (e.message && e.message.includes('UNIQUE')) {
        addNotification('Username already exists. Please choose a different one.', 'error');
      } else {
        addNotification('Failed to save employee. Check logs.', 'error');
      }
    }
    setLoading(false);
  };

  const handleViewEmployee = async (emp) => {
    setSelectedEmp(emp);
    // Fetch profile id
    const profileRows = await window.electronAPI.query(
      'SELECT id FROM employee_profiles WHERE user_id = ?', [emp.id]
    );
    if (profileRows.length > 0) {
      await fetchPayments(profileRows[0].id);
    } else {
      setPayments([]);
    }
    setView('detail');
  };

  const handleEditEmployee = (emp) => {
    setForm({
      full_name: emp.full_name || '',
      username: emp.username || '',
      password: '',
      confirm_password: '',
      phone: emp.phone || '',
      address: emp.address || '',
      joining_date: emp.joining_date || new Date().toISOString().slice(0, 10),
      salary: emp.salary ? emp.salary.toString() : '',
      role: emp.role || 'employee',
      status: emp.status || 'active'
    });
    setEditMode(true);
    setSelectedEmp(emp);
    setView('create');
  };

  const handleDeleteEmployee = async (emp) => {
    if (!window.confirm(`Are you sure you want to deactivate "${emp.full_name || emp.username}"?`)) return;
    try {
      await window.electronAPI.run(`UPDATE users SET status = 'inactive' WHERE id = ?`, [emp.id]);
      addNotification(`Employee deactivated.`, 'info');
      await fetchEmployees();
    } catch (e) {
      addNotification('Failed to deactivate.', 'error');
    }
  };

  const handleAddPayment = async () => {
    if (!payForm.amount || isNaN(parseFloat(payForm.amount))) {
      addNotification('Enter a valid amount.', 'warning');
      return;
    }
    try {
      const profileRows = await window.electronAPI.query(
        'SELECT id FROM employee_profiles WHERE user_id = ?', [selectedEmp.id]
      );
      if (profileRows.length === 0) {
        addNotification('Employee profile not found.', 'error');
        return;
      }
      const empProfileId = profileRows[0].id;

      await window.electronAPI.run(
        `INSERT INTO salary_payments (employee_id, amount, payment_date, payment_type, notes, paid_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [empProfileId, parseFloat(payForm.amount), payForm.payment_date,
         payForm.payment_type, payForm.notes.trim(), user.id]
      );

      await window.electronAPI.run(
        `INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'salary_payment', ?)`,
        [user.id, `Paid Rs.${payForm.amount} (${payForm.payment_type}) to ${selectedEmp.full_name || selectedEmp.username} on ${payForm.payment_date}`]
      );

      addNotification(`Payment of Rs. ${payForm.amount} recorded!`, 'success');
      setPayForm({ amount: '', payment_type: 'salary', payment_date: new Date().toISOString().slice(0, 10), notes: '' });
      setShowPayForm(false);
      await fetchPayments(empProfileId);
      await fetchEmployees();
    } catch (e) {
      console.error('Add payment error:', e);
      addNotification('Failed to record payment.', 'error');
    }
  };

  const resetForm = () => {
    setForm({
      full_name: '', username: '', password: '', confirm_password: '',
      phone: '', address: '',
      joining_date: new Date().toISOString().slice(0, 10),
      salary: '', role: 'employee', status: 'active'
    });
    setFormErrors({});
    setEditMode(false);
    setSelectedEmp(null);
  };

  const payTypeColor = (type) => {
    if (type === 'salary') return 'var(--success)';
    if (type === 'advance') return 'var(--accent-primary)';
    if (type === 'bonus') return '#f59e0b';
    if (type === 'deduction') return 'var(--danger)';
    return 'var(--text-secondary)';
  };

  const payTypeBg = (type) => {
    if (type === 'salary') return 'rgba(16,185,129,0.1)';
    if (type === 'advance') return 'rgba(59,130,246,0.1)';
    if (type === 'bonus') return 'rgba(245,158,11,0.1)';
    if (type === 'deduction') return 'rgba(239,68,68,0.1)';
    return 'var(--bg-tertiary)';
  };

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: '8px',
    border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box'
  };

  const labelStyle = {
    fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-tertiary)',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', display: 'block'
  };

  // ─── LIST VIEW ───────────────────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px' }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px', backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)', borderRadius: '10px'
        }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FaUsers style={{ color: 'var(--accent-primary)' }} /> Employee Management
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
              Create &amp; manage employee profiles, salaries, and payment history
            </p>
          </div>
          <button
            onClick={() => { resetForm(); setView('create'); }}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
          >
            <FaUserPlus /> Add New Employee
          </button>
        </div>

        {/* Employee Cards Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-tertiary)' }}>Loading employees...</div>
        ) : employees.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px', color: 'var(--text-tertiary)',
            border: '2px dashed var(--border-color)', borderRadius: '12px'
          }}>
            <FaUsers style={{ fontSize: '3rem', marginBottom: '12px', opacity: 0.3 }} />
            <p>No employees yet. Click "Add New Employee" to create the first one.</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '16px', overflowY: 'auto', flex: 1
          }}>
            {employees.map(emp => {
              const salary = parseFloat(emp.salary) || 0;
              const paid = parseFloat(emp.total_paid) || 0;
              const deductions = parseFloat(emp.total_deductions) || 0;
              const balance = salary - paid + deductions;

              return (
                <div key={emp.id} style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: `1px solid ${emp.status === 'inactive' ? 'var(--danger)' : 'var(--border-color)'}`,
                  borderRadius: '12px', padding: '20px',
                  display: 'flex', flexDirection: 'column', gap: '12px',
                  opacity: emp.status === 'inactive' ? 0.7 : 1,
                  transition: 'box-shadow 0.2s',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  {/* Card Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '48px', height: '48px', borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary, #6366f1))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: '1.2rem', fontWeight: '800', flexShrink: 0
                    }}>
                      {(emp.full_name || emp.username || 'E').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {emp.full_name || emp.username}
                      </h3>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '0.7rem', fontWeight: '700', padding: '2px 8px', borderRadius: '4px',
                          backgroundColor: emp.role === 'owner' ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)',
                          color: emp.role === 'owner' ? 'var(--success)' : 'var(--accent-primary)',
                          textTransform: 'uppercase'
                        }}>
                          {emp.role === 'owner' ? 'Admin/Owner' : 'Employee'}
                        </span>
                        {emp.status === 'inactive' && (
                          <span style={{ fontSize: '0.7rem', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--danger)', textTransform: 'uppercase' }}>
                            Inactive
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem' }}>
                    <div style={{ color: 'var(--text-secondary)' }}>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem' }}>Username</span><br />
                      <strong>@{emp.username}</strong>
                    </div>
                    <div style={{ color: 'var(--text-secondary)' }}>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem' }}>Monthly Salary</span><br />
                      <strong style={{ color: 'var(--success)' }}>Rs. {salary.toLocaleString()}</strong>
                    </div>
                    <div style={{ color: 'var(--text-secondary)' }}>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem' }}>Joining Date</span><br />
                      <strong>{emp.joining_date || '—'}</strong>
                    </div>
                    <div style={{ color: 'var(--text-secondary)' }}>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem' }}>Total Paid</span><br />
                      <strong style={{ color: 'var(--accent-primary)' }}>Rs. {paid.toLocaleString()}</strong>
                    </div>
                    {emp.phone && (
                      <div style={{ color: 'var(--text-secondary)', gridColumn: '1/-1' }}>
                        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem' }}>Phone</span><br />
                        <strong>{emp.phone}</strong>
                      </div>
                    )}
                  </div>

                  {/* Salary Balance Bar */}
                  {salary > 0 && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                        <span>Paid: Rs. {paid.toLocaleString()}</span>
                        <span style={{ color: balance > 0 ? 'var(--danger)' : 'var(--success)' }}>
                          {balance > 0 ? `Due: Rs. ${balance.toLocaleString()}` : 'Fully Paid ✓'}
                        </span>
                      </div>
                      <div style={{ height: '6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${Math.min((paid / salary) * 100, 100)}%`,
                          backgroundColor: balance > 0 ? 'var(--accent-primary)' : 'var(--success)',
                          borderRadius: '4px', transition: 'width 0.4s ease'
                        }} />
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button
                      onClick={() => handleViewEmployee(emp)}
                      className="btn btn-primary"
                      style={{ flex: 1, padding: '8px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      <FaEye /> Details &amp; Payments
                    </button>
                    <button
                      onClick={() => handleEditEmployee(emp)}
                      className="btn btn-secondary"
                      style={{ padding: '8px 12px', fontSize: '0.82rem' }}
                      title="Edit"
                    >
                      <FaEdit />
                    </button>
                    {emp.status !== 'inactive' && (
                      <button
                        onClick={() => handleDeleteEmployee(emp)}
                        style={{ padding: '8px 12px', fontSize: '0.82rem', backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', cursor: 'pointer' }}
                        title="Deactivate"
                      >
                        <FaTrash />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─── CREATE / EDIT VIEW ──────────────────────────────────────────────────────
  if (view === 'create') {
    const fieldGroup = (label, field, type = 'text', placeholder = '', required = false) => (
      <div>
        <label style={labelStyle}>{label}{required && <span style={{ color: 'var(--danger)' }}> *</span>}</label>
        <input
          type={type}
          placeholder={placeholder}
          value={form[field]}
          onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
          style={{ ...inputStyle, borderColor: formErrors[field] ? 'var(--danger)' : 'var(--border-color)' }}
        />
        {formErrors[field] && <span style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '2px', display: 'block' }}>{formErrors[field]}</span>}
      </div>
    );

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px' }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '16px',
          padding: '16px 20px', backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)', borderRadius: '10px'
        }}>
          <button onClick={() => { setView('list'); resetForm(); }} className="btn btn-secondary" style={{ padding: '8px 12px' }}>
            <FaArrowLeft />
          </button>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '800' }}>
              {editMode ? '✏️ Edit Employee Profile' : '👤 Add New Employee'}
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
              {editMode ? 'Update employee details. Leave password blank to keep existing.' : 'Fill all details to create login credentials for the new employee.'}
            </p>
          </div>
        </div>

        {/* Form */}
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px',
            backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
            borderRadius: '12px', padding: '24px'
          }}>
            {/* Section: Personal Info */}
            <div style={{ gridColumn: '1/-1' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--accent-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FaUserTie /> Personal Information
              </h3>
            </div>

            {fieldGroup('Full Name', 'full_name', 'text', 'e.g. Ali Hassan', true)}
            {fieldGroup('Phone Number', 'phone', 'text', 'e.g. 0300-1234567')}
            <div style={{ gridColumn: '1/-1' }}>
              {fieldGroup('Address', 'address', 'text', 'e.g. House 12, Street 5, Lahore')}
            </div>

            {/* Section: Login */}
            <div style={{ gridColumn: '1/-1', marginTop: '8px' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--accent-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FaLock /> Login Credentials
              </h3>
            </div>

            {fieldGroup('Username (for login)', 'username', 'text', 'e.g. ali_cashier', true)}
            {fieldGroup(editMode ? 'New Password (leave blank to keep)' : 'Password', 'password', 'password', '••••••••', !editMode)}
            {fieldGroup('Confirm Password', 'confirm_password', 'password', '••••••••', !editMode)}

            <div>
              <label style={labelStyle}>Role <span style={{ color: 'var(--danger)' }}>*</span></label>
              <select
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                style={{ ...inputStyle }}
              >
                <option value="employee">Employee / Cashier</option>
                <option value="owner">Owner / Admin</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Status</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                style={{ ...inputStyle }}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive / Suspended</option>
              </select>
            </div>

            {/* Section: Employment */}
            <div style={{ gridColumn: '1/-1', marginTop: '8px' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--accent-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FaCalendarAlt /> Employment Details
              </h3>
            </div>

            {fieldGroup('Joining Date', 'joining_date', 'date', '', true)}
            {fieldGroup('Monthly Salary (Rs.)', 'salary', 'number', 'e.g. 25000')}

            {/* Submit */}
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button
                onClick={handleCreateEmployee}
                disabled={loading}
                className="btn btn-success"
                style={{ padding: '12px 28px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <FaCheck /> {loading ? 'Saving...' : (editMode ? 'Update Employee' : 'Create Employee')}
              </button>
              <button
                onClick={() => { setView('list'); resetForm(); }}
                className="btn btn-secondary"
                style={{ padding: '12px 20px' }}
              >
                <FaTimes /> Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── DETAIL / PAYMENT VIEW ──────────────────────────────────────────────────
  if (view === 'detail' && selectedEmp) {
    const salary = parseFloat(selectedEmp.salary) || 0;
    const totalPaid = payments.filter(p => p.payment_type !== 'deduction').reduce((s, p) => s + parseFloat(p.amount), 0);
    const totalDed = payments.filter(p => p.payment_type === 'deduction').reduce((s, p) => s + parseFloat(p.amount), 0);
    const netPaid = totalPaid - totalDed;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)', borderRadius: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button onClick={() => { setView('list'); setSelectedEmp(null); setPayments([]); }} className="btn btn-secondary" style={{ padding: '8px 12px' }}>
              <FaArrowLeft />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '52px', height: '52px', borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent-primary), #6366f1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: '1.4rem', fontWeight: '800'
              }}>
                {(selectedEmp.full_name || selectedEmp.username || 'E').charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: '800' }}>{selectedEmp.full_name || selectedEmp.username}</h2>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>@{selectedEmp.username} • {selectedEmp.role}</span>
              </div>
            </div>
          </div>
          <button onClick={() => handleEditEmployee(selectedEmp)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FaEdit /> Edit Profile
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', flex: 1, overflowY: 'auto' }}>
          {/* Left: Profile Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Profile Card */}
            <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: '700', marginBottom: '16px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                📋 Profile Details
              </h3>
              {[
                { label: 'Full Name', value: selectedEmp.full_name || '—', icon: '👤' },
                { label: 'Username', value: `@${selectedEmp.username}`, icon: '🔑' },
                { label: 'Phone', value: selectedEmp.phone || '—', icon: '📞' },
                { label: 'Address', value: selectedEmp.address || '—', icon: '📍' },
                { label: 'Joining Date', value: selectedEmp.joining_date || '—', icon: '📅' },
                { label: 'Role', value: selectedEmp.role === 'owner' ? 'Admin / Owner' : 'Employee / Cashier', icon: '🎯' },
                { label: 'Status', value: selectedEmp.status, icon: '⚡' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--bg-tertiary)', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>{item.icon} {item.label}</span>
                  <strong style={{ color: 'var(--text-primary)', textAlign: 'right', maxWidth: '60%' }}>{item.value}</strong>
                </div>
              ))}
            </div>

            {/* Salary Summary */}
            <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: '700', marginBottom: '16px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                💰 Salary Summary
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {[
                  { label: 'Monthly Salary', value: `Rs. ${salary.toLocaleString()}`, color: 'var(--text-primary)' },
                  { label: 'Total Paid', value: `Rs. ${totalPaid.toLocaleString()}`, color: 'var(--success)' },
                  { label: 'Total Deductions', value: `Rs. ${totalDed.toLocaleString()}`, color: 'var(--danger)' },
                  { label: 'Net Received', value: `Rs. ${netPaid.toLocaleString()}`, color: 'var(--accent-primary)' },
                ].map((s, i) => (
                  <div key={i} style={{ backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginBottom: '4px' }}>{s.label}</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: '800', color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Payment History */}
          <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FaHistory /> Payment History
              </h3>
              <button
                onClick={() => setShowPayForm(!showPayForm)}
                className="btn btn-primary"
                style={{ padding: '7px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <FaPlus /> Add Payment
              </button>
            </div>

            {/* Add Payment Form */}
            {showPayForm && (
              <div style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: '700', marginBottom: '4px' }}>Record New Payment</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={labelStyle}>Amount (Rs.) *</label>
                    <input type="number" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} placeholder="e.g. 15000" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Payment Type</label>
                    <select value={payForm.payment_type} onChange={e => setPayForm(f => ({ ...f, payment_type: e.target.value }))} style={inputStyle}>
                      <option value="salary">Monthly Salary</option>
                      <option value="advance">Advance Payment</option>
                      <option value="bonus">Bonus / Incentive</option>
                      <option value="deduction">Deduction / Penalty</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Date *</label>
                    <input type="date" value={payForm.payment_date} onChange={e => setPayForm(f => ({ ...f, payment_date: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Notes (optional)</label>
                    <input type="text" value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. For month of May" style={inputStyle} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={handleAddPayment} className="btn btn-success" style={{ padding: '9px 18px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FaCheck /> Save Payment
                  </button>
                  <button onClick={() => setShowPayForm(false)} className="btn btn-secondary" style={{ padding: '9px 14px', fontSize: '0.85rem' }}>
                    <FaTimes /> Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Payment List */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {payments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                  <FaMoneyBillWave style={{ fontSize: '2rem', marginBottom: '8px', opacity: 0.3, display: 'block', margin: '0 auto 8px' }} />
                  No payment records yet.
                </div>
              ) : (
                payments.map((p, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 14px', borderRadius: '8px',
                    backgroundColor: payTypeBg(p.payment_type),
                    border: `1px solid ${payTypeColor(p.payment_type)}30`
                  }}>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: '700' }}>
                        <span style={{ color: payTypeColor(p.payment_type), textTransform: 'capitalize' }}>{p.payment_type}</span>
                        {p.notes && <span style={{ color: 'var(--text-tertiary)', fontWeight: '400', marginLeft: '6px' }}>— {p.notes}</span>}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                        📅 {p.payment_date} &nbsp;·&nbsp; By: {p.paid_by_name}
                      </div>
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: '800', color: p.payment_type === 'deduction' ? 'var(--danger)' : 'var(--success)' }}>
                      {p.payment_type === 'deduction' ? '−' : '+'}Rs. {parseFloat(p.amount).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
