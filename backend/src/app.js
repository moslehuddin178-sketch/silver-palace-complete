const express = require('express');
const app = express();

app.use(express.json({ limit: '10mb' }));   // 10mb for base64 QR images
app.use(express.urlencoded({ extended: true }));

// ─── Routes ───────────────────────────────────────────────────────────────────
const { authRouter, silverRouter, productRouter, customerRouter } = require('./routes/index');
const saleRouter = require('./routes/saleRoutes');

app.use('/api/auth',     authRouter);
app.use('/api/silver',   silverRouter);
app.use('/api/products', productRouter);
app.use('/api/customers',customerRouter);
app.use('/api/sales',    saleRouter);

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/', (req, res) =>
  res.json({ success: true, message: '💍 Silver Jewelry API running', version: '1.0.0' })
);

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) =>
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` })
);

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

module.exports = app;
