const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

let mainWindow;

// Determine DB Path: User AppData folder in production, local in development
const isDev = !app.isPackaged;
const appDataPath = isDev ? __dirname : app.getPath('userData');
const dbFolder = path.join(appDataPath, 'data');
if (!fs.existsSync(dbFolder)) {
  fs.mkdirSync(dbFolder, { recursive: true });
}
const dbPath = path.join(dbFolder, 'bakery_billing.db');

console.log('Database Path:', dbPath);

// Establish database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to open database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    initializeDatabase();
  }
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON;');

// 1. Initial Database Schema Creation
function initializeDatabase() {
  db.serialize(() => {
    // Users Table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      permissions TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Categories Table
    db.run(`CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Products Table
    db.run(`CREATE TABLE IF NOT EXISTS products (
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

    // Bills Table
    db.run(`CREATE TABLE IF NOT EXISTS bills (
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

    // Bill Items Table
    db.run(`CREATE TABLE IF NOT EXISTS bill_items (
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

    // Bill History Table
    db.run(`CREATE TABLE IF NOT EXISTS bill_history (
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

    // Inventory Requests
    db.run(`CREATE TABLE IF NOT EXISTS inventory_requests (
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

    // Inventory Logs
    db.run(`CREATE TABLE IF NOT EXISTS inventory_logs (
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

    // Audit Logs Table
    db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    // Settings Table
    db.run(`CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Employee Profiles Table (HR details, separate from auth users)
    db.run(`CREATE TABLE IF NOT EXISTS employee_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      joining_date DATE,
      salary REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    // Salary Payments Table (tracks every payment/advance/bonus/deduction)
    db.run(`CREATE TABLE IF NOT EXISTS salary_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      payment_date DATE NOT NULL,
      payment_type TEXT NOT NULL DEFAULT 'salary',
      notes TEXT,
      paid_by_user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employee_profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (paid_by_user_id) REFERENCES users(id)
    )`);

    // Indexes
    db.run(`CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_bills_number ON bills(bill_number);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_bills_created ON bills(created_at);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_bill_items_bill ON bill_items(bill_id);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_bill_history_bill ON bill_history(bill_id);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_inventory_logs_product ON inventory_logs(product_id);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);`);

    // Seeds default accounts if none exist
    seedDefaultData();
  });
}

function seedDefaultData() {
  db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
    if (err) return console.error('Error counting users:', err);
    
    if (row.count === 0) {
      console.log('No users found. Seeding default accounts...');
      
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
      
      db.run('INSERT INTO users (username, password_hash, role, permissions) VALUES (?, ?, ?, ?)', 
        ['admin', adminPassHash, 'owner', adminPerms]
      );
      
      db.run('INSERT INTO users (username, password_hash, role, permissions) VALUES (?, ?, ?, ?)', 
        ['staff', staffPassHash, 'employee', staffPerms]
      );
      
      console.log('User seeding finished.');
    }
  });

  db.get('SELECT COUNT(*) as count FROM categories', (err, row) => {
    if (err) return console.error('Error counting categories:', err);
    if (row.count === 0) {
      console.log('Seeding default categories & products...');
      const defaultCategories = ['Bakery', 'Cakes', 'Beverages', 'Sweets'];
      defaultCategories.forEach(cat => {
        db.run('INSERT INTO categories (name) VALUES (?)', [cat]);
      });
      
      // Delay slightly to allow categories to insert, then insert products
      setTimeout(() => {
        const productsSeed = [
          { name: 'White Bread (Large)', name_urdu: 'ڈبل روٹی (بڑی)', code: '1001', barcode: '1000000000018', category_id: 1, unit_type: 'Piece', purchase_price: 90, sale_price: 120, quantity: 50, min_stock: 10, expiry: '2026-06-15', supplier: 'Dawn Foods', batch: 'B-WB01' },
          { name: 'Chocolate Fudge Cake (1 Pound)', name_urdu: 'چاکلیٹ فج کیک', code: '2001', barcode: '2000000000015', category_id: 2, unit_type: 'Piece', purchase_price: 400, sale_price: 600, quantity: 15, min_stock: 5, expiry: '2026-06-03', supplier: 'In-House Bakery', batch: 'B-CF24' },
          { name: 'Fresh Milk (1 Liter)', name_urdu: 'تازہ دودھ (1 لیٹر)', code: '3001', barcode: '3000000000012', category_id: 3, unit_type: 'Liter', purchase_price: 180, sale_price: 220, quantity: 30, min_stock: 8, expiry: '2026-05-30', supplier: 'Nestle Pakistan', batch: 'B-MILK02' },
          { name: 'Chicken Patties (One Dozen)', name_urdu: 'چکن پیٹیز (ایک درجن)', code: '1002', barcode: '1000000000025', category_id: 1, unit_type: 'Dozen', purchase_price: 350, sale_price: 480, quantity: 12, min_stock: 4, expiry: '2026-05-31', supplier: 'In-House Kitchen', batch: 'B-CP12' },
          { name: 'Rusk (Packet)', name_urdu: 'رس (پیکٹ)', code: '1003', barcode: '1000000000032', category_id: 1, unit_type: 'Packet', purchase_price: 70, sale_price: 95, quantity: 40, min_stock: 12, expiry: '2026-08-20', supplier: 'Dawn Foods', batch: 'B-RS09' }
        ];

        productsSeed.forEach(p => {
          db.run(`INSERT INTO products (name, name_urdu, code, barcode, category_id, unit_type, purchase_price, sale_price, quantity, min_stock, expiry_date, supplier_name, batch_number)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [p.name, p.name_urdu, p.code, p.barcode, p.category_id, p.unit_type, p.purchase_price, p.sale_price, p.quantity, p.min_stock, p.expiry, p.supplier, p.batch]
          );
        });

        console.log('Seeding products finished.');
      }, 500);
    }
  });

  db.get('SELECT COUNT(*) as count FROM settings', (err, row) => {
    if (err) return;
    if (row.count === 0) {
      const defaultSettings = [
        { key: 'bakery_name', value: 'Choudhry Bakery & Sweets' },
        { key: 'bakery_address', value: 'Gousia Chowk, Abdul Hakim' },
        { key: 'bakery_phone', value: '0304-7863020' },
        { key: 'bakery_tax_no', value: 'GST-3047863-2' },
        { key: 'bakery_tax_rate', value: '0' },
        { key: 'receipt_header', value: 'WELCOME TO CHOUDHRY BAKERY' },
        { key: 'receipt_footer', value: 'Items will be returned with cash memo within 15 days. Spoilage/loose items are not returnable.' },
        { key: 'receipt_paper_size', value: '80mm' }, // '58mm' or '80mm'
        { key: 'receipt_printer_name', value: '' }, // default system printer
        { key: 'auto_backup_path', value: path.join(appDataPath, 'backovers') },
        { key: 'auto_backup_on_close', value: 'true' }
      ];

      defaultSettings.forEach(s => {
        db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [s.key, s.value]);
      });
      console.log('Default settings seeded.');
    }
  });
}

