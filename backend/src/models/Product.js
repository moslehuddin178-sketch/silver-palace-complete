const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    sku:        { type: String, required: true, unique: true, uppercase: true, trim: true },
    barcode:    { type: String, unique: true, sparse: true, trim: true },
    name:       { type: String, required: true, trim: true },
    slug:       { type: String, unique: true, lowercase: true },
    description:{ type: String, trim: true },

    // ── Jewelry Classification ────────────────────────────────────────────────
    category: {
      type: String,
      required: true,
      enum: [
        'ring', 'necklace', 'bracelet', 'earring', 'anklet',
        'pendant', 'chain', 'brooch', 'set', 'bangle', 'other'
      ],
    },
    subcategory:  { type: String, trim: true },   // e.g. "solitaire", "tennis", "figaro"
    collectionName: { type: String, trim: true },   // e.g. "Winter 2024", "Ottoman Series"
    gender: {
      type: String,
      enum: ['women', 'men', 'unisex', 'kids'],
      default: 'women',
    },
    style:        { type: String, trim: true },   // e.g. "vintage", "modern", "bohemian"

    // ── Silver Properties ─────────────────────────────────────────────────────
    purity: {
      type: String,
      enum: ['925', '950', '999', '800', 'custom'],
      default: '925',                              // Sterling silver
    },
    weightGram:   { type: Number, required: true, min: 0.1 },   // gross weight
    netWeightGram:{ type: Number },                              // without stones
    size:         { type: String, trim: true },   // ring size, chain length cm, etc.
    dimensions:   { type: String, trim: true },   // e.g. "3cm x 2cm"
    finish: {
      type: String,
      enum: ['polished', 'matte', 'oxidized', 'hammered', 'brushed', 'rhodium_plated', 'gold_plated'],
      default: 'polished',
    },

    // ── Stones & Extras ───────────────────────────────────────────────────────
    hasStone:     { type: Boolean, default: false },
    stones: [{
      type:   { type: String },                   // "cubic_zirconia", "garnet", "turquoise"
      color:  { type: String },
      count:  { type: Number },
      carat:  { type: Number },
    }],
    plating:      { type: String, trim: true },   // "gold", "rose gold", "rhodium"

    // ── Pricing ───────────────────────────────────────────────────────────────
    // Retail price = (weightGram × silverGramPrice) + laborCost + stoneCost + (× retailMarkup%)
    // Wholesale price = (weightGram × silverGramPrice) + laborCost + stoneCost + (× wholesaleMarkup%)
    laborCost:       { type: Number, default: 0 },    // craftsmanship flat cost
    stoneCost:       { type: Number, default: 0 },    // stones material cost
    retailMarkup:    { type: Number, default: 150 },  // % over material cost
    wholesaleMarkup: { type: Number, default: 50 },   // % over material cost

    // Fixed override prices (optional — skip markup formula if set)
    fixedRetailPrice:    { type: Number },
    fixedWholesalePrice: { type: Number },

    // ── Stock ─────────────────────────────────────────────────────────────────
    stockQty:     { type: Number, default: 0, min: 0 },
    reservedQty:  { type: Number, default: 0, min: 0 },
    minimumStock: { type: Number, default: 2 },
    warehouse:    { type: String, default: 'Main Showroom' },
    shelfLocation:{ type: String, trim: true },       // "A-12", "Showcase-3"

    // ── Status & Flags ────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['active', 'inactive', 'out_of_stock', 'low_stock', 'discontinued', 'sample'],
      default: 'active',
    },
    isLowStock:     { type: Boolean, default: false },
    isFeatured:     { type: Boolean, default: false },
    isNewArrival:   { type: Boolean, default: false },
    isBestSeller:   { type: Boolean, default: false },
    availableForWholesale: { type: Boolean, default: true },
    minimumWholesaleQty:   { type: Number, default: 1 },

    // ── Media ─────────────────────────────────────────────────────────────────
    images:       [{ type: String }],                 // image URLs
    qrCode:       { type: String },                   // base64 QR PNG
    qrData:       { type: String },                   // the encoded QR string

    // ── Source / Production ───────────────────────────────────────────────────
    manufacturer: { type: String, trim: true },
    countryOfOrigin: { type: String, default: 'Turkey' },
    productionDate:  { type: Date },
    expiryDate:      { type: Date },

    // ── Meta ──────────────────────────────────────────────────────────────────
    tags:         [{ type: String, lowercase: true }],
    createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // ── Stats (updated on sale) ───────────────────────────────────────────────
    totalSold:    { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    viewCount:    { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Virtual: computed prices ───────────────────────────────────────────────────
productSchema.virtual('availableQty').get(function () {
  return Math.max(0, this.stockQty - this.reservedQty);
});

// ── Auto-status update ────────────────────────────────────────────────────────
productSchema.pre('save', function () {
  if (this.stockQty === 0) {
    this.status = 'out_of_stock';
    this.isLowStock = false;
  } else if (this.stockQty <= this.minimumStock) {
    this.status = 'low_stock';
    this.isLowStock = true;
  } else if (this.status === 'out_of_stock' || this.status === 'low_stock') {
    this.status = 'active';
    this.isLowStock = false;
  }
});

// ── Indexes for 50k+ products ─────────────────────────────────────────────────
productSchema.index({ sku: 1 });
productSchema.index({ barcode: 1 });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ status: 1 });
productSchema.index({ name: 'text', description: 'text', tags: 'text', collectionName: 'text' });
productSchema.index({ isLowStock: 1 });
productSchema.index({ isFeatured: 1 });
productSchema.index({ purity: 1 });
productSchema.index({ weightGram: 1 });
productSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Product', productSchema);
