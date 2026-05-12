const { validationResult } = require('express-validator');
const Customer = require('../models/Customer');

const createCustomer = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  try {
    const customer = await Customer.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json({ success: true, message: 'Customer created', data: customer });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getCustomers = async (req, res) => {
  try {
    const { type, search, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (type)   filter.type = type;
    if (search) filter.$text = { $search: search };
    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Customer.countDocuments(filter);
    const customers = await Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit));
    res.status(200).json({ success: true, total, page: Number(page), pages: Math.ceil(total / Number(limit)), data: customers });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.status(200).json({ success: true, data: customer });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateCustomer = async (req, res) => {
  try {
    ['customerCode', 'createdBy', 'totalPurchases', 'totalSpent'].forEach(f => delete req.body[f]);
    const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.status(200).json({ success: true, data: customer });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const deleteCustomer = async (req, res) => {
  try {
    await Customer.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Customer deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { createCustomer, getCustomers, getCustomer, updateCustomer, deleteCustomer };
