import React, { useState, useEffect } from 'react';
import { 
  FaSearch, 
  FaPlus, 
  FaEdit, 
  FaTrash, 
  FaExclamationCircle, 
  FaPaperPlane, 
  FaClock, 
  FaTimes, 
  FaWarehouse, 
  FaBox 
} from 'react-icons/fa';
import { formatPrice } from '../utils/helpers';

export default function Inventory({ user, addNotification }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  
  // Search / Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [filterStockStatus, setFilterStockStatus] = useState('all'); // 'all', 'low', 'out', 'expired'
  
  // Modal states
  const [showProductModal, setShowProductModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  
  // Product Form state (For Owner adding/editing)
  const [editingProduct, setEditingProduct] = useState(null);
  const [prodForm, setProdForm] = useState({
    name: '', name_urdu: '', code: '', barcode: '', category_id: '',
    unit_type: 'Piece', purchase_price: '', sale_price: '', quantity: '',
    min_stock: '5', expiry_date: '', supplier_name: '', batch_number: ''
  });

  // Request Form state (For Employee stock adjustment / product addition requests)
  const [requestForm, setRequestForm] = useState({
    request_type: 'update_stock', // 'update_stock' or 'add_product'
    product_id: '',
    requested_qty: '',
    reason: '',
    new_product_name: '',
    new_product_urdu: '',
    new_product_code: '',
    new_product_barcode: '',
    new_product_category: '',
    new_product_unit: 'Piece',
    new_product_purchase: '',
    new_product_sale: '',
    new_product_min: '5',
    new_product_expiry: '',
    new_product_supplier: '',
    new_product_batch: ''
  });

  const isOwner = user.role === 'owner';

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [searchQuery, selectedCategory, filterStockStatus]);

  const fetchProducts = async () => {
    try {
      let query = `
        SELECT p.*, c.name as category_name 
        FROM products p 
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.status = 'active'
      `;
      let params = [];

      // Filter by name/code/barcode
      if (searchQuery.trim()) {
        query += ' AND (p.name LIKE ? OR p.name_urdu LIKE ? OR p.code = ? OR p.barcode = ?)';
        const wildcard = `%${searchQuery}%`;
        params.push(wildcard, wildcard, searchQuery, searchQuery);
      }

      // Filter by category
      if (selectedCategory) {
        query += ' AND p.category_id = ?';
        params.push(selectedCategory);
      }

      // Filter by stock level/status
      if (filterStockStatus === 'low') {
        query += ' AND p.quantity <= p.min_stock AND p.quantity > 0';
      } else if (filterStockStatus === 'out') {
        query += ' AND p.quantity = 0';
      } else if (filterStockStatus === 'expired') {
        query += ' AND p.expiry_date IS NOT NULL AND date(p.expiry_date) <= date("now", "localtime")';
      }

      query += ' ORDER BY p.name ASC';
      const rows = await window.electronAPI.query(query, params);
      setProducts(rows);
    } catch (e) {
      console.error('Failed to fetch inventory:', e);
    }
  };

  const fetchCategories = async () => {
    try {
      const rows = await window.electronAPI.query('SELECT * FROM categories ORDER BY name ASC');
      setCategories(rows);
    } catch (e) {
      console.error('Failed to fetch categories:', e);
    }
  };

  // Owner Operations: Save Product Add / Edit
  const handleProductSubmit = async (e) => {
    e.preventDefault();
    if (!prodForm.name || !prodForm.code || !prodForm.purchase_price || !prodForm.sale_price) {
      addNotification('Please enter all required fields.', 'warning');
      return;
    }

    try {
      if (editingProduct) {
        // Edit flow
        const sql = `
          UPDATE products 
          SET name = ?, name_urdu = ?, code = ?, barcode = ?, category_id = ?, unit_type = ?, 
              purchase_price = ?, sale_price = ?, quantity = ?, min_stock = ?, expiry_date = ?, 
              supplier_name = ?, batch_number = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `;
        const params = [
          prodForm.name, prodForm.name_urdu, prodForm.code, prodForm.barcode || null,
          prodForm.category_id || null, prodForm.unit_type, parseFloat(prodForm.purchase_price),
          parseFloat(prodForm.sale_price), parseFloat(prodForm.quantity) || 0,
          parseFloat(prodForm.min_stock) || 5, prodForm.expiry_date || null,
          prodForm.supplier_name, prodForm.batch_number, editingProduct.id
        ];
        
        await window.electronAPI.run(sql, params);
        
        // Log movement if quantity changed
        const qtyDiff = (parseFloat(prodForm.quantity) || 0) - editingProduct.quantity;
        if (qtyDiff !== 0) {
          const logSql = `INSERT INTO inventory_logs (product_id, log_type, quantity, previous_qty, new_qty, reason, user_id)
                          VALUES (?, 'adjustment', ?, ?, ?, ?, ?)`;
          await window.electronAPI.run(logSql, [
            editingProduct.id, qtyDiff, editingProduct.quantity, parseFloat(prodForm.quantity) || 0, 
            `Direct owner stock adjustment`, user.id
          ]);
        }

        addNotification('Product updated successfully!', 'success');
      } else {
        // Add flow
        const sql = `
          INSERT INTO products (name, name_urdu, code, barcode, category_id, unit_type, purchase_price, sale_price, quantity, min_stock, expiry_date, supplier_name, batch_number, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
        `;
        const params = [
          prodForm.name, prodForm.name_urdu, prodForm.code, prodForm.barcode || null,
          prodForm.category_id || null, prodForm.unit_type, parseFloat(prodForm.purchase_price),
          parseFloat(prodForm.sale_price), parseFloat(prodForm.quantity) || 0,
          parseFloat(prodForm.min_stock) || 5, prodForm.expiry_date || null,
          prodForm.supplier_name, prodForm.batch_number
        ];
        const res = await window.electronAPI.run(sql, params);
        
        // Log movement
        if ((parseFloat(prodForm.quantity) || 0) > 0) {
          const logSql = `INSERT INTO inventory_logs (product_id, log_type, quantity, previous_qty, new_qty, reason, user_id)
                          VALUES (?, 'purchase', ?, 0, ?, 'Initial stock intake', ?)`;
          await window.electronAPI.run(logSql, [res.lastID, parseFloat(prodForm.quantity), parseFloat(prodForm.quantity), user.id]);
        }

        addNotification('Product added successfully!', 'success');
      }

      setShowProductModal(false);
      resetProductForm();
      fetchProducts();
    } catch (e) {
      console.error('Failed to save product:', e);
      addNotification('Database entry failure (Duplicate code/barcode?).', 'error');
    }
  };

  const deleteProduct = async (product) => {
    if (!window.confirm(`Are you sure you want to delete ${product.name}?`)) return;
    
    try {
      // Soft delete by setting status to deleted/inactive
      await window.electronAPI.run('UPDATE products SET status = "inactive", updated_at = CURRENT_TIMESTAMP WHERE id = ?', [product.id]);
      addNotification(`${product.name} deleted.`, 'info');
      fetchProducts();
    } catch (e) {
      console.error('Delete product error:', e);
    }
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setProdForm({
      name: product.name,
      name_urdu: product.name_urdu || '',
      code: product.code,
      barcode: product.barcode || '',
      category_id: product.category_id || '',
      unit_type: product.unit_type,
      purchase_price: product.purchase_price,
      sale_price: product.sale_price,
      quantity: product.quantity,
      min_stock: product.min_stock,
      expiry_date: product.expiry_date || '',
      supplier_name: product.supplier_name || '',
      batch_number: product.batch_number || ''
    });
    setShowProductModal(true);
  };

  // Employee Operations: Submit Request Flow
  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    
    if (requestForm.request_type === 'update_stock') {
      if (!requestForm.product_id || !requestForm.requested_qty || !requestForm.reason) {
        addNotification('Please enter product, quantity, and reason.', 'warning');
        return;
      }
    } else {
      if (!requestForm.new_product_name || !requestForm.new_product_code || !requestForm.new_product_purchase || !requestForm.new_product_sale || !requestForm.reason) {
        addNotification('Please fill in required new product fields and reason.', 'warning');
        return;
      }
    }

    try {
      const details = requestForm.request_type === 'add_product' ? JSON.stringify({
        name: requestForm.new_product_name,
        name_urdu: requestForm.new_product_urdu,
        code: requestForm.new_product_code,
        barcode: requestForm.new_product_barcode || null,
        category_id: requestForm.new_product_category || null,
        unit_type: requestForm.new_product_unit,
        purchase_price: parseFloat(requestForm.new_product_purchase),
        sale_price: parseFloat(requestForm.new_product_sale),
        quantity: parseFloat(requestForm.requested_qty) || 0,
        min_stock: parseFloat(requestForm.new_product_min) || 5,
        expiry_date: requestForm.new_product_expiry || null,
        supplier_name: requestForm.new_product_supplier,
        batch_number: requestForm.new_product_batch
      }) : null;

      const sql = `
        INSERT INTO inventory_requests (request_type, product_id, product_details_json, requested_qty, reason, requested_by_user_id, status)
        VALUES (?, ?, ?, ?, ?, ?, 'pending')
      `;
      const params = [
        requestForm.request_type,
        requestForm.request_type === 'update_stock' ? requestForm.product_id : null,
        details,
        parseFloat(requestForm.requested_qty) || 0,
        requestForm.reason.trim(),
        user.id
      ];

      await window.electronAPI.run(sql, params);
      addNotification('Inventory change request sent to Owner/Admin for approval!', 'success');
      setShowRequestModal(false);
      resetRequestForm();
    } catch (e) {
      console.error('Request submit error:', e);
      addNotification('Failed to submit approval request.', 'error');
    }
  };

  const resetProductForm = () => {
    setEditingProduct(null);
    setProdForm({
      name: '', name_urdu: '', code: '', barcode: '', category_id: '',
      unit_type: 'Piece', purchase_price: '', sale_price: '', quantity: '',
      min_stock: '5', expiry_date: '', supplier_name: '', batch_number: ''
    });
  };

  const resetRequestForm = () => {
    setRequestForm({
      request_type: 'update_stock',
      product_id: '',
      requested_qty: '',
      reason: '',
      new_product_name: '',
      new_product_urdu: '',
      new_product_code: '',
      new_product_barcode: '',
      new_product_category: '',
      new_product_unit: 'Piece',
      new_product_purchase: '',
      new_product_sale: '',
      new_product_min: '5',
      new_product_expiry: '',
      new_product_supplier: '',
      new_product_batch: ''
    });
  };

  const getExpiryClass = (expiryDate) => {
    if (!expiryDate) return '';
    const today = new Date();
    const exp = new Date(expiryDate);
    const diffTime = exp - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) return 'color-danger'; // Expired
    if (diffDays <= 7) return 'color-warning'; // Expiry warning
    return '';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: '800' }}>Inventory Management</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>View, track, and adjust bakery products and stock levels</p>
        </div>
        
        <div>
          {isOwner ? (
            <button onClick={() => { resetProductForm(); setShowProductModal(true); }} className="btn btn-primary">
              <FaPlus /> Add Product
            </button>
          ) : (
            <button onClick={() => { resetRequestForm(); setShowRequestModal(true); }} className="btn btn-primary">
              <FaPaperPlane /> Request Stock Adjust
            </button>
          )}
        </div>
      </div>

      {/* Inventory Filters Card */}
      <div className="standard-card" style={{ padding: '16px', display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
        
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', display: 'flex' }}><FaSearch size={14} /></span>
          <input
            type="text"
            placeholder="Search by name, code or barcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field"
            style={{ paddingLeft: '36px', height: '40px', fontSize: '0.875rem' }}
          />
        </div>

        {/* Category Filter */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="input-field"
          style={{ width: '180px', height: '40px', padding: '0 12px', fontSize: '0.875rem', cursor: 'pointer' }}
        >
          <option value="">All Categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Stock alerts Filter */}
        <select
          value={filterStockStatus}
          onChange={(e) => setFilterStockStatus(e.target.value)}
          className="input-field"
          style={{ width: '180px', height: '40px', padding: '0 12px', fontSize: '0.875rem', cursor: 'pointer' }}
        >
          <option value="all">All Stocks Status</option>
          <option value="low">Low Stock Alerts</option>
          <option value="out">Out of Stock Alerts</option>
          <option value="expired">Expired Products</option>
        </select>

      </div>

      {/* Products Table grid list */}
      <div className="table-container">
        <table className="custom-table" style={{ fontSize: '0.9rem' }}>
          <thead>
            <tr>
              <th>Product Code</th>
              <th>Product Name</th>
              <th>Category</th>
              <th style={{ textAlign: 'center' }}>Current Stock</th>
              <th style={{ textAlign: 'right' }}>Purchase Rate</th>
              <th style={{ textAlign: 'right' }}>Retail Price</th>
              <th>Expiry Date</th>
              {isOwner && <th style={{ textAlign: 'center', width: '10%' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={isOwner ? 8 : 7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                  No inventory products found matching filters.
                </td>
              </tr>
            ) : (
              products.map(prod => {
                const isOutOfStock = prod.quantity === 0;
                const isLowStock = prod.quantity <= prod.min_stock && prod.quantity > 0;
                const expClass = getExpiryClass(prod.expiry_date);
                
                return (
                  <tr key={prod.id}>
                    <td>
                      <strong style={{ fontFamily: 'monospace' }}>{prod.code}</strong>
                      {prod.barcode && <div style={{ fontSize: '0.725rem', color: 'var(--text-tertiary)' }}>Barcode: {prod.barcode}</div>}
                    </td>
                    <td>
                      <strong>{prod.name}</strong>
                      {prod.name_urdu && <div style={{ direction: 'rtl', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-urdu)' }}>{prod.name_urdu}</div>}
                    </td>
                    <td>{prod.category_name || 'Unassigned'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span 
                        style={{
                          fontWeight: 'bold',
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-full)',
                          fontSize: '0.825rem',
                          backgroundColor: isOutOfStock ? 'rgba(239, 68, 68, 0.1)' : isLowStock ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                          color: isOutOfStock ? 'var(--danger)' : isLowStock ? 'var(--warning)' : 'var(--success)'
                        }}
                        className={isOutOfStock ? 'pulse-red' : ''}
                      >
                        {prod.quantity} {prod.unit_type}s
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>{formatPrice(prod.purchase_price)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--accent-primary)' }}>{formatPrice(prod.sale_price)}</td>
                    <td>
                      {prod.expiry_date ? (
                        <span 
                          style={{ 
                            fontWeight: '600',
                            color: expClass === 'color-danger' ? 'var(--danger)' : expClass === 'color-warning' ? 'var(--warning)' : 'inherit'
                          }}
                        >
                          {new Date(prod.expiry_date).toLocaleDateString()}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-tertiary)' }}>No Expiry</span>
                      )}
                    </td>
                    {isOwner && (
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button onClick={() => openEditModal(prod)} style={{ color: 'var(--warning)', cursor: 'pointer' }} title="Edit"><FaEdit /></button>
                          <button onClick={() => deleteProduct(prod)} style={{ color: 'var(--danger)', cursor: 'pointer' }} title="Delete"><FaTrash /></button>
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

      {/* Modal 1: Owner Add/Edit Product */}
      {showProductModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="standard-card" style={{ width: '100%', maxWidth: '650px', padding: '24px', backgroundColor: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '1.1rem' }}><FaWarehouse /> {editingProduct ? 'Edit Inventory Product' : 'Add New Product (Owner)'}</h3>
              <button onClick={() => setShowProductModal(false)} style={{ cursor: 'pointer', color: 'var(--text-tertiary)' }}><FaTimes size={18} /></button>
            </div>
            
            <form onSubmit={handleProductSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              
              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Product Name *</label>
                <input type="text" value={prodForm.name} onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })} className="input-field" placeholder="e.g. Dawn Milk Bread" required />
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Product Name (Urdu)</label>
                <input type="text" value={prodForm.name_urdu} onChange={(e) => setProdForm({ ...prodForm, name_urdu: e.target.value })} className="input-field" placeholder="ڈبل روٹی" style={{ direction: 'rtl', fontFamily: 'var(--font-urdu)' }} />
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Product Code (Unique) *</label>
                <input type="text" value={prodForm.code} onChange={(e) => setProdForm({ ...prodForm, code: e.target.value })} className="input-field" placeholder="e.g. 1001" required />
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Barcode Scanner Input</label>
                <input type="text" value={prodForm.barcode} onChange={(e) => setProdForm({ ...prodForm, barcode: e.target.value })} className="input-field" placeholder="Scan product barcode..." />
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Category *</label>
                <select value={prodForm.category_id} onChange={(e) => setProdForm({ ...prodForm, category_id: e.target.value })} className="input-field" required>
                  <option value="">Select Category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Measurement Unit *</label>
                <select value={prodForm.unit_type} onChange={(e) => setProdForm({ ...prodForm, unit_type: e.target.value })} className="input-field" required>
                  {['Piece', 'KG', 'Gram', 'Liter', 'ML', 'Box', 'Tray', 'Packet', 'Dozen', 'Bottle'].map(unit => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Purchase Price (Rs.) *</label>
                <input type="number" step="0.01" value={prodForm.purchase_price} onChange={(e) => setProdForm({ ...prodForm, purchase_price: e.target.value })} className="input-field" placeholder="0.00" required />
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Sale Price / retail (Rs.) *</label>
                <input type="number" step="0.01" value={prodForm.sale_price} onChange={(e) => setProdForm({ ...prodForm, sale_price: e.target.value })} className="input-field" placeholder="0.00" required />
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Opening Quantity *</label>
                <input type="number" value={prodForm.quantity} onChange={(e) => setProdForm({ ...prodForm, quantity: e.target.value })} className="input-field" placeholder="0" required />
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Min Stock Threshold Alert *</label>
                <input type="number" value={prodForm.min_stock} onChange={(e) => setProdForm({ ...prodForm, min_stock: e.target.value })} className="input-field" placeholder="5" required />
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Expiry Date</label>
                <input type="date" value={prodForm.expiry_date} onChange={(e) => setProdForm({ ...prodForm, expiry_date: e.target.value })} className="input-field" />
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Supplier Name</label>
                <input type="text" value={prodForm.supplier_name} onChange={(e) => setProdForm({ ...prodForm, supplier_name: e.target.value })} className="input-field" placeholder="Supplier" />
              </div>

              <div className="input-group" style={{ margin: 0, gridColumn: 'span 2' }}>
                <label className="input-label">Batch Number / Lot</label>
                <input type="text" value={prodForm.batch_number} onChange={(e) => setProdForm({ ...prodForm, batch_number: e.target.value })} className="input-field" placeholder="Batch details" />
              </div>

              <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowProductModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-success">Save Product</button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Employee Request Stock Adjust / Add Product */}
      {showRequestModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="standard-card" style={{ width: '100%', maxWidth: '600px', padding: '24px', backgroundColor: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '1.1rem' }}><FaPaperPlane /> Request Inventory Change (Approval System)</h3>
              <button onClick={() => setShowRequestModal(false)} style={{ cursor: 'pointer', color: 'var(--text-tertiary)' }}><FaTimes size={18} /></button>
            </div>
            
            <form onSubmit={handleRequestSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              
              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Request Type</label>
                <select 
                  value={requestForm.request_type} 
                  onChange={(e) => setRequestForm({ ...requestForm, request_type: e.target.value })} 
                  className="input-field"
                >
                  <option value="update_stock">Adjust/Increase Current Product Stock</option>
                  <option value="add_product">Add a Brand New Product to Database</option>
                </select>
              </div>

              {requestForm.request_type === 'update_stock' ? (
                <>
                  <div className="input-group" style={{ margin: 0 }}>
                    <label className="input-label">Select Target Product *</label>
                    <select 
                      value={requestForm.product_id} 
                      onChange={(e) => setRequestForm({ ...requestForm, product_id: e.target.value })} 
                      className="input-field"
                      required
                    >
                      <option value="">-- Choose Product --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} (Code: {p.code} | Stock: {p.quantity})</option>
                      ))}
                    </select>
                  </div>

                  <div className="input-group" style={{ margin: 0 }}>
                    <label className="input-label">Stock Quantity to ADD/ADJUST *</label>
                    <input 
                      type="number" 
                      placeholder="e.g. 50" 
                      value={requestForm.requested_qty} 
                      onChange={(e) => setRequestForm({ ...requestForm, requested_qty: e.target.value })} 
                      className="input-field" 
                      required 
                    />
                  </div>
                </>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  
                  <div className="input-group" style={{ margin: 0 }}>
                    <label className="input-label">New Product Name *</label>
                    <input type="text" value={requestForm.new_product_name} onChange={(e) => setRequestForm({ ...requestForm, new_product_name: e.target.value })} className="input-field" required />
                  </div>

                  <div className="input-group" style={{ margin: 0 }}>
                    <label className="input-label">Product Name (Urdu)</label>
                    <input type="text" value={requestForm.new_product_urdu} onChange={(e) => setRequestForm({ ...requestForm, new_product_urdu: e.target.value })} className="input-field" style={{ direction: 'rtl', fontFamily: 'var(--font-urdu)' }} />
                  </div>

                  <div className="input-group" style={{ margin: 0 }}>
                    <label className="input-label">Product Code *</label>
                    <input type="text" value={requestForm.new_product_code} onChange={(e) => setRequestForm({ ...requestForm, new_product_code: e.target.value })} className="input-field" required />
                  </div>

                  <div className="input-group" style={{ margin: 0 }}>
                    <label className="input-label">Barcode</label>
                    <input type="text" value={requestForm.new_product_barcode} onChange={(e) => setRequestForm({ ...requestForm, new_product_barcode: e.target.value })} className="input-field" />
                  </div>

                  <div className="input-group" style={{ margin: 0 }}>
                    <label className="input-label">Category *</label>
                    <select value={requestForm.new_product_category} onChange={(e) => setRequestForm({ ...requestForm, new_product_category: e.target.value })} className="input-field" required>
                      <option value="">Select Category</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  <div className="input-group" style={{ margin: 0 }}>
                    <label className="input-label">Unit *</label>
                    <select value={requestForm.new_product_unit} onChange={(e) => setRequestForm({ ...requestForm, new_product_unit: e.target.value })} className="input-field" required>
                      {['Piece', 'KG', 'Gram', 'Liter', 'ML', 'Box', 'Tray', 'Packet', 'Dozen', 'Bottle'].map(unit => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                    </select>
                  </div>

                  <div className="input-group" style={{ margin: 0 }}>
                    <label className="input-label">Purchase Price (Rs.) *</label>
                    <input type="number" step="0.01" value={requestForm.new_product_purchase} onChange={(e) => setRequestForm({ ...requestForm, new_product_purchase: e.target.value })} className="input-field" required />
                  </div>

                  <div className="input-group" style={{ margin: 0 }}>
                    <label className="input-label">Retail Price (Rs.) *</label>
                    <input type="number" step="0.01" value={requestForm.new_product_sale} onChange={(e) => setRequestForm({ ...requestForm, new_product_sale: e.target.value })} className="input-field" required />
                  </div>

                  <div className="input-group" style={{ margin: 0 }}>
                    <label className="input-label">Opening Quantity *</label>
                    <input type="number" value={requestForm.requested_qty} onChange={(e) => setRequestForm({ ...requestForm, requested_qty: e.target.value })} className="input-field" required />
                  </div>

                  <div className="input-group" style={{ margin: 0 }}>
                    <label className="input-label">Min Stock Threshold *</label>
                    <input type="number" value={requestForm.new_product_min} onChange={(e) => setRequestForm({ ...requestForm, new_product_min: e.target.value })} className="input-field" required />
                  </div>

                  <div className="input-group" style={{ margin: 0 }}>
                    <label className="input-label">Expiry Date</label>
                    <input type="date" value={requestForm.new_product_expiry} onChange={(e) => setRequestForm({ ...requestForm, new_product_expiry: e.target.value })} className="input-field" />
                  </div>

                  <div className="input-group" style={{ margin: 0 }}>
                    <label className="input-label">Supplier Name</label>
                    <input type="text" value={requestForm.new_product_supplier} onChange={(e) => setRequestForm({ ...requestForm, new_product_supplier: e.target.value })} className="input-field" />
                  </div>

                </div>
              )}

              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Reason / Justification for Request *</label>
                <textarea 
                  value={requestForm.reason} 
                  onChange={(e) => setRequestForm({ ...requestForm, reason: e.target.value })} 
                  className="input-field" 
                  style={{ height: '80px', padding: '10px 12px' }}
                  placeholder="e.g. Received new shipment from Dawn Foods, need to update shelf count."
                  required 
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowRequestModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary"><FaPaperPlane /> Send Request</button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
