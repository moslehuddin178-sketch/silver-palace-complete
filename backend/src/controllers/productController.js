const { validationResult } = require('express-validator');
const Product     = require('../models/Product');
const SilverPrice = require('../models/SilverPrice');
const { computePrices }    = require('../utils/pricing');
const { generateProductQR } = require('../utils/qrcode');

// ─── Helper: make slug without slugify ────────────────────────────────────────
const makeSlug = (name, sku) =>
  `${name}-${sku}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// ─── CREATE ───────────────────────────────────────────────────────────────────
const createProduct = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });
  try {
    const skuUpper = req.body.sku?.toUpperCase();
    if (await Product.findOne({ sku: skuUpper }))
      return res.status(409).json({ success: false, message: `SKU '${skuUpper}' already exists` });

    const product = await Product.create({
      ...req.body,
      sku:       skuUpper,
      slug:      makeSlug(req.body.name, skuUpper),
      createdBy: req.user._id,
    });

    const prices = await computePrices(product);
    const { qrBase64, qrString } = await generateProductQR(product, prices);
    product.qrCode = qrBase64;
    product.qrData = qrString;
    await product.save();

    res.status(201).json({
      success: true,
      message: 'Product created with QR',
      data: { ...product.toObject(), prices },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET ALL ──────────────────────────────────────────────────────────────────
const getProducts = async (req, res) => {
  try {
    const {
      category, status, purity, gender, finish,
      isFeatured, isNewArrival, isBestSeller,
      availableForWholesale, isLowStock, warehouse,
      minWeight, maxWeight, search,
      page = 1, limit = 20, sortBy = 'createdAt', order = 'desc',
    } = req.query;

    const filter = {};
    if (category)  filter.category = category;
    if (status)    filter.status   = status;
    if (purity)    filter.purity   = purity;
    if (gender)    filter.gender   = gender;
    if (finish)    filter.finish   = finish;
    if (isFeatured         === 'true') filter.isFeatured            = true;
    if (isNewArrival       === 'true') filter.isNewArrival           = true;
    if (isBestSeller       === 'true') filter.isBestSeller           = true;
    if (availableForWholesale === 'true') filter.availableForWholesale = true;
    if (isLowStock         === 'true') filter.isLowStock             = true;
    if (warehouse) filter.warehouse = { $regex: warehouse, $options: 'i' };
    if (minWeight || maxWeight) filter.weightGram = {};
    if (minWeight) filter.weightGram.$gte = parseFloat(minWeight);
    if (maxWeight) filter.weightGram.$lte = parseFloat(maxWeight);
    if (search)    filter.$text = { $search: search };
    if (req.user.role === 'wholesaler') filter.availableForWholesale = true;

    const skip     = (Number(page) - 1) * Number(limit);
    const total    = await Product.countDocuments(filter);
    const sortObj  = { [sortBy]: order === 'asc' ? 1 : -1 };

    const products = await Product.find(filter)
      .select('-qrCode')
      .sort(sortObj)
      .skip(skip)
      .limit(Number(limit))
      .populate('createdBy', 'name');

    const silverGramPrice = await SilverPrice.getActive();

    const enriched = products.map(p => {
      const w   = p.netWeightGram || p.weightGram;
      const mat = w * silverGramPrice + (p.laborCost || 0) + (p.stoneCost || 0);
      return {
        ...p.toObject(),
        prices: {
          silverGramPrice,
          retailPrice:    p.fixedRetailPrice    || parseFloat((mat * (1 + (p.retailMarkup    || 150) / 100)).toFixed(2)),
          wholesalePrice: p.fixedWholesalePrice || parseFloat((mat * (1 + (p.wholesaleMarkup || 50)  / 100)).toFixed(2)),
        },
      };
    });

    res.status(200).json({
      success: true, total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      data: enriched,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET SINGLE ───────────────────────────────────────────────────────────────
const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name');
    if (!product)
      return res.status(404).json({ success: false, message: 'Product not found' });
    const prices = await computePrices(product);
    res.status(200).json({ success: true, data: { ...product.toObject(), prices } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── SCAN BY SKU / BARCODE / ID (POS) ────────────────────────────────────────
const scanProduct = async (req, res) => {
  try {
    const { query } = req.params;
    let found = await Product.findOne({
      $or: [{ sku: query.toUpperCase() }, { barcode: query }],
    }).lean();

    if (!found && query.length === 24) {
      found = await Product.findById(query).lean();
    }
    if (!found)
      return res.status(404).json({ success: false, message: `Product not found: "${query}"` });

    const prices = await computePrices(found);
    await Product.findByIdAndUpdate(found._id, { $inc: { viewCount: 1 } });

    res.status(200).json({ success: true, message: 'Product scanned', data: { ...found, prices } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── REGENERATE QR ────────────────────────────────────────────────────────────
const regenerateQR = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product)
      return res.status(404).json({ success: false, message: 'Product not found' });
    const prices = await computePrices(product);
    const { qrBase64, qrString } = await generateProductQR(product, prices);
    product.qrCode    = qrBase64;
    product.qrData    = qrString;
    product.updatedBy = req.user._id;
    await product.save();
    res.status(200).json({ success: true, message: 'QR regenerated', qrCode: qrBase64, sku: product.sku });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── UPDATE ───────────────────────────────────────────────────────────────────
const updateProduct = async (req, res) => {
  try {
    ['sku', 'slug', 'createdBy', 'totalSold', 'totalRevenue'].forEach(f => delete req.body[f]);
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user._id },
      { new: true, runValidators: true }
    );
    if (!product)
      return res.status(404).json({ success: false, message: 'Product not found' });
    const prices = await computePrices(product);
    const { qrBase64, qrString } = await generateProductQR(product, prices);
    product.qrCode = qrBase64;
    product.qrData = qrString;
    await product.save();
    res.status(200).json({ success: true, message: 'Product updated', data: { ...product.toObject(), prices } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── STOCK ADJUSTMENT ─────────────────────────────────────────────────────────
const adjustStock = async (req, res) => {
  const { type, quantity, reason } = req.body;
  if (!['add', 'remove', 'set'].includes(type) || !quantity)
    return res.status(400).json({ success: false, message: 'type (add|remove|set) and quantity required' });
  try {
    const product = await Product.findById(req.params.id);
    if (!product)
      return res.status(404).json({ success: false, message: 'Product not found' });
    const qty = Number(quantity);
    if (type === 'add')         product.stockQty += qty;
    else if (type === 'remove') {
      if (product.stockQty < qty)
        return res.status(400).json({ success: false, message: `Insufficient stock. Have: ${product.stockQty}` });
      product.stockQty -= qty;
    } else {
      product.stockQty = qty;
    }
    product.updatedBy = req.user._id;
    await product.save();
    res.status(200).json({
      success: true,
      message: `Stock ${type}: now ${product.stockQty} units`,
      data: { sku: product.sku, stockQty: product.stockQty, status: product.status },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── DELETE ───────────────────────────────────────────────────────────────────
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product)
      return res.status(404).json({ success: false, message: 'Product not found' });
    if (product.stockQty > 0)
      return res.status(400).json({ success: false, message: `Cannot delete — ${product.stockQty} units in stock. Zero out first.` });
    await product.deleteOne();
    res.status(200).json({ success: true, message: `Product '${product.sku}' deleted` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── ANALYTICS ───────────────────────────────────────────────────────────────
const getProductAnalytics = async (req, res) => {
  try {
    const [byCategory, byPurity, lowStock, topSellers, totals] = await Promise.all([
      Product.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 }, totalQty: { $sum: '$stockQty' }, totalGrams: { $sum: { $multiply: ['$weightGram', '$stockQty'] } } } },
        { $sort: { count: -1 } },
      ]),
      Product.aggregate([
        { $group: { _id: '$purity', count: { $sum: 1 }, avgWeight: { $avg: '$weightGram' } } },
      ]),
      Product.find({ isLowStock: true })
        .select('sku name stockQty minimumStock warehouse')
        .limit(20),
      Product.find()
        .select('sku name totalSold totalRevenue')
        .sort({ totalSold: -1 })
        .limit(10),
      Product.aggregate([
        { $group: {
          _id: null,
          totalProducts:    { $sum: 1 },
          totalStockGrams:  { $sum: { $multiply: ['$weightGram', '$stockQty'] } },
          totalItems:       { $sum: '$stockQty' },
          outOfStockCount:  { $sum: { $cond: [{ $eq: ['$status', 'out_of_stock'] }, 1, 0] } },
          lowStockCount:    { $sum: { $cond: ['$isLowStock', 1, 0] } },
        }},
      ]),
    ]);

    res.status(200).json({
      success: true,
      data: { overview: totals[0] || {}, byCategory, byPurity, lowStock, topSellers },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createProduct, getProducts, getProduct, scanProduct,
  regenerateQR, updateProduct, adjustStock, deleteProduct, getProductAnalytics,
};