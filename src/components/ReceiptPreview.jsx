import React from 'react';

export default function ReceiptPreview({
  cart = [],
  billDetails = {},
  settings = {},
  employeeName = 'Admin',
  language = 'en',
  customerName = '',
  customerPhone = ''
}) {
  // Shop info — fall back to hard-coded defaults so preview is never blank
  const shopName    = settings.bakery_name    || 'Choudhry Bakery & Sweets';
  const address     = settings.bakery_address || 'Gousia Chowk, Abdul Hakim';
  const phone       = settings.bakery_phone   || '0304-7863020';
  const taxNo       = settings.bakery_tax_no  || '';
  const header      = settings.receipt_header || 'WELCOME TO CHOUDHRY BAKERY';
  const footer      = settings.receipt_footer || 'Items returnable with cash memo within 15 days. Loose/expiry items not returnable.';
  const taxRate     = parseFloat(settings.bakery_tax_rate) || 0;

  // Bill info
  const billNumber    = billDetails.bill_number    || 'BAK-PREVIEW-0001';
  const createdDate   = billDetails.created_at ? new Date(billDetails.created_at) : new Date();
  const dateStr       = createdDate.toLocaleDateString('en-GB');
  const timeStr       = createdDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  // Totals
  const grossAmount   = billDetails.gross_amount   != null ? billDetails.gross_amount  : cart.reduce((s, i) => s + (i.sale_price * (i.cartQty || i.quantity || 1)), 0);
  const discount      = billDetails.discount       || 0;
  const taxAmount     = billDetails.tax_amount     || (taxRate > 0 ? (grossAmount - discount) * (taxRate / 100) : 0);
  const netAmount     = billDetails.net_amount     != null ? billDetails.net_amount : (grossAmount - discount + taxAmount);
  const paymentMethod = billDetails.payment_method || 'Cash';
  const totalItems    = billDetails.total_items    || cart.reduce((s, i) => s + (i.cartQty || i.quantity || 1), 0);

  const isUrdu = language === 'ur';

  const hr = (dashed = true, thick = false) => (
    <div style={{
      borderTop: thick ? '2px solid #000' : (dashed ? '1px dashed #000' : '1px solid #000'),
      margin: '6px 0'
    }} />
  );

  const row = (left, right, bold = false, color = '#000') => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', margin: '2px 0', color }}>
      <span style={{ fontWeight: bold ? '700' : '400' }}>{left}</span>
      <span style={{ fontWeight: bold ? '700' : '400' }}>{right}</span>
    </div>
  );

  return (
    <div style={{
      backgroundColor: '#fff',
      color: '#000',
      padding: '14px',
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '10.5px',
      width: '100%',
      maxWidth: '302px',
      margin: '0 auto',
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      border: '1px solid #ccc',
      lineHeight: '1.45',
      boxSizing: 'border-box'
    }}>

      {/* ── SHOP HEADER ─────────────────────────────────────── */}
      <div style={{ textAlign: 'center', marginBottom: '6px' }}>
        {/* Welcome banner */}
        <div style={{ fontSize: '8px', letterSpacing: '0.08em', color: '#555', marginBottom: '3px', textTransform: 'uppercase' }}>
          {header}
        </div>

        {/* Shop Name */}
        <div style={{ fontSize: '15px', fontWeight: '900', fontFamily: 'Arial, sans-serif', margin: '2px 0 3px', letterSpacing: '0.03em' }}>
          {shopName}
        </div>

        {/* Address */}
        <div style={{ fontSize: '9px', color: '#333', margin: '1px 0' }}>
          {address}
        </div>

        {/* Phone */}
        <div style={{ fontSize: '9.5px', fontWeight: '700', margin: '1px 0' }}>
          Cell: {phone}
        </div>

        {/* Tax No (if exists) */}
        {taxNo && (
          <div style={{ fontSize: '8px', color: '#555', margin: '1px 0' }}>
            Tax Reg No: {taxNo}
          </div>
        )}
      </div>

      {hr(true)}

      {/* ── BILL META ───────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '9.5px', marginBottom: '4px' }}>
        <div>
          <span style={{ color: '#555' }}>Invoice #:</span><br />
          <strong style={{ fontSize: '9px' }}>{billNumber}</strong>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ color: '#555' }}>Date:</span><br />
          <strong>{dateStr}</strong><br />
          <span style={{ fontSize: '8.5px', color: '#666' }}>{timeStr}</span>
        </div>
      </div>

      {/* Customer Info (shown only if provided) */}
      {(customerName || billDetails.customer_name) && (
        <div style={{ fontSize: '9px', margin: '3px 0' }}>
          <span style={{ color: '#555' }}>Customer: </span>
          <strong>{customerName || billDetails.customer_name}</strong>
          {(customerPhone || billDetails.customer_phone) && (
            <span style={{ color: '#555' }}> | Ph: <strong>{customerPhone || billDetails.customer_phone}</strong></span>
          )}
        </div>
      )}

      <div style={{ fontSize: '9px', margin: '2px 0' }}>
        <span style={{ color: '#555' }}>Cashier: </span>
        <strong>{employeeName.toUpperCase()}</strong>
      </div>

      {hr(false, true)}

      {/* ── TABLE HEADER ────────────────────────────────────── */}
      <div style={{ display: 'flex', fontWeight: '700', fontSize: '9.5px', padding: '3px 0' }}>
        <div style={{ width: '10%' }}>Qty</div>
        <div style={{ width: '50%' }}>Description</div>
        <div style={{ width: '20%', textAlign: 'right' }}>Rate</div>
        <div style={{ width: '20%', textAlign: 'right' }}>Amt</div>
      </div>

      {hr(false, true)}

      {/* ── CART ITEMS ──────────────────────────────────────── */}
      <div style={{ minHeight: '50px' }}>
        {cart.length === 0 && (
          <div style={{ textAlign: 'center', color: '#888', padding: '12px 0', fontSize: '9px', fontStyle: 'italic' }}>
            No items — add products to see preview
          </div>
        )}
        {cart.map((item, idx) => {
          const qty    = item.cartQty || item.quantity || 1;
          const rate   = item.sale_price || item.rate || 0;
          const amount = qty * rate;
          const desc   = (isUrdu && item.name_urdu) ? item.name_urdu : item.name;
          const isUrduItem = isUrdu && !!item.name_urdu;

          return (
            <div key={idx} style={{
              borderBottom: idx < cart.length - 1 ? '1px dashed #eee' : 'none',
              paddingBottom: '4px', marginBottom: '4px'
            }}>
              {/* Main row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', fontSize: '9.5px' }}>
                <div style={{ width: '10%', fontWeight: '700' }}>{qty}</div>
                <div style={{
                  width: '50%',
                  fontWeight: '700',
                  fontFamily: isUrduItem ? '"Jameel Noori Nastaliq","Noto Nastaliq Urdu",serif' : 'inherit',
                  direction: isUrduItem ? 'rtl' : 'ltr',
                  textAlign: isUrduItem ? 'right' : 'left',
                  fontSize: isUrduItem ? '10px' : '9.5px'
                }}>
                  {desc}
                </div>
                <div style={{ width: '20%', textAlign: 'right' }}>{rate.toFixed(2)}</div>
                <div style={{ width: '20%', textAlign: 'right', fontWeight: '700' }}>{amount.toFixed(2)}</div>
              </div>
              {/* Show English name below if Urdu is active */}
              {isUrduItem && (
                <div style={{ fontSize: '8.5px', color: '#666', marginLeft: '10%' }}>{item.name}</div>
              )}
            </div>
          );
        })}
      </div>

      {hr(true)}

      {/* ── TOTALS ──────────────────────────────────────────── */}
      <div style={{ fontSize: '9.5px' }}>
        {row(`Total Items: ${totalItems}`, `Gross:`, false)}
        <div style={{ display: 'flex', justifyContent: 'flex-end', fontWeight: '700', fontSize: '10px', margin: '1px 0' }}>
          Rs. {grossAmount.toFixed(2)}
        </div>

        {discount > 0 && row('', `Discount: -Rs. ${discount.toFixed(2)}`, false, '#c00')}
        {taxAmount > 0 && row('', `Tax (${taxRate}%): Rs. ${taxAmount.toFixed(2)}`)}
      </div>

      {/* Net Amount Box */}
      <div style={{
        border: '2px solid #000',
        padding: '7px 10px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontWeight: '900',
        fontSize: '14px',
        margin: '8px 0'
      }}>
        <div style={{ fontSize: '11px' }}>NET AMOUNT</div>
        <div style={{ fontFamily: 'Arial, sans-serif' }}>Rs. {netAmount.toFixed(2)}</div>
      </div>

      {row('Payment Method:', paymentMethod, true)}

      {hr(true)}

      {/* ── FOOTER ──────────────────────────────────────────── */}
      <div style={{ fontSize: '8px', lineHeight: '1.4', color: '#444', textAlign: 'center' }}>
        {footer}
      </div>

      {hr(true)}

      {/* Cashier footer stamp */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#666', fontWeight: '700' }}>
        <span>{employeeName.toUpperCase()}</span>
        <span>SERVER-PC</span>
        <span style={{ fontSize: '7.5px' }}>Powered by BakeryPOS</span>
      </div>
    </div>
  );
}
