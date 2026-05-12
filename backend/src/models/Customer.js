const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    customerCode: { type: String, unique: true },
    name:         { type: String, required: true, trim: true },
    email:        { type: String, lowercase: true, trim: true, sparse: true },
    phone:        { type: String, trim: true, required: true },
    phone2:       { type: String, trim: true },

    type: {
      type: String,
      enum: ['retail', 'wholesale'],
      default: 'retail',
    },

    // ── Address ───────────────────────────────────────────────────────────────
    address: {
      street:  { type: String },
      city:    { type: String },
      country: { type: String, default: 'Turkey' },
    },

    // ── Wholesale specific ────────────────────────────────────────────────────
    companyName:  { type: String, trim: true },
    taxNumber:    { type: String, trim: true },
    creditLimit:  { type: Number, default: 0 },       // max credit extended
    creditUsed:   { type: Number, default: 0 },        // current outstanding
    discountRate: { type: Number, default: 0 },        // extra % discount for this customer
    paymentTermDays: { type: Number, default: 0 },     // net30, net60 etc.

    // ── Stats ─────────────────────────────────────────────────────────────────
    totalPurchases: { type: Number, default: 0 },
    totalSpent:     { type: Number, default: 0 },
    lastPurchaseAt: { type: Date },

    // ── Meta ──────────────────────────────────────────────────────────────────
    notes:    { type: String },
    isActive: { type: Boolean, default: true },
    tags:     [{ type: String }],
    createdBy:{ type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Auto-generate customer code
customerSchema.pre('save', async function () {
  if (!this.customerCode) {
    const count = await mongoose.model('Customer').countDocuments();
    const prefix = this.type === 'wholesale' ? 'WS' : 'RT';
    this.customerCode = `${prefix}-${String(count + 1).padStart(5, '0')}`;
  }
});
customerSchema.index({ phone: 1 });
customerSchema.index({ customerCode: 1 });
customerSchema.index({ type: 1 });
customerSchema.index({ name: 'text', companyName: 'text' });

module.exports = mongoose.model('Customer', customerSchema);