// 2. Electron App Window Creation
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1250,
    height: 850,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    title: 'Bakery Billing & Inventory Management System',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.maximize();

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  // If auto-backup on close is configured, run backup here before closing
  db.get("SELECT value FROM settings WHERE key='auto_backup_on_close'", (err, row) => {
    if (row && row.value === 'true') {
      db.get("SELECT value FROM settings WHERE key='auto_backup_path'", (err, pathRow) => {
        if (pathRow) {
          const backupDir = pathRow.value;
          if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
          }
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const backupDest = path.join(backupDir, `bakery_backup_${timestamp}.db`);
          
          try {
            fs.copyFileSync(dbPath, backupDest);
            console.log('Auto-backup completed on exit:', backupDest);
          } catch (e) {
            console.error('Failed to complete auto-backup on exit:', e);
          }
        }
        app.quit();
      });
    } else {
      app.quit();
    }
  });
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// 3. Database IPC Handlers
ipcMain.handle('db:query', async (event, sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('SQL Error (query):', sql, params, err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
});

ipcMain.handle('db:run', async (event, sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        console.error('SQL Error (run):', sql, params, err);
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
});

// Multi-query Transaction IPC (atomic commit or rollback)
ipcMain.handle('db:transaction', async (event, queries) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION;', (err) => {
        if (err) return reject(err);
        
        let hasError = false;
        let count = 0;
        
        for (let i = 0; i < queries.length; i++) {
          const q = queries[i];
          db.run(q.sql, q.params || [], (err) => {
            if (err) {
              console.error('Transaction failure on query:', q.sql, q.params, err);
              hasError = true;
            }
            count++;
            
            if (count === queries.length) {
              if (hasError) {
                db.run('ROLLBACK;', () => {
                  reject(new Error('Transaction rolled back due to error in one or more statements.'));
                });
              } else {
                db.run('COMMIT;', (commitErr) => {
                  if (commitErr) {
                    db.run('ROLLBACK;', () => reject(commitErr));
                  } else {
                    resolve({ success: true });
                  }
                });
              }
            }
          });
        }
      });
    });
  });
});

