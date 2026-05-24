const express = require('express');
const { protect, authorize } = require('../middlewares/authMiddleware');
const { getCurrentWeather, getForecast, clearCache } = require('../controllers/weatherController');

const router = express.Router();
router.use(protect);

router.get('/',         getCurrentWeather);          // all roles
router.get('/forecast', getForecast);                // all roles
router.delete('/cache', authorize('owner', 'manager'), clearCache);

module.exports = router;