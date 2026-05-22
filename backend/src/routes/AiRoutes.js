const express = require('express');
const { body } = require('express-validator');
const { protect, authorize } = require('../middlewares/authMiddleware');
const { salesAssistant, generateDescription, businessInsights } = require('../controllers/AiController');

const router = express.Router();
router.use(protect);

// Sales assistant — all roles can ask questions
router.post('/assistant',
  [body('question').notEmpty().withMessage('Question is required')],
  salesAssistant
);

// Product description generator — owner/manager only
router.post('/describe',
  authorize('owner', 'manager'),
  generateDescription
);

// Business insights — owner/manager only
router.post('/insights',
  authorize('owner', 'manager'),
  businessInsights
);

module.exports = router;