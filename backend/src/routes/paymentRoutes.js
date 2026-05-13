const express = require('express');
const { body } = require('express-validator');
const { protect, authorize } = require('../middlewares/authMiddleware');
const { createPaymentIntent, verifyPaymentIntent, refundPayment, handleWebhook, getConfig } = require('../controllers/paymentController');

const router = express.Router();

router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

router.use(protect);

router.get('/config', getConfig);

router.post('/create-intent',
  authorize('owner', 'manager', 'cashier'),
  [body('amount').isFloat({ min: 0.01 })],
  createPaymentIntent
);

router.get('/verify/:intentId',
  authorize('owner', 'manager', 'cashier'),
  verifyPaymentIntent
);

router.post('/refund',
  authorize('owner', 'manager'),
  [body('intentId').notEmpty()],
  refundPayment
);

module.exports = router;