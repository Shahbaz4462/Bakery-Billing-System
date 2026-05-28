/**
 * Mock Electron API for browser preview testing
 * This simulates the SQLite database with in-memory storage
 */

// In-memory database tables
let mockDB = {
  users: [
    { id: 1, username: 'admin', password_hash: '$2a$10$xyz', role: 'owner', status: 'active', permissions: '["create_employee","edit_employee"]', created_at: '2026-01-01', updated_at: '2026-01-01' },
    { id: 2, username: 'staff', password_hash: '$2a$10$xyz', role: 'employee', status: 'active', permissions: '["create_bill"]', created_at: '2026-01-01', updated_at: '2026-01-01' }
  ],
  employee_profiles: [
    { id: 1, user_id: 2, full_name: 'Muhammad Ali', phone: '0300-1234567', address: 'Lahore, Pakistan', joining_date: '2026-01-15', salary: 25000, status: 'active', created_at: '2026-01-15', updated_at: '2026-01-15' }
  ],
  salary_payments: [],
  categories: [
    { id: 1, name: 'Bakery', created_at: '2026-01-01' },
    { id: 2, name: 'Cakes', created_at: '2026-01-01' },
    { id: 3, name: 'Beverages', created_at: '2026-01-01' },
    { id: 4, name: 'Sweets', created_at: '2026-01-01' }
  ],
  products: [
    { id: 1, name: 'White Bread (Large)', name_urdu: 'ڈبل روٹی (بڑی)', code: '1001', barcode: '1000000000018', category_id: 1, unit_type: 'Piece', purchase_price: 90, sale_price: 120, quantity: 50, min_stock: 10, expiry_date: '2026-06-15', supplier_name: 'Dawn Foods', batch_number: 'B-WB01', status: 'active', created_at: '2026-01-01', updated_at: '2026-01-01' },
    { id: 2, name: 'Chocolate Fudge Cake (1 Pound)', name_urdu: 'چاکلیٹ فج کیک', code: '2001', barcode: '2000000000015', category_id: 2, unit_type: 'Piece', purchase_price: 400, sale_price: 600, quantity: 15, min_stock: 5, expiry_date: '2026-06-03', supplier_name: 'In-House Bakery', batch_number: 'B-CF24', status: 'active', created_at: '2026-01-01', updated_at: '2026-01-01' },
    { id: 3, name: 'Fresh Milk (1 Liter)', name_urdu: 'تازہ دودھ (1 لیٹر)', code: '3001', barcode: '3000000000012', category_id: 3, unit_type: 'Liter', purchase_price: 180, sale_price: 220, quantity: 30, min_stock: 8, expiry_date: '2026-05-30', supplier_name: 'Nestle Pakistan', batch_number: 'B-MILK02', status: 'active', created_at: '2026-01-01', updated_at: '2026-01-01' },
    { id: 4, name: 'Chicken Patties (One Dozen)', name_urdu: 'چکن پیٹیز (ایک درجن)', code: '1002', barcode: '1000000000025', category_id: 1, unit_type: 'Dozen', purchase_price: 350, sale_price: 480, quantity: 12, min_stock: 4, expiry_date: '2026-05-31', supplier_name: 'In-House Kitchen', batch_number: 'B-CP12', status: 'active', created_at: '2026-01-01', updated_at: '2026-01-01' },
    { id: 5, name: 'Rusk (Packet)', name_urdu: 'رس (پیکٹ)', code: '1003', barcode: '1000000000032', category_id: 1, unit_type: 'Packet', purchase_price: 70, sale_price: 95, quantity: 40, min_stock: 12, expiry_date: '2026-08-20', supplier_name: 'Dawn Foods', batch_number: 'B-RS09', status: 'active', created_at: '2026-01-01', updated_at: '2026-01-01' }
  ],
  bills: [],
  bill_items: [],
  bill_history: [],
  inventory_requests: generateInventoryRequests(),
  inventory_logs: generateInventoryLogs(),
  audit_logs: [],
  settings: [
    { key: 'bakery_name', value: 'Choudhry Bakery & Sweets', updated_at: '2026-01-01' },
    { key: 'bakery_address', value: 'Gousia Chowk, Abdul Hakim', updated_at: '2026-01-01' },
    { key: 'bakery_phone', value: '0304-7863020', updated_at: '2026-01-01' },
    { key: 'bakery_tax_no', value: 'GST-3047863-2', updated_at: '2026-01-01' },
    { key: 'bakery_tax_rate', value: '0', updated_at: '2026-01-01' },
    { key: 'receipt_header', value: 'WELCOME TO CHOUDHRY BAKERY', updated_at: '2026-01-01' },
    { key: 'receipt_footer', value: 'Items will be returned with cash memo within 15 days. Spoilage/loose items are not returnable.', updated_at: '2026-01-01' },
    { key: 'receipt_paper_size', value: '80mm', updated_at: '2026-01-01' },
    { key: 'receipt_printer_name', value: '', updated_at: '2026-01-01' }
  ]
};

