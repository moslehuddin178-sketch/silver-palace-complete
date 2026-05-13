const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema({
  product:         { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  sku:             { type: String },
  name:            { type: String },
  category:        { type: String },
  weightGram:      { type: Number },
  purity:          { type: String },
  quantity:        { type: Number, required: true, min: 1 },
  unitPrice:       { type: Number, required: true },
  discount:        { type: Number, default: 0 },
  totalPrice:      { type: Number },
  silverGramPrice: { type: Number },
  priceType:       { type: String, enum: ['retail', 'wholesale'], default: 'retail' },
});

const saleSchema = new mongoose.Schema(
  {
    invoiceNo:  { type: String, unique: true },
    saleType:   { type: String, enum: ['retail', 'wholesale'], default: 'retail' },
    customer:   { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    customerSnapshot: {
      name:  { type: String },
      phone: { type: String },
      type:  { type: String },
    },
    isWalkIn:        { type: Boolean, default: false },
    items:           [saleItemSchema],
    subtotal:        { type: Number, default: 0 },
    globalDiscount:  { type: Number, default: 0 },
    discountAmount:  { type: Number, default: 0 },
    taxRate:         { type: Number, default: 0 },
    taxAmount:       { type: Number, default: 0 },
    totalAmount:     { type: Number, default: 0 },
    totalWeightGram: { type: Number, default: 0 },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'bank_transfer', 'credit', 'mixed'],
      required: true,
    },
    amountPaid:      { type: Number, default: 0 },
    changeGiven:     { type: Number, default: 0 },
    creditAmount:    { type: Number, default: 0 },
    isPaid:          { type: Boolean, default: true },
    paidAt:          { type: Date },
    silverGramPrice: { type: Number },
    stripePaymentId: { type: String },
    stripeRefundId:  { type: String },
    status: {
      type: String,
      enum: ['completed', 'pending', 'cancelled', 'refunded', 'partial_refund'],
      default: 'completed',
    },
    isReturn:     { type: Boolean, default: false },
    originalSale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
    returnReason: { type: String },
    notes:        { type: String },
    cashier:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    shift:        { type: String },
  },
  { timestamps: true }
);

saleSchema.index({ createdAt: -1 });
saleSchema.index({ customer: 1 });
saleSchema.index({ saleType: 1 });
saleSchema.index({ status: 1 });
saleSchema.index({ cashier: 1 });

module.exports = mongoose.model('Sale', saleSchema);