export const ITEM_RULES = {
  milk: { name: 'Milk', target: { type: 'volume', value: 4, unit: 'L' } },
  bananas: { name: 'Bananas', target: { type: 'weight', value: 2, unit: 'kg' }, variableWeight: true },
  'chicken-breast': { name: 'Chicken breast', target: { type: 'weight', value: 2, unit: 'kg' }, variableWeight: true },
  apples: { name: 'Apples', target: { type: 'weight', value: 1, unit: 'kg' }, variableWeight: true },
  'greek-yogurt': { name: 'Plain Greek yogurt', target: { type: 'weight', value: 1, unit: 'kg' }, flexiblePackSize: true },
  eggs: { name: 'Eggs', target: { type: 'count', value: 12, unit: 'each' }, compareBy: 'each' },
  'pork-tenderloin': { name: 'Pork tenderloin', target: { type: 'weight', value: 1.5, unit: 'kg' }, variableWeight: true },
  'wheat-thins': { name: 'Wheat Thins', target: { type: 'package', value: 1, unit: 'box' } },
  oranges: { name: 'Oranges', target: { type: 'count', value: 8, unit: 'each' }, variableWeight: true },
  peppers: { name: 'Bell peppers', target: { type: 'count', value: 4, unit: 'each' }, flexiblePackSize: true },
  carrots: { name: 'Carrots', target: { type: 'weight', value: 1, unit: 'kg' }, variableWeight: true },
  potatoes: { name: 'Baby potatoes', target: { type: 'package', value: 1, unit: 'bag' }, flexiblePackSize: true },
  romaine: { name: 'Romaine lettuce', target: { type: 'package', value: 1, unit: 'pack' } },
  bubly: { name: 'Bubly', target: { type: 'package', value: 1, unit: 'case' } },
  vector: { name: 'Vector cereal', target: { type: 'package', value: 1, unit: 'box' } },
  cheese: { name: 'Marble cheese', target: { type: 'package', value: 1, unit: 'block' }, flexiblePackSize: true },
  'peanut-butter': { name: 'Kraft smooth peanut butter', target: { type: 'package', value: 1, unit: 'jar' } },
  creamer: { name: 'Silk hazelnut coffee creamer', target: { type: 'package', value: 1, unit: 'carton' } },
  grapes: { name: 'Grapes', target: { type: 'weight', value: 1, unit: 'kg' }, variableWeight: true },
  bread: { name: 'Bread', target: { type: 'package', value: 1, unit: 'loaf' } }
};

const UNIT_TO_KG = { kg: 1, g: 0.001, lb: 0.45359237 };
const UNIT_TO_L = { l: 1, ml: 0.001 };

export function normalizeUnitPrice(unitPrice) {
  if (!unitPrice || typeof unitPrice.value !== 'number') return null;
  const unit = String(unitPrice.unit || '').toLowerCase();
  const basis = Number(unitPrice.basis || 1);
  if (!Number.isFinite(basis) || basis <= 0) return null;

  if (unit in UNIT_TO_KG) {
    const kg = basis * UNIT_TO_KG[unit];
    return { perKg: unitPrice.value / kg, display: `$${(unitPrice.value / kg).toFixed(2)}/kg` };
  }
  if (unit in UNIT_TO_L) {
    const litres = basis * UNIT_TO_L[unit];
    return { perL: unitPrice.value / litres, display: `$${(unitPrice.value / litres).toFixed(2)}/L` };
  }
  if (['each', 'ea', 'unit', 'count'].includes(unit)) {
    return { perEach: unitPrice.value / basis, display: `$${(unitPrice.value / basis).toFixed(2)}/each` };
  }
  return null;
}

export function normalizeRetailerProduct({ itemId, retailer, product }) {
  const rule = ITEM_RULES[itemId] || { name: itemId, target: { type: 'package', value: 1, unit: 'item' } };
  if (!product) {
    return { itemId, itemName: rule.name, retailer, status: 'not_found', basketCost: null, confidence: 'none', notes: ['No product result returned.'] };
  }

  const status = product.status || (product.in_stock === false ? 'out_of_stock' : 'available');
  if (status !== 'available') {
    return { itemId, itemName: rule.name, retailer, status, basketCost: null, confidence: 'high', productName: product.name || null, notes: [] };
  }

  const packagePrice = typeof product.packagePrice === 'number' ? product.packagePrice :
    (typeof product.price === 'number' ? product.price : null);
  const normalized = normalizeUnitPrice(product.unitPrice);
  const notes = [];

  // PC Express variable-weight results can expose an estimated package total in `price`.
  // Never treat that raw amount as $/kg. Require unit-price enrichment for a target-weight basket.
  if (rule.variableWeight && rule.target?.type === 'weight') {
    if (!normalized?.perKg) {
      notes.push('Variable-weight item: raw retailer price may be an estimated pack total, not a unit rate.');
      notes.push('Unit price enrichment is required before calculating the requested basket quantity.');
      return {
        itemId, itemName: rule.name, retailer, status: 'needs_unit_price',
        productName: product.name || null, brand: product.brand || null,
        rawPrice: packagePrice, basketCost: null, normalizedUnitPrice: null,
        confidence: 'blocked', notes
      };
    }
    const basketCost = normalized.perKg * rule.target.value;
    return {
      itemId, itemName: rule.name, retailer, status: 'available',
      productName: product.name || null, brand: product.brand || null,
      rawPrice: packagePrice, basketCost, normalizedUnitPrice: normalized,
      target: rule.target, confidence: 'high', notes
    };
  }

  // For counted goods, use per-each when supplied; otherwise a package price is valid if package count matches.
  if (rule.target?.type === 'count' && normalized?.perEach) {
    return {
      itemId, itemName: rule.name, retailer, status: 'available',
      productName: product.name || null, brand: product.brand || null,
      rawPrice: packagePrice, basketCost: normalized.perEach * rule.target.value,
      normalizedUnitPrice: normalized, target: rule.target, confidence: 'high', notes
    };
  }

  if (packagePrice !== null) {
    return {
      itemId, itemName: rule.name, retailer, status: 'available',
      productName: product.name || null, brand: product.brand || null,
      rawPrice: packagePrice, basketCost: packagePrice,
      normalizedUnitPrice: normalized, target: rule.target, confidence: normalized ? 'high' : 'medium', notes
    };
  }

  return {
    itemId, itemName: rule.name, retailer, status: 'needs_price',
    productName: product.name || null, brand: product.brand || null,
    rawPrice: null, basketCost: null, normalizedUnitPrice: normalized,
    confidence: 'blocked', notes: ['No usable price was returned.']
  };
}

export function summarizeStore(retailer, normalizedItems) {
  const unresolved = normalizedItems.filter(x => x.status !== 'available' || typeof x.basketCost !== 'number');
  const subtotal = normalizedItems.reduce((sum, x) => sum + (typeof x.basketCost === 'number' ? x.basketCost : 0), 0);
  return {
    retailer,
    complete: unresolved.length === 0,
    subtotal,
    total: unresolved.length === 0 ? subtotal : null,
    pricedCount: normalizedItems.length - unresolved.length,
    itemCount: normalizedItems.length,
    unresolved: unresolved.map(x => ({ itemId: x.itemId, item: x.itemName, status: x.status, notes: x.notes })),
    items: normalizedItems
  };
}
