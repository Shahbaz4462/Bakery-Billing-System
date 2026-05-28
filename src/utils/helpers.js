/**
 * Helper utilities for the Bakery Billing & Inventory Management System
 */

// Formats a price number into a beautiful local currency display (Rs.)
export function formatPrice(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) return 'Rs. 0.00';
  return `Rs. ${Number(amount).toFixed(2)}`;
}

// Generates an auto-incrementing bill number in format: BAK-YYYYMMDD-XXXX
// In production, we query the DB to count today's bills and append a padded index.
export async function generateBillNumber() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const date = String(today.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${date}`;
  
  try {
    const query = 'SELECT COUNT(*) as count FROM bills WHERE date(created_at) = date("now", "localtime")';
    const result = await window.electronAPI.query(query);
    const count = (result && result[0] ? result[0].count : 0) + 1;
    const paddedCount = String(count).padStart(4, '0');
    return `BAK-${dateStr}-${paddedCount}`;
  } catch (e) {
    // Fallback if db query fails
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `BAK-${dateStr}-${rand}`;
  }
}

// Logs user activity to the audit_logs table
export async function logActivity(userId, action, details) {
  try {
    const query = 'INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)';
    await window.electronAPI.run(query, [userId, action, details]);
  } catch (e) {
    console.error('Audit logging failed:', e);
  }
}

// Returns a human-friendly relative time or formatted date string
export function formatDate(dateString, includeTime = true) {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  
  const options = { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  };
  
  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.second = '2-digit';
    options.hour12 = true;
  }
  
  return d.toLocaleString('en-US', options);
}

// Translates a basic English unit to its corresponding Urdu script
export function translateUnit(unit) {
  const mapping = {
    'Piece': 'پیس',
    'KG': 'کلوگرام',
    'Gram': 'گرام',
    'Liter': 'لیٹر',
    'ML': 'ملی لیٹر',
    'Box': 'ڈبہ',
    'Tray': 'ٹرے',
    'Packet': 'پیکٹ',
    'Dozen': 'درجن',
    'Bottle': 'بوتل'
  };
  return mapping[unit] || unit;
}

// Translates a basic English payment method to Urdu
export function translatePaymentMethod(method) {
  const mapping = {
    'Cash': 'نقد (Cash)',
    'Card': 'کارڈ (Card)',
    'JazzCash': 'جاز کیش',
    'EasyPaisa': 'ایزی پیسہ'
  };
  return mapping[method] || method;
}
