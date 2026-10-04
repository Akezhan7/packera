import assert from 'node:assert/strict';
import { describe,before,after,beforeEach,test } from 'node:test';
import { startTestServer } from './helpers/test-server.js';

describe('Original data-loss regressions on addressed APIs', {concurrency:false},() => {
  let server,headers;
  before(async () => {
    server = await startTestServer();
    const user = await server.createUser('integrity-test');
    const session = await server.request('/api/auth/login',{method:'POST',body:user});
    headers = {Cookie:session.cookie.split(';')[0],'X-CSRF-Token':session.body.csrfToken};
  });
  after(async () => { if(server) await server.close(); });
  const call = (path,method,body) => server.request(path,{method,body,headers});
  const read = async () => (await server.request('/api/data')).body;
  const initialProduct = id => ({id,title:`Product ${id}`,desc:'Original description',price:100,unit:'шт',category:'Test category',visual:'box',color:'#ffffff',image:'/products/front.png',images:['/products/front.png','/products/back.png'],tasks:{move:1},sizes:[{size:'M',price:100,image:'/products/size.png',images:['/products/size.png']}],specs:{material:'cardboard'},sortOrder:0,categorySortOrder:0,isVisible:true});
  const patch = (snapshot,id,changes) => call(`/api/products/${id}`,'PATCH',{version:snapshot.products.find(p => p.id === id).version,changes});
  beforeEach(async () => {
    await server.clear(); await server.query('TRUNCATE audit_log');
    const result = await call('/api/content/batch','POST',{operations:[
      {entity:'categories',action:'create',data:{name:'Test category',icon:'box'}},
      {entity:'tasks',action:'create',data:{id:'move',title:'Move'}},
      ...['x','y'].map(id => ({entity:'products',action:'create',data:initialProduct(id)})),
      {entity:'banners',action:'create',data:{id:'banner-1',image:'/original.png'}},
    ]});
    assert.equal(result.status,200,JSON.stringify(result.body));
  });
  test('control: description photos sizes and specs persist',async () => {
    const a = await read();
    const changes = {desc:'Confirmed',images:['/new.png'],sizes:[{size:'L',price:250,image:'/large.png',images:['/large.png']}],specs:{material:'paper',thickness:'5 mm'}};
    assert.equal((await patch(a,'x',changes)).status,200);
    const row = await server.readProduct('x'); assert.equal(row.desc,'Confirmed');
    for(const field of ['images','sizes','specs']) assert.deepEqual(JSON.parse(row[field]),changes[field]);
  });
  test('editing different products preserves both users changes',async () => {
    const a = await read(); const b = await read();
    assert.equal((await patch(a,'x',{desc:'User A description'})).status,200);
    assert.equal((await patch(b,'y',{price:250})).status,200);
    assert.equal((await server.readProduct('x')).desc,'User A description');
    assert.equal((await server.readProduct('y')).price,250);
  });
  test('editing same product cannot silently overwrite a confirmed change',async () => {
    const a = await read(); const b = await read();
    await patch(a,'x',{desc:'User A description'});
    assert.equal((await patch(b,'x',{price:250})).status,409);
    assert.equal((await server.readProduct('x')).desc,'User A description');
    assert.equal((await server.readProduct('x')).price,100);
  });
  test('a stale view cannot delete a newly created product',async () => {
    const b = await read();
    assert.equal((await call('/api/products','POST',initialProduct('z'))).status,201);
    assert.equal((await patch(b,'y',{price:250})).status,200);
    assert.ok(await server.readProduct('z'));
  });
  test('a stale view cannot resurrect a deleted product',async () => {
    const b = await read();
    assert.equal((await call('/api/products/x','DELETE',{version:b.products.find(p => p.id === 'x').version})).status,200);
    assert.equal((await patch(b,'y',{price:250})).status,200);
    assert.equal(await server.readProduct('x'),undefined);
    assert.equal((await patch(b,'x',{desc:'Resurrect'})).status,404);
  });
  test('editing a banner cannot revert an already saved product',async () => {
    const a = await read(); const b = await read();
    await patch(a,'x',{desc:'User A description'});
    assert.equal((await call('/api/banners/banner-1','PATCH',{version:b.banners[0].version,changes:{image:'/updated.png'}})).status,200);
    assert.equal((await server.readProduct('x')).desc,'User A description');
  });
  test('database failure rolls back earlier writes and audit records',async () => {
    const a = await read();
    const count = (await server.query('SELECT count(*)::int AS count FROM audit_log')).rows[0].count;
    await server.query(`CREATE FUNCTION packera_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id = 'y' THEN RAISE EXCEPTION 'Test database failure'; END IF; RETURN NEW; END $$`);
    await server.query('CREATE TRIGGER packera_test_failure BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION packera_test_failure()');
    try {
      const result = await call('/api/content/batch','POST',{operations:a.products.map(p => ({entity:'products',action:'update',id:p.id,version:p.version,changes:{desc:'Must rollback'}}))});
      assert.equal(result.status,500);
      assert.equal((await server.readProduct('x')).desc,'Original description');
      assert.equal((await server.query('SELECT count(*)::int AS count FROM audit_log')).rows[0].count,count);
    } finally {
      await server.query('DROP TRIGGER packera_test_failure ON products'); await server.query('DROP FUNCTION packera_test_failure()');
    }
  });
  test('anonymous clients cannot write any addressed endpoint',async () => {
    const a = await read();
    assert.equal((await server.request('/api/products/x',{method:'PATCH',body:{version:a.products[0].version,changes:{desc:'Anonymous'}}})).status,401);
    assert.equal((await server.readProduct('x')).desc,'Original description');
  });
  test('an old full snapshot is refused without any side effects',async () => {
    const a = await read();
    a.products=[]; a.categories=[];
    assert.equal((await call('/api/save','POST',a)).status,410);
    assert.ok(await server.readProduct('x')); assert.ok(await server.readProduct('y'));
  });
});
