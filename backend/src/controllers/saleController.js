const { validationResult } = require('express-validator');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const SilverPrice = require('../models/SilverPrice');
const { computePrices } = require('../utils/pricing');

// ─── CHECKOUT (POS) ───────────────────────────────────────────────────────────
const checkout = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { customerId, isWalkIn, items, paymentMethod, amountPaid, globalDiscount = 0, taxRate, saleType = 'retail', notes } = req.body;

  try {
    const silverGramPrice = await SilverPrice.getActive();
    let customer = null;

    if (customerId) {
      customer = await Customer.findById(customerId);
      if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    // ── Build sale items & validate stock ─────────────────────────────────────
    const saleItems = [];
    let subtotal = 0;
    let totalWeightGram = 0;

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) return res.status(404).json({ success: false, message: `Product ${item.productId} not found` });
      if (product.stockQty < item.quantity)
        return res.status(400).json({ success: false, message: `Insufficient stock for '${product.name}'. Available: ${product.stockQty}` });

      const prices    = await computePrices(product);
      const unitPrice = saleType === 'wholesale' ? prices.wholesalePrice : prices.retailPrice;
      const lineDiscount = item.discount || 0;
      const lineTotalBeforeDiscount = unitPrice * item.quantity;
      const lineTotal = lineTotalBeforeDiscount * (1 - lineDiscount / 100);

      subtotal       += lineTotal;
      totalWeightGram += product.weightGram * item.quantity;

      saleItems.push({
        product:     product._id,
        sku:         product.sku,
        name:        product.name,
        category:    product.category,
        weightGram:  product.weightGram,
        purity:      product.purity,
        quantity:    item.quantity,
        unitPrice,
        discount:    lineDiscount,
        totalPrice:  lineTotal,
        silverGramPrice,
        priceType:   saleType,
      });
    }

    // ── Totals ─────────────────────────────────────────────────────────────────
    const discountAmount = subtotal * (globalDiscount / 100);
    const afterDiscount  = subtotal - discountAmount;
    const appliedTaxRate = taxRate ?? parseFloat(process.env.SHOP_TAX_RATE || 0);
    const taxAmount      = afterDiscount * appliedTaxRate;
    const totalAmount    = parseFloat((afterDiscount + taxAmount).toFixed(2));
    const paid           = amountPaid || totalAmount;
    const changeGiven    = Math.max(0, paid - totalAmount);
    const creditAmount   = Math.max(0, totalAmount - paid);

    // ── Check credit limit ────────────────────────────────────────────────────
    if (creditAmount > 0 && customer) {
      const available = customer.creditLimit - customer.creditUsed;
      if (creditAmount > available)
        return res.status(400).json({ success: false, message: `Credit limit exceeded. Available credit: $${available.toFixed(2)}` });
    }

    // ── Create Sale ───────────────────────────────────────────────────────────
    const sale = await Sale.create({
      saleType,
      customer:   customer?._id,
      customerSnapshot: customer ? { name: customer.name, phone: customer.phone, type: customer.type } : null,
      isWalkIn:   !customerId,
      items:      saleItems,
      subtotal,
      globalDiscount,
      discountAmount,
      taxRate:    appliedTaxRate,
      taxAmount,
      totalAmount,
      totalWeightGram,
      paymentMethod,
      amountPaid: paid,
      changeGiven,
      creditAmount,
      isPaid:     creditAmount === 0,
      paidAt:     creditAmount === 0 ? new Date() : null,
      silverGramPrice,
      status:     'completed',
      notes,
      cashier:    req.user._id,
    });

    // ── Deduct stock + update product stats ───────────────────────────────────
    for (const item of saleItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stockQty: -item.quantity, totalSold: item.quantity, totalRevenue: item.totalPrice },
      });
    }

    // ── Update customer stats ─────────────────────────────────────────────────
    if (customer) {
      customer.totalPurchases += 1;
      customer.totalSpent     += totalAmount;
      customer.creditUsed     += creditAmount;
      customer.lastPurchaseAt  = new Date();
      await customer.save();
    }

    const populated = await Sale.findById(sale._id)
      .populate('customer', 'name phone customerCode')
      .populate('cashier', 'name role');

    res.status(201).json({
      success: true,
      message: 'Sale completed ✅',
      invoice: {
        invoiceNo:    populated.invoiceNo,
        saleType:     populated.saleType,
        customer:     populated.customer || 'Walk-in',
        items:        populated.items.length,
        totalWeightGram: totalWeightGram.toFixed(2) + 'g',
        subtotal:     subtotal.toFixed(2),
        discount:     discountAmount.toFixed(2),
        tax:          taxAmount.toFixed(2),
        totalAmount:  totalAmount.toFixed(2),
        amountPaid:   paid.toFixed(2),
        changeGiven:  changeGiven.toFixed(2),
        creditAmount: creditAmount.toFixed(2),
        paymentMethod,
        cashier:      populated.cashier?.name,
        silverGramPrice,
      },
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ─── GET SALES ────────────────────────────────────────────────────────────────
const getSales = async (req, res) => {
  try {
    const { saleType, status, paymentMethod, from, to, page = 1, limit = 20, cashier } = req.query;
    const filter = {};
    if (saleType)       filter.saleType = saleType;
    if (status)         filter.status   = status;
    if (paymentMethod)  filter.paymentMethod = paymentMethod;
    if (cashier)        filter.cashier  = cashier;
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
      .populate('cashier', 'name')
      .sort({ createdAt: -1 }).skip(skip).limit(Number(limit));
    res.status(200).json({ success: true, total, page: Number(page), pages: Math.ceil(total / Number(limit)), data: sales });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ─── GET SINGLE SALE ──────────────────────────────────────────────────────────
const getSale = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate('customer', 'name phone customerCode type')
      .populate('cashier', 'name role')
      .populate('items.product', 'sku name images');
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found' });
    res.status(200).json({ success: true, data: sale });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ─── PROCESS RETURN ───────────────────────────────────────────────────────────
const processReturn = async (req, res) => {
  const { reason, items: returnItems } = req.body;
  try {
    const original = await Sale.findById(req.params.id);
    if (!original) return res.status(404).json({ success: false, message: 'Original sale not found' });
    if (original.status === 'refunded') return res.status(400).json({ success: false, message: 'Already fully refunded' });

    let refundTotal = 0;
    for (const ri of returnItems) {
      const origItem = original.items.find(i => String(i.product) === ri.productId);
      if (!origItem) return res.status(400).json({ success: false, message: `Item not in original sale` });
      const refundLine = (origItem.totalPrice / origItem.quantity) * ri.quantity;
      refundTotal += refundLine;
      // Re-stock
      await Product.findByIdAndUpdate(ri.productId, { $inc: { stockQty: ri.quantity, totalSold: -ri.quantity, totalRevenue: -refundLine } });
    }

    // Mark original
    original.status = 'refunded';
    await original.save();

    res.status(200).json({ success: true, message: 'Return processed', refundAmount: refundTotal.toFixed(2), originalInvoice: original.invoiceNo });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ─── DAILY REPORT ─────────────────────────────────────────────────────────────
const getDailyReport = async (req, res) => {
  try {
    const date = req.query.date ? new Date(req.query.date) : new Date();
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end   = new Date(date); end.setHours(23, 59, 59, 999);

    const [summary, byPayment, byCashier] = await Promise.all([
      Sale.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end }, status: { $ne: 'cancelled' } } },
        { $group: { _id: '$saleType', count: { $sum: 1 }, totalAmount: { $sum: '$totalAmount' }, totalWeight: { $sum: '$totalWeightGram' }, totalDiscount: { $sum: '$discountAmount' } } },
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

    const totals = summary.reduce((acc, s) => ({ ...acc, totalRevenue: (acc.totalRevenue || 0) + s.totalAmount, totalSales: (acc.totalSales || 0) + s.count, totalGrams: (acc.totalGrams || 0) + s.totalWeight }), {});

    res.status(200).json({ success: true, date: date.toDateString(), data: { totals, byType: summary, byPayment, byCashier } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { checkout, getSales, getSale, processReturn, getDailyReport };
