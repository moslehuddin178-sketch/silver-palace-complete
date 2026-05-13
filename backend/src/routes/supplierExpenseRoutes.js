const express = require('express');
const { body } = require('express-validator');
const { protect, authorize } = require('../middlewares/authMiddleware');

// ── Supplier Routes ───────────────────────────────────────────────────────────
const {
  createSupplier, getSuppliers, getSupplier,
  updateSupplier, deleteSupplier, getSupplierStats,
} = require('../controllers/supplierController');

const supplierRouter = express.Router();
supplierRouter.use(protect);

supplierRouter.get('/stats',  authorize('owner', 'manager'), getSupplierStats);
supplierRouter.get('/',       getSuppliers);
supplierRouter.post('/',      authorize('owner', 'manager'), [
  body('name').notEmpty().withMessage('Name required'),
  body('phone').notEmpty().withMessage('Phone required'),
], createSupplier);
supplierRouter.get('/:id',    getSupplier);
supplierRouter.put('/:id',    authorize('owner', 'manager'), updateSupplier);
supplierRouter.delete('/:id', authorize('owner'), deleteSupplier);

// ── Expense Routes ────────────────────────────────────────────────────────────
const {
  createExpense, getExpenses, getExpense,
  updateExpense, deleteExpense, getProfitReport,
} = require('../controllers/expenseController');

const expenseRouter = express.Router();
expenseRouter.use(protect);

expenseRouter.get('/profit-report', authorize('owner', 'manager'), getProfitReport);
expenseRouter.get('/',    authorize('owner', 'manager'), getExpenses);
expenseRouter.post('/',   authorize('owner', 'manager'), [
  body('title').notEmpty().withMessage('Title required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Valid amount required'),
  body('category').isIn([
    'rent', 'salary', 'utilities', 'silver_purchase', 'packaging',
    'marketing', 'maintenance', 'transport', 'tax', 'equipment', 'other',
  ]).withMessage('Valid category required'),
  body('expenseDate').notEmpty().withMessage('Date required'),
], createExpense);
expenseRouter.get('/:id',    authorize('owner', 'manager'), getExpense);
expenseRouter.put('/:id',    authorize('owner', 'manager'), updateExpense);
expenseRouter.delete('/:id', authorize('owner'), deleteExpense);

module.exports = { supplierRouter, expenseRouter };