// 4. Native Printing Implementation (HTML Template Render & Print)
ipcMain.handle('print:receipt', async (event, htmlContent, printerName, paperSize) => {
  return new Promise((resolve, reject) => {
    let workerWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false
      }
    });
    
    const formattedHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            @page {
              margin: 0;
              size: ${paperSize === '80mm' ? '80mm auto' : '58mm auto'};
            }
            body {
              margin: 0;
              font-family: 'Courier New', 'Arial', 'Noto Nastaliq Urdu', 'Jameel Noori Nastaliq', sans-serif;
              width: ${paperSize === '80mm' ? '74mm' : '52mm'};
              padding: 3mm;
              font-size: 11px;
              color: #000;
              background: #fff;
              box-sizing: border-box;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 6px 0; }
            .double-divider { border-top: 3px double #000; border-bottom: 1px dashed #000; height: 3px; margin: 6px 0; }
            .item-table { width: 100%; border-collapse: collapse; margin: 6px 0; }
            .item-table th, .item-table td { padding: 4px 0; font-size: 11px; vertical-align: top; }
            .item-table th { text-align: left; border-top: 1px solid #000; border-bottom: 1px solid #000; }
            .item-table td.qty-col { width: 10%; text-align: left; }
            .item-table td.desc-col { width: 50%; text-align: left; }
            .item-table td.rate-col { width: 20%; text-align: right; }
            .item-table td.amt-col { width: 20%; text-align: right; }
            .net-box { border: 1.5px solid #000; padding: 6px; margin: 8px 0; font-size: 13px; font-weight: bold; text-align: center; }
            .urdu { font-family: 'Jameel Noori Nastaliq', 'Noto Nastaliq Urdu', 'Noto Sans Arabic', 'Arial', sans-serif; direction: rtl; text-align: right; font-size: 12px; }
            .flex-row { display: flex; justify-content: space-between; margin: 3px 0; }
            .notes-section { font-size: 9.5px; margin-top: 10px; line-height: 1.3; }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
      </html>
    `;
    
    workerWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(formattedHtml)}`);
    
    workerWindow.webContents.on('did-finish-load', () => {
      const printOptions = {
        silent: true,
        printBackground: true,
        deviceName: printerName || '' // Use default if blank
      };
      
      workerWindow.webContents.print(printOptions, (success, errorType) => {
        workerWindow.destroy();
        if (success) {
          resolve({ success: true });
        } else {
          console.error('Print failure:', errorType);
          resolve({ success: false, error: errorType });
        }
      });
    });
  });
});

// 5. System Printers IPC
ipcMain.handle('printer:list', async () => {
  if (mainWindow) {
    return mainWindow.webContents.getPrinters();
  }
  return [];
});

// 6. Native Dialog IPC Handlers
ipcMain.handle('dialog:save', async (event, options) => {
  return await dialog.showSaveDialog(mainWindow, options);
});

ipcMain.handle('dialog:open', async (event, options) => {
  return await dialog.showOpenDialog(mainWindow, options);
});

// 7. Backup & Restore File Handlers
ipcMain.handle('backup:db', async (event, destPath) => {
  return new Promise((resolve, reject) => {
    try {
      fs.copyFile(dbPath, destPath, (err) => {
        if (err) {
          console.error('Database backup copy failure:', err);
          resolve({ success: false, error: err.message });
        } else {
          resolve({ success: true, path: destPath });
        }
      });
    } catch (e) {
      resolve({ success: false, error: e.message });
    }
  });
});

ipcMain.handle('restore:db', async (event, srcPath) => {
  return new Promise((resolve, reject) => {
    try {
      // Close database connection first
      db.close((err) => {
        if (err) {
          console.error('Failed to close DB for restore:', err);
          resolve({ success: false, error: 'Database is busy. Close other panels and try again.' });
          return;
        }
        
        // Copy the backup database over the current one
        fs.copyFile(srcPath, dbPath, (copyErr) => {
          if (copyErr) {
            console.error('Database restore copy failure:', copyErr);
            // Reopen connection to broken DB
            reconnectDB();
            resolve({ success: false, error: copyErr.message });
          } else {
            // Reopen connection to restored DB
            reconnectDB();
            resolve({ success: true });
          }
        });
      });
    } catch (e) {
      reconnectDB();
      resolve({ success: false, error: e.message });
    }
  });
});

function reconnectDB() {
  global.db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Failed to reconnect database:', err.message);
    } else {
      console.log('Reconnected to SQLite database.');
      db.run('PRAGMA foreign_keys = ON;');
    }
  });
}

ipcMain.handle('backup:get-dir', async () => {
  return path.join(appDataPath, 'backovers');
});

// Hash password via bcrypt (used by EmployeeManagement UI)
ipcMain.handle('auth:hash-password', async (event, plainText) => {
  return bcrypt.hashSync(plainText, 10);
});

ipcMain.on('app:close', () => {
  app.quit();
});
