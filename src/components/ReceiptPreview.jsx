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
  // Shop info - fall back to hard-coded defaults so preview is never blank
  const shopName    = settings.bakery_name    || 'CHOUDHRY BAKERY';
  const address     = settings.bakery_address || 'GOUSIA CHOWK, ABDUL HAKIM';
  const phone       = settings.bakery_phone   || '0304-7863020';
  const taxNo       = settings.bakery_tax_no  || '';
  const taxRate     = parseFloat(settings.bakery_tax_rate) || 0;

  // Bill info
  const billNumber    = billDetails.bill_number    || 'BAK-PREVIEW-0001';
  const createdDate   = billDetails.created_at ? new Date(billDetails.created_at) : new Date();
  const dateStr       = createdDate.toLocaleDateString('en-GB'); // DD/MM/YY format
  const timeStr       = createdDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

  // Totals
  const grossAmount   = billDetails.gross_amount   != null ? billDetails.gross_amount  : cart.reduce((s, i) => s + (i.sale_price * (i.cartQty || i.quantity || 1)), 0);
  const discount      = billDetails.discount       || 0;
  const taxAmount     = billDetails.tax_amount     || (taxRate > 0 ? (grossAmount - discount) * (taxRate / 100) : 0);
  const netAmount     = billDetails.net_amount     != null ? billDetails.net_amount : (grossAmount - discount + taxAmount);
  const paymentMethod = billDetails.payment_method || 'Cash';
  const totalItems    = billDetails.total_items    || cart.reduce((s, i) => s + (i.cartQty || i.quantity || 1), 0);

  const isUrdu = language === 'ur';

  // Format invoice number without leading zeros mess - extract numeric portion
  const invoiceNum = billNumber.includes('-') ? billNumber.split('-').pop().replace(/^0+/, '') || '1' : billNumber;

  return (
    <div style={{
      backgroundColor: '#fff',
      color: '#000',
      padding: '12px 10px',
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '11px',
      width: '100%',
      maxWidth: '302px',
      margin: '0 auto',
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      border: '1px solid #ccc',
      lineHeight: '1.4',
      boxSizing: 'border-box'
    }}>

      {/* ── SHOP HEADER ─────────────────────────────────────── */}
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        {/* Shop Name - Bold and Large */}
        <div style={{ 
          fontSize: '16px', 
          fontWeight: '900', 
          fontFamily: 'Arial, sans-serif', 
          letterSpacing: '0.02em',
          marginBottom: '2px'
        }}>
          {shopName.toUpperCase()}
        </div>

        {/* Address */}
        <div style={{ fontSize: '10px', margin: '2px 0' }}>
          {address.toUpperCase()}
        </div>

        {/* Phone */}
        <div style={{ fontSize: '11px', fontWeight: '700', margin: '2px 0' }}>
          CELL: {phone}
        </div>
      </div>

      {/* ── INVOICE META ROW ───────────────────────────────── */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        fontSize: '10px',
        marginBottom: '6px',
        paddingTop: '4px',
        borderTop: '1px solid #000'
      }}>
        <div>
          <span style={{ fontWeight: '700' }}>Inv #</span>
          <span style={{ marginLeft: '8px', fontWeight: '700', fontSize: '11px' }}>{invoiceNum}</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontWeight: '700' }}>Date.</span>
          <span style={{ marginLeft: '8px' }}>{dateStr}</span>
          <br />
          <span style={{ fontSize: '9px' }}>{timeStr}</span>
        </div>
      </div>

      {/* ── TABLE HEADER ────────────────────────────────────── */}
      <div style={{ 
        border: '1px solid #000',
        marginBottom: '0'
      }}>
        <div style={{ 
          display: 'flex', 
          fontWeight: '700', 
          fontSize: '10px', 
          padding: '4px 6px',
          borderBottom: '1px solid #000',
          backgroundColor: '#f5f5f5'
        }}>
          <div style={{ width: '12%', textAlign: 'center' }}>Qty</div>
          <div style={{ width: '44%' }}>Description</div>
          <div style={{ width: '22%', textAlign: 'right' }}>Rate</div>
          <div style={{ width: '22%', textAlign: 'right' }}>Amount</div>
        </div>

        {/* ── CART ITEMS ──────────────────────────────────────── */}
        <div style={{ minHeight: '40px' }}>
          {cart.length === 0 && (
            <div style={{ textAlign: 'center', color: '#888', padding: '12px 0', fontSize: '9px', fontStyle: 'italic' }}>
              No items - add products to see preview
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
                borderBottom: idx < cart.length - 1 ? '1px dashed #aaa' : 'none',
                padding: '4px 6px'
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  fontSize: '10px'
                }}>
                  <div style={{ width: '12%', textAlign: 'center', fontWeight: '700' }}>{qty}</div>
                  <div style={{
                    width: '44%',
                    fontWeight: '600',
                    fontFamily: isUrduItem ? '"Jameel Noori Nastaliq","Noto Nastaliq Urdu",serif' : 'inherit',
                    direction: isUrduItem ? 'rtl' : 'ltr',
                    textAlign: isUrduItem ? 'right' : 'left',
                    fontSize: isUrduItem ? '11px' : '10px',
                    wordBreak: 'break-word',
                    paddingRight: '4px'
                  }}>
                    {desc.length > 18 ? (
                      <>
                        {desc.substring(0, 18)}
                        <br />
                        <span style={{ fontSize: '9px' }}>{desc.substring(18)}</span>
                      </>
                    ) : desc}
                  </div>
                  <div style={{ width: '22%', textAlign: 'right' }}>{rate.toFixed(2)}</div>
                  <div style={{ width: '22%', textAlign: 'right', fontWeight: '700' }}>{amount.toFixed(2)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── DASHED SEPARATOR ────────────────────────────────── */}
      <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

      {/* ── TOTALS ROW ──────────────────────────────────────── */}
      <div style={{ fontSize: '10px', marginBottom: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
          <span>Total Items: <strong>{totalItems}</strong></span>
          <span>Gross Amount: <strong style={{ fontSize: '11px' }}>{grossAmount.toFixed(2)}</strong></span>
        </div>
        
        {discount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', color: '#c00', marginBottom: '2px' }}>
            <span>Discount: -{discount.toFixed(2)}</span>
          </div>
        )}
        
        {taxAmount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2px' }}>
            <span>Tax ({taxRate}%): {taxAmount.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* ── NET AMOUNT BOX ──────────────────────────────────── */}
      <div style={{
        border: '2px solid #000',
        padding: '8px 12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontWeight: '900',
        margin: '8px 0'
      }}>
        <div style={{ fontSize: '12px' }}>Net Amount:</div>
        <div style={{ fontSize: '16px', fontFamily: 'Arial, sans-serif' }}>{netAmount.toFixed(2)}</div>
      </div>

      {/* ── NOTES / FOOTER ──────────────────────────────────── */}
      <div style={{ 
        fontSize: '8px', 
        lineHeight: '1.4', 
        color: '#333', 
        marginTop: '8px',
        marginBottom: '8px'
      }}>
        <div style={{ fontWeight: '700', marginBottom: '2px' }}>Note:</div>
        <div>1. Items will be return with cash memo within 15 days.</div>
        <div>2. Inhaler / loose tablets / lotion / fridge items/cosmetics items will not be returned.</div>
        <div>3. Without sign and stamp bill will not be valid.</div>
      </div>

      {/* ── DASHED SEPARATOR ────────────────────────────────── */}
      <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

      {/* ── CASHIER FOOTER STAMP ────────────────────────────── */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        fontSize: '9px', 
        fontWeight: '700',
        paddingTop: '4px'
      }}>
        <span>{employeeName.toUpperCase()}</span>
        <span>ADMIN</span>
        <span>SERVER-PC</span>
      </div>
    </div>
  );
}
