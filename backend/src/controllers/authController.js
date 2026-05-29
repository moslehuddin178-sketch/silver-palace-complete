const { validationResult } = require('express-validator');
const User = require('../models/User');
const { generateToken } = require('../utils/jwt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const signup = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });


  const { name, email, password, phone, role } = req.body;

  try {

    if (await User.findOne({ email })) 

      return res.status(409).json({ success: false, message: 'Email already registered' });
      const user  = await User.create({ name, email, password, phone, role });
      const token = generateToken({ id: user._id, role: user.role });
    res.status(201).json({ success: true, token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });

    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const signin = async (req, res) => {

  const errors = validationResult(req);
 if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
 const { email, password } = req.body;
  try {
    const user = await User.findOne({ email }).select('+password');

    if (!user || !user.isActive) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    if (!(await user.comparePassword(password))) return res.status(401).json({ success: false, message: 'Invalid credentials' });


    user.lastLogin = new Date(); await user.save({ validateBeforeSave: false });

    const token = generateToken({ id: user._id, role: user.role });
  res.status(200).json({ success: true, token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
    
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getMe = async (req, res) => {
  res.status(200).json({ success: true, user: req.user });
};

// ─── Send password reset email ─────────────────────────────────────────────
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email)
    return res.status(400).json({ success: false, message: 'Email is required' });

  try {
    const user = await User.findOne({ email: email.toLowerCase() });

    // Always return success — don't reveal if email exists
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If that email exists, a reset link has been sent.',
      });
    }

    // Generate reset token
    const resetToken   = crypto.randomBytes(32).toString('hex');
    const hashedToken  = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.passwordResetToken   = hashedToken;
    user.passwordResetExpires = Date.now() + 30 * 60 * 1000; // 30 minutes
    await user.save({ validateBeforeSave: false });

    // Build reset URL
    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

    // Send email
    const transporter = nodemailer.createTransport({
      host:   process.env.EMAIL_HOST,
      port:   parseInt(process.env.EMAIL_PORT || 587),
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from:    process.env.EMAIL_FROM,
      to:      user.email,
      subject: 'Silver Palace — Password Reset',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#f59e0b">💎 Silver Palace</h2>
          <p>You requested a password reset for <strong>${user.email}</strong>.</p>
          <p>Click the button below to reset your password. This link expires in <strong>30 minutes</strong>.</p>
          <a href="${resetUrl}"
            style="display:inline-block;background:#f59e0b;color:#fff;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;margin:16px 0">
            Reset Password
          </a>
          <p style="color:#888;font-size:12px">If you didn't request this, you can safely ignore this email.</p>
          <p style="color:#bbb;font-size:11px">Link: ${resetUrl}</p>
        </div>
      `,
    });

    res.status(200).json({
      success: true,
      message: 'Password reset link sent to your email.',
    });
  } catch (err) {
    // Clear token if email fails
    if (err.code === 'EAUTH' || err.code === 'ECONNECTION') {
      await User.findOneAndUpdate(
        { email },
        { $unset: { passwordResetToken: 1, passwordResetExpires: 1 } }
      );
    }
    console.error('Forgot password error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to send email. Check EMAIL settings in .env' });
  }
};

// ─── Verify reset token (check if valid before showing form) ──────────────
const verifyResetToken = async (req, res) => {
  try {
    const hashedToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user = await User.findOne({
      passwordResetToken:   hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user)
      return res.status(400).json({ success: false, message: 'Token is invalid or has expired.' });

    res.status(200).json({ success: true, message: 'Token is valid.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Reset password ────────────────────────────────────────────────────────
const resetPassword = async (req, res) => {
  const { password } = req.body;

  if (!password || password.length < 6)
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });

  try {
    const hashedToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user = await User.findOne({
      passwordResetToken:   hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select('+password');

    if (!user)
      return res.status(400).json({ success: false, message: 'Token is invalid or has expired.' });

    // Set new password — pre-save hook will hash it
    user.password             = password;
    user.passwordResetToken   = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    const { generateToken } = require('../utils/jwt');
    const token = generateToken({ id: user._id, role: user.role });

    res.status(200).json({
      success: true,
      message: 'Password reset successful. You are now logged in.',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { signup, signin, getMe, forgotPassword, verifyResetToken, resetPassword };