// Generate mock inventory requests for the past 30 days
function generateInventoryRequests() {
  const requests = [];
  const now = new Date();
  let reqId = 1;
  
  const statuses = ['pending', 'approved', 'rejected'];
  const reasons = [
    'Stock running low',
    'Customer demand increased',
    'Batch received from supplier',
    'Weekly restocking',
    'New product line addition'
  ];
  
  for (let daysAgo = 0; daysAgo < 30; daysAgo += 3) {
    const reqDate = new Date(now);
    reqDate.setDate(reqDate.getDate() - daysAgo);
    
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const productId = Math.floor(Math.random() * 5) + 1;
    const userId = Math.random() > 0.5 ? 1 : 2; // Admin or employee
    
    requests.push({
      id: reqId++,
      request_type: 'update_stock',
      product_id: productId,
      product_details_json: null,
      requested_qty: Math.floor(Math.random() * 30) + 5,
      reason: reasons[Math.floor(Math.random() * reasons.length)],
      requested_by_user_id: userId,
      status: status,
      approved_by_user_id: status !== 'pending' ? 1 : null,
      approval_date: status !== 'pending' ? reqDate.toISOString() : null,
      notes: status === 'approved' ? 'Request approved and processed.' : (status === 'rejected' ? 'Insufficient documentation.' : null),
      created_at: reqDate.toISOString()
    });
  }
  
  return requests;
}

// Generate mock inventory logs for the past 100 days
function generateInventoryLogs() {
  const logs = [];
  const now = new Date();
  let logId = 1;
  
  for (let daysAgo = 0; daysAgo < 100; daysAgo++) {
    const logDate = new Date(now);
    logDate.setDate(logDate.getDate() - daysAgo);
    
    // Create 1-3 logs per day
    const logsPerDay = Math.floor(Math.random() * 3) + 1;
    for (let j = 0; j < logsPerDay; j++) {
      const productId = Math.floor(Math.random() * 5) + 1;
      const logTypes = ['purchase', 'sale', 'adjustment'];
      const logType = logTypes[Math.floor(Math.random() * logTypes.length)];
      const quantity = Math.floor(Math.random() * 20) + 1;
      const userId = Math.random() > 0.5 ? 1 : 2; // Admin or employee
      
      logs.push({
        id: logId++,
        product_id: productId,
        log_type: logType,
        quantity: quantity,
        previous_qty: 50,
        new_qty: logType === 'purchase' ? 50 + quantity : 50 - quantity,
        reason: logType === 'purchase' ? 'Stock replenishment' : logType === 'sale' ? 'Sold in bill' : 'Stock adjustment',
        user_id: userId,
        created_at: logDate.toISOString()
      });
    }
  }
  
  return logs;
}

// Auto-increment IDs
let nextIds = {
  users: 3,
  employee_profiles: 2,
  salary_payments: 1,
  categories: 5,
  products: 6,
  bills: 1,
  bill_items: 1,
  bill_history: 1,
  inventory_requests: mockDB.inventory_requests.length + 1,
  inventory_logs: mockDB.inventory_logs.length + 1,
  audit_logs: 1
};

