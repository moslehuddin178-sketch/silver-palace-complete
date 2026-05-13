const { validationResult } = require('express-validator');
const Sale     = require('../models/Sale');
const Product  = require('../models/Product');
const Customer = require('../models/Customer');
const SilverPrice = require('../models/SilverPrice');
const { computePrices } = require('../utils/pricing');

const checkout = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });

  const {
    customerId, isWalkIn, items,
    paymentMethod, amountPaid,
    globalDiscount = 0,
    taxRate, saleType = 'retail', notes,
  } = req.body;

  try {
    const silverGramPrice = await SilverPrice.getActive();
    let customer = null;

    if (customerId) {
      customer = await Customer.findById(customerId);
      if (!customer)
        return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    // ── Build and validate each item ─────────────────────────────────────────
    const saleItems = [];
    let subtotal        = 0;
    let totalWeightGram = 0;

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product)
        return res.status(404).json({ success: false, message: `Product not found: ${item.productId}` });

      if (product.stockQty < item.quantity)
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${product.name}". Available: ${product.stockQty}`,
        });

      const prices    = await computePrices(product);
      const unitPrice = saleType === 'wholesale'
        ? prices.wholesalePrice
        : prices.retailPrice;

      const lineDiscount = Number(item.discount) || 0;
      const lineTotal    = unitPrice * item.quantity * (1 - lineDiscount / 100);

      subtotal        += lineTotal;
      totalWeightGram += (product.weightGram || 0) * item.quantity;

      saleItems.push({
        product:         product._id,
        sku:             product.sku,
        name:            product.name,
        category:        product.category,
        weightGram:      product.weightGram,
        purity:          product.purity,
        quantity:        item.quantity,
        unitPrice,
        discount:        lineDiscount,
        totalPrice:      parseFloat(lineTotal.toFixed(2)),
        silverGramPrice,
        priceType:       saleType,
      });
    }

    // ── Totals ────────────────────────────────────────────────────────────────
    const discountAmount  = subtotal * (globalDiscount / 100);
    const afterDiscount   = subtotal - discountAmount;
    const appliedTaxRate  = taxRate !== undefined ? Number(taxRate) : parseFloat(process.env.SHOP_TAX_RATE || 0);
    const taxAmount       = afterDiscount * appliedTaxRate;
    const totalAmount     = parseFloat((afterDiscount + taxAmount).toFixed(2));
    const paid            = amountPaid ? Number(amountPaid) : totalAmount;
    const changeGiven     = Math.max(0, paid - totalAmount);
    const creditAmount    = Math.max(0, totalAmount - paid);

    // ── Credit limit check ────────────────────────────────────────────────────
    if (creditAmount > 0 && customer) {
      const available = (customer.creditLimit || 0) - (customer.creditUsed || 0);
      if (creditAmount > available)
        return res.status(400).json({
          success: false,
          message: `Credit limit exceeded. Available: $${available.toFixed(2)}`,
        });
    }

    // ── Generate invoice number manually (avoid pre-save async issues) ────────
    const count    = await Sale.countDocuments();
    const prefix   = saleType === 'wholesale' ? 'WS-INV' : 'RT-INV';
    const dateStr  = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const invoiceNo = `${prefix}-${dateStr}-${String(count + 1).padStart(5, '0')}`;

    // ── Create sale ───────────────────────────────────────────────────────────
    const sale = new Sale({
      invoiceNo,
      saleType,
      customer:         customer?._id || null,
      customerSnapshot: customer
        ? { name: customer.name, phone: customer.phone, type: customer.type }
        : { name: 'Walk-in', phone: '', type: 'retail' },
      isWalkIn:         !customerId,
      items:            saleItems,
      subtotal:         parseFloat(subtotal.toFixed(2)),
      globalDiscount,
      discountAmount:   parseFloat(discountAmount.toFixed(2)),
      taxRate:          appliedTaxRate,
      taxAmount:        parseFloat(taxAmount.toFixed(2)),
      totalAmount,
      totalWeightGram:  parseFloat(totalWeightGram.toFixed(2)),
      paymentMethod,
      amountPaid:       paid,
      changeGiven:      parseFloat(changeGiven.toFixed(2)),
      creditAmount:     parseFloat(creditAmount.toFixed(2)),
      isPaid:           creditAmount === 0,
      paidAt:           creditAmount === 0 ? new Date() : null,
      silverGramPrice,
      status:           'completed',
      notes:            notes || '',
      cashier:          req.user._id,
    });

    await sale.save();

    // ── Deduct stock ──────────────────────────────────────────────────────────
    for (const item of saleItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: {
          stockQty:     -item.quantity,
          totalSold:     item.quantity,
          totalRevenue:  item.totalPrice,
        },
      });
    }

    // ── Update customer stats ─────────────────────────────────────────────────
    if (customer) {
      await Customer.findByIdAndUpdate(customer._id, {
        $inc: {
          totalPurchases: 1,
          totalSpent:     totalAmount,
          creditUsed:     creditAmount,
        },
        $set: { lastPurchaseAt: new Date() },
      });
    }

    // ── Response ──────────────────────────────────────────────────────────────
    res.status(201).json({
      success: true,
      message: 'Sale completed ✅',
      invoice: {
        invoiceNo:       sale.invoiceNo,
        saleType:        sale.saleType,
        customer:        customer ? customer.name : 'Walk-in',
        items:           saleItems.length,
        totalWeightGram: totalWeightGram.toFixed(2) + 'g',
        subtotal:        subtotal.toFixed(2),
        discount:        discountAmount.toFixed(2),
        tax:             taxAmount.toFixed(2),
        totalAmount:     totalAmount.toFixed(2),
        amountPaid:      paid.toFixed(2),
        changeGiven:     changeGiven.toFixed(2),
        creditAmount:    creditAmount.toFixed(2),
        paymentMethod,
        cashier:         req.user.name,
        silverGramPrice,
      },
    });
  } catch (err) {
    console.error('CHECKOUT ERROR:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const getSales = async (req, res) => {
  try {
    const { saleType, status, paymentMethod, from, to, page = 1, limit = 20, cashier } = req.query;
    const filter = {};
    if (saleType)      filter.saleType      = saleType;
    if (status)        filter.status        = status;
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    if (cashier)       filter.cashier       = cashier;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to)   filter.createdAt.$lte = new Date(to);
    }
    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Sale.countDocuments(filter);
    const sales = await Sale.find(filter)
      .select('-items')
      .populate('customer', 'name phone customerCode')
      .populate('cashier',  'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));
    res.status(200).json({
      success: true, total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      data: sales,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getSale = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate('customer', 'name phone customerCode type')
      .populate('cashier',  'name role')
      .populate('items.product', 'sku name images');
    if (!sale)
      return res.status(404).json({ success: false, message: 'Sale not found' });
    res.status(200).json({ success: true, data: sale });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const processReturn = async (req, res) => {
  const { reason, items: returnItems } = req.body;
  try {
    const original = await Sale.findById(req.params.id);
    if (!original)
      return res.status(404).json({ success: false, message: 'Original sale not found' });
    if (original.status === 'refunded')
      return res.status(400).json({ success: false, message: 'Already fully refunded' });

    let refundTotal = 0;
    for (const ri of returnItems) {
      const origItem = original.items.find(i => String(i.product) === ri.productId);
      if (!origItem)
        return res.status(400).json({ success: false, message: 'Item not in original sale' });
      const refundLine = (origItem.totalPrice / origItem.quantity) * ri.quantity;
      refundTotal += refundLine;
      await Product.findByIdAndUpdate(ri.productId, {
        $inc: { stockQty: ri.quantity, totalSold: -ri.quantity, totalRevenue: -refundLine },
      });
    }

    original.status = 'refunded';
    await original.save();

    res.status(200).json({
      success: true,
      message: 'Return processed',
      refundAmount:    refundTotal.toFixed(2),
      originalInvoice: original.invoiceNo,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getDailyReport = async (req, res) => {
  try {
    const date  = req.query.date ? new Date(req.query.date) : new Date();
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end   = new Date(date); end.setHours(23, 59, 59, 999);

    const [summary, byPayment, byCashier] = await Promise.all([
      Sale.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end }, status: { $ne: 'cancelled' } } },
        { $group: {
          _id:           '$saleType',
          count:         { $sum: 1 },
          totalAmount:   { $sum: '$totalAmount' },
          totalWeight:   { $sum: '$totalWeightGram' },
          totalDiscount: { $sum: '$discountAmount' },
        }},
      ]),
      Sale.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end }, status: { $ne: 'cancelled' } } },
        { $group: { _id: '$paymentMethod', count: { $sum: 1 }, total: { $sum: '$totalAmount' } } },
      ]),
      Sale.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end }, status: { $ne: 'cancelled' } } },
        { $group: { _id: '$cashier', total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'cashierInfo' } },
      ]),
    ]);

    const totals = summary.reduce((acc, s) => ({
      totalRevenue: (acc.totalRevenue || 0) + s.totalAmount,
      totalSales:   (acc.totalSales   || 0) + s.count,
      totalGrams:   (acc.totalGrams   || 0) + s.totalWeight,
    }), {});

    res.status(200).json({
      success: true,
      date: date.toDateString(),
      data: { totals, byType: summary, byPayment, byCashier },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { checkout, getSales, getSale, processReturn, getDailyReport };