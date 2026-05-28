import React, { useState, useEffect } from 'react';
import { FaHistory, FaUserShield, FaSearch, FaExchangeAlt, FaEye, FaTimes, FaFileInvoiceDollar } from 'react-icons/fa';
import { formatDate, formatPrice } from '../utils/helpers';

export default function HistoryLogs({ user, addNotification }) {
  const [activeSubTab, setActiveSubTab] = useState('bill_history'); // 'bill_history' or 'audit_logs'
  const [historyList, setHistoryList] = useState([]);
  const [auditList, setAuditList] = useState([]);

  // Filter terms
  const [searchQuery, setSearchQuery] = useState('');
  
  // Diff Modal states
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [parsedDiff, setParsedDiff] = useState({ prev: null, next: null });

  useEffect(() => {
    if (activeSubTab === 'bill_history') {
      fetchBillHistory();
    } else {
      fetchAuditLogs();
    }
  }, [activeSubTab, searchQuery]);

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
      setHistoryList(rows);
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
      setAuditList(rows);
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Page Header */}
      <div>
        <h1 style={{ fontSize: '1.8rem', fontWeight: '800' }}>Revision & Audit Trails</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Track invoice modifications and employee security actions</p>
      </div>

      {/* Sub Tabs Toggle */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '10px' }}>
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
            gap: '8px'
          }}
        >
          <FaHistory /> Bill Update Revision Logs
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
            gap: '8px'
          }}
        >
          <FaUserShield /> System Audit Logs
        </button>
      </div>

      {/* Table Search filters bar */}
      <div className="standard-card" style={{ padding: '16px', display: 'flex', gap: '15px', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: '320px' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', display: 'flex' }}><FaSearch size={14} /></span>
          <input
            type="text"
            placeholder={activeSubTab === 'bill_history' ? 'Search by Bill Number or Cashier...' : 'Search by username or action...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field"
            style={{ paddingLeft: '36px', height: '40px', fontSize: '0.875rem' }}
          />
        </div>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Showing latest 50 logs. All records stored fully offline.</span>
      </div>

      {/* Conditional Listing Tables */}
      {activeSubTab === 'bill_history' ? (
        /* Bill Revision Logs Table */
        <div className="table-container">
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
      ) : (
        /* General System Audit Logs Table */
        <div className="table-container">
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
                        color: log.action.includes('login') ? 'var(--success)' : log.action.includes('delete') || log.action.includes('reject') ? 'var(--danger)' : 'var(--accent-primary)'
                      }}>
                        {log.action.toUpperCase()}
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

      {/* side-by-side Bill Comparison Revision Diff Modal */}
      {showDiffModal && selectedHistory && parsedDiff.prev && parsedDiff.next && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="standard-card" style={{ width: '100%', maxWidth: '850px', padding: '24px', backgroundColor: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FaFileInvoiceDollar /> Revision Diff comparison: <strong>{selectedHistory.bill_number}</strong> (Ver {selectedHistory.version - 1} vs Ver {selectedHistory.version})
              </h3>
              <button onClick={() => setShowDiffModal(false)} style={{ cursor: 'pointer', color: 'var(--text-tertiary)' }}><FaTimes size={18} /></button>
            </div>

            <div style={{ 
              backgroundColor: 'var(--bg-tertiary)', 
              borderRadius: 'var(--radius-sm)', 
              padding: '12px 16px', 
              fontSize: '0.825rem',
              color: 'var(--text-secondary)'
            }}>
              <strong>Cashier notes on revision:</strong> "{selectedHistory.reason}" 
              <br />
              <span style={{ fontSize: '0.75rem' }}>Modified by cashier on: {formatDate(selectedHistory.created_at)}</span>
            </div>

            {/* side-by-side comparison tables */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              
              {/* Previous version snapshot */}
              <div>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--danger)', marginBottom: '8px', borderBottom: '1.5px solid var(--danger)', paddingBottom: '4px' }}>
                  Version {selectedHistory.version - 1} State (Before)
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
                      {parsedDiff.prev.items.map((item, idx) => {
                        const nextItem = findItem(parsedDiff.next.items, item.product_id);
                        const isDeleted = !nextItem;
                        const isQtyChanged = nextItem && nextItem.quantity !== item.quantity;
                        
                        return (
                          <tr key={idx} style={{ 
                            backgroundColor: isDeleted ? 'rgba(239, 68, 68, 0.05)' : isQtyChanged ? 'rgba(245, 158, 11, 0.05)' : 'transparent',
                            textDecoration: isDeleted ? 'line-through' : 'none'
                          }}>
                            <td style={{ padding: '8px 6px' }}>{item.name}</td>
                            <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 'bold' }}>{item.quantity}</td>
                            <td style={{ padding: '8px 6px', textAlign: 'right' }}>Rs. {item.rate.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: '12px', fontSize: '0.9rem', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', padding: '0 8px' }}>
                  <span>Gross: Rs. {parsedDiff.prev.header.gross_amount.toFixed(2)}</span>
                  <span>Net Paid: Rs. {parsedDiff.prev.header.net_amount.toFixed(2)}</span>
                </div>
              </div>

              {/* New version snapshot */}
              <div>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--success)', marginBottom: '8px', borderBottom: '1.5px solid var(--success)', paddingBottom: '4px' }}>
                  Version {selectedHistory.version} State (After)
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
                      {parsedDiff.next.items.map((item, idx) => {
                        const prevItem = findItem(parsedDiff.prev.items, item.product_id);
                        const isAdded = !prevItem;
                        const isQtyChanged = prevItem && prevItem.quantity !== item.quantity;
                        
                        return (
                          <tr key={idx} style={{ 
                            backgroundColor: isAdded ? 'rgba(16, 185, 129, 0.05)' : isQtyChanged ? 'rgba(245, 158, 11, 0.05)' : 'transparent',
                            fontWeight: isAdded ? 'bold' : 'normal'
                          }}>
                            <td style={{ padding: '8px 6px' }}>
                              {item.name} {isAdded && <span style={{ fontSize: '0.65rem', color: 'var(--success)', verticalAlign: 'middle', marginLeft: '4px' }}>[NEW]</span>}
                            </td>
                            <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 'bold' }}>{item.quantity}</td>
                            <td style={{ padding: '8px 6px', textAlign: 'right' }}>Rs. {item.rate.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: '12px', fontSize: '0.9rem', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', padding: '0 8px' }}>
                  <span>Gross: Rs. {parsedDiff.next.header.gross_amount.toFixed(2)}</span>
                  <span>Net Paid: Rs. {parsedDiff.next.header.net_amount.toFixed(2)}</span>
                </div>
              </div>

            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '10px' }}>
              <button onClick={() => setShowDiffModal(false)} className="btn btn-secondary">Close comparison</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
