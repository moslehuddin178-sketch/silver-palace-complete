const mongoose = require('mongoose');

const silverPriceSchema = new mongoose.Schema(
  {
    gramPrice:    { type: Number, required: true },          // USD per gram
    currency:     { type: String, default: 'USD' },
    source:       { type: String, default: 'manual' },       // manual | api
    setBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isActive:     { type: Boolean, default: true },
    notes:        { type: String },
  },
  { timestamps: true }
);

// Only one active price at a time
silverPriceSchema.statics.getActive = async function () {
  const price = await this.findOne({ isActive: true }).sort({ createdAt: -1 });
  return price ? price.gramPrice : parseFloat(process.env.SILVER_GRAM_PRICE || 0.85);
};

module.exports = mongoose.model('SilverPrice', silverPriceSchema);
