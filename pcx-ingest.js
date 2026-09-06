import { analyzePcxStore } from './pcx-adapter.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
  const body = req.body || {};
  const retailer = body.retailer;
  const products = Array.isArray(body.products) ? body.products : [];
  const itemIds = Array.isArray(body.itemIds) ? body.itemIds : [];
  if (!retailer || !itemIds.length) return res.status(400).json({ error: 'retailer and itemIds are required' });

  const summary = analyzePcxStore({ retailer, products, itemIds });
  return res.status(200).json({
    engineMode: 'official PC Express feed -> normalization layer',
    source: 'PC Express ChatGPT connector',
    ...summary,
    note: summary.complete
      ? 'Complete basket from connector data.'
      : 'Package-priced items are usable. Variable-weight items remain unresolved until a true unit rate is supplied.'
  });
}
