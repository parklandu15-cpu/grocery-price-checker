// TEMPORARY DIAGNOSTIC — safe to delete once the chicken issue is solved.
// Shows the raw Vynn results for one search so we can see actual banner/product
// names instead of guessing. Uses the same VYNN_API_KEY as api/compare.js.
export default async function handler(req, res) {
  const key = (process.env.VYNN_API_KEY || '').trim();
  if (!key) return res.status(500).json({ error: 'VYNN_API_KEY is not configured' });
  const q = req.query?.q || 'boneless skinless chicken breast';
  const url = 'https://vynn.ai/v1/products/search?q=' + encodeURIComponent(q) + '&province=AB&limit=40';
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + key } });
  const j = await r.json();
  if (!r.ok) return res.status(500).json({ error: j?.error?.message || 'Vynn request failed' });
  const results = (j.results || []).map(rec => ({
    banner: rec?.banner?.value || rec?.provider?.value || null,
    product_name: rec?.product_name || null,
    size: rec?.size || null,
    price: rec?.price ?? null,
    comparison_unit_price: rec?.comparison_unit_price || null
  }));
  return res.status(200).json({ query: q, count: results.length, results });
}
