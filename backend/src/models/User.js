const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true },
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone:    { type: String, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    passwordResetToken:   { type: String },
    passwordResetExpires: { type: Date },
    role: {
      type: String,
      enum: ['owner', 'manager', 'cashier', 'wholesaler', 'viewer'],
      default: 'cashier',
    },
    isActive: { type: Boolean, default: true },
    lastLogin:{ type: Date },
  },
  { timestamps: true }
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = async function (candidate) {
  return await bcrypt.compare(candidate, this.password);
};
module.exports = mongoose.model('User', userSchema);
