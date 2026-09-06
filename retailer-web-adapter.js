const UNIT_PATTERNS = [
  { re: /\$(\d+(?:\.\d{1,2})?)\s*\/\s*1\s*kg\b/i, unit: 'kg', basis: 1 },
  { re: /\$(\d+(?:\.\d{1,2})?)\s*\/\s*kg\b/i, unit: 'kg', basis: 1 },
  { re: /\$(\d+(?:\.\d{1,2})?)\s*\/\s*100\s*g\b/i, unit: 'g', basis: 100 },
  { re: /\$(\d+(?:\.\d{1,2})?)\s*\/\s*1\s*lb\b/i, unit: 'lb', basis: 1 },
  { re: /\$(\d+(?:\.\d{1,2})?)\s*\/\s*lb\b/i, unit: 'lb', basis: 1 },
  { re: /\$(\d+(?:\.\d{1,2})?)\s*\/\s*1\s*L\b/i, unit: 'L', basis: 1 },
  { re: /\$(\d+(?:\.\d{1,2})?)\s*\/\s*100\s*mL\b/i, unit: 'mL', basis: 100 },
  { re: /\$(\d+(?:\.\d{1,2})?)\s*\/\s*1\s*ea\b/i, unit: 'each', basis: 1 }
];

export function htmlToSearchableText(html='') {
  return String(html)
    .replace(/\\u0024/g, '$')
    .replace(/\\u002F/gi, '/')
    .replace(/\\n/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/<script[\s\S]*?<\/script>/gi, m => m.replace(/<[^>]+>/g, ' '))
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(s='') {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(x=>x.length>2);
}

export function productMatchScore(candidateText, productName) {
  const wanted=tokens(productName);
  if (!wanted.length) return 0;
  const hay=new Set(tokens(candidateText));
  return wanted.filter(t=>hay.has(t)).length / wanted.length;
}

export function extractBestUnitPrice(pageText, productName, { minScore=0.45, window=320 }={}) {
  const text=String(pageText||'');
  if (!text) return null;
  const nameTokens=tokens(productName);
  const anchors=[];
  if (productName) {
    const exact=text.toLowerCase().indexOf(String(productName).toLowerCase());
    if (exact>=0) anchors.push(exact);
    for (const token of nameTokens.slice(0,5)) {
      let from=0, idx;
      while ((idx=text.toLowerCase().indexOf(token,from))>=0 && anchors.length<40) { anchors.push(idx); from=idx+token.length; }
    }
  }
  if (!anchors.length) anchors.push(0);

  let best=null;
  for (const anchor of anchors) {
    const start=Math.max(0,anchor-window), end=Math.min(text.length,anchor+window);
    const segment=text.slice(start,end);
    const score=productMatchScore(segment,productName);
    if (score<minScore) continue;
    for (const pattern of UNIT_PATTERNS) {
      const match=pattern.re.exec(segment);
      if (!match) continue;
      const candidate={value:Number(match[1]),unit:pattern.unit,basis:pattern.basis,match:match[0],score,segment};
      if (!best || candidate.score>best.score) best=candidate;
    }
  }
  return best;
}

export function buildRetailerSearchUrl(retailer, query) {
  const q=encodeURIComponent(query);
  if (retailer==='Superstore') return `https://www.realcanadiansuperstore.ca/en/search?search-bar=${q}`;
  if (retailer==='No Frills') return `https://www.nofrills.ca/en/search?search-bar=${q}`;
  if (retailer==='Walmart') return `https://www.walmart.ca/en/search?q=${q}`;
  return null;
}

export async function fetchRetailerSearchText(retailer, query, fetchImpl=fetch) {
  const url=buildRetailerSearchUrl(retailer,query);
  if (!url) return { ok:false, reason:'unsupported_retailer', url:null, text:'' };
  try {
    const response=await fetchImpl(url,{headers:{'user-agent':'Mozilla/5.0 (compatible; GroceryPriceChecker/0.3; +https://example.invalid)','accept-language':'en-CA,en;q=0.9'},redirect:'follow'});
    if (!response.ok) return {ok:false,reason:`http_${response.status}`,url,text:''};
    const html=await response.text();
    return {ok:true,reason:null,url,text:htmlToSearchableText(html)};
  } catch (err) {
    return {ok:false,reason:'fetch_failed',error:String(err?.message||err),url,text:''};
  }
}

export async function enrichVariableWeightProduct({retailer, product, searchQuery}, fetchImpl=fetch) {
  if (!product?.name) return {...product,enrichment:{status:'skipped',reason:'missing_product_name'}};
  const fetched=await fetchRetailerSearchText(retailer,searchQuery||product.name,fetchImpl);
  if (!fetched.ok) return {...product,enrichment:{status:'failed',reason:fetched.reason,url:fetched.url}};
  const found=extractBestUnitPrice(fetched.text,product.name);
  if (!found) return {...product,enrichment:{status:'not_found',reason:'unit_rate_not_found',url:fetched.url}};
  return {
    ...product,
    unitPrice:{value:found.value,unit:found.unit,basis:found.basis},
    enrichment:{status:'enriched',url:fetched.url,matched:found.match,matchScore:found.score}
  };
}
