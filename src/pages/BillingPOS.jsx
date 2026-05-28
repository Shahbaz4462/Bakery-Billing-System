import React, { useState, useEffect, useRef } from 'react';
import { 
  FaSearch, 
  FaPlus, 
  FaMinus, 
  FaTrash, 
  FaPause, 
  FaPlay, 
  FaPrint, 
  FaCalculator, 
  FaTimes, 
  FaCheck, 
  FaLanguage, 
  FaSearchPlus, 
  FaHistory 
} from 'react-icons/fa';
import ReceiptPreview from '../components/ReceiptPreview';
import { generateBillNumber } from '../utils/helpers';

export default function BillingPOS({ user, settings, addNotification, language: initialLanguage = 'en' }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [cart, setCart] = useState([]);
  const [discountVal, setDiscountVal] = useState('');
  const [discountType, setDiscountType] = useState('flat'); // 'flat' or 'percent'
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [language, setLanguage] = useState(initialLanguage);
  
  // Hold & Draft Bills State
  const [drafts, setDrafts] = useState([]);
  const [showDraftsModal, setShowDraftsModal] = useState(false);
  
  // Editing Old Bill State
  const [editingBillId, setEditingBillId] = useState(null);
  const [editingBillNumber, setEditingBillNumber] = useState('');
  const [editingBillUpdatesCount, setEditingBillUpdatesCount] = useState(0);
  const [showHistorySearchModal, setShowHistorySearchModal] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historySearchResults, setHistorySearchResults] = useState([]);
  const [billUpdateReason, setBillUpdateReason] = useState('');

  // DOM Refs for Fast Keyboard Shortcuts
  const searchInputRef = useRef(null);
  const qtyInputRefs = useRef({});

  const taxRate = parseFloat(settings.bakery_tax_rate) || 0;
  const isUrdu = language === 'ur';

  // Fetch products on query change
  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      const delayDebounceFn = setTimeout(async () => {
        try {
          const sql = `
            SELECT * FROM products 
            WHERE (name LIKE ? OR name_urdu LIKE ? OR code = ? OR barcode = ?)
            AND status = 'active' AND quantity > 0
            LIMIT 5
          `;
          const wildcard = `%${searchQuery}%`;
          const rows = await window.electronAPI.query(sql, [wildcard, wildcard, searchQuery, searchQuery]);
          setSearchResults(rows);
        } catch (e) {
          console.error('POS search query failed:', e);
        }
      }, 150);
      return () => clearTimeout(delayDebounceFn);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  // Global Keyboard Shortcut Controller
  useEffect(() => {
    const handleKeyDown = (e) => {
      // F1: Focus Search
      if (e.key === 'F1') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      // F2: Complete Checkout (Cash)
      if (e.key === 'F2') {
        e.preventDefault();
        if (cart.length > 0) handleCheckout('Cash');
      }
      // F3: Hold Cart (Draft)
      if (e.key === 'F3') {
        e.preventDefault();
        if (cart.length > 0) handleHoldBill();
      }
      // F4: Switch Urdu / English
      if (e.key === 'F4') {
        e.preventDefault();
        toggleLanguage();
      }
      // ESC: Close Search Dropdowns / Clear fields
      if (e.key === 'Escape') {
        setSearchQuery('');
        setSearchResults([]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, language, customerName, customerPhone, discountVal, discountType, editingBillId, billUpdateReason]);

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'ur' : 'en');
    addNotification(
      isUrdu ? 'Receipt language set to English' : 'بل کی زبان تبدیل کر کے اردو کر دی گئی ہے', 
      'info'
    );
  };

  // Cart Operations
  const addToCart = (product) => {
    const existingIndex = cart.findIndex(item => item.id === product.id);
    
    if (existingIndex > -1) {
      const updatedCart = [...cart];
      if (updatedCart[existingIndex].cartQty < product.quantity) {
        updatedCart[existingIndex].cartQty += 1;
        setCart(updatedCart);
        addNotification(`${product.name} quantity increased`, 'success');
      } else {
        addNotification(`Cannot add more. Max stock available: ${product.quantity}`, 'warning');
      }
    } else {
      setCart([...cart, { ...product, cartQty: 1 }]);
      addNotification(`${product.name} added to cart`, 'success');
    }
    
    setSearchQuery('');
    setSearchResults([]);
    searchInputRef.current?.focus();
  };

  const updateCartQty = (productId, newQty) => {
    const index = cart.findIndex(item => item.id === productId);
    if (index === -1) return;
    
    const maxStock = cart[index].quantity;
    
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }

    if (newQty > maxStock && !editingBillId) {
      addNotification(`Only ${maxStock} in stock!`, 'warning');
      newQty = maxStock;
    }

    const updatedCart = [...cart];
    updatedCart[index].cartQty = newQty;
    setCart(updatedCart);
  };

  const removeFromCart = (productId) => {
    const updatedCart = cart.filter(item => item.id !== productId);
    setCart(updatedCart);
    addNotification('Item removed from cart', 'info');
  };

  // Calculations
  const calculateGross = () => {
    return cart.reduce((sum, item) => sum + (item.sale_price * item.cartQty), 0);
  };

  const calculateDiscount = () => {
    const gross = calculateGross();
    const val = parseFloat(discountVal) || 0;
    if (val <= 0) return 0;
    
    if (discountType === 'percent') {
      return gross * (val / 100);
    }
    return val;
  };

  const calculateTax = () => {
    const taxable = calculateGross() - calculateDiscount();
    return taxable * (taxRate / 100);
  };

  const calculateNet = () => {
    const net = calculateGross() - calculateDiscount() + calculateTax();
    return Math.max(0, Math.round(net)); // round-off to nearest rupee
  };

  // Checkout Operations — shouldPrint controls whether printer fires
  const handleCheckout = async (selectedMethod = paymentMethod, shouldPrint = true) => {
    if (cart.length === 0) {
      addNotification('Cart is empty', 'warning');
      return;
    }

    const gross    = calculateGross();
    const discount = calculateDiscount();
    const tax      = calculateTax();
    const net      = calculateNet();
    const roundOff = net - (gross - discount + tax);

    // Editing an existing invoice (Approval / Audit Flow)
    if (editingBillId) {
      if (user.role === 'employee' && editingBillUpdatesCount >= 2) {
        addNotification('Employee update limit reached (Max 2 updates allowed). Contact owner.', 'error');
        return;
      }
      if (!billUpdateReason.trim()) {
        addNotification('Please specify a reason for modifying this bill.', 'warning');
        return;
      }

      await saveBillUpdate(selectedMethod, gross, discount, tax, net, roundOff, shouldPrint);
      return;
    }

    // Creating a new invoice
    try {
      const billNo = await generateBillNumber();
      
      // We will perform the stock deduction and invoice entry in a single ATOMIC transaction!
      const queries = [];
      
      // 1. Insert invoice header
      queries.push({
        sql: `INSERT INTO bills (bill_number, customer_name, customer_phone, gross_amount, discount, net_amount, payment_method, tax_amount, round_off, employee_id, notes, status)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        params: [billNo, customerName.trim(), customerPhone.trim(), gross, discount, net, selectedMethod, tax, roundOff, user.id, notes.trim()]
      });

      // 2. Add bill items & decrease stock levels
      cart.forEach(item => {
        // Insert item detail
        queries.push({
          sql: `INSERT INTO bill_items (bill_id, product_id, name, name_urdu, quantity, rate, amount)
                VALUES ((SELECT id FROM bills WHERE bill_number = ?), ?, ?, ?, ?, ?, ?)`,
          params: [billNo, item.id, item.name, item.name_urdu, item.cartQty, item.sale_price, item.sale_price * item.cartQty]
        });

        // Deduct inventory stock
        queries.push({
          sql: `UPDATE products SET quantity = quantity - ? WHERE id = ?`,
          params: [item.cartQty, item.id]
        });

        // Log stock movement
        queries.push({
          sql: `INSERT INTO inventory_logs (product_id, log_type, quantity, previous_qty, new_qty, reason, user_id)
                VALUES (?, 'sale', ?, ?, ? - ?, ?, ?)`,
          params: [item.id, item.cartQty, item.quantity, item.quantity, item.quantity, item.cartQty, `Sold in bill: ${billNo}`, user.id]
        });
      });

      // 3. Log Audit trail
      queries.push({
        sql: `INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'create_bill', ?)`,
        params: [user.id, `Created bill ${billNo}. Net: Rs. ${net.toFixed(2)}.`]
      });

      // Execute transaction securely
      await window.electronAPI.transaction(queries);
      
      if (shouldPrint) {
        triggerThermalPrint(billNo, selectedMethod);
        addNotification(`Invoice ${billNo} saved & printed successfully!`, 'success');
      } else {
        addNotification(`Invoice ${billNo} saved successfully!`, 'success');
      }
      resetPOS();
    } catch (err) {
      console.error('POS transaction failure:', err);
      addNotification('POS checkout error. Check logs.', 'error');
    }
  };

  // Direct HTML thermal printing to the electron printing bridge
  const triggerThermalPrint = async (billNo, method) => {
    const gross = calculateGross();
    const discount = calculateDiscount();
    const tax = calculateTax();
    const net = calculateNet();
    
    // Construct HTML content exactly like receipt preview
    const receiptHtml = document.getElementById('receipt-preview-inner').innerHTML;
    
    try {
      const printer = settings.receipt_printer_name || '';
      const paperSize = settings.receipt_paper_size || '80mm';
      
      const printRes = await window.electronAPI.printReceipt(receiptHtml, printer, paperSize);
      if (printRes.success) {
        addNotification('Sent to printer.', 'info');
      } else {
        addNotification(`Printing error: ${printRes.error}`, 'error');
      }
    } catch (e) {
      console.error('Print trigger failed:', e);
    }
  };

  // Modify Bill & Save revision flow
  const saveBillUpdate = async (selectedMethod, gross, discount, tax, net, roundOff, shouldPrint = true) => {
    try {
      // 1. Fetch the OLD bill details for history comparison
      const oldBillRows = await window.electronAPI.query('SELECT * FROM bills WHERE id = ?', [editingBillId]);
      const oldItemsRows = await window.electronAPI.query('SELECT * FROM bill_items WHERE bill_id = ?', [editingBillId]);
      
      if (!oldBillRows || oldBillRows.length === 0) return;
      const oldBill = oldBillRows[0];
      
      const oldVersionJson = JSON.stringify({
        header: oldBill,
        items: oldItemsRows
      });

      const queries = [];
      
      // Restore old stock quantities in database (Rollback)
      for (const oldItem of oldItemsRows) {
        queries.push({
          sql: `UPDATE products SET quantity = quantity + ? WHERE id = ?`,
          params: [oldItem.quantity, oldItem.product_id]
        });
      }

      // Delete old items
      queries.push({
        sql: `DELETE FROM bill_items WHERE bill_id = ?`,
        params: [editingBillId]
      });

      // Update Bill Header details
      queries.push({
        sql: `UPDATE bills 
              SET gross_amount = ?, discount = ?, net_amount = ?, payment_method = ?, tax_amount = ?, round_off = ?, customer_name = ?, customer_phone = ?, notes = ?, update_count = update_count + 1, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?`,
        params: [gross, discount, net, selectedMethod, tax, roundOff, customerName.trim(), customerPhone.trim(), notes.trim(), editingBillId]
      });

      // Re-deduct stock for updated cart & insert new items
      cart.forEach(item => {
        queries.push({
          sql: `INSERT INTO bill_items (bill_id, product_id, name, name_urdu, quantity, rate, amount)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          params: [editingBillId, item.id, item.name, item.name_urdu, item.cartQty, item.sale_price, item.sale_price * item.cartQty]
        });

        queries.push({
          sql: `UPDATE products SET quantity = quantity - ? WHERE id = ?`,
          params: [item.cartQty, item.id]
        });

        queries.push({
          sql: `INSERT INTO inventory_logs (product_id, log_type, quantity, previous_qty, new_qty, reason, user_id)
                VALUES (?, 'adjustment', ?, ?, ? - ?, ?, ?)`,
          params: [item.id, item.cartQty, item.quantity, item.quantity, item.quantity, item.cartQty, `Updated in bill: ${editingBillNumber}`, user.id]
        });
      });

      // Construct New Version snapshot JSON
      const newVersionJson = JSON.stringify({
        header: { ...oldBill, gross_amount: gross, discount, net_amount: net, payment_method: selectedMethod, tax_amount: tax },
        items: cart.map(i => ({ product_id: i.id, name: i.name, quantity: i.cartQty, rate: i.sale_price }))
      });

      // Record bill history details
      queries.push({
        sql: `INSERT INTO bill_history (bill_id, version, previous_version_json, new_version_json, changed_by_user_id, change_type, reason)
              VALUES (?, ?, ?, ?, ?, 'update', ?)`,
        params: [editingBillId, oldBill.update_count + 1, oldVersionJson, newVersionJson, user.id, billUpdateReason.trim()]
      });

      // Log Audit activity
      queries.push({
        sql: `INSERT INTO audit_logs (user_id, action, details) VALUES (?, 'update_bill', ?)`,
        params: [user.id, `Modified bill ${editingBillNumber}. Reason: ${billUpdateReason}.`]
      });

      await window.electronAPI.transaction(queries);
      addNotification(`Bill ${editingBillNumber} updated successfully!`, 'success');
      
      if (shouldPrint) {
        triggerThermalPrint(editingBillNumber, selectedMethod);
      }
      
      resetPOS();
    } catch (err) {
      console.error('Update POS transaction failed:', err);
      addNotification('POS update error.', 'error');
    }
  };

  // Hold current Cart (Save Draft)
  const handleHoldBill = () => {
    if (cart.length === 0) return;
    
    const newDraft = {
      id: Date.now(),
      customerName: customerName || 'Walk-In Customer',
      customerPhone,
      cart: [...cart],
      discountVal,
      discountType,
      notes,
      language,
      date: new Date()
    };

    setDrafts([newDraft, ...drafts]);
    addNotification('Cart holds created.', 'info');
    resetPOS();
  };

  const resumeDraft = (draft) => {
    setCart(draft.cart);
    setCustomerName(draft.customerName === 'Walk-In Customer' ? '' : draft.customerName);
    setCustomerPhone(draft.customerPhone);
    setDiscountVal(draft.discountVal);
    setDiscountType(draft.discountType);
    setNotes(draft.notes);
    setLanguage(draft.language);
    
    setDrafts(drafts.filter(d => d.id !== draft.id));
    setShowDraftsModal(false);
    addNotification('Cart resumed successfully.', 'success');
  };

  // Pull past invoice for revision search
  const handleHistorySearch = async () => {
    if (!historySearchQuery.trim()) return;
    
    try {
      const sql = `
        SELECT b.*, u.username as employee_name 
        FROM bills b 
        JOIN users u ON b.employee_id = u.id
        WHERE b.bill_number = ? OR b.customer_phone = ? OR b.customer_name LIKE ?
        ORDER BY b.created_at DESC
        LIMIT 5
      `;
      const rows = await window.electronAPI.query(sql, [historySearchQuery, historySearchQuery, `%${historySearchQuery}%`]);
      setHistorySearchResults(rows);
    } catch (e) {
      console.error('POS bill history query failed:', e);
    }
  };

  const loadBillForEditing = async (bill) => {
    if (bill.status === 'cancelled') {
      addNotification('Cannot edit a cancelled bill.', 'warning');
      return;
    }

    try {
      // Fetch bill items
      const items = await window.electronAPI.query('SELECT * FROM bill_items WHERE bill_id = ?', [bill.id]);
      
      // Fetch actual current stocks of products to prevent oversell
      const productsMap = {};
      const productIds = items.map(i => i.product_id);
      if (productIds.length > 0) {
        const prodRows = await window.electronAPI.query(`SELECT id, quantity FROM products WHERE id IN (${productIds.join(',')})`);
        prodRows.forEach(p => { productsMap[p.id] = p.quantity; });
      }

      const cartFormat = items.map(item => ({
        id: item.product_id,
        name: item.name,
        name_urdu: item.name_urdu,
        sale_price: item.rate,
        cartQty: item.quantity,
        quantity: (productsMap[item.product_id] || 0) + item.quantity // current stock + already purchased in this bill
      }));

      setCart(cartFormat);
      setCustomerName(bill.customer_name || '');
      setCustomerPhone(bill.customer_phone || '');
      setDiscountVal(bill.discount.toString());
      setDiscountType('flat');
      setNotes(bill.notes || '');
      setEditingBillId(bill.id);
      setEditingBillNumber(bill.bill_number);
      setEditingBillUpdatesCount(bill.update_count);
      
      setShowHistorySearchModal(false);
      addNotification(`Loaded invoice ${bill.bill_number} for updates.`, 'info');
    } catch (e) {
      console.error('Load bill for editing error:', e);
      addNotification('Failed to load bill items.', 'error');
    }
  };

  const resetPOS = () => {
    setCart([]);
    setSearchQuery('');
    setSearchResults([]);
    setDiscountVal('');
    setDiscountType('flat');
    setCustomerName('');
    setCustomerPhone('');
    setNotes('');
    setEditingBillId(null);
    setEditingBillNumber('');
    setEditingBillUpdatesCount(0);
    setBillUpdateReason('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* POS Top Bar Controls */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px',
        padding: '10px 20px',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-sm)'
      }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{isUrdu ? 'بلنگ انٹرفیس (POS)' : 'Cashier Counter (POS)'}</span>
            {editingBillId && (
              <span style={{ 
                fontSize: '0.75rem', 
                backgroundColor: 'var(--danger)', 
                color: '#fff', 
                padding: '4px 8px', 
                borderRadius: '4px' 
              }}>
                {isUrdu ? `بل ترمیم: ${editingBillNumber}` : `REVISING BILL: ${editingBillNumber}`}
              </span>
            )}
          </h2>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {/* Active Hold Bills Button */}
          <button 
            onClick={() => setShowDraftsModal(true)} 
            className="btn btn-secondary"
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            <FaPause /> {isUrdu ? `ہولڈ بلز (${drafts.length})` : `Hold Bills (${drafts.length})`}
          </button>

          {/* Edit/Refund Search Button */}
          <button 
            onClick={() => setShowHistorySearchModal(true)} 
            className="btn btn-secondary"
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            <FaHistory /> {isUrdu ? 'بل ترمیم کریں' : 'Revise / Refund Bill'}
          </button>

          {/* Language Toggle Button */}
          <button 
            onClick={toggleLanguage} 
            className="btn btn-secondary"
            style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', gap: '6px' }}
          >
            <FaLanguage size={16} /> {isUrdu ? 'English Bill' : 'اردو بل'}
          </button>
        </div>
      </div>

      {/* POS Core Layout */}
      <div className="pos-grid">
        {/* Left Column: Product Searches & Cart Cart */}
        <div className="pos-billing-area">
          <div className="standard-card" style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            
            {/* Search Input bar */}
            <div style={{ position: 'relative', width: '100%' }}>
              <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>
                <FaSearch />
              </span>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isUrdu ? 'پروڈکٹ کوڈ / نام / بارکوڈ اسکین کریں... (F1)' : 'Scan barcode or type name/code... (F1)'}
                className="input-field"
                style={{ paddingLeft: '44px', paddingRight: '16px', height: '48px' }}
              />

              {/* Instant Search Results Dropdown */}
              {searchResults.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '52px',
                  left: 0,
                  width: '100%',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 200,
                  overflow: 'hidden'
                }}>
                  {searchResults.map(prod => (
                    <div
                      key={prod.id}
                      onClick={() => addToCart(prod)}
                      style={{
                        padding: '12px 16px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderBottom: '1px solid var(--border-color)'
                      }}
                      className="search-row-hover"
                    >
                      <div>
                        <strong style={{ fontSize: '0.95rem' }}>{prod.name}</strong>
                        {prod.name_urdu && <span style={{ marginRight: '8px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-urdu)', fontSize: '0.8rem' }}>{prod.name_urdu}</span>}
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Code: {prod.code} | Barcode: {prod.barcode}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <strong style={{ color: 'var(--accent-primary)' }}>Rs. {prod.sale_price.toFixed(2)}</strong>
                        <div style={{ fontSize: '0.75rem', color: prod.quantity < prod.min_stock ? 'var(--danger)' : 'var(--success)', fontWeight: 'bold' }}>
                          Stock: {prod.quantity} {prod.unit_type}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cart Table Cart */}
            <div className="pos-bill-cart" style={{ flex: 1, overflowY: 'auto', marginTop: '15px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', width: '40%' }}>{isUrdu ? 'تفصیل' : 'Description'}</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', width: '25%' }}>{isUrdu ? 'تعداد' : 'Qty'}</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', width: '15%' }}>{isUrdu ? 'قیمت' : 'Price'}</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', width: '15%' }}>{isUrdu ? 'ٹوٹل' : 'Total'}</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', width: '5%' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                        {isUrdu ? 'کارٹ خالی ہے۔ پروڈکٹ منتخب کریں۔' : 'Cart is empty. Please scan or search products.'}
                      </td>
                    </tr>
                  ) : (
                    cart.map(item => (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <strong style={{ fontSize: '0.9rem' }}>{item.name}</strong>
                          {item.name_urdu && <div className="urdu-text" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{item.name_urdu}</div>}
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Code: {item.code}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <button 
                              onClick={() => updateCartQty(item.id, item.cartQty - 1)}
                              style={{ width: '24px', height: '24px', borderRadius: '50%', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                            >
                              <FaMinus size={10} />
                            </button>
                            <input
                              type="number"
                              value={item.cartQty}
                              onChange={(e) => updateCartQty(item.id, parseInt(e.target.value) || 0)}
                              style={{ width: '50px', textAlign: 'center', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '2px 0', fontSize: '0.9rem' }}
                            />
                            <button 
                              onClick={() => updateCartQty(item.id, item.cartQty + 1)}
                              style={{ width: '24px', height: '24px', borderRadius: '50%', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                            >
                              <FaPlus size={10} />
                            </button>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>Rs. {item.sale_price.toFixed(2)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 'bold' }}>Rs. {(item.sale_price * item.cartQty).toFixed(2)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <button 
                            onClick={() => removeFromCart(item.id)}
                            style={{ color: 'var(--danger)', cursor: 'pointer' }}
                          >
                            <FaTrash />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* POS Shortcut Reference guide */}
            <div style={{ display: 'flex', gap: '15px', marginTop: '12px', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              <div><span className="shortcut-badge">F1</span> Search</div>
              <div><span className="shortcut-badge">F2</span> Pay Cash</div>
              <div><span className="shortcut-badge">F3</span> Hold Bill</div>
              <div><span className="shortcut-badge">F4</span> Urdu Toggle</div>
              <div><span className="shortcut-badge">ESC</span> Clear search</div>
            </div>
          </div>
        </div>

        {/* Right Column: Checkout Panel & Receipt Simulator */}
        <div className="pos-sidebar">
          {/* Customer Meta Panel */}
          <div className="standard-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              {isUrdu ? 'گاہک کی تفصیل' : 'Customer Info (Optional)'}
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <input
                type="text"
                placeholder={isUrdu ? 'نام' : 'Customer Name'}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="input-field"
                style={{ padding: '8px 12px', fontSize: '0.85rem' }}
              />
              <input
                type="text"
                placeholder={isUrdu ? 'فون نمبر' : 'Phone Number'}
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="input-field"
                style={{ padding: '8px 12px', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          {/* Pricing & Checkout Summary Panel */}
          <div className="pos-totals-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
              <span>{isUrdu ? 'مجموعی قیمت' : 'Subtotal'}:</span>
              <span>Rs. {calculateGross().toFixed(2)}</span>
            </div>

            {/* Discount Section */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{isUrdu ? 'ڈسکاؤنٹ' : 'Discount'}:</span>
              <input
                type="number"
                value={discountVal}
                onChange={(e) => setDiscountVal(e.target.value)}
                placeholder="0"
                style={{ flex: 1, border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 8px', fontSize: '0.85rem', backgroundColor: 'var(--bg-primary)' }}
              />
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value)}
                style={{ border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 6px', fontSize: '0.8rem', backgroundColor: 'var(--bg-primary)', cursor: 'pointer' }}
              >
                <option value="flat">Rs.</option>
                <option value="percent">%</option>
              </select>
            </div>

            {taxRate > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <span>Tax ({taxRate}%):</span>
                <span>Rs. {calculateTax().toFixed(2)}</span>
              </div>
            )}

            <div style={{ borderTop: '1px dashed var(--border-color)', margin: '4px 0' }}></div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: '900', color: 'var(--accent-primary)' }}>
              <span>{isUrdu ? 'کل رقم' : 'Net Payable'}:</span>
              <span>Rs. {calculateNet().toFixed(2)}</span>
            </div>

            {/* Revision Reason Form */}
            {editingBillId && (
              <div className="input-group" style={{ margin: '5px 0' }}>
                <label className="input-label" style={{ color: 'var(--danger)' }}>
                  <span>{isUrdu ? 'تبدیلی کی وجہ (لازمی)' : 'Reason for Update (Required)'}</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Returned 1 bread, added cookie pack"
                  value={billUpdateReason}
                  onChange={(e) => setBillUpdateReason(e.target.value)}
                  className="input-field"
                  style={{ border: '1px solid var(--danger)', padding: '8px 12px', fontSize: '0.85rem' }}
                />
              </div>
            )}

            {/* Payment Method Tabs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-tertiary)' }}>PAYMENT METHOD</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                {['Cash', 'Card', 'JazzCash', 'EasyPaisa'].map(method => (
                  <button
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    style={{
                      padding: '8px 4px',
                      fontSize: '0.8rem',
                      fontWeight: '700',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      border: '1px solid',
                      borderColor: paymentMethod === method ? 'var(--accent-primary)' : 'var(--border-color)',
                      backgroundColor: paymentMethod === method ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                      color: paymentMethod === method ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      transition: 'all var(--transition-fast)'
                    }}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            {/* Save Only / Save & Print Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
              {/* Button 1: Save Only */}
              <button
                onClick={() => handleCheckout(paymentMethod, false)}
                className="btn btn-secondary"
                style={{ height: '46px', fontSize: '0.95rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: '700', border: '2px solid var(--border-color)' }}
              >
                <FaCheck /> {editingBillId
                  ? (isUrdu ? '1. صرف محفوظ کریں' : '1. Save Update Only')
                  : (isUrdu ? '1. صرف محفوظ کریں' : '1. Save Only')}
              </button>

              {/* Button 2: Save & Print */}
              <button
                onClick={() => handleCheckout(paymentMethod, true)}
                className={`btn ${editingBillId ? 'btn-danger' : 'btn-success'}`}
                style={{ height: '50px', fontSize: '1rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: '800' }}
              >
                <FaPrint /> {editingBillId
                  ? (isUrdu ? '2. تبدیلی محفوظ اور پرنٹ کریں' : '2. Update & Re-Print')
                  : (isUrdu ? '2. محفوظ کریں اور پرنٹ کریں' : '2. Save & Print Receipt (F2)')}
              </button>

              {editingBillId && (
                <button
                  onClick={resetPOS}
                  className="btn btn-secondary"
                  style={{ height: '40px', fontSize: '0.85rem', width: '100%' }}
                >
                  <FaTimes /> {isUrdu ? 'ترمیم منسوخ کریں' : 'Cancel Revision'}
                </button>
              )}
            </div>
          </div>

          {/* Hidden Live Receipt Simulator View */}
          <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center' }}>
            <div id="receipt-preview-inner" style={{ transform: 'scale(0.9)', transformOrigin: 'top center', width: '100%' }}>
              <ReceiptPreview
                cart={cart}
                billDetails={{
                  bill_number: editingBillId ? editingBillNumber : 'BAK-PREVIEW-0001',
                  gross_amount: calculateGross(),
                  discount: calculateDiscount(),
                  tax_amount: calculateTax(),
                  net_amount: calculateNet(),
                  payment_method: paymentMethod,
                  total_items: cart.reduce((sum, item) => sum + item.cartQty, 0)
                }}
                settings={settings}
                employeeName={user.username}
                language={language}
                customerName={customerName}
                customerPhone={customerPhone}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Hold/Draft Bills Resumption Modal */}
      {showDraftsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="standard-card" style={{ width: '100%', maxWidth: '500px', padding: '24px', backgroundColor: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '1.1rem' }}><FaPause /> {isUrdu ? 'بلز جو ہولڈ پر ہیں' : 'Held Bills / Drafts'}</h3>
              <button onClick={() => setShowDraftsModal(false)} style={{ cursor: 'pointer', color: 'var(--text-tertiary)' }}><FaTimes size={18} /></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }}>
              {drafts.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>No held bills</div>
              ) : (
                drafts.map(draft => (
                  <div 
                    key={draft.id}
                    style={{
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '12px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <strong>{draft.customerName}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Items: {draft.cart.length} | Date: {new Date(draft.date).toLocaleTimeString()}</div>
                    </div>
                    <button 
                      onClick={() => resumeDraft(draft)}
                      className="btn btn-primary"
                      style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                    >
                      <FaPlay size={10} /> Resume
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bill History Search Modal for Revising Bills */}
      {showHistorySearchModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="standard-card" style={{ width: '100%', maxWidth: '600px', padding: '24px', backgroundColor: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '1.1rem' }}><FaHistory /> {isUrdu ? 'بل ترمیم / ریفنڈ سرچ کریں' : 'Revise / Modify Existing Bill'}</h3>
              <button onClick={() => setShowHistorySearchModal(false)} style={{ cursor: 'pointer', color: 'var(--text-tertiary)' }}><FaTimes size={18} /></button>
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Enter Bill Number (e.g. BAK-20260528-0001) or customer phone..."
                value={historySearchQuery}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
                className="input-field"
                style={{ flex: 1 }}
                onKeyDown={(e) => e.key === 'Enter' && handleHistorySearch()}
              />
              <button onClick={handleHistorySearch} className="btn btn-primary" style={{ padding: '12px 18px' }}>
                <FaSearch />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
              {historySearchResults.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>No bills found matching search term.</div>
              ) : (
                historySearchResults.map(bill => (
                  <div 
                    key={bill.id}
                    style={{
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '12px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <strong>{bill.bill_number}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                        Net Amount: <strong>Rs. {bill.net_amount.toFixed(2)}</strong> | Date: {new Date(bill.created_at).toLocaleString()}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                        Customer: {bill.customer_name || 'Walk-in'} | Cashier: {bill.employee_name} | Modifications: {bill.update_count}/2
                      </div>
                    </div>
                    <button 
                      onClick={() => loadBillForEditing(bill)}
                      className="btn btn-warning"
                      style={{ padding: '8px 14px', fontSize: '0.8rem' }}
                    >
                      Revise Bill
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
