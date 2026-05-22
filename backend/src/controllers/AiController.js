const Anthropic = require('@anthropic-ai/sdk');
const Product    = require('../models/Product');
const Sale       = require('../models/Sale');
const SilverPrice = require('../models/SilverPrice');

const getClient = () => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key.includes('YOUR_KEY'))
    throw new Error('ANTHROPIC_API_KEY not configured in .env');
  return new Anthropic({ apiKey: key });
};

// ─── 1. SALES ASSISTANT ───────────────────────────────────────────────────────
const salesAssistant = async (req, res) => {
  const { question, conversationHistory = [] } = req.body;
  if (!question?.trim())
    return res.status(400).json({ success: false, message: 'Question is required' });

  try {
    const client = getClient();

    const [products, silverPrice, recentSales] = await Promise.all([
      Product.find({ status: { $ne: 'discontinued' } })
        .select('sku name category purity weightGram stockQty status fixedRetailPrice fixedWholesalePrice retailMarkup wholesaleMarkup laborCost stoneCost netWeightGram')
        .limit(200)
        .lean(),
      SilverPrice.getActive(),
      Sale.find().sort({ createdAt: -1 }).limit(10)
        .select('invoiceNo totalAmount saleType createdAt')
        .lean(),
    ]);

    const productsWithPrices = products.map(p => {
      const w   = p.netWeightGram || p.weightGram;
      const mat = w * silverPrice + (p.laborCost || 0) + (p.stoneCost || 0);
      const retail    = p.fixedRetailPrice    || parseFloat((mat * (1 + (p.retailMarkup    || 150) / 100)).toFixed(2));
      const wholesale = p.fixedWholesalePrice || parseFloat((mat * (1 + (p.wholesaleMarkup || 50)  / 100)).toFixed(2));
      return { ...p, retailPrice: retail, wholesalePrice: wholesale };
    });

    const systemPrompt = `You are a helpful AI assistant for Silver Palace Jewelry shop.
You have access to the shop's live inventory and sales data.

CURRENT SILVER PRICE: $${silverPrice}/gram

INVENTORY (${productsWithPrices.length} products):
${productsWithPrices.map(p =>
  `- [${p.sku}] ${p.name} | ${p.category} | ${p.purity} | ${p.weightGram}g | Stock: ${p.stockQty} | Retail: $${p.retailPrice} | Wholesale: $${p.wholesalePrice} | Status: ${p.status}`
).join('\n')}

RECENT SALES:
${recentSales.map(s =>
  `- ${s.invoiceNo} | ${s.saleType} | $${s.totalAmount} | ${new Date(s.createdAt).toLocaleDateString()}`
).join('\n')}

Answer questions about products, prices, stock levels, and recommendations.
Be concise, friendly, and helpful. Use $ for prices.
If asked for recommendations, suggest specific SKUs with prices.
If stock is 0 or out_of_stock, mention it clearly.`;

    const messages = [
      ...conversationHistory.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: question },
    ];

    const response = await client.messages.create({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system:     systemPrompt,
      messages,
    });

    res.status(200).json({
      success: true,
      answer:  response.content[0].text,
      usage:   response.usage,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── 2. PRODUCT DESCRIPTION GENERATOR ────────────────────────────────────────
const generateDescription = async (req, res) => {
  const { productId, tone = 'professional', language = 'english' } = req.body;

  try {
    const client = getClient();

    let product;
    if (productId) {
      product = await Product.findById(productId).lean();
      if (!product)
        return res.status(404).json({ success: false, message: 'Product not found' });
    } else {
      product = req.body.product;
      if (!product)
        return res.status(400).json({ success: false, message: 'productId or product data required' });
    }

    const silverPrice = await SilverPrice.getActive();
    const w   = product.netWeightGram || product.weightGram;
    const mat = w * silverPrice + (product.laborCost || 0) + (product.stoneCost || 0);
    const retailPrice = product.fixedRetailPrice || parseFloat((mat * (1 + (product.retailMarkup || 150) / 100)).toFixed(2));

    const prompt = `Generate a professional jewelry product description for an online/in-store listing.

PRODUCT DETAILS:
- Name: ${product.name}
- Category: ${product.category}
- Silver Purity: ${product.purity} (${product.purity === '925' ? 'Sterling Silver' : product.purity === '999' ? 'Fine Silver' : product.purity === '950' ? 'Britannia Silver' : 'Silver'})
- Weight: ${product.weightGram}g gross${product.netWeightGram ? ` / ${product.netWeightGram}g net` : ''}
- Finish: ${product.finish || 'polished'}
- Gender: ${product.gender || 'unisex'}
- Collection: ${product.collectionName || 'N/A'}
- Has Stones: ${product.hasStone ? 'Yes - ' + (product.stones?.map(s => s.type).join(', ') || 'gemstones') : 'No'}
- Size: ${product.size || 'standard'}
- Country of Origin: ${product.countryOfOrigin || 'Turkey'}
- Retail Price: $${retailPrice}

Tone: ${tone} (options: professional, luxury, casual, poetic)
Language: ${language}

Write:
1. A SHORT tagline (1 sentence, compelling)
2. A MAIN description (2-3 sentences, highlight craftsmanship and material)
3. KEY FEATURES (4-5 bullet points)
4. CARE INSTRUCTIONS (1-2 sentences)

Respond ONLY with valid JSON, no extra text, no markdown:
{
  "tagline": "...",
  "description": "...",
  "features": ["...", "...", "...", "...", "..."],
  "careInstructions": "..."
}`;

    const response = await client.messages.create({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages:   [{ role: 'user', content: prompt }],
    });

    let result;
    try {
      const text = response.content[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : { description: text };
    } catch {
      result = { description: response.content[0].text };
    }

    res.status(200).json({
      success: true,
      sku:     product.sku,
      name:    product.name,
      data:    result,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── 3. BUSINESS INSIGHTS ─────────────────────────────────────────────────────
const businessInsights = async (req, res) => {
  const { question = 'Give me a full business overview and key insights', period = '30' } = req.body;

  try {
    const client = getClient();

    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(period));

    const [
      salesSummary,
      topProducts,
      salesByType,
      salesByPayment,
      lowStock,
      inventoryOverview,
      silverPriceHistory,
    ] = await Promise.all([
      Sale.aggregate([
        { $match: { createdAt: { $gte: daysAgo }, status: { $ne: 'cancelled' } } },
        { $group: {
          _id:           null,
          totalRevenue:  { $sum: '$totalAmount' },
          totalSales:    { $sum: 1 },
          avgOrderValue: { $avg: '$totalAmount' },
          totalWeight:   { $sum: '$totalWeightGram' },
          totalDiscount: { $sum: '$discountAmount' },
        }},
      ]),
      Sale.aggregate([
        { $match: { createdAt: { $gte: daysAgo }, status: { $ne: 'cancelled' } } },
        { $unwind: '$items' },
        { $group: {
          _id:          '$items.sku',
          name:         { $first: '$items.name' },
          totalSold:    { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.totalPrice' },
        }},
        { $sort: { totalRevenue: -1 } },
        { $limit: 10 },
      ]),
      Sale.aggregate([
        { $match: { createdAt: { $gte: daysAgo }, status: { $ne: 'cancelled' } } },
        { $group: { _id: '$saleType', count: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
      ]),
      Sale.aggregate([
        { $match: { createdAt: { $gte: daysAgo }, status: { $ne: 'cancelled' } } },
        { $group: { _id: '$paymentMethod', count: { $sum: 1 }, total: { $sum: '$totalAmount' } } },
        { $sort: { total: -1 } },
      ]),
      Product.find({ isLowStock: true })
        .select('sku name stockQty minimumStock')
        .lean(),
      Product.aggregate([
        { $group: {
          _id:             null,
          totalProducts:   { $sum: 1 },
          totalStockGrams: { $sum: { $multiply: ['$weightGram', '$stockQty'] } },
          outOfStock:      { $sum: { $cond: [{ $eq: ['$status', 'out_of_stock'] }, 1, 0] } },
        }},
      ]),
      SilverPrice.find().sort({ createdAt: -1 }).limit(5).lean(),
    ]);

    const s   = salesSummary[0]      || {};
    const inv = inventoryOverview[0] || {};

    const dataContext = `
BUSINESS DATA — Last ${period} days:

SALES PERFORMANCE:
- Total Revenue: $${s.totalRevenue?.toFixed(2) || 0}
- Total Transactions: ${s.totalSales || 0}
- Average Order Value: $${s.avgOrderValue?.toFixed(2) || 0}
- Total Silver Weight Sold: ${s.totalWeight?.toFixed(2) || 0}g
- Total Discounts Given: $${s.totalDiscount?.toFixed(2) || 0}

SALES BY TYPE:
${salesByType.map(t => `- ${t._id}: ${t.count} sales, $${t.revenue?.toFixed(2)}`).join('\n')}

PAYMENT METHODS:
${salesByPayment.map(p => `- ${p._id}: ${p.count} times, $${p.total?.toFixed(2)}`).join('\n')}

TOP 10 PRODUCTS BY REVENUE:
${topProducts.map((p,i) => `${i+1}. [${p._id}] ${p.name} — ${p.totalSold} sold, $${p.totalRevenue?.toFixed(2)}`).join('\n')}

INVENTORY:
- Total Products: ${inv.totalProducts || 0}
- Total Stock (grams): ${inv.totalStockGrams?.toFixed(0) || 0}g
- Out of Stock: ${inv.outOfStock || 0} items
- Low Stock Alerts: ${lowStock.length} items
${lowStock.slice(0,5).map(p => `  ⚠️ ${p.sku} ${p.name}: ${p.stockQty} left (min: ${p.minimumStock})`).join('\n')}

SILVER PRICE TREND:
${silverPriceHistory.map(p => `- $${p.gramPrice}/g on ${new Date(p.createdAt).toLocaleDateString()}`).join('\n')}`;

    const systemPrompt = `You are a senior business analyst for Silver Palace, a silver jewelry shop.
Analyze the provided business data and give clear, actionable insights.
Be specific with numbers. Highlight what's working and what needs attention.
Format your response with clear sections using emojis for readability.
Keep it concise — busy shop owners need quick actionable advice.`;

    const response = await client.messages.create({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system:     systemPrompt,
      messages:   [{
        role:    'user',
        content: `${dataContext}\n\nQUESTION: ${question}`,
      }],
    });

    res.status(200).json({
      success:  true,
      period:   `Last ${period} days`,
      insights: response.content[0].text,
      rawData: {
        revenue:    s.totalRevenue   || 0,
        sales:      s.totalSales     || 0,
        avgOrder:   s.avgOrderValue  || 0,
        lowStock:   lowStock.length,
        outOfStock: inv.outOfStock   || 0,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { salesAssistant, generateDescription, businessInsights };