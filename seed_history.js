const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dbFolder = path.join(__dirname, 'data');
if (!fs.existsSync(dbFolder)) {
  fs.mkdirSync(dbFolder, { recursive: true });
}
const dbPath = path.join(dbFolder, 'bakery_billing.db');

console.log('Database Path for Seeding:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to open database:', err.message);
    process.exit(1);
  }
  console.log('Connected to the SQLite database. Running Promise-based seeder...');
  runSeeder();
});

// Helper Promise wrappers
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) {
    if (err) reject(err);
    else resolve({ lastID: this.lastID, changes: this.changes });
  });
});

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) reject(err);
    else resolve(row);
  });
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows);
  });
});

async function runSeeder() {
  try {
    // 1. Create Tables
    await dbRun(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      permissions TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    await dbRun(`CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    await dbRun(`CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_urdu TEXT,
      code TEXT UNIQUE NOT NULL,
      barcode TEXT UNIQUE,
      category_id INTEGER,
      unit_type TEXT NOT NULL,
      purchase_price REAL NOT NULL,
      sale_price REAL NOT NULL,
      quantity REAL DEFAULT 0,
      min_stock REAL DEFAULT 5,
      expiry_date DATE,
      supplier_name TEXT,
      batch_number TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    )`);

    await dbRun(`CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_number TEXT UNIQUE NOT NULL,
      customer_name TEXT,
      customer_phone TEXT,
      gross_amount REAL NOT NULL,
      discount REAL DEFAULT 0,
      net_amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      tax_amount REAL DEFAULT 0,
      round_off REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      cancellation_reason TEXT,
      update_count INTEGER DEFAULT 0,
      employee_id INTEGER NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES users(id)
    )`);

    await dbRun(`CREATE TABLE IF NOT EXISTS bill_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      name_urdu TEXT,
      quantity REAL NOT NULL,
      rate REAL NOT NULL,
      amount REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    await dbRun(`CREATE TABLE IF NOT EXISTS bill_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id INTEGER NOT NULL,
      version INTEGER NOT NULL,
      previous_version_json TEXT NOT NULL,
      new_version_json TEXT NOT NULL,
      changed_by_user_id INTEGER NOT NULL,
      change_type TEXT NOT NULL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
      FOREIGN KEY (changed_by_user_id) REFERENCES users(id)
    )`);

    await dbRun(`CREATE TABLE IF NOT EXISTS inventory_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_type TEXT NOT NULL,
      product_id INTEGER,
      product_details_json TEXT,
      requested_qty REAL,
      reason TEXT,
      requested_by_user_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      approved_by_user_id INTEGER,
      approval_date DATETIME,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
      FOREIGN KEY (requested_by_user_id) REFERENCES users(id),
      FOREIGN KEY (approved_by_user_id) REFERENCES users(id)
    )`);

    await dbRun(`CREATE TABLE IF NOT EXISTS inventory_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      log_type TEXT NOT NULL,
      quantity REAL NOT NULL,
      previous_qty REAL NOT NULL,
      new_qty REAL NOT NULL,
      reason TEXT,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    await dbRun(`CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    await dbRun(`CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Indexes
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);`);
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);`);
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);`);
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_bills_number ON bills(bill_number);`);
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_bills_created ON bills(created_at);`);
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_bill_items_bill ON bill_items(bill_id);`);
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_bill_history_bill ON bill_history(bill_id);`);
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_inventory_logs_product ON inventory_logs(product_id);`);
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);`);

    console.log('Tables initialized.');

    // 2. Seed Default Accounts
    const adminPassHash = bcrypt.hashSync('admin123', 10);
    const staffPassHash = bcrypt.hashSync('staff123', 10);
    
    const adminPerms = JSON.stringify([
      "create_employee", "edit_employee", "assign_permissions", 
      "approve_requests", "access_bills", "access_inventory", 
      "update_bill", "view_logs", "view_reports", "manage_settings"
    ]);
    
    const staffPerms = JSON.stringify([
      "create_bill", "search_bill", "update_bill_limited", 
      "request_inventory", "request_product", "view_stock", 
      "print_bill", "switch_language"
    ]);

    await dbRun('INSERT OR IGNORE INTO users (id, username, password_hash, role, permissions) VALUES (1, ?, ?, ?, ?)', 
      ['admin', adminPassHash, 'owner', adminPerms]
    );
    
    await dbRun('INSERT OR IGNORE INTO users (id, username, password_hash, role, permissions) VALUES (2, ?, ?, ?, ?)', 
      ['staff', staffPassHash, 'employee', staffPerms]
    );

    // 3. Seed Settings
    const defaultSettings = [
      { key: 'bakery_name', value: 'Choudhry Bakery & Sweets' },
      { key: 'bakery_address', value: 'Gousia Chowk, Abdul Hakim' },
      { key: 'bakery_phone', value: '0304-7863020' },
      { key: 'bakery_tax_no', value: 'GST-3047863-2' },
      { key: 'bakery_tax_rate', value: '0' },
      { key: 'receipt_header', value: 'WELCOME TO CHOUDHRY BAKERY' },
      { key: 'receipt_footer', value: 'Items will be returned with cash memo within 15 days. Spoilage/loose items are not returnable.' },
      { key: 'receipt_paper_size', value: '80mm' },
      { key: 'receipt_printer_name', value: '' },
      { key: 'auto_backup_path', value: path.join(__dirname, 'backovers') },
      { key: 'auto_backup_on_close', value: 'true' }
    ];

    for (const s of defaultSettings) {
      await dbRun('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [s.key, s.value]);
    }

    // 4. Seed Categories and Products
    const defaultCategories = ['Bakery', 'Cakes', 'Beverages', 'Sweets'];
    let catIndex = 1;
    for (const cat of defaultCategories) {
      await dbRun('INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)', [catIndex++, cat]);
    }

    const productsSeed = [
      { id: 1, name: 'White Bread (Large)', name_urdu: 'ڈبل روٹی (بڑی)', code: '1001', barcode: '1000000000018', category_id: 1, unit_type: 'Piece', purchase_price: 90, sale_price: 120, quantity: 50, min_stock: 10, expiry: '2026-06-15', supplier: 'Dawn Foods', batch: 'B-WB01' },
      { id: 2, name: 'Chocolate Fudge Cake (1 Pound)', name_urdu: 'چاکلیٹ فج کیک', code: '2001', barcode: '2000000000015', category_id: 2, unit_type: 'Piece', purchase_price: 400, sale_price: 600, quantity: 15, min_stock: 5, expiry: '2026-06-03', supplier: 'In-House Bakery', batch: 'B-CF24' },
      { id: 3, name: 'Fresh Milk (1 Liter)', name_urdu: 'تازہ دودھ (1 لیٹر)', code: '3001', barcode: '3000000000012', category_id: 3, unit_type: 'Liter', purchase_price: 180, sale_price: 220, quantity: 30, min_stock: 8, expiry: '2026-05-30', supplier: 'Nestle Pakistan', batch: 'B-MILK02' },
      { id: 4, name: 'Chicken Patties (One Dozen)', name_urdu: 'چکن پیٹیز (ایک درجن)', code: '1002', barcode: '1000000000025', category_id: 1, unit_type: 'Dozen', purchase_price: 350, sale_price: 480, quantity: 12, min_stock: 4, expiry: '2026-05-31', supplier: 'In-House Kitchen', batch: 'B-CP12' },
      { id: 5, name: 'Rusk (Packet)', name_urdu: 'رس (پیکٹ)', code: '1003', barcode: '1000000000032', category_id: 1, unit_type: 'Packet', purchase_price: 70, sale_price: 95, quantity: 40, min_stock: 12, expiry: '2026-08-20', supplier: 'Dawn Foods', batch: 'B-RS09' }
    ];

    for (const p of productsSeed) {
      await dbRun(`INSERT OR IGNORE INTO products (id, name, name_urdu, code, barcode, category_id, unit_type, purchase_price, sale_price, quantity, min_stock, expiry_date, supplier_name, batch_number)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [p.id, p.name, p.name_urdu, p.code, p.barcode, p.category_id, p.unit_type, p.purchase_price, p.sale_price, p.quantity, p.min_stock, p.expiry, p.supplier, p.batch]
      );
    }

    console.log('Seeded defaults. Checking historical sales...');
    const billsCountRow = await dbGet('SELECT COUNT(*) as count FROM bills');
    
    if (billsCountRow.count > 0) {
      console.log('Historical bills already exist. Done!');
      db.close();
      return;
    }

    const products = await dbAll('SELECT * FROM products WHERE status = "active"');
    await generateHistory(products);

  } catch (e) {
    console.error('Fatal seeder error:', e);
    db.close();
  }
}

async function generateHistory(products) {
  const paymentMethods = ['Cash', 'Card', 'JazzCash', 'EasyPaisa'];
  const customers = [
    { name: 'Muhammad Shahbaz', phone: '0300-1234567' },
    { name: 'Ahmad Khan', phone: '0321-7654321' },
    { name: 'Zainab Bibi', phone: '0333-9876543' },
    { name: 'Ali Raza', phone: '0345-5551234' },
    { name: 'Sana Fatima', phone: '0312-8889999' },
    { name: '', phone: '' },
    { name: '', phone: '' },
    { name: '', phone: '' }
  ];

  const now = new Date();
  
  await dbRun('BEGIN TRANSACTION;');

  console.log('Generating 1-year of sales data records (Approx. 2000+ bills)...');
  
  let billCounter = 1;
  const totalDays = 365;

  for (let d = totalDays; d >= 0; d--) {
    const currentDate = new Date();
    currentDate.setDate(now.getDate() - d);
    
    // Generate between 3 and 8 bills daily
    const billsForDay = Math.floor(3 + Math.random() * 6);

    for (let b = 0; b < billsForDay; b++) {
      const hour = Math.floor(8 + Math.random() * 14); // 8 AM to 10 PM
      const minute = Math.floor(Math.random() * 60);
      const second = Math.floor(Math.random() * 60);
      
      const billTime = new Date(currentDate);
      billTime.setHours(hour, minute, second);
      const timestampStr = billTime.toISOString().replace('T', ' ').substring(0, 19);

      const dateStr = billTime.toISOString().slice(0, 10).replace(/-/g, '');
      const paddedCount = String(billCounter).padStart(5, '0');
      const billNumber = `BAK-${dateStr}-${paddedCount}`;
      billCounter++;

      const cust = customers[Math.floor(Math.random() * customers.length)];
      
      // Select random products
      const selectedProducts = [];
      const numProducts = Math.floor(1 + Math.random() * 3);
      const shuffled = [...products].sort(() => 0.5 - Math.random());
      for (let i = 0; i < Math.min(numProducts, shuffled.length); i++) {
        selectedProducts.push(shuffled[i]);
      }

      let gross = 0;
      const itemsToInsert = [];

      selectedProducts.forEach(prod => {
        const qty = Math.floor(1 + Math.random() * 2);
        const rate = prod.sale_price;
        const amount = qty * rate;
        gross += amount;
        
        itemsToInsert.push({
          product_id: prod.id,
          name: prod.name,
          name_urdu: prod.name_urdu,
          quantity: qty,
          rate: rate,
          amount: amount
        });
      });

      let discount = 0;
      if (Math.random() < 0.1) {
        discount = Math.random() < 0.5 ? Math.floor(10 + Math.random() * 20) : Math.round(gross * 0.05);
      }
      
      const tax = 0;
      const net = Math.max(0, Math.round(gross - discount + tax));
      const roundOff = net - (gross - discount + tax);
      const method = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
      const employeeId = Math.random() < 0.2 ? 2 : 1; 

      // Insert Bill Header
      const headerRes = await dbRun(`
        INSERT INTO bills (bill_number, customer_name, customer_phone, gross_amount, discount, net_amount, payment_method, tax_amount, round_off, employee_id, notes, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', 'active', ?, ?)`,
        [billNumber, cust.name, cust.phone, gross, discount, net, method, tax, roundOff, employeeId, timestampStr, timestampStr]
      );

      const billId = headerRes.lastID;

      // Insert Bill Items & Movement Logs sequentially
      for (const item of itemsToInsert) {
        await dbRun(`
          INSERT INTO bill_items (bill_id, product_id, name, name_urdu, quantity, rate, amount, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [billId, item.product_id, item.name, item.name_urdu, item.quantity, item.rate, item.amount, timestampStr]
        );

        await dbRun(`
          INSERT INTO inventory_logs (product_id, log_type, quantity, previous_qty, new_qty, reason, user_id, created_at)
          VALUES (?, 'sale', ?, 100, 100 - ?, ?, ?, ?)`,
          [item.product_id, item.quantity, item.quantity, `Historical sale in bill ${billNumber}`, employeeId, timestampStr]
        );
      }
    }
  }

  try {
    await dbRun('COMMIT;');
    console.log(`Successfully generated database and seeded ${billCounter - 1} sales entries spanning 365 days!`);
  } catch (commitErr) {
    console.error('Commit failed, rolling back:', commitErr);
    await dbRun('ROLLBACK;');
  } finally {
    db.close();
  }
}
