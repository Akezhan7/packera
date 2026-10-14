import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, cp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { pageStructuredData, serializeScriptData } from '../shared/structuredData.js';

const product = { id:'box', title:'Box', desc:'Strong box', category:'Boxes', price:50, image:'/products/cover.jpg', images:['/products/details.jpg'], specs:{Material:'Cardboard'}, sizes:[{size:'Small',price:100,image:'/products/small.jpg'},{size:'Large',price:250,image:'/products/large.jpg'}] };
const catalog = { products:[product], categories:[{id:'boxes',name:'Boxes'}], tasks:[] };
const schema = size => pageStructuredData({kind:'product',id:'box',size}, product, catalog);

test('Product/Offer describes the displayed variant and actual gallery without invented commercial facts', () => {
  const initial = schema('').find(item => item['@type'] === 'Product');
  assert.equal(initial.offers.price, 100);
  assert.equal(initial.offers.priceCurrency, 'KZT');
  assert.equal(initial.offers.url, 'https://packera.kz/product/id-box?size=Small');
  assert.deepEqual(initial.image, ['https://packera.kz/products/cover.jpg','https://packera.kz/products/details.jpg']);
  assert.deepEqual(initial.additionalProperty, [{ '@type':'PropertyValue', name:'Material', value:'Cardboard' }]);
  const large = schema('Large').find(item => item['@type'] === 'Product');
  assert.equal(large.offers.price, 250);
  assert.equal(large.offers.url, 'https://packera.kz/product/id-box?size=Large');
  assert.equal(large.url, 'https://packera.kz/product/id-box');
  assert.deepEqual(large.image, ['https://packera.kz/products/large.jpg','https://packera.kz/products/cover.jpg','https://packera.kz/products/details.jpg']);
  assert.equal(schema('unknown').find(item => item['@type'] === 'Product').offers.price, 100);
  assert.doesNotMatch(JSON.stringify(large), /availability|sku|aggregateRating|review|shippingDetails|hasMerchantReturnPolicy|brand|manufacturer/);
  const unsafe = pageStructuredData({kind:'product'}, {...product,image:'javascript:alert(1)',images:[],sizes:[],price:NaN}, catalog).find(item => item['@type'] === 'Product');
  assert.equal(unsafe.image, undefined);
  assert.equal(unsafe.offers, undefined);
});

test('breadcrumb and store data use public navigation and safely serialized real content', () => {
  const graph = schema('Large');
  const breadcrumb = graph.find(item => item['@type'] === 'BreadcrumbList');
  assert.deepEqual(breadcrumb.itemListElement.map(item => item.item), ['https://packera.kz/','https://packera.kz/catalog/id-boxes','https://packera.kz/product/id-box']);
  const store = graph.find(item => item['@type'] === 'Organization');
  assert.equal(store.name, 'Packera.kz');
  assert.equal(store.telephone, '+77011623491');
  assert.deepEqual(store.address, {'@type':'PostalAddress',addressLocality:'Алматы',streetAddress:'ул. Ратушного, 78в',addressCountry:'KZ'});
  assert.deepEqual(store.areaServed, {'@type':'Country',name:'Kazakhstan'});
  assert.match(store.description, /70\s000/);
  assert.equal(store.openingHours, undefined);
  assert.deepEqual(pageStructuredData({kind:'missing'}, null, catalog), []);
  assert.deepEqual(pageStructuredData({kind:'product'}, {...product,isVisible:false}, catalog), []);
  const malicious = {text:'</script><script>alert(1)</script>\u2028\u2029'};
  const serialized = serializeScriptData(malicious);
  assert.doesNotMatch(serialized, /<|\u2028|\u2029/);
  assert.deepEqual(JSON.parse(serialized), malicious);
});

test('server schema runs from the deployed shared folder without UI source files', async t => {
  const dir = await mkdtemp(join(tmpdir(),'packera-schema-'));
  t.after(() => rm(dir,{recursive:true,force:true}));
  await writeFile(join(dir,'package.json'), JSON.stringify({type:'module'}));
  await cp(new URL('../shared',import.meta.url),join(dir,'shared'),{recursive:true});
  const module = await import(pathToFileURL(join(dir,'shared','structuredData.js')));
  assert.equal(module.pageStructuredData({kind:'home'},null,{}).length,1);
});
