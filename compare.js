import { ITEM_RULES, normalizeRetailerProduct, summarizeStore } from './normalizer.js';

const stores=['Walmart','Superstore','Costco','No Frills','Safeway','Sobeys'];
const names=Object.fromEntries(Object.entries(ITEM_RULES).map(([id,r])=>[id,r.name]));

// Prototype fixed-price records. Live connectors can replace these records without changing
// normalization or basket-completion logic.
const productRecords={
  Walmart:{
    milk:{name:'1% Milk 4 L',price:6.44}, eggs:{name:'Large Eggs 12',price:3.93}, 'greek-yogurt':{name:'Plain Greek Yogurt',price:5.56},
    'chicken-breast':{name:'Boneless Skinless Chicken Breast',unitPrice:{value:12.70,unit:'kg',basis:1}}, romaine:{name:'Romaine',price:1.94},
    bubly:{name:'Bubly 12 pack',price:6.98}, vector:{name:'Vector',price:5.47}, cheese:{name:'Marble cheese block',price:4.92},
    'peanut-butter':{name:'Kraft Smooth Peanut Butter',price:5.97}, bananas:{name:'Bananas',unitPrice:{value:1.50,unit:'kg',basis:1}},
    creamer:{name:'Silk Hazelnut Creamer',price:5.46}, grapes:{name:'Seedless Grapes',unitPrice:{value:7.60,unit:'kg',basis:1}},
    bread:{name:'Whole Wheat Bread',price:2.48}, 'wheat-thins':{name:'Wheat Thins',price:2.98}, carrots:{name:'Carrots',price:2.94},
    peppers:{name:'Bell peppers pack',price:3.98}, oranges:{name:'Oranges bag',price:5.97}, potatoes:{name:'Baby potatoes',price:5.47}
  },
  Superstore:{
    milk:{name:'Beatrice Partly Skimmed Milk 1%',price:6.35}, eggs:{name:'No Name Large Eggs 12',price:4.18},
    'greek-yogurt':{name:'PC Plain Greek Yogurt Club Size',price:6.99},
    'chicken-breast':{name:'Chicken Breast Club Pack Boneless Skinless',unitPrice:{value:18.72,unit:'kg',basis:1}},
    romaine:{name:'Romaine Hearts 3 Pack',price:5.48}, bubly:{name:'Bubly 12 Pack',price:5.99}, vector:{name:'Kelloggs Vector',price:8.49},
    cheese:{name:'No Name Marble Farmer’s Cheese',price:8.79}, 'peanut-butter':{name:'Kraft Smooth Peanut Butter',price:5.99},
    bananas:{name:'Bananas',unitPrice:{value:1.52,unit:'kg',basis:1}}, creamer:{name:'Silk Hazelnut Almond Coffee Creamer',price:5.79},
    grapes:{name:'PC Sweet Carnival Grapes',unitPrice:{value:13.21,unit:'kg',basis:1}}, bread:{name:'No Name Whole Wheat Bread',price:2.50},
    'wheat-thins':{name:'Christie Wheat Thins',price:2.50}, carrots:{name:'Carrots 3 lb bag',price:3.00}, peppers:{name:'No Name Mixed Sweet Peppers 2.5 lb',price:6.00},
    oranges:{name:'Navel Oranges bag',price:10.00}, potatoes:{name:'PC Yellow Mini Potatoes',price:4.00}
  },
  'No Frills':{
    milk:{name:'Beatrice Partly Skimmed Milk 1%',price:6.35}, eggs:{name:'No Name Large Eggs 12',price:4.18},
    'greek-yogurt':{name:'PC Plain Greek Yogurt Club Size',price:7.00},
    'chicken-breast':{name:'Chicken Breast Club Pack Boneless Skinless',unitPrice:{value:19.46,unit:'kg',basis:1}},
    romaine:{name:'Romaine Hearts 3 Pack',price:4.99}, bubly:{name:'Bubly 12 Pack',price:6.50},
    vector:{name:'Kelloggs Vector',status:'out_of_stock'}, cheese:{name:'No Name Marble Farmer’s Cheese',price:9.00},
    'peanut-butter':{name:'Kraft Smooth Peanut Butter',price:6.50}, bananas:{name:'Bananas',unitPrice:{value:1.52,unit:'kg',basis:1}},
    creamer:{name:'Silk Hazelnut Almond Coffee Creamer',price:5.49}, grapes:{name:'PC Sweet Carnival Grapes',unitPrice:{value:13.21,unit:'kg',basis:1}},
    bread:{name:'No Name Whole Wheat Bread',price:2.50}, 'wheat-thins':{name:'Christie Wheat Thins',price:2.50}, carrots:{name:'Carrots 3 lb bag',price:3.00},
    peppers:{name:'No Name Mixed Sweet Peppers 2.5 lb',price:7.00}, oranges:{name:'Navel Oranges',unitPrice:{value:1.92,unit:'kg',basis:1}}, potatoes:{name:'PC Yellow Mini Potatoes',price:3.99}
  }
};

function analyzeStore(store, items, oneTime){
  const normalized = items.map(id => normalizeRetailerProduct({ itemId:id, retailer:store, product:productRecords[store]?.[id] || null }));
  for (const item of oneTime) normalized.push({ itemId:`one:${item}`, itemName:item, retailer:store, status:'needs_live_lookup', basketCost:null, confidence:'none', notes:['One-time item requires a live retailer search.'] });
  const summary=summarizeStore(store,normalized);
  return {
    store,
    subtotal:summary.subtotal,
    complete:summary.complete,
    total:summary.total,
    summary:summary.complete?`Complete basket (${summary.itemCount} items)`:`${summary.pricedCount} priced, ${summary.unresolved.length} unresolved`,
    missing:summary.unresolved.map(x=>({item:x.item,status:x.status})),
    items:summary.items
  };
}

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'POST required'});
  const body=req.body||{};
  const items=Array.isArray(body.items)?body.items:[];
  const oneTime=Array.isArray(body.oneTime)?body.oneTime:[];
  const results=stores.map(s=>analyzeStore(s,items,oneTime));
  const complete=results.filter(x=>x.complete).sort((a,b)=>a.total-b.total);
  const recommendation=complete.length?{label:complete[0].store,total:complete[0].total,note:'Lowest complete one-store basket after unit-price normalization.'}:{label:'No complete one-store basket yet',total:null,note:'Some items still need live lookup or unit-price enrichment.'};
  return res.status(200).json({
    engineMode:'server-side normalization + availability rules',
    itemCount:items.length+oneTime.length,
    basket:[...items.map(id=>names[id]||id),...oneTime],
    stores:results,
    recommendation,
    nextStep:'Connect live retailer search results to the normalizer. Variable-weight items require an explicit unit price before they can enter a basket total.'
  });
}
