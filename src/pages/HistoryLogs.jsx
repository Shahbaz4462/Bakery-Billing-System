import React, { useState, useEffect } from 'react';
import { FaHistory, FaUserShield, FaSearch, FaExchangeAlt, FaTimes, FaFileInvoiceDollar, FaBoxes, FaCheckCircle, FaTimesCircle, FaClock } from 'react-icons/fa';
import { formatDate, formatPrice } from '../utils/helpers';

export default function HistoryLogs({ user, addNotification }) {
  const [activeSubTab, setActiveSubTab] = useState('stock_history'); // 'stock_history', 'bill_history', or 'audit_logs'
  const [historyList, setHistoryList] = useState([]);
  const [auditList, setAuditList] = useState([]);
  const [stockLogs, setStockLogs] = useState([]);
  const [requestHistory, setRequestHistory] = useState([]);

  // Filter terms
  const [searchQuery, setSearchQuery] = useState('');
  
  // Diff Modal states
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [parsedDiff, setParsedDiff] = useState({ prev: null, next: null });

  useEffect(() => {
    if (activeSubTab === 'bill_history') {
      fetchBillHistory();
    } else if (activeSubTab === 'audit_logs') {
      fetchAuditLogs();
    } else if (activeSubTab === 'stock_history') {
      fetchStockHistory();
    }
  }, [activeSubTab, searchQuery]);

  // Fetch stock update history for past 100 days (inventory logs + requests)
  const fetchStockHistory = async () => {
    try {
      // Get inventory logs from past 100 days
      const logsSQL = `
        SELECT l.*, p.name as product_name, p.code as product_code, u.username, u.role as user_role
        FROM inventory_logs l
        LEFT JOIN products p ON l.product_id = p.id
        LEFT JOIN users u ON l.user_id = u.id
        WHERE date(l.created_at) >= date('now', '-100 days')
        ORDER BY l.created_at DESC
        LIMIT 200
      `;
      const logs = await window.electronAPI.query(logsSQL);
      setStockLogs(logs || []);

      // Get inventory requests history (approved/rejected) from past 100 days
      const reqSQL = `
        SELECT r.*, u.username as requester_name, u.role as requester_role,
               a.username as approver_name, p.name as product_name, p.code as product_code
        FROM inventory_requests r
        LEFT JOIN users u ON r.requested_by_user_id = u.id
        LEFT JOIN users a ON r.approved_by_user_id = a.id
        LEFT JOIN products p ON r.product_id = p.id
        WHERE date(r.created_at) >= date('now', '-100 days')
        ORDER BY r.created_at DESC
        LIMIT 200
      `;
      const requests = await window.electronAPI.query(reqSQL);
      setRequestHistory(requests || []);
    } catch (e) {
      console.error('Failed to fetch stock history:', e);
      addNotification('Failed to load stock history', 'error');
    }
  };

  const fetchBillHistory = async () => {
    try {
      let sql = `
        SELECT h.*, b.bill_number, u.username as employee_name 
        FROM bill_history h
        JOIN bills b ON h.bill_id = b.id
        JOIN users u ON h.changed_by_user_id = u.id
      `;
      let params = [];

      if (searchQuery.trim()) {
        sql += ' WHERE b.bill_number = ? OR u.username LIKE ?';
        params.push(searchQuery.trim(), `%${searchQuery}%`);
      }

      sql += ' ORDER BY h.created_at DESC LIMIT 50';
      const rows = await window.electronAPI.query(sql, params);
      setHistoryList(rows || []);
    } catch (e) {
      console.error('Failed to query bill history revision logs:', e);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      let sql = `
        SELECT a.*, u.username, u.role 
        FROM audit_logs a
        JOIN users u ON a.user_id = u.id
      `;
      let params = [];

      if (searchQuery.trim()) {
        sql += ' WHERE u.username LIKE ? OR a.action LIKE ? OR a.details LIKE ?';
        const wildcard = `%${searchQuery}%`;
        params.push(wildcard, wildcard, wildcard);
      }

      sql += ' ORDER BY a.created_at DESC LIMIT 50';
      const rows = await window.electronAPI.query(sql, params);
      setAuditList(rows || []);
    } catch (e) {
      console.error('Failed to query system audit logs:', e);
    }
  };

  const openDiffViewer = (hist) => {
    try {
      const prevData = JSON.parse(hist.previous_version_json);
      const nextData = JSON.parse(hist.new_version_json);
      
      setParsedDiff({ prev: prevData, next: nextData });
      setSelectedHistory(hist);
      setShowDiffModal(true);
    } catch (e) {
      console.error('Failed to parse revision comparison JSON:', e);
      addNotification('Could not parse historical revision logs.', 'error');
    }
  };

  // Helper: Find item details in invoice snapshot arrays
  const findItem = (itemsArray, prodId) => {
    return itemsArray.find(i => i.product_id === prodId || i.id === prodId);
  };

  // Get status badge style
  const getStatusBadge = (status) => {
    if (status === 'approved') {
      return { bg: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', icon: <FaCheckCircle /> };
    } else if (status === 'rejected') {
      return { bg: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', icon: <FaTimesCircle /> };
    } else {
      return { bg: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', icon: <FaClock /> };
    }
  };

  const getLogTypeBadge = (logType) => {
    const types = {
      'purchase': { bg: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', label: 'STOCK IN' },
      'sale': { bg: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-primary)', label: 'SALE' },
      'adjustment': { bg: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', label: 'ADJUST' },
      'return': { bg: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', label: 'RETURN' }
    };
    return types[logType] || { bg: 'var(--bg-tertiary)', color: 'var(--text-secondary)', label: logType?.toUpperCase() || 'OTHER' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
      
      {/* Page Header */}
      <div>
        <h1 style={{ fontSize: '1.8rem', fontWeight: '800' }}>History & Audit Trails</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>View stock updates, invoice modifications, and security logs from the past 100 days</p>
      </div>

      {/* Sub Tabs Toggle */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '10px', flexWrap: 'wrap' }}>
        <button
          onClick={() => { setActiveSubTab('stock_history'); setSearchQuery(''); }}
          style={{
            padding: '12px 20px',
            cursor: 'pointer',
            fontWeight: '700',
            fontSize: '0.9rem',
            color: activeSubTab === 'stock_history' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            borderBottom: activeSubTab === 'stock_history' ? '2.5px solid var(--accent-primary)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none'
          }}
        >
          <FaBoxes /> Stock Update History (100 Days)
        </button>
        <button
          onClick={() => { setActiveSubTab('bill_history'); setSearchQuery(''); }}
          style={{
            padding: '12px 20px',
            cursor: 'pointer',
            fontWeight: '700',
            fontSize: '0.9rem',
            color: activeSubTab === 'bill_history' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            borderBottom: activeSubTab === 'bill_history' ? '2.5px solid var(--accent-primary)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none'
          }}
        >
          <FaHistory /> Bill Revision Logs
        </button>
        <button
          onClick={() => { setActiveSubTab('audit_logs'); setSearchQuery(''); }}
          style={{
            padding: '12px 20px',
            cursor: 'pointer',
            fontWeight: '700',
            fontSize: '0.9rem',
            color: activeSubTab === 'audit_logs' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            borderBottom: activeSubTab === 'audit_logs' ? '2.5px solid var(--accent-primary)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none'
          }}
        >
          <FaUserShield /> System Audit Logs
        </button>
      </div>

      {/* Table Search filters bar */}
      <div className="standard-card" style={{ padding: '16px', display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: '320px', minWidth: '200px' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', display: 'flex' }}><FaSearch size={14} /></span>
          <input
            type="text"
            placeholder={activeSubTab === 'bill_history' ? 'Search by Bill Number or Cashier...' : activeSubTab === 'stock_history' ? 'Search by product or user...' : 'Search by username or action...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field"
            style={{ paddingLeft: '36px', height: '40px', fontSize: '0.875rem' }}
          />
        </div>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
          {activeSubTab === 'stock_history' ? 'Showing stock movements from past 100 days' : 'Showing latest 50 logs'}
        </span>
      </div>

      {/* Stock History Tab Content */}
      {activeSubTab === 'stock_history' && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          {/* Inventory Requests Section */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FaExchangeAlt /> Stock Update Requests (Admin/Employee)
            </h3>
            <div className="table-container">
              <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Date / Time</th>
                    <th>Requested By</th>
                    <th>Role</th>
                    <th>Type</th>
                    <th>Product / Details</th>
                    <th style={{ textAlign: 'center' }}>Qty</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Approved By</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {requestHistory.length === 0 ? (
                    <tr>
                      <td colSpan="10" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                        No stock update requests found in the past 100 days.
                      </td>
                    </tr>
                  ) : (
                    requestHistory.map(req => {
                      const statusBadge = getStatusBadge(req.status);
                      let productDisplay = req.product_name || 'N/A';
                      if (req.request_type === 'add_product') {
                        try {
                          const details = JSON.parse(req.product_details_json);
                          productDisplay = `[NEW] ${details.name}`;
                        } catch {
                          productDisplay = '[NEW PRODUCT]';
                        }
                      }
                      
                      return (
                        <tr key={`req-${req.id}`}>
                          <td style={{ whiteSpace: 'nowrap' }}>{formatDate(req.created_at)}</td>
                          <td><strong>{req.requester_name || 'Unknown'}</strong></td>
                          <td>
                            <span style={{
                              fontSize: '0.7rem',
                              fontWeight: 'bold',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: req.requester_role === 'owner' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                              color: req.requester_role === 'owner' ? 'var(--success)' : 'var(--accent-primary)',
                              textTransform: 'uppercase'
                            }}>
                              {req.requester_role === 'owner' ? 'Admin' : 'Employee'}
                            </span>
                          </td>
                          <td>
                            <span style={{
                              fontSize: '0.7rem',
                              fontWeight: 'bold',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: req.request_type === 'update_stock' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(139, 92, 246, 0.1)',
                              color: req.request_type === 'update_stock' ? 'var(--accent-primary)' : '#8b5cf6'
                            }}>
                              {req.request_type === 'update_stock' ? 'STOCK UPDATE' : 'NEW PRODUCT'}
                            </span>
                          </td>
                          <td style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={productDisplay}>
                            {productDisplay}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{req.requested_qty}</td>
                          <td style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={req.reason}>
                            {req.reason || '-'}
                          </td>
                          <td>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontWeight: 'bold',
                              fontSize: '0.75rem',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              backgroundColor: statusBadge.bg,
                              color: statusBadge.color
                            }}>
                              {statusBadge.icon}
                              {req.status?.toUpperCase()}
                            </span>
                          </td>
                          <td>{req.approver_name || '-'}</td>
                          <td style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: 'italic', color: 'var(--text-secondary)' }} title={req.notes}>
                            {req.notes || '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Inventory Movement Logs Section */}
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FaBoxes /> All Stock Movements Log
            </h3>
            <div className="table-container">
              <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Date / Time</th>
                    <th>Product</th>
                    <th>Code</th>
                    <th>Action</th>
                    <th style={{ textAlign: 'center' }}>Qty Change</th>
                    <th style={{ textAlign: 'center' }}>Previous</th>
                    <th style={{ textAlign: 'center' }}>New Qty</th>
                    <th>Performed By</th>
                    <th>Role</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {stockLogs.length === 0 ? (
                    <tr>
                      <td colSpan="10" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                        No stock movement logs found in the past 100 days.
                      </td>
                    </tr>
                  ) : (
                    stockLogs.map(log => {
                      const typeBadge = getLogTypeBadge(log.log_type);
                      return (
                        <tr key={`log-${log.id}`}>
                          <td style={{ whiteSpace: 'nowrap' }}>{formatDate(log.created_at)}</td>
                          <td><strong>{log.product_name || 'Unknown'}</strong></td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{log.product_code || '-'}</td>
                          <td>
                            <span style={{
                              fontSize: '0.7rem',
                              fontWeight: 'bold',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: typeBadge.bg,
                              color: typeBadge.color
                            }}>
                              {typeBadge.label}
                            </span>
                          </td>
                          <td style={{ 
                            textAlign: 'center', 
                            fontWeight: 'bold',
                            color: log.log_type === 'purchase' ? 'var(--success)' : log.log_type === 'sale' ? 'var(--danger)' : 'var(--warning)'
                          }}>
                            {log.log_type === 'purchase' ? '+' : log.log_type === 'sale' ? '-' : ''}{log.quantity}
                          </td>
                          <td style={{ textAlign: 'center' }}>{log.previous_qty}</td>
                          <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{log.new_qty}</td>
                          <td><strong>{log.username || 'System'}</strong></td>
                          <td>
                            <span style={{
                              fontSize: '0.7rem',
                              fontWeight: 'bold',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: log.user_role === 'owner' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                              color: log.user_role === 'owner' ? 'var(--success)' : 'var(--accent-primary)',
                              textTransform: 'uppercase'
                            }}>
                              {log.user_role === 'owner' ? 'Admin' : 'Employee'}
                            </span>
                          </td>
                          <td style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.reason}>
                            {log.reason || '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Bill History Tab */}
      {activeSubTab === 'bill_history' && (
        <div className="table-container" style={{ flex: 1, overflow: 'auto' }}>
          <table className="custom-table" style={{ fontSize: '0.9rem' }}>
            <thead>
              <tr>
                <th>Date / Time</th>
                <th>Bill Number</th>
                <th>Revision #</th>
                <th>Changed By</th>
                <th>Reason for Update</th>
                <th style={{ textAlign: 'center', width: '12%' }}>Comparison</th>
              </tr>
            </thead>
            <tbody>
              {historyList.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                    No invoice updates found.
                  </td>
                </tr>
              ) : (
                historyList.map(hist => (
                  <tr key={hist.id}>
                    <td>{formatDate(hist.created_at)}</td>
                    <td><strong>{hist.bill_number}</strong></td>
                    <td>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        color: 'var(--warning)'
                      }}>
                        Version {hist.version}
                      </span>
                    </td>
                    <td style={{ textTransform: 'capitalize' }}><strong>{hist.employee_name}</strong></td>
                    <td style={{ maxWidth: '280px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={hist.reason}>
                      {hist.reason}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        onClick={() => openDiffViewer(hist)} 
                        className="btn btn-primary"
                        style={{ padding: '6px 12px', fontSize: '0.775rem', gap: '4px' }}
                      >
                        <FaExchangeAlt size={10} /> Compare Diff
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Audit Logs Tab */}
      {activeSubTab === 'audit_logs' && (
        <div className="table-container" style={{ flex: 1, overflow: 'auto' }}>
          <table className="custom-table" style={{ fontSize: '0.9rem' }}>
            <thead>
              <tr>
                <th>Date / Time</th>
                <th>Username</th>
                <th>Role</th>
                <th>Security Action</th>
                <th>Operation Details</th>
              </tr>
            </thead>
            <tbody>
              {auditList.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                    No system security activities found.
                  </td>
                </tr>
              ) : (
                auditList.map(log => (
                  <tr key={log.id}>
                    <td>{formatDate(log.created_at)}</td>
                    <td style={{ textTransform: 'capitalize' }}><strong>{log.username}</strong></td>
                    <td>
                      <span style={{
                        fontSize: '0.725rem',
                        fontWeight: 'bold',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: log.role === 'owner' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                        color: log.role === 'owner' ? 'var(--success)' : 'var(--accent-primary)'
                      }}>
                        {log.role}
                      </span>
                    </td>
                    <td>
                      <strong style={{
                        color: log.action?.includes('login') ? 'var(--success)' : log.action?.includes('delete') || log.action?.includes('reject') ? 'var(--danger)' : 'var(--accent-primary)'
                      }}>
                        {log.action?.toUpperCase()}
                      </strong>
                    </td>
                    <td>{log.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Bill Comparison Diff Modal */}
      {showDiffModal && selectedHistory && parsedDiff.prev && parsedDiff.next && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="standard-card" style={{ width: '100%', maxWidth: '850px', padding: '24px', backgroundColor: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FaFileInvoiceDollar /> Revision Diff: <strong>{selectedHistory.bill_number}</strong>
              </h3>
              <button onClick={() => setShowDiffModal(false)} style={{ cursor: 'pointer', color: 'var(--text-tertiary)', background: 'none', border: 'none' }}><FaTimes size={18} /></button>
            </div>

            <div style={{ 
              backgroundColor: 'var(--bg-tertiary)', 
              borderRadius: 'var(--radius-sm)', 
              padding: '12px 16px', 
              fontSize: '0.825rem',
              color: 'var(--text-secondary)'
            }}>
              <strong>Reason:</strong> {selectedHistory.reason}
              <br />
              <span style={{ fontSize: '0.75rem' }}>Modified on: {formatDate(selectedHistory.created_at)}</span>
            </div>

            {/* Side-by-side comparison tables */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
              {/* Previous version */}
              <div>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--danger)', marginBottom: '8px' }}>
                  Before (Version {selectedHistory.version - 1})
                </h4>
                <div className="table-container" style={{ border: 'none' }}>
                  <table className="custom-table" style={{ fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                        <th style={{ padding: '6px' }}>Item</th>
                        <th style={{ padding: '6px', textAlign: 'center' }}>Qty</th>
                        <th style={{ padding: '6px', textAlign: 'right' }}>Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedDiff.prev.items?.map((item, idx) => (
                        <tr key={idx}>
                          <td style={{ padding: '8px 6px' }}>{item.name}</td>
                          <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 'bold' }}>{item.quantity}</td>
                          <td style={{ padding: '8px 6px', textAlign: 'right' }}>Rs. {item.rate?.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: '8px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                  Net: Rs. {parsedDiff.prev.header?.net_amount?.toFixed(2)}
                </div>
              </div>

              {/* New version */}
              <div>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--success)', marginBottom: '8px' }}>
                  After (Version {selectedHistory.version})
                </h4>
                <div className="table-container" style={{ border: 'none' }}>
                  <table className="custom-table" style={{ fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                        <th style={{ padding: '6px' }}>Item</th>
                        <th style={{ padding: '6px', textAlign: 'center' }}>Qty</th>
                        <th style={{ padding: '6px', textAlign: 'right' }}>Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedDiff.next.items?.map((item, idx) => (
                        <tr key={idx}>
                          <td style={{ padding: '8px 6px' }}>{item.name}</td>
                          <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 'bold' }}>{item.quantity}</td>
                          <td style={{ padding: '8px 6px', textAlign: 'right' }}>Rs. {item.rate?.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: '8px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                  Net: Rs. {parsedDiff.next.header?.net_amount?.toFixed(2)}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
              <button onClick={() => setShowDiffModal(false)} className="btn btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
