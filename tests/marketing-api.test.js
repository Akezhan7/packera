import assert from 'node:assert/strict';
import { describe, before, after, test } from 'node:test';
import { startTestServer } from './helpers/test-server.js';
import { migrateIntegrity } from '../server/content.js';

describe('Marketing settings and addressed writes', {concurrency:false}, () => {
  let server, headers, category, task, product;
  before(async () => {
    server = await startTestServer();
    const actor = await server.createUser('marketing-test');
    const session = await server.request('/api/auth/login', {method:'POST',body:actor});
    headers = {Cookie:session.cookie.split(';')[0],'X-CSRF-Token':session.body.csrfToken};
    category = (await call('/api/categories','POST',{name:'Boxes'})).body.data;
    const createdTask = await call('/api/tasks','POST',{id:'move-test',title:'Move',desktopImage:'/wide.jpg',mobileImage:'/square.jpg'});
    assert.equal(createdTask.status,201,JSON.stringify(createdTask.body));
    task = createdTask.body.data;
    product = (await call('/api/products','POST',{id:'box-test',title:'Box',price:500,category:'Boxes',sizes:[{size:'S',price:400,image:'/s.jpg'}]})).body.data;
  });
  after(async () => { if(server) await server.close(); });
  const call = (path,method,body) => server.request(path,{method,body,headers});
  const createBanner = extra => call('/api/banners','POST',{image:'/promo.jpg',mobileImage:'/promo-mobile.jpg',...extra});

  test('all actions persist through the public API with translations and scheduling', async () => {
    for(const [actionType,actionTarget] of [['none',''],['category',category.id],['task',task.id],['product',product.id],['link','https://example.com/promo'],['info','']]) {
      const response = await createBanner({actionType,actionTarget,title:'Акция',titleKk:'Науқан',description:'Условия',descriptionKk:'Шарттар',startsAt:'2026-10-09T10:00:00Z',endsAt:'2027-10-09T10:00:00Z'});
      assert.equal(response.status,201,JSON.stringify(response.body));
      const read = (await server.request('/api/data')).body.banners.find(b=>b.id===response.body.data.id);
      assert.equal(read.actionTarget,actionTarget);
      assert.equal(read.mobileImage,'/promo-mobile.jpg');
      assert.equal(read.titleKk,'Науқан');
    }
  });
  test('invalid or partial action changes are rejected atomically', async () => {
    const response=await createBanner({actionType:'none'});
    assert.equal(response.status,201);
    const banner=response.body.data;
    for(const changes of [{actionType:'link',actionTarget:'javascript:alert(1)'},{actionType:'product',actionTarget:'missing'},{actionType:'category',actionTarget:'missing'},{actionType:'info'},{startsAt:'2027-01-01T00:00:00Z',endsAt:'2026-01-01T00:00:00Z'}]) {
      assert.equal((await call(`/api/banners/${banner.id}`,'PATCH',{version:banner.version,changes})).status,400);
    }
    const row=(await server.request('/api/data')).body.banners.find(b=>b.id===banner.id);
    assert.equal(row.version,banner.version);
    assert.equal(row.actionType,'none');
  });
  test('hero is editable independently and settings retain version conflict protection', async () => {
    const snapshot=(await server.request('/api/data')).body;
    assert.equal(typeof snapshot.siteSettings.hero,'object');
    const hero={...snapshot.siteSettings.hero,title:'Всё для упаковки',titleKk:'Қаптауға арналған барлық заттар',image:'/hero.jpg',mobileImage:'/hero-mobile.jpg',actionType:'category',actionTarget:category.id};
    const result=await call('/api/settings','PATCH',{key:'hero',version:snapshot.settingVersions.hero,changes:{value:hero}});
    assert.equal(result.status,200,JSON.stringify(result.body));
    assert.deepEqual(result.body.data.value,hero);
    assert.equal((await call('/api/settings','PATCH',{key:'hero',version:snapshot.settingVersions.hero,changes:{value:hero}})).status,409);
    const next=(await server.request('/api/data')).body;
    assert.deepEqual(next.banners,snapshot.banners);
    assert.deepEqual(next.products,snapshot.products);
    assert.equal(next.siteSettings.installmentEnabled,snapshot.siteSettings.installmentEnabled);
    assert.equal(next.tasks.find(t=>t.id===task.id).desktopImage,'/wide.jpg');
    await migrateIntegrity(server.pool);
    assert.deepEqual((await server.request('/api/data')).body.siteSettings.hero,hero);
  });
  test('deleting a banner destination clears the action and leaves commercial data intact', async () => {
    const temporary=(await call('/api/tasks','POST',{id:'temporary',title:'Temporary'})).body.data;
    const banner=(await createBanner({actionType:'task',actionTarget:temporary.id})).body.data;
    const result=await call(`/api/tasks/${temporary.id}`,'DELETE',{version:temporary.version});
    assert.equal(result.status,200);
    const snapshot=(await server.request('/api/data')).body;
    const cleared=snapshot.banners.find(b=>b.id===banner.id);
    assert.equal(cleared.actionType,'none');
    assert.equal(cleared.actionTarget,'');
    assert.deepEqual(snapshot.products.find(p=>p.id===product.id),product);
  });
});
