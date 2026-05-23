import { formatINR } from './currency';

const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const normalizeBarcodeValue = (value) => {
  const cleaned = String(value || 'ITEM').replace(/[^\x20-\x7e]/g, '').trim();
  return cleaned || 'ITEM';
};

export const createCode128Svg = (value, options = {}) => {
  const text = normalizeBarcodeValue(value);
  const height = options.height || 58;
  const moduleWidth = options.moduleWidth || 2;
  const quietZone = options.quietZone ?? 10;
  const codes = [104];

  for (const char of text) {
    const code = char.charCodeAt(0);
    codes.push(code >= 32 && code <= 126 ? code - 32 : 0);
  }

  const checksum = codes.reduce((sum, code, index) => sum + code * (index === 0 ? 1 : index), 0) % 103;
  codes.push(checksum, 106);

  let x = quietZone;
  const bars = [];
  codes.forEach((code) => {
    const pattern = CODE128_PATTERNS[code];
    for (let i = 0; i < pattern.length; i += 1) {
      const width = Number(pattern[i]) * moduleWidth;
      if (i % 2 === 0) {
        bars.push(`<rect x="${x}" y="0" width="${width}" height="${height}" />`);
      }
      x += width;
    }
  });

  const width = x + quietZone;
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height + 22}" width="100%" height="${height + 22}" role="img" aria-label="Barcode ${escapeHtml(text)}">
      <rect width="${width}" height="${height + 22}" fill="#fff" />
      <g fill="#111">${bars.join('')}</g>
      <text x="${width / 2}" y="${height + 16}" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" letter-spacing="1">${escapeHtml(text)}</text>
    </svg>
  `;
};

const openPrintWindow = (title, bodyHtml, pageCss = '') => {
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) return false;

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 24px; font-family: Arial, sans-serif; color: #111827; background: #f8fafc; }
          .sheet { width: 100%; max-width: 760px; margin: 0 auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; }
          .muted { color: #64748b; }
          .tiny { font-size: 11px; text-transform: uppercase; letter-spacing: 1.4px; font-weight: 700; }
          .row { display: flex; justify-content: space-between; gap: 16px; }
          .divider { border-top: 1px solid #e5e7eb; margin: 18px 0; }
          .barcode { width: 100%; max-width: 420px; margin: 14px auto 0; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 8px; border-bottom: 1px solid #eef2f7; font-size: 12px; text-align: left; }
          th { color: #64748b; text-transform: uppercase; letter-spacing: 1px; font-size: 10px; }
          @media print {
            body { padding: 0; background: #fff; }
            .sheet { border: 0; border-radius: 0; max-width: none; }
            @page { margin: 12mm; }
          }
          ${pageCss}
        </style>
      </head>
      <body>${bodyHtml}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 250);
  return true;
};

const getAddressLine = (address = {}) =>
  [
    address.address,
    address.city,
    address.state,
    address.postalCode || address.zipCode,
    address.country,
  ].filter(Boolean).join(', ');

export const printOrderAddressReceipt = (order) => {
  const orderId = order.orderId || order.id || order._id;
  const address = order.shippingAddress || {};
  const items = order.orderItems || [];
  const barcodeValue = `ORD-${orderId}`;

  return openPrintWindow(`Address Receipt ${orderId}`, `
    <main class="sheet">
      <div class="row">
        <div>
          <div class="tiny muted">Ship To</div>
          <h1 style="margin: 6px 0 8px; font-size: 24px;">${escapeHtml(address.fullName || (address.firstName ? `${address.firstName} ${address.lastName || ''}`.trim() : '') || address.name || 'Customer')}</h1>
          <p style="margin: 0; line-height: 1.55; font-size: 15px;">${escapeHtml(getAddressLine(address) || 'Address not available')}</p>
          <p style="margin: 8px 0 0; font-size: 13px;"><strong>Phone:</strong> ${escapeHtml(address.phone || address.phoneNumber || address.mobile || order.phone || 'N/A')}</p>
        </div>
        <div style="text-align: right;">
          <div class="tiny muted">Order</div>
          <div style="font-weight: 800; font-size: 16px;">#${escapeHtml(orderId)}</div>
          <div class="muted" style="font-size: 12px; margin-top: 4px;">${escapeHtml(order.date || '')}</div>
        </div>
      </div>

      <div class="barcode">${createCode128Svg(barcodeValue)}</div>
      <div class="divider"></div>

      <div class="row">
        <div>
          <div class="tiny muted">Payment</div>
          <strong>${escapeHtml(order.payment || 'Unpaid')}</strong>
          <span class="muted">via ${escapeHtml(order.paymentMethod || 'COD')}</span>
        </div>
        <div style="text-align: right;">
          <div class="tiny muted">Total</div>
          <strong>${escapeHtml(formatINR(order.totalPrice || order.price || 0))}</strong>
        </div>
      </div>

      <div class="divider"></div>
      <table>
        <thead><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead>
        <tbody>
          ${items.map((item) => {
            const finalPrice = item.price || item.product?.discountPrice || item.product?.price || 0;
            return `
            <tr>
              <td>${escapeHtml(item.name || 'Product')}</td>
              <td>${escapeHtml(item.qty || item.quantity || 1)}</td>
              <td>${escapeHtml(formatINR(finalPrice))}</td>
            </tr>
          `;
          }).join('')}
        </tbody>
      </table>
    </main>
  `);
};

export const printOrderBarcode = (order) => {
  const orderId = order.orderId || order.id || order._id;
  return openPrintWindow(`Order Barcode ${orderId}`, `
    <main class="sheet" style="max-width: 420px; text-align: center;">
      <div class="tiny muted">Order Barcode</div>
      <h1 style="font-size: 22px; margin: 8px 0;">#${escapeHtml(orderId)}</h1>
      <div class="barcode">${createCode128Svg(`ORD-${orderId}`, { height: 64 })}</div>
      <p class="muted" style="font-size: 12px;">${escapeHtml(order.product || 'Order shipment')}</p>
    </main>
  `);
};

export const printProductBarcode = (product) => {
  const code = product.sku || product._id || product.name;
  return openPrintWindow(`Product Barcode ${product.name}`, `
    <main class="sheet" style="max-width: 420px; text-align: center;">
      <div class="tiny muted">Product Barcode</div>
      <h1 style="font-size: 20px; margin: 8px 0 2px;">${escapeHtml(product.name || 'Product')}</h1>
      <p class="muted" style="font-size: 12px; margin: 0;">${escapeHtml(product.mainCategory || 'Catalog')}</p>
      <div class="barcode">${createCode128Svg(code, { height: 64 })}</div>
      <div class="row" style="margin-top: 14px; font-size: 12px;">
        <span><strong>Price:</strong> ${escapeHtml(formatINR(product.discountPrice || product.price || 0))}</span>
        <span><strong>Stock:</strong> ${escapeHtml(product.stock ?? 0)}</span>
      </div>
    </main>
  `);
};
