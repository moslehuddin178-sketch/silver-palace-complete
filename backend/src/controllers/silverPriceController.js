const SilverPrice = require('../models/SilverPrice');
const { computePrices } = require('../utils/pricing');
const Product = require('../models/Product');

// Set new silver price (owner/manager only)
const setPrice = async (req, res) => {
  const { gramPrice, notes, currency } = req.body;
  if (!gramPrice || gramPrice <= 0)
    return res.status(400).json({ success: false, message: 'Valid gram price required' });
  try {
    // Deactivate previous
    await SilverPrice.updateMany({ isActive: true }, { isActive: false });
    const price = await SilverPrice.create({ gramPrice, notes, currency, setBy: req.user._id, isActive: true });
    res.status(201).json({ success: true, message: `Silver price updated to $${gramPrice}/gram`, data: price });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// Get current silver price
const getActive = async (req, res) => {
  try {
    const price = await SilverPrice.findOne({ isActive: true }).sort({ createdAt: -1 }).populate('setBy', 'name role');
    res.status(200).json({ success: true, data: price || { gramPrice: parseFloat(process.env.SILVER_GRAM_PRICE || 0.85), source: 'env_default' } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// Price history
const getHistory = async (req, res) => {
  try {
    const history = await SilverPrice.find().sort({ createdAt: -1 }).limit(30).populate('setBy', 'name');
    res.status(200).json({ success: true, data: history });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// Preview: what would a product cost at current silver price
const previewProductPrice = async (req, res) => {
  try {
    const product = await Product.findById(req.params.productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    const prices = await computePrices(product);
    res.status(200).json({ success: true, sku: product.sku, name: product.name, ...prices });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { setPrice, getActive, getHistory, previewProductPrice };
