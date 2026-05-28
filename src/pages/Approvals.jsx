import React, { useState, useEffect } from 'react';
import { FaCheck, FaTimes, FaInbox, FaHistory, FaCheckCircle, FaTimesCircle, FaEye } from 'react-icons/fa';
import { formatDate } from '../utils/helpers';

export default function Approvals({ user, addNotification }) {
  const [requests, setRequests] = useState([]);
  const [activeSubTab, setActiveSubTab] = useState('pending'); // 'pending' or 'history'
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, [activeSubTab]);

  const fetchRequests = async () => {
    try {
      let sql = `
        SELECT r.*, u.username as employee_name, p.name as target_product_name, p.quantity as target_product_qty 
        FROM inventory_requests r
        LEFT JOIN users u ON r.requested_by_user_id = u.id
        LEFT JOIN products p ON r.product_id = p.id
      `;
      
      if (activeSubTab === 'pending') {
        sql += ' WHERE r.status = "pending"';
      } else {
        sql += ' WHERE r.status IN ("approved", "rejected")';
      }
      
      sql += ' ORDER BY r.created_at DESC';
      const rows = await window.electronAPI.query(sql);
      setRequests(rows);
    } catch (e) {
      console.error('Failed to fetch approval requests:', e);
    }
  };

  const handleApprove = async (req) => {
    if (!window.confirm(`Are you sure you want to APPROVE this request?`)) return;

    try {
      const queries = [];
      const now = new Date().toISOString();

      if (req.request_type === 'update_stock') {
        // Update current stock level
        queries.push({
          sql: `UPDATE products SET quantity = quantity + ? WHERE id = ?`,
          params: [req.requested_qty, req.product_id]
        });

        // Log movement
        queries.push({
          sql: `INSERT INTO inventory_logs (product_id, log_type, quantity, previous_qty, new_qty, reason, user_id)
                VALUES (?, 'adjustment', ?, ?, ? + ?, ?, ?)`,
          params: [
            req.product_id, req.requested_qty, req.target_product_qty, 
            req.target_product_qty, req.target_product_qty, req.requested_qty, 
            `Approved stock adjust request by owner.`, user.id
          ]
        });
      } else if (req.request_type === 'add_product') {
        // Insert new product
        const details = JSON.parse(req.product_details_json);
        queries.push({
          sql: `INSERT INTO products (name, name_urdu, code, barcode, category_id, unit_type, purchase_price, sale_price, quantity, min_stock, expiry_date, supplier_name, batch_number, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
          params: [
            details.name, details.name_urdu, details.code, details.barcode,
            details.category_id, details.unit_type, details.purchase_price,
            details.sale_price, details.quantity, details.min_stock,
            details.expiry_date, details.supplier_name, details.batch_number
          ]
        });

        // Insert log in sub-query (we will let main process handle this or just do separate query in Node, but since transaction runs items in order, we can fetch last ID in a single query outside or insert log directly. Let's insert stock log by querying name matches which is safe in transactions)
        queries.push({
          sql: `INSERT INTO inventory_logs (product_id, log_type, quantity, previous_qty, new_qty, reason, user_id)
                VALUES ((SELECT id FROM products WHERE code = ?), 'purchase', ?, 0, ?, 'Approved brand new product entry.', ?)`,
          params: [details.code, details.quantity, details.quantity, user.id]
        });
      }

      // Update request header state
      queries.push({
        sql: `UPDATE inventory_requests 
              SET status = 'approved', approved_by_user_id = ?, approval_date = ?, notes = 'Request approved and processed.'
              WHERE id = ?`,
        params: [user.id, now, req.id]
      });

      // Insert audit log
      queries.push({
        sql: `INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'approve_request', ?)`,
        params: [user.id, `Approved inventory request ID: ${req.id} (${req.request_type}).`]
      });

      await window.electronAPI.transaction(queries);
      addNotification('Inventory request approved and updated successfully!', 'success');
      fetchRequests();
    } catch (e) {
      console.error('Approval transaction failed:', e);
      addNotification('Database query failed during approval.', 'error');
    }
  };

  const handleOpenRejectModal = (req) => {
    setSelectedRequest(req);
    setRejectNotes('');
    setShowRejectModal(true);
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectNotes.trim()) {
      addNotification('Please provide a reason for rejecting the request.', 'warning');
      return;
    }

    try {
      const now = new Date().toISOString();
      const queries = [
        {
          sql: `UPDATE inventory_requests 
                SET status = 'rejected', approved_by_user_id = ?, approval_date = ?, notes = ?
                WHERE id = ?`,
          params: [user.id, now, rejectNotes.trim(), selectedRequest.id]
        },
        {
          sql: `INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'reject_request', ?)`,
          params: [user.id, `Rejected inventory request ID: ${selectedRequest.id}. Reason: ${rejectNotes}`]
        }
      ];

      await window.electronAPI.transaction(queries);
      addNotification('Inventory request rejected successfully.', 'info');
      setShowRejectModal(false);
      fetchRequests();
    } catch (e) {
      console.error('Rejection transaction failed:', e);
      addNotification('Failed to process rejection.', 'error');
    }
  };

  const handleViewDetails = (req) => {
    setSelectedRequest(req);
    setShowDetailsModal(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Page Header */}
      <div>
        <h1 style={{ fontSize: '1.8rem', fontWeight: '800' }}>Pending Approvals</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Review and approve employee inventory or product addition requests</p>
      </div>

      {/* Sub Tabs Toggle */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '10px' }}>
        <button
          onClick={() => setActiveSubTab('pending')}
          style={{
            padding: '12px 20px',
            cursor: 'pointer',
            fontWeight: '700',
            fontSize: '0.9rem',
            color: activeSubTab === 'pending' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            borderBottom: activeSubTab === 'pending' ? '2.5px solid var(--accent-primary)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <FaInbox /> Pending Requests
        </button>
        <button
          onClick={() => setActiveSubTab('history')}
          style={{
            padding: '12px 20px',
            cursor: 'pointer',
            fontWeight: '700',
            fontSize: '0.9rem',
            color: activeSubTab === 'history' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            borderBottom: activeSubTab === 'history' ? '2.5px solid var(--accent-primary)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <FaHistory /> Approval History
        </button>
      </div>

      {/* Requests Listing Table */}
      <div className="table-container">
        <table className="custom-table" style={{ fontSize: '0.9rem' }}>
          <thead>
            <tr>
              <th>Date / Time</th>
              <th>Requested By</th>
              <th>Request Type</th>
              <th>Target Details</th>
              <th style={{ textAlign: 'center' }}>Qty</th>
              <th>Reason</th>
              {activeSubTab === 'history' ? (
                <>
                  <th>Status</th>
                  <th>Admin Notes</th>
                </>
              ) : (
                <th style={{ textAlign: 'center', width: '15%' }}>Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr>
                <td colSpan={activeSubTab === 'history' ? 8 : 7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                  No requests found.
                </td>
              </tr>
            ) : (
              requests.map(req => {
                let displayTarget = '';
                if (req.request_type === 'update_stock') {
                  displayTarget = req.target_product_name || 'Deleted Product';
                } else {
                  try {
                    const details = JSON.parse(req.product_details_json);
                    displayTarget = `[NEW] ${details.name}`;
                  } catch (e) {
                    displayTarget = 'New Product Entry';
                  }
                }

                return (
                  <tr key={req.id}>
                    <td>{formatDate(req.created_at)}</td>
                    <td style={{ textTransform: 'capitalize' }}><strong>{req.employee_name}</strong></td>
                    <td>
                      <span style={{
                        fontSize: '0.725rem',
                        fontWeight: 'bold',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: req.request_type === 'update_stock' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(139, 92, 246, 0.1)',
                        color: req.request_type === 'update_stock' ? 'var(--accent-primary)' : '#8b5cf6'
                      }}>
                        {req.request_type === 'update_stock' ? 'STOCK INTENSITY' : 'NEW PRODUCT'}
                      </span>
                    </td>
                    <td>
                      {displayTarget}
                      {req.request_type === 'add_product' && (
                        <button 
                          onClick={() => handleViewDetails(req)}
                          style={{ marginLeft: '8px', color: 'var(--accent-primary)', cursor: 'pointer', display: 'inline-flex', verticalAlign: 'middle' }}
                          title="View New Product Details"
                        >
                          <FaEye />
                        </button>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{req.requested_qty}</td>
                    <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }} title={req.reason}>
                      {req.reason}
                    </td>
                    
                    {activeSubTab === 'history' ? (
                      <>
                        <td>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontWeight: 'bold',
                            color: req.status === 'approved' ? 'var(--success)' : 'var(--danger)'
                          }}>
                            {req.status === 'approved' ? <FaCheckCircle /> : <FaTimesCircle />}
                            {req.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>{req.notes}</td>
                      </>
                    ) : (
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button 
                            onClick={() => handleApprove(req)} 
                            className="btn btn-success" 
                            style={{ padding: '6px 12px', fontSize: '0.8rem', gap: '4px' }}
                          >
                            <FaCheck size={10} /> Approve
                          </button>
                          <button 
                            onClick={() => handleOpenRejectModal(req)} 
                            className="btn btn-danger" 
                            style={{ padding: '6px 12px', fontSize: '0.8rem', gap: '4px' }}
                          >
                            <FaTimes size={10} /> Reject
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Reject Reason input Modal */}
      {showRejectModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="standard-card" style={{ width: '100%', maxWidth: '450px', padding: '24px', backgroundColor: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--danger)' }}><FaTimes /> Reject Request</h3>
              <button onClick={() => setShowRejectModal(false)} style={{ cursor: 'pointer', color: 'var(--text-tertiary)' }}><FaTimes size={18} /></button>
            </div>
            
            <form onSubmit={handleRejectSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Reason for Rejection *</label>
                <textarea 
                  value={rejectNotes} 
                  onChange={(e) => setRejectNotes(e.target.value)} 
                  className="input-field" 
                  style={{ height: '100px', padding: '10px 12px' }}
                  placeholder="e.g. Quantity seems incorrect, double check and re-submit."
                  required 
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowRejectModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-danger">Reject Request</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: View Details of New Product Request */}
      {showDetailsModal && selectedRequest && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="standard-card" style={{ width: '100%', maxWidth: '500px', padding: '24px', backgroundColor: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '1.1rem' }}><FaEye /> New Product Submission Details</h3>
              <button onClick={() => setShowDetailsModal(false)} style={{ cursor: 'pointer', color: 'var(--text-tertiary)' }}><FaTimes size={18} /></button>
            </div>
            
            {(() => {
              try {
                const details = JSON.parse(selectedRequest.product_details_json);
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.875rem' }}>
                    <div><strong>English Name:</strong> {details.name}</div>
                    <div><strong>Urdu Name:</strong> {details.name_urdu || 'N/A'}</div>
                    <div><strong>Product Code:</strong> {details.code}</div>
                    <div><strong>Barcode:</strong> {details.barcode || 'N/A'}</div>
                    <div><strong>Unit Type:</strong> {details.unit_type}</div>
                    <div><strong>Opening Qty:</strong> {details.quantity}</div>
                    <div><strong>Purchase Cost:</strong> Rs. {details.purchase_price.toFixed(2)}</div>
                    <div><strong>Retail price:</strong> Rs. {details.sale_price.toFixed(2)}</div>
                    <div><strong>Min threshold:</strong> {details.min_stock}</div>
                    <div><strong>Expiry Date:</strong> {details.expiry_date || 'N/A'}</div>
                    <div><strong>Supplier:</strong> {details.supplier_name || 'N/A'}</div>
                    <div><strong>Batch Number:</strong> {details.batch_number || 'N/A'}</div>
                  </div>
                );
              } catch (e) {
                return <div>Failed to parse product specifications.</div>;
              }
            })()}
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '10px' }}>
              <button onClick={() => setShowDetailsModal(false)} className="btn btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
