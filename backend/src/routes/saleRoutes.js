const express = require('express');
const { body } = require('express-validator');
const { protect, authorize } = require('../middlewares/authMiddleware');
const { checkout, getSales, getSale, processReturn, getDailyReport } = require('../controllers/saleController');

const router = express.Router();
router.use(protect);

router.get('/report/daily', authorize('owner', 'manager'), getDailyReport);
router.get('/',    authorize('owner', 'manager', 'cashier'), getSales);
router.post('/',   authorize('owner', 'manager', 'cashier'),
  [body('items').isArray({ min: 1 }), body('paymentMethod').isIn(['cash','card','bank_transfer','credit','mixed'])],
  checkout
);
router.get('/:id',  authorize('owner', 'manager', 'cashier'), getSale);
router.post('/:id/return', authorize('owner', 'manager'), processReturn);

module.exports = router;