// Parse SQL query (simplified parser for common operations)
function parseQuery(sql, params = []) {
  const upperSQL = sql.toUpperCase().trim();
  
  // SELECT queries
  if (upperSQL.startsWith('SELECT')) {
    return handleSelect(sql, params);
  }
  
  // INSERT queries  
  if (upperSQL.startsWith('INSERT')) {
    return handleInsert(sql, params);
  }
  
  // UPDATE queries
  if (upperSQL.startsWith('UPDATE')) {
    return handleUpdate(sql, params);
  }
  
  // DELETE queries
  if (upperSQL.startsWith('DELETE')) {
    return handleDelete(sql, params);
  }
  
  return [];
}

function handleSelect(sql, params) {
  const upperSQL = sql.toUpperCase();
  
  // Settings query
  if (upperSQL.includes('FROM SETTINGS')) {
    return mockDB.settings;
  }
  
  // Users query with employee profiles (for employee management)
  if (upperSQL.includes('FROM USERS U') && upperSQL.includes('LEFT JOIN EMPLOYEE_PROFILES')) {
    const excludeUserId = params[0] || 0;
    return mockDB.users
      .filter(u => u.id !== excludeUserId)
      .map(u => {
        const profile = mockDB.employee_profiles.find(ep => ep.user_id === u.id);
        const payments = mockDB.salary_payments.filter(sp => {
          const empProfile = mockDB.employee_profiles.find(ep => ep.user_id === u.id);
          return empProfile && sp.employee_id === empProfile.id;
        });
        const totalPaid = payments.filter(p => p.payment_type !== 'deduction').reduce((s, p) => s + p.amount, 0);
        const totalDeductions = payments.filter(p => p.payment_type === 'deduction').reduce((s, p) => s + p.amount, 0);
        
        return {
          ...u,
          full_name: profile?.full_name || null,
          phone: profile?.phone || null,
          address: profile?.address || null,
          joining_date: profile?.joining_date || null,
          salary: profile?.salary || 0,
          total_paid: totalPaid,
          total_deductions: totalDeductions
        };
      });
  }
  
  // Users login query
  if (upperSQL.includes('FROM USERS') && upperSQL.includes('WHERE USERNAME')) {
    const username = params[0];
    return mockDB.users.filter(u => u.username === username);
  }
  
  // Employee profile ID query
  if (upperSQL.includes('FROM EMPLOYEE_PROFILES') && upperSQL.includes('WHERE USER_ID')) {
    const userId = params[0];
    return mockDB.employee_profiles.filter(ep => ep.user_id === userId);
  }
  
  // Salary payments query
  if (upperSQL.includes('FROM SALARY_PAYMENTS')) {
    const empProfileId = params[0];
    return mockDB.salary_payments
      .filter(sp => sp.employee_id === empProfileId)
      .map(sp => ({
        ...sp,
        paid_by_name: mockDB.users.find(u => u.id === sp.paid_by_user_id)?.username || 'Unknown'
      }))
      .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));
  }
  
  // Products search query (for POS)
  if (upperSQL.includes('FROM PRODUCTS') && upperSQL.includes('WHERE') && upperSQL.includes('LIKE')) {
    const searchTerm = params[0]?.replace(/%/g, '') || '';
    return mockDB.products.filter(p => 
      p.status === 'active' && 
      p.quantity > 0 &&
      (p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
       (p.name_urdu && p.name_urdu.includes(searchTerm)) ||
       p.code === searchTerm ||
       p.barcode === searchTerm)
    ).slice(0, 5);
  }
  
  // Products list with category (for inventory)
  if (upperSQL.includes('FROM PRODUCTS P') && upperSQL.includes('LEFT JOIN CATEGORIES')) {
    let results = mockDB.products.filter(p => p.status === 'active');
    
    // Apply search filter if provided
    if (params.length > 0 && params[0]) {
      const searchTerm = params[0].replace(/%/g, '');
      results = results.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.name_urdu && p.name_urdu.includes(searchTerm)) ||
        p.code === searchTerm ||
        p.barcode === searchTerm
      );
    }
    
    return results.map(p => ({
      ...p,
      category_name: mockDB.categories.find(c => c.id === p.category_id)?.name || 'Unassigned'
    }));
  }
  
  // Categories query
  if (upperSQL.includes('FROM CATEGORIES')) {
    return mockDB.categories;
  }
  
  // Bills query (for bill search/history)
  if (upperSQL.includes('FROM BILLS B') && upperSQL.includes('JOIN USERS')) {
    const searchTerm = params[0] || '';
    let results = mockDB.bills;
    
    if (searchTerm) {
      results = results.filter(b => 
        b.bill_number === searchTerm || 
        b.customer_phone === searchTerm ||
        (b.customer_name && b.customer_name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    return results.map(b => ({
      ...b,
      employee_name: mockDB.users.find(u => u.id === b.employee_id)?.username || 'Unknown'
    })).slice(0, 5);
  }
  
  // Bill items query
  if (upperSQL.includes('FROM BILL_ITEMS') && upperSQL.includes('WHERE BILL_ID')) {
    const billId = params[0];
    return mockDB.bill_items.filter(bi => bi.bill_id === billId);
  }
  
  // Bills by ID
  if (upperSQL.includes('FROM BILLS') && upperSQL.includes('WHERE ID =')) {
    const billId = params[0];
    return mockDB.bills.filter(b => b.id === billId);
  }
  
  // Count bills today
  if (upperSQL.includes('COUNT(*)') && upperSQL.includes('FROM BILLS')) {
    const today = new Date().toISOString().split('T')[0];
    const count = mockDB.bills.filter(b => b.created_at?.startsWith(today)).length;
    return [{ count }];
  }
  
  // Inventory requests query
  if (upperSQL.includes('FROM INVENTORY_REQUESTS')) {
    let results = mockDB.inventory_requests.map(r => ({
      ...r,
      employee_name: mockDB.users.find(u => u.id === r.requested_by_user_id)?.username || 'Unknown',
      requester_name: mockDB.users.find(u => u.id === r.requested_by_user_id)?.username || 'Unknown',
      requester_role: mockDB.users.find(u => u.id === r.requested_by_user_id)?.role || 'employee',
      approver_name: r.approved_by_user_id ? mockDB.users.find(u => u.id === r.approved_by_user_id)?.username : null,
      target_product_name: mockDB.products.find(p => p.id === r.product_id)?.name || 'New Product',
      product_name: mockDB.products.find(p => p.id === r.product_id)?.name || 'New Product',
      product_code: mockDB.products.find(p => p.id === r.product_id)?.code || '-',
      target_product_qty: mockDB.products.find(p => p.id === r.product_id)?.quantity || 0
    }));
    
    if (upperSQL.includes('STATUS = "PENDING"') || upperSQL.includes("STATUS = 'PENDING'")) {
      results = results.filter(r => r.status === 'pending');
    } else if (upperSQL.includes('STATUS IN')) {
      results = results.filter(r => r.status === 'approved' || r.status === 'rejected');
    }
    
    // Filter by date if needed (past 100 days)
    if (upperSQL.includes('-100 DAYS')) {
      const hundredDaysAgo = new Date();
      hundredDaysAgo.setDate(hundredDaysAgo.getDate() - 100);
      results = results.filter(r => new Date(r.created_at) >= hundredDaysAgo);
    }
    
    return results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 200);
  }
  
  // Inventory logs query (for history - past 100 days)
  if (upperSQL.includes('FROM INVENTORY_LOGS')) {
    const hundredDaysAgo = new Date();
    hundredDaysAgo.setDate(hundredDaysAgo.getDate() - 100);
    
    return mockDB.inventory_logs
      .filter(log => new Date(log.created_at) >= hundredDaysAgo)
      .map(log => ({
        ...log,
        product_name: mockDB.products.find(p => p.id === log.product_id)?.name || 'Unknown Product',
        product_code: mockDB.products.find(p => p.id === log.product_id)?.code || '-',
        username: mockDB.users.find(u => u.id === log.user_id)?.username || 'System',
        user_role: mockDB.users.find(u => u.id === log.user_id)?.role || 'system'
      }))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 200);
  }
  
  // Bill history query
  if (upperSQL.includes('FROM BILL_HISTORY')) {
    return mockDB.bill_history.map(h => ({
      ...h,
      bill_number: mockDB.bills.find(b => b.id === h.bill_id)?.bill_number || 'Unknown',
      employee_name: mockDB.users.find(u => u.id === h.changed_by_user_id)?.username || 'Unknown'
    })).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 50);
  }
  
  // Audit logs query
  if (upperSQL.includes('FROM AUDIT_LOGS')) {
    return mockDB.audit_logs.map(log => ({
      ...log,
      username: mockDB.users.find(u => u.id === log.user_id)?.username || 'Unknown',
      role: mockDB.users.find(u => u.id === log.user_id)?.role || 'unknown'
    })).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 50);
  }
  
  // Product by IDs
  if (upperSQL.includes('FROM PRODUCTS') && upperSQL.includes('WHERE ID IN')) {
    const idsMatch = sql.match(/WHERE id IN \(([^)]+)\)/i);
    if (idsMatch) {
      const ids = idsMatch[1].split(',').map(id => parseInt(id.trim()));
      return mockDB.products.filter(p => ids.includes(p.id)).map(p => ({ id: p.id, quantity: p.quantity }));
    }
  }
  
  return [];
}

