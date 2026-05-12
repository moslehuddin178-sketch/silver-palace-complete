const QRCode = require('qrcode');

/**
 * Generate a QR code for a jewelry product.
 * The QR encodes a JSON payload that can be scanned by POS or mobile app.
 */
const generateProductQR = async (product, prices = {}) => {
  const payload = {
    sku:          product.sku,
    name:         product.name,
    category:     product.category,
    purity:       product.purity,
    weightGram:   product.weightGram,
    retailPrice:  prices.retailPrice  || 0,
    wholesalePrice: prices.wholesalePrice || 0,
    barcode:      product.barcode || product.sku,
    _id:          product._id?.toString(),
  };

  const qrString = JSON.stringify(payload);

  // Generate base64 PNG
  const qrBase64 = await QRCode.toDataURL(qrString, {
    errorCorrectionLevel: 'M',
    type: 'image/png',
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
    width: 256,
  });

  return { qrBase64, qrString };
};

/**
 * Generate a plain text QR (URL-based) for web lookup
 */
const generateProductQRUrl = async (productId, baseUrl = 'http://localhost:5000') => {
  const url = `${baseUrl}/api/products/scan/${productId}`;
  const qrBase64 = await QRCode.toDataURL(url, { width: 256, margin: 2 });
  return { qrBase64, url };
};

module.exports = { generateProductQR, generateProductQRUrl };
