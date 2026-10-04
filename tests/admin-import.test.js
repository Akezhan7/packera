import assert from 'node:assert/strict';
import {test} from 'node:test';
const module = await import('../src/adminImport.js').catch(()=>null);
const catalog={products:[{id:'p',version:7,title:'Old',price:10,desc:'Keep',images:['keep.jpg']}],categories:[],tasks:[{id:'move'}]};
test('import preserves unprovided fields and fixes source versions before review',()=>{
  assert.ok(module);
  const result=module.prepareProductImport([{ID:'p',Title:'New',Price:12}],catalog);
  assert.deepEqual(result.operations,[{entity:'products',action:'update',id:'p',version:7,changes:{title:'New',price:12}}]);
  catalog.products[0].version=8;
  assert.equal(result.operations[0].version,7);
});
test('new categories precede their products in one batch; IDs remain stable',()=>{
  assert.ok(module);
  const result=module.prepareProductImport([{ID:'new',Title:'New',Price:0,Category:'New category'}],catalog);
  assert.equal(result.categoryCount,1);
  assert.equal(result.operations[0].entity,'categories');
  assert.equal(result.operations[1].data.category,'New category');
  assert.equal(result.operations[1].data.id,'new');
});
test('invalid price, missing required headers, duplicate IDs and unknown columns stop entire import',()=>{
  assert.ok(module);
  for(const rows of [[{ID:'x',Title:'x',Price:-1}],[{ID:'x',Title:'x'}],[{ID:'x',Title:'x',Price:''}],[{ID:'x',Title:'x',Price:1},{ID:'x',Title:'x',Price:1}],[{ID:'x',Title:'x',Price:1,Surprise:'value'}]]) assert.throws(()=>module.prepareProductImport(rows,catalog));
});
