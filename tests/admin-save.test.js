import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import * as api from '../src/adminApi.js';
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const product = { id:'p', version:8, title:'Old', desc:'Original', price:10, images:['old.jpg'] };
const update = () => ({ entity:'products', action:'update', id:'p', version:8, changes:{title:'New'} });
const snapshot = p => ({ products:p ? [p] : [], categories:[],tasks:[],banners:[],siteSettings:{},settingVersions:{} });

test('draft diff sends only edited fields with the original version', () => {
  assert.equal(typeof api.makeUpdateOperation,'function');
  assert.deepEqual(api.makeUpdateOperation('products',product,{...product,title:'New'}),update());
  assert.equal(api.makeUpdateOperation('products',product,{...product}),null);
});

test('409 preserves draft and returns the current server object', async () => {
  const draft = {...product,title:'New'};
  globalThis.fetch = async () => Response.json({code:'VERSION_CONFLICT',current:{...product,version:9,title:'Other'},entity:'products',id:'p',error:'Conflict'},{status:409});
  assert.equal(typeof api.saveContentOperations,'function');
  await assert.rejects(api.saveContentOperations([update()]),e => e.status === 409 && e.data.current.version === 9);
  assert.equal(draft.title,'New');
  assert.equal(draft.version,8);
});

test('pending write is immutable; repeated click cannot create a second request', async () => {
  assert.equal(typeof api.saveContentOperations,'function');
  let finish; let calls=0; let sent;
  globalThis.fetch = async (_url,options) => {
    calls++; sent=JSON.parse(options.body);
    return new Promise(resolve => { finish = () => resolve(Response.json({changes:[{entity:'products',id:'p',data:{...product,version:9,title:'New'}}]})); });
  };
  const operation = update();
  const saving = api.saveContentOperations([operation]);
  operation.changes.title='Changed during request';
  await assert.rejects(api.saveContentOperations([update()]),e => e.code === 'SAVE_BUSY');
  assert.equal(calls,1);
  assert.equal(sent.operations[0].changes.title,'New');
  finish();
  const result = await saving;
  assert.equal(result.changes[0].data.version,9);
  assert.equal(api.makeUpdateOperation('products',result.changes[0].data,{...result.changes[0].data,desc:'Next'}).version,9);
});

test('lost response after COMMIT is checked with GET instead of a repeated POST', async () => {
  assert.equal(typeof api.saveContentOperations,'function');
  const methods=[];
  globalThis.fetch = async (_url,options) => {
    methods.push(options.method);
    if(options.method === 'POST') throw new TypeError('Response lost');
    return Response.json(snapshot({...product,version:9,title:'New'}));
  };
  const result=await api.saveContentOperations([update()]);
  assert.equal(result.reconciled,true);
  assert.deepEqual(methods,['POST','GET']);
});

test('offline result blocks new mutations until explicitly checked; creation keeps its ID', async () => {
  assert.equal(typeof api.saveContentOperations,'function');
  const creation={entity:'products',action:'create',data:{id:'new-stable-id',title:'New'}};
  let writes=0;
  globalThis.fetch=async (_url,options) => { if(options.method==='POST') writes++; throw new TypeError('Offline'); };
  await assert.rejects(api.saveContentOperations([creation]),e => e.code==='SAVE_UNCERTAIN');
  await assert.rejects(api.saveContentOperations([creation]),e => e.code==='SAVE_UNCERTAIN');
  assert.equal(writes,1);
  globalThis.fetch=async () => Response.json(snapshot(null));
  const result=await api.resolvePendingContentSave();
  assert.equal(result.outcome,'not-written');
  assert.equal(api.pendingContentSave.value,null);
});

test('mixed batch outcome cannot be claimed as saved or replayed automatically', async () => {
  assert.equal(typeof api.saveContentOperations,'function');
  globalThis.fetch=async (_url,options) => {
    if(options.method==='POST') throw new TypeError('Lost');
    return Response.json({...snapshot({...product,version:9,title:'New'}),tasks:[{id:'t',version:5,title:'Original'}]});
  };
  await assert.rejects(api.saveContentOperations([update(),{entity:'tasks',action:'update',id:'t',version:5,changes:{title:'New'}}]),e => e.code==='SAVE_DIVERGED');
  assert.equal(api.pendingContentSave.value,null);
});
test('JSON object key order does not create edits or an uncertain-result conflict', async () => {
  assert.equal(api.makeUpdateOperation('products',{id:'p',version:8,specs:{b:'2',a:'1'}},{specs:{a:'1',b:'2'}}),null);
  globalThis.fetch=async (_url,options)=>{
    if(options.method==='POST')throw new TypeError('Lost');
    return Response.json(snapshot({...product,version:9,specs:{a:'1',b:'2'}}));
  };
  const result=await api.saveContentOperations([{entity:'products',action:'update',id:'p',version:8,changes:{specs:{b:'2',a:'1'}}}]);
  assert.equal(result.reconciled,true);
});
test('reconciliation reads bypass HTTP cache', async () => {
  globalThis.fetch=async (_url,options)=>{
    if(options.method==='POST')throw new TypeError('Lost response');
    assert.equal(options.cache,'no-store');
    return Response.json(snapshot({...product,version:9,title:'New'}));
  };
  assert.equal((await api.saveContentOperations([update()])).reconciled,true);
});
