import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as XLSX from 'xlsx';
const module = await import('../src/adminImport.js').catch(()=>null);
const catalog={products:[{id:'p',version:7,title:'Old',price:10,desc:'Keep',images:['keep.jpg']}],categories:[],tasks:[{id:'move'}]};

test('supported spreadsheet formats retain Cyrillic, text IDs and prices through the actual parser',()=>{
  const workbook=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([
    ['ID','Название','Цена'],['001','Коробка для переезда',1250.5],
  ]),'Товары');
  XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([['Ignored']]),'Other');
  for(const bookType of ['xlsx','xls','csv']) {
    const bytes=XLSX.write(workbook,{type:'array',bookType});
    const parsed=XLSX.read(bytes,{type:'array',raw:true});
    const rows=XLSX.utils.sheet_to_json(parsed.Sheets[parsed.SheetNames[0]],{defval:''});
    const result=module.prepareProductImport(rows,{products:[],categories:[],tasks:[]});
    assert.deepEqual(result.operations,[{entity:'products',action:'create',data:{id:'001',title:'Коробка для переезда',price:1250.5}}],bookType);
  }
});
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
