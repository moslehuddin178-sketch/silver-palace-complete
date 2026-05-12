const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema({
  product:      { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  sku:          { type: String },
  name:         { type: String },
  category:     { type: String },
  weightGram:   { type: Number },
  purity:       { type: String },
  quantity:     { type: Number, required: true, min: 1 },
  unitPrice:    { type: Number, required: true },       // price at time of sale
  discount:     { type: Number, default: 0 },           // % discount on this line
  totalPrice:   { type: Number },
  silverGramPrice: { type: Number },                    // snapshot of silver price
  priceType:    { type: String, enum: ['retail', 'wholesale'], default: 'retail' },
});

saleItemSchema.pre('save', function (next) {
  const discounted = this.unitPrice * (1 - this.discount / 100);
  this.totalPrice  = discounted * this.quantity;
  next();
});

const saleSchema = new mongoose.Schema(
  {
    // ── Invoice ───────────────────────────────────────────────────────────────
    invoiceNo:  { type: String, unique: true },
    saleType:   { type: String, enum: ['retail', 'wholesale'], default: 'retail' },

    // ── Customer ──────────────────────────────────────────────────────────────
    customer:   { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    customerSnapshot: {                               // saved even if customer deleted
      name:  { type: String },
      phone: { type: String },
      type:  { type: String },
    },
    isWalkIn:   { type: Boolean, default: false },    // no customer record for quick retail

    // ── Items ─────────────────────────────────────────────────────────────────
    items:      [saleItemSchema],

    // ── Totals ────────────────────────────────────────────────────────────────
    subtotal:         { type: Number, default: 0 },
    globalDiscount:   { type: Number, default: 0 },   // % off whole invoice
    discountAmount:   { type: Number, default: 0 },
    taxRate:          { type: Number, default: 0 },
    taxAmount:        { type: Number, default: 0 },
    totalAmount:      { type: Number, default: 0 },
    totalWeightGram:  { type: Number, default: 0 },   // total grams sold

    // ── Payment ───────────────────────────────────────────────────────────────
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'bank_transfer', 'credit', 'mixed'],
      required: true,
    },
    amountPaid:   { type: Number, default: 0 },
    changeGiven:  { type: Number, default: 0 },
    creditAmount: { type: Number, default: 0 },        // amount on credit/tab
    isPaid:       { type: Boolean, default: true },
    paidAt:       { type: Date },

    // ── Silver Rate ───────────────────────────────────────────────────────────
    silverGramPrice: { type: Number },                 // silver price at time of sale

    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['completed', 'pending', 'cancelled', 'refunded', 'partial_refund'],
      default: 'completed',
    },

    // ── Return info ───────────────────────────────────────────────────────────
    isReturn:     { type: Boolean, default: false },
    originalSale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
    returnReason: { type: String },

    // ── Meta ──────────────────────────────────────────────────────────────────
    notes:        { type: String },
    cashier:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    shift:        { type: String },
  },
  { timestamps: true }
);

// Auto invoice number
saleSchema.pre('save', async function () {
  if (!this.invoiceNo) {
    const count   = await mongoose.model('Sale').countDocuments();
    const prefix  = this.saleType === 'wholesale' ? 'WS-INV' : 'RT-INV';
    const date    = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    this.invoiceNo = `${prefix}-${date}-${String(count + 1).padStart(5, '0')}`;
  }
});

saleSchema.index({ invoiceNo: 1 });
saleSchema.index({ customer: 1 });
saleSchema.index({ saleType: 1 });
saleSchema.index({ status: 1 });
saleSchema.index({ createdAt: -1 });
saleSchema.index({ cashier: 1 });

module.exports = mongoose.model('Sale', saleSchema);
