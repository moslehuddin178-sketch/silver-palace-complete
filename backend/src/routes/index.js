const express = require('express');
const { body } = require('express-validator');
const { protect, authorize } = require('../middlewares/authMiddleware');

// ── Auth ──────────────────────────────────────────────────────────────────────
const { signup, signin, getMe,forgotPassword, verifyResetToken, resetPassword } = require('../controllers/authController');
const authRouter = express.Router();

authRouter.post('/signup', [
  body('name').notEmpty().withMessage('Name required'),
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Min 6 chars'),
  body('role').optional().isIn(['owner','manager','cashier','wholesaler','viewer']),
], signup);

authRouter.post('/signin', [
  body('email').isEmail(),
  body('password').notEmpty(),
], signin);


authRouter.get('/me', protect, getMe);

authRouter.post('/forgot-password', forgotPassword);
authRouter.get('/reset-password/verify/:token', verifyResetToken);
authRouter.post('/reset-password/:token', resetPassword);

// ── Silver Price ──────────────────────────────────────────────────────────────
const { setPrice, getActive, getHistory, previewProductPrice } = require('../controllers/silverPriceController');
const silverRouter = express.Router();

silverRouter.use(protect);
silverRouter.get('/active',   getActive);
silverRouter.get('/history',  getHistory);
silverRouter.get('/preview/:productId', previewProductPrice);
silverRouter.post('/', authorize('owner', 'manager'), [
  body('gramPrice').isFloat({ min: 0.01 }),
], setPrice);

// ── Products ──────────────────────────────────────────────────────────────────
const {
  createProduct, getProducts, getProduct, scanProduct,
  regenerateQR, updateProduct, adjustStock, deleteProduct, getProductAnalytics,
} = require('../controllers/productController');
const productRouter = express.Router();

productRouter.use(protect);
productRouter.get('/analytics',   authorize('owner', 'manager', 'cashier'), getProductAnalytics);
productRouter.get('/scan/:query', scanProduct);
productRouter.get('/',            getProducts);
productRouter.post('/', authorize('owner', 'manager'), [
  body('sku').notEmpty(),
  body('name').notEmpty(),
  body('category').isIn(['ring','necklace','bracelet','earring','anklet','pendant','chain','brooch','set','bangle','other']),
  body('weightGram').isFloat({ min: 0.1 }),
  body('warehouse').notEmpty(),
], createProduct);
productRouter.get('/:id',         getProduct);
productRouter.put('/:id',         authorize('owner', 'manager'), updateProduct);
productRouter.patch('/:id/stock', authorize('owner', 'manager', 'cashier'), adjustStock);
productRouter.patch('/:id/qr',    authorize('owner', 'manager'), regenerateQR);
productRouter.delete('/:id',      authorize('owner'), deleteProduct);

// ── Customers ─────────────────────────────────────────────────────────────────
const { createCustomer, getCustomers, getCustomer, updateCustomer, deleteCustomer } = require('../controllers/customerController');
const customerRouter = express.Router();

customerRouter.use(protect);
customerRouter.get('/',    getCustomers);
customerRouter.post('/', authorize('owner', 'manager', 'cashier'), [
  body('name').notEmpty(),
  body('phone').notEmpty(),
], createCustomer);
customerRouter.get('/:id',    getCustomer);
customerRouter.put('/:id',    authorize('owner', 'manager'), updateCustomer);
customerRouter.delete('/:id', authorize('owner'), deleteCustomer);

// ── Sales ─────────────────────────────────────────────────────────────────────
const { checkout, getSales, getSale, processReturn, getDailyReport } = require('../controllers/saleController');
const saleRouter = express.Router();

saleRouter.use(protect);
saleRouter.get('/report/daily', authorize('owner', 'manager'), getDailyReport);
saleRouter.get('/',             authorize('owner', 'manager', 'cashier'), getSales);
saleRouter.post('/', authorize('owner', 'manager', 'cashier'), [
  body('items').isArray({ min: 1 }),
  body('paymentMethod').isIn(['cash','card','bank_transfer','credit','mixed']),
], checkout);
saleRouter.get('/:id',         authorize('owner', 'manager', 'cashier'), getSale);
saleRouter.post('/:id/return', authorize('owner', 'manager'), processReturn);

module.exports = { authRouter, silverRouter, productRouter, customerRouter, saleRouter };