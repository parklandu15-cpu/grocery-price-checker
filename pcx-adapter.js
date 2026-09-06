import { normalizeRetailerProduct, summarizeStore } from './normalizer.js';

const TERM_TO_ITEM = {
  '1% milk 4L': 'milk',
  'large eggs 12 or 30': 'eggs',
  'plain Greek yogurt about 1 kg': 'greek-yogurt',
  'boneless skinless chicken breast 2 kg': 'chicken-breast',
  'romaine lettuce': 'romaine',
  'Bubly 12 pack': 'bubly',
  'Vector cereal': 'vector',
  'marble cheese block': 'cheese',
  'Kraft smooth peanut butter': 'peanut-butter',
  'bananas 2 kg': 'bananas',
  'Silk hazelnut coffee creamer': 'creamer',
  'grapes 1 kg': 'grapes',
  'whole wheat bread': 'bread',
  'Wheat Thins': 'wheat-thins',
  'carrots 1 kg': 'carrots',
  'bell peppers': 'peppers',
  'oranges 8': 'oranges',
  'baby potatoes': 'potatoes'
};

export function pcxProductsToRecords(products = []) {
  const records = {};
  for (const p of products) {
    const itemId = TERM_TO_ITEM[p.search_term];
    if (!itemId) continue;
    const hasUsableIdentity = Boolean(p.name || p.brand || typeof p.price === 'number');
    records[itemId] = hasUsableIdentity ? {
      name: p.name || null,
      brand: p.brand || null,
      price: typeof p.price === 'number' ? p.price : null,
      in_stock: p.in_stock,
      status: p.in_stock === false ? 'out_of_stock' : undefined,
      source: 'pcx_official_connector'
    } : {
      name: null,
      brand: null,
      status: 'needs_price',
      source: 'pcx_official_connector'
    };
  }
  return records;
}

export function analyzePcxStore({ retailer, products, itemIds }) {
  const records = pcxProductsToRecords(products);
  const normalized = itemIds.map(itemId => normalizeRetailerProduct({
    itemId,
    retailer,
    product: records[itemId] || null
  }));
  return summarizeStore(retailer, normalized);
}

export const PCX_SEARCH_TERMS = Object.keys(TERM_TO_ITEM);
export const PCX_TERM_TO_ITEM = TERM_TO_ITEM;

import { enrichVariableWeightProduct } from './retailer-web-adapter.js';
import { ITEM_RULES } from './normalizer.js';

const ITEM_TO_SEARCH_TERM = Object.fromEntries(Object.entries(TERM_TO_ITEM).map(([term,id])=>[id,term]));

export async function analyzePcxStoreWithWebEnrichment({ retailer, products, itemIds }, fetchImpl=fetch) {
  const records = pcxProductsToRecords(products);
  const enriched = {};
  for (const itemId of itemIds) {
    const record = records[itemId] || null;
    if (!record) { enriched[itemId]=null; continue; }
    const rule = ITEM_RULES[itemId];
    if (rule?.variableWeight && rule.target?.type === 'weight' && !record.unitPrice && record.status !== 'out_of_stock') {
      enriched[itemId] = await enrichVariableWeightProduct({
        retailer,
        product: record,
        searchQuery: ITEM_TO_SEARCH_TERM[itemId] || record.name
      }, fetchImpl);
    } else {
      enriched[itemId]=record;
    }
  }
  const normalized = itemIds.map(itemId => normalizeRetailerProduct({
    itemId,
    retailer,
    product: enriched[itemId]
  }));
  const summary=summarizeStore(retailer,normalized);
  return {...summary, enrichmentApplied:true};
}
