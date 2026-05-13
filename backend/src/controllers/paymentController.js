const Stripe = require('stripe');
const Sale   = require('../models/Sale');

const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('YOUR_')) {
    throw new Error('Stripe secret key not configured. Add STRIPE_SECRET_KEY to .env');
  }
  return Stripe(process.env.STRIPE_SECRET_KEY);
};

const createPaymentIntent = async (req, res) => {
  try {
    const stripe = getStripe();
    const { amount, currency = 'usd', metadata = {} } = req.body;
    if (!amount || amount <= 0)
      return res.status(400).json({ success: false, message: 'Valid amount required' });

    const amountInCents = Math.round(parseFloat(amount) * 100);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: { shop: process.env.SHOP_NAME || 'Silver Palace', cashier: req.user?.name || '', ...metadata },
    });

    res.status(200).json({
      success:      true,
      clientSecret: paymentIntent.client_secret,
      intentId:     paymentIntent.id,
      amount:       amountInCents,
      currency,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const verifyPaymentIntent = async (req, res) => {
  try {
    const stripe = getStripe();
    const intent = await stripe.paymentIntents.retrieve(req.params.intentId);
    if (intent.status !== 'succeeded')
      return res.status(400).json({ success: false, message: `Payment not completed. Status: ${intent.status}`, status: intent.status });
    res.status(200).json({ success: true, verified: true, intentId: intent.id, amount: intent.amount / 100, status: intent.status });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const refundPayment = async (req, res) => {
  try {
    const stripe = getStripe();
    const { intentId, amount, reason = 'requested_by_customer' } = req.body;
    if (!intentId) return res.status(400).json({ success: false, message: 'Payment intent ID required' });
    const refundData = { payment_intent: intentId, reason };
    if (amount) refundData.amount = Math.round(parseFloat(amount) * 100);
    const refund = await stripe.refunds.create(refundData);
    res.status(200).json({ success: true, refundId: refund.id, amount: refund.amount / 100, status: refund.status });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const handleWebhook = async (req, res) => {
  const sig    = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || secret.includes('YOUR_'))
    return res.status(200).json({ received: true, note: 'Webhook secret not configured' });

  let event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'payment_intent.succeeded':
      await Sale.findOneAndUpdate(
        { stripePaymentId: event.data.object.id },
        { isPaid: true, paidAt: new Date(), status: 'completed' }
      );
      break;
    case 'payment_intent.payment_failed':
      console.log(`❌ Payment failed: ${event.data.object.id}`);
      break;
  }
  res.status(200).json({ received: true });
};

const getConfig = async (req, res) => {
  const key = process.env.STRIPE_PUBLISHABLE_KEY || '';
  res.status(200).json({
    success:        true,
    publishableKey: key.includes('YOUR_') ? null : key,
    stripeEnabled:  !!(process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.includes('YOUR_')),
    currency:       process.env.SHOP_CURRENCY || 'USD',
    shopName:       process.env.SHOP_NAME || 'Silver Palace',
  });
};

module.exports = { createPaymentIntent, verifyPaymentIntent, refundPayment, handleWebhook, getConfig };