const { validationResult } = require('express-validator');
const User = require('../models/User');
const { generateToken } = require('../utils/jwt');

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

module.exports = { signup, signin, getMe };
