require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`💍 Silver Jewelry API → http://localhost:${PORT}`);
    console.log(`   Shop: ${process.env.SHOP_NAME}`);
    console.log(`   Silver price: $${process.env.SILVER_GRAM_PRICE}/gram`);
  });
});