function handleInsert(sql, params) {
  const tableName = sql.match(/INSERT INTO (\w+)/i)?.[1]?.toLowerCase();
  
  if (!tableName || !mockDB[tableName]) {
    console.log('[Mock] Unknown table:', tableName);
    return { lastID: 0, changes: 0 };
  }
  
  const newId = nextIds[tableName]++;
  const now = new Date().toISOString();
  
  // Parse columns and values from SQL
  if (tableName === 'users') {
    mockDB.users.push({
      id: newId,
      username: params[0],
      password_hash: params[1],
      role: params[2],
      status: params[3] || 'active',
      permissions: params[4] || '[]',
      created_at: now,
      updated_at: now
    });
  } else if (tableName === 'employee_profiles') {
    mockDB.employee_profiles.push({
      id: newId,
      user_id: params[0],
      full_name: params[1],
      phone: params[2],
      address: params[3],
      joining_date: params[4],
      salary: params[5] || 0,
      status: 'active',
      created_at: now,
      updated_at: now
    });
  } else if (tableName === 'salary_payments') {
    mockDB.salary_payments.push({
      id: newId,
      employee_id: params[0],
      amount: params[1],
      payment_date: params[2],
      payment_type: params[3],
      notes: params[4],
      paid_by_user_id: params[5],
      created_at: now
    });
  } else if (tableName === 'bills') {
    mockDB.bills.push({
      id: newId,
      bill_number: params[0],
      customer_name: params[1],
      customer_phone: params[2],
      gross_amount: params[3],
      discount: params[4],
      net_amount: params[5],
      payment_method: params[6],
      tax_amount: params[7],
      round_off: params[8],
      employee_id: params[9],
      notes: params[10],
      status: 'active',
      update_count: 0,
      created_at: now,
      updated_at: now
    });
  } else if (tableName === 'bill_items') {
    // Handle subquery for bill_id
    let billId = params[0];
    if (typeof params[0] === 'string' && mockDB.bills.length > 0) {
      const bill = mockDB.bills.find(b => b.bill_number === params[0]);
      billId = bill?.id || mockDB.bills[mockDB.bills.length - 1]?.id;
    }
    
    mockDB.bill_items.push({
      id: newId,
      bill_id: billId,
      product_id: params[1],
      name: params[2],
      name_urdu: params[3],
      quantity: params[4],
      rate: params[5],
      amount: params[6],
      created_at: now
    });
  } else if (tableName === 'inventory_requests') {
    mockDB.inventory_requests.push({
      id: newId,
      request_type: params[0],
      product_id: params[1],
      product_details_json: params[2],
      requested_qty: params[3],
      reason: params[4],
      requested_by_user_id: params[5],
      status: 'pending',
      approved_by_user_id: null,
      approval_date: null,
      notes: null,
      created_at: now
    });
  } else if (tableName === 'inventory_logs') {
    let productId = params[0];
    // Handle subquery for product_id
    if (sql.includes('SELECT id FROM products WHERE code')) {
      const code = params[0];
      const product = mockDB.products.find(p => p.code === code);
      productId = product?.id || 1;
    }
    
    mockDB.inventory_logs.push({
      id: newId,
      product_id: productId,
      log_type: params[1],
      quantity: params[2],
      previous_qty: params[3],
      new_qty: params[4],
      reason: params[5],
      user_id: params[6],
      created_at: now
    });
  } else if (tableName === 'audit_logs') {
    mockDB.audit_logs.push({
      id: newId,
      user_id: params[0],
      action: params[1],
      details: params[2],
      created_at: now
    });
  } else if (tableName === 'bill_history') {
    mockDB.bill_history.push({
      id: newId,
      bill_id: params[0],
      version: params[1],
      previous_version_json: params[2],
      new_version_json: params[3],
      changed_by_user_id: params[4],
      change_type: 'update',
      reason: params[5],
      created_at: now
    });
  } else if (tableName === 'products') {
    mockDB.products.push({
      id: newId,
      name: params[0],
      name_urdu: params[1],
      code: params[2],
      barcode: params[3],
      category_id: params[4],
      unit_type: params[5],
      purchase_price: params[6],
      sale_price: params[7],
      quantity: params[8],
      min_stock: params[9],
      expiry_date: params[10],
      supplier_name: params[11],
      batch_number: params[12],
      status: 'active',
      created_at: now,
      updated_at: now
    });
  }
  
  return { lastID: newId, changes: 1 };
}

function handleUpdate(sql, params) {
  const tableName = sql.match(/UPDATE (\w+)/i)?.[1]?.toLowerCase();
  
  if (!tableName || !mockDB[tableName]) {
    return { lastID: 0, changes: 0 };
  }
  
  const upperSQL = sql.toUpperCase();
  
  if (tableName === 'users') {
    const userId = params[params.length - 1];
    const user = mockDB.users.find(u => u.id === userId);
    if (user) {
      if (upperSQL.includes('USERNAME =')) {
        user.username = params[0];
        user.role = params[1];
        user.status = params[2];
      }
      if (upperSQL.includes('PASSWORD_HASH =')) {
        user.password_hash = params[0];
      }
      if (upperSQL.includes("STATUS = 'INACTIVE'") || upperSQL.includes('STATUS = "INACTIVE"')) {
        user.status = 'inactive';
      }
      user.updated_at = new Date().toISOString();
    }
  } else if (tableName === 'employee_profiles') {
    const userId = params[params.length - 1];
    const profile = mockDB.employee_profiles.find(ep => ep.user_id === userId);
    if (profile) {
      profile.full_name = params[0];
      profile.phone = params[1];
      profile.address = params[2];
      profile.joining_date = params[3];
      profile.salary = params[4];
      profile.updated_at = new Date().toISOString();
    }
  } else if (tableName === 'products') {
    if (upperSQL.includes('QUANTITY = QUANTITY +')) {
      const qty = params[0];
      const productId = params[1];
      const product = mockDB.products.find(p => p.id === productId);
      if (product) {
        product.quantity += qty;
      }
    } else if (upperSQL.includes('QUANTITY = QUANTITY -')) {
      const qty = params[0];
      const productId = params[1];
      const product = mockDB.products.find(p => p.id === productId);
      if (product) {
        product.quantity -= qty;
      }
    } else if (upperSQL.includes("STATUS = 'INACTIVE'") || upperSQL.includes('STATUS = "INACTIVE"')) {
      const productId = params[0];
      const product = mockDB.products.find(p => p.id === productId);
      if (product) {
        product.status = 'inactive';
      }
    } else {
      // Full update
      const productId = params[params.length - 1];
      const product = mockDB.products.find(p => p.id === productId);
      if (product) {
        product.name = params[0] ?? product.name;
        product.name_urdu = params[1] ?? product.name_urdu;
        product.code = params[2] ?? product.code;
        product.barcode = params[3] ?? product.barcode;
        product.category_id = params[4] ?? product.category_id;
        product.unit_type = params[5] ?? product.unit_type;
        product.purchase_price = params[6] ?? product.purchase_price;
        product.sale_price = params[7] ?? product.sale_price;
        product.quantity = params[8] ?? product.quantity;
        product.min_stock = params[9] ?? product.min_stock;
        product.expiry_date = params[10] ?? product.expiry_date;
        product.supplier_name = params[11] ?? product.supplier_name;
        product.batch_number = params[12] ?? product.batch_number;
        product.updated_at = new Date().toISOString();
      }
    }
  } else if (tableName === 'inventory_requests') {
    const requestId = params[params.length - 1];
    const request = mockDB.inventory_requests.find(r => r.id === requestId);
    if (request) {
      if (upperSQL.includes("STATUS = 'APPROVED'") || upperSQL.includes('STATUS = "APPROVED"')) {
        request.status = 'approved';
        request.approved_by_user_id = params[0];
        request.approval_date = params[1];
        request.notes = params[2] || 'Request approved and processed.';
      } else if (upperSQL.includes("STATUS = 'REJECTED'") || upperSQL.includes('STATUS = "REJECTED"')) {
        request.status = 'rejected';
        request.approved_by_user_id = params[0];
        request.approval_date = params[1];
        request.notes = params[2];
      }
    }
  } else if (tableName === 'bills') {
    const billId = params[params.length - 1];
    const bill = mockDB.bills.find(b => b.id === billId);
    if (bill) {
      bill.gross_amount = params[0] ?? bill.gross_amount;
      bill.discount = params[1] ?? bill.discount;
      bill.net_amount = params[2] ?? bill.net_amount;
      bill.payment_method = params[3] ?? bill.payment_method;
      bill.tax_amount = params[4] ?? bill.tax_amount;
      bill.round_off = params[5] ?? bill.round_off;
      bill.customer_name = params[6] ?? bill.customer_name;
      bill.customer_phone = params[7] ?? bill.customer_phone;
      bill.notes = params[8] ?? bill.notes;
      bill.update_count = (bill.update_count || 0) + 1;
      bill.updated_at = new Date().toISOString();
    }
  }
  
  return { lastID: 0, changes: 1 };
}

function handleDelete(sql, params) {
  const tableName = sql.match(/DELETE FROM (\w+)/i)?.[1]?.toLowerCase();
  
  if (tableName === 'bill_items') {
    const billId = params[0];
    mockDB.bill_items = mockDB.bill_items.filter(bi => bi.bill_id !== billId);
  }
  
  return { lastID: 0, changes: 1 };
}

// Mock bcrypt hash function
function mockHashPassword(password) {
  return '$2a$10$mock_hash_' + btoa(password).slice(0, 20);
}

// Mock bcrypt compare function
function mockComparePassword(password, hash) {
  // For demo, accept any password
  return true;
}

// Export mock API
export const mockElectronAPI = {
  query: async (sql, params = []) => {
    console.log('[Mock Query]', sql.substring(0, 100), params);
    return parseQuery(sql, params);
  },
  
  run: async (sql, params = []) => {
    console.log('[Mock Run]', sql.substring(0, 100), params);
    return parseQuery(sql, params);
  },
  
  transaction: async (queries) => {
    console.log('[Mock Transaction]', queries.length, 'queries');
    for (const q of queries) {
      parseQuery(q.sql, q.params || []);
    }
    return { success: true };
  },
  
  printReceipt: async (htmlContent, printerName, paperSize) => {
    console.log('[Mock Print]', 'Printing receipt...');
    // Open print dialog in browser
    const printWindow = window.open('', '_blank', 'width=320,height=600');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Receipt</title>
          <style>
            body { font-family: 'Courier New', monospace; margin: 0; padding: 10px; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>${htmlContent}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
    return { success: true };
  },
  
  getPrinters: async () => {
    return [{ name: 'Default Printer', isDefault: true }];
  },
  
  hashPassword: async (plain) => {
    return mockHashPassword(plain);
  },
  
  showSaveDialog: async (options) => {
    return { canceled: false, filePath: '/mock/path/backup.db' };
  },
  
  showOpenDialog: async (options) => {
    return { canceled: false, filePaths: ['/mock/path/restore.db'] };
  },
  
  backupDatabase: async (destPath) => {
    return { success: true };
  },
  
  restoreDatabase: async (srcPath) => {
    return { success: true };
  },
  
  getBackupDir: async () => {
    return '/mock/backups';
  },
  
  closeApp: () => {
    console.log('[Mock] App close requested');
  }
};

// Initialize mock API on window
export function initMockElectronAPI() {
  if (typeof window !== 'undefined' && !window.electronAPI) {
    window.electronAPI = mockElectronAPI;
    console.log('[Mock] Electron API initialized for browser preview');
  }
}

export default mockElectronAPI;
