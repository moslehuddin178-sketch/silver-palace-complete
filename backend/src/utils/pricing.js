const SilverPrice = require('../models/SilverPrice');

/**
 * Compute product price dynamically based on live silver gram price
 * Formula: (weightGram × silverGramPrice) + laborCost + stoneCost
 *          × (1 + markup/100)
 */
const computePrices = async (product) => {
  const silverGramPrice = await SilverPrice.getActive();
  const weight = product.netWeightGram || product.weightGram;

  const materialCost =
    weight * silverGramPrice + (product.laborCost || 0) + (product.stoneCost || 0);

  const retailPrice = product.fixedRetailPrice
    ? product.fixedRetailPrice
    : parseFloat((materialCost * (1 + (product.retailMarkup || 150) / 100)).toFixed(2));

  const wholesalePrice = product.fixedWholesalePrice
    ? product.fixedWholesalePrice
    : parseFloat((materialCost * (1 + (product.wholesaleMarkup || 50) / 100)).toFixed(2));

  return {
    silverGramPrice,
    materialCost:     parseFloat(materialCost.toFixed(2)),
    retailPrice,
    wholesalePrice,
  };
};

module.exports = { computePrices };
