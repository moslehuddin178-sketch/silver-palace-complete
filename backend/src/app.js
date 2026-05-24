const express = require('express');
const app = express();

app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const { authRouter, silverRouter, productRouter, customerRouter } = require('./routes/index');
const saleRouter    = require('./routes/saleRoutes');
const paymentRouter = require('./routes/paymentRoutes');
const aiRouter      = require('./routes/AiRoutes');
const weatherRouter = require('./routes/weatherRoutes');

app.use('/api/auth',      authRouter);
app.use('/api/silver',    silverRouter);
app.use('/api/products',  productRouter);
app.use('/api/customers', customerRouter);
app.use('/api/sales',     saleRouter);
app.use('/api/payments',  paymentRouter);
app.use('/api/ai',        aiRouter);
app.use('/api/weather',   weatherRouter);

app.get('/', (req, res) =>
  res.json({ success: true, message: '💍 Silver Jewelry API running', version: '1.0.0' })
);

app.use((req, res) =>
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` })
);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

module.exports = app;