import assert from 'node:assert/strict';
import {test,after} from 'node:test';
const originalFetch=globalThis.fetch;
const originalStorage=globalThis.localStorage;
globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
const initial={products:[{id:'p',title:'Original',version:5,category:'Old'}],categories:[{id:'c',name:'Old',version:2}],tasks:[],banners:[],siteSettings:{installmentEnabled:true},settingVersions:{installmentEnabled:3}};
globalThis.fetch=async()=>Response.json(initial);
const data=await import('../src/data.js');
await new Promise(resolve=>setTimeout(resolve,0));
after(()=>{globalThis.fetch=originalFetch;globalThis.localStorage=originalStorage;});

test('catalog is unchanged before COMMIT response and adopts the confirmed revision',async()=>{
  data.acceptCatalog(initial);
  let finish;
  globalThis.fetch=async()=>new Promise(resolve=>{finish=()=>resolve(Response.json({changes:[{entity:'products',id:'p',data:{...initial.products[0],title:'Confirmed',version:6}}]}));});
  const saving=data.saveOperations([{entity:'products',action:'update',id:'p',version:5,changes:{title:'Confirmed'}}]);
  assert.equal(data.products[0].title,'Original');
  finish();await saving;
  assert.equal(data.products[0].title,'Confirmed');assert.equal(data.products[0].version,6);
});
test('409 does not mutate catalog and stale result cannot replace a newer version',async()=>{
  data.acceptCatalog(initial);
  globalThis.fetch=async()=>Response.json({code:'VERSION_CONFLICT',current:{...initial.products[0],version:6}},{status:409});
  await assert.rejects(data.saveOperations([{entity:'products',action:'update',id:'p',version:5,changes:{title:'Draft'}}]));
  assert.equal(data.products[0].title,'Original');
  data.applyContentResult({changes:[{entity:'products',id:'p',data:{...initial.products[0],title:'Fresh',version:7}}]});
  data.applyContentResult({changes:[{entity:'products',id:'p',data:{...initial.products[0],title:'Old',version:6}}]});
  assert.equal(data.products[0].title,'Fresh');
});
test('category side effects and setting revisions come from server changes',()=>{
  data.acceptCatalog(initial);
  data.applyContentResult({changes:[{entity:'categories',id:'c',data:{id:'c',name:'New',version:8}},{entity:'products',id:'p',data:{...initial.products[0],category:'New',version:9}},{entity:'settings',id:'installmentEnabled',data:{key:'installmentEnabled',value:false,version:10}}]});
  assert.equal(data.products[0].category,'New');assert.equal(data.products[0].version,9);
  assert.equal(data.settingVersions.installmentEnabled,10);assert.equal(data.siteSettings.installmentEnabled,false);
});
test('failed admin refresh retains confirmed catalog and disables writes instead of writable fallback',async()=>{
  data.acceptCatalog(initial);
  globalThis.fetch=async()=>{throw new TypeError('Offline');};
  await assert.rejects(data.loadDatabase());
  assert.equal(data.products[0].id,'p');assert.equal(data.databaseReady.value,false);
  await assert.rejects(data.saveOperations([]),/каталог/);
});
