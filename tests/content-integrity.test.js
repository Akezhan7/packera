import assert from 'node:assert/strict';
import { describe, before, after, beforeEach, test } from 'node:test';
import { startTestServer } from './helpers/test-server.js';

describe('Addressed content writes and concurrency', { concurrency: false }, () => {
  let server, headers, actor;
  before(async () => {
    server = await startTestServer();
    actor = await server.createUser('content-test');
    const session = await server.request('/api/auth/login', { method: 'POST', body: actor });
    headers = { Cookie: session.cookie.split(';')[0], 'X-CSRF-Token': session.body.csrfToken };
  });
  after(async () => { if (server) await server.close(); });
  const call = (path, method, body) => server.request(path, { method, body, headers });
  const create = (id, extra = {}) => call('/api/products', 'POST', { id, title: id, price: 100, ...extra });
  const update = (id, version, changes) => call(`/api/products/${id}`, 'PATCH', { version, changes });
  beforeEach(async () => {
    await server.clear();
    const exists = await server.query("SELECT to_regclass('audit_log') AS name");
    if (exists.rows[0].name) await server.query('TRUNCATE audit_log');
  });

  test('public read includes entity versions without changing settings values', async () => {
    const result = await create('x');
    assert.equal(result.status, 201);
    const data = (await server.request('/api/data')).body;
    assert.equal(data.products[0].version, result.body.data.version);
  });
  test('different products preserve both changes', async () => {
    const x = await create('x'); const y = await create('y');
    assert.equal(x.status, 201); assert.equal(y.status, 201);
    assert.equal((await update('x', x.body.data.version, { desc: 'User A' })).status, 200);
    assert.equal((await update('y', y.body.data.version, { price: 250 })).status, 200);
    assert.equal((await server.readProduct('x')).desc, 'User A');
    assert.equal((await server.readProduct('y')).price, 250);
  });
  test('same version concurrent writes yield one success and one conflict', async () => {
    const original = await create('x'); assert.equal(original.status, 201);
    const results = await Promise.all([
      update('x', original.body.data.version, { desc: 'A' }),
      update('x', original.body.data.version, { desc: 'B' }),
    ]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
    const row = await server.readProduct('x');
    assert.equal(row.desc, results.find(r => r.status === 200).body.data.desc);
    assert.equal(results.find(r => r.status === 409).body.current.version, row.version);
    assert.equal((await server.query("SELECT count(*)::int AS count FROM audit_log WHERE action = 'update'")).rows[0].count, 1);
  });
  test('explicit delete requires current version and cannot resurrect on stale update', async () => {
    const original = await create('x'); assert.equal(original.status, 201);
    const changed = await update('x', original.body.data.version, { desc: 'new' });
    assert.equal((await call('/api/products/x', 'DELETE', { version: original.body.data.version })).status, 409);
    assert.equal((await call('/api/products/x', 'DELETE', { version: changed.body.data.version })).status, 200);
    assert.equal((await update('x', changed.body.data.version, { desc: 'stale' })).status, 404);
    assert.equal(await server.readProduct('x'), undefined);
  });
  test('recreated ID cannot accept the previous incarnation version', async () => {
    const first = await create('x'); assert.equal(first.status, 201);
    await call('/api/products/x', 'DELETE', { version: first.body.data.version });
    const next = await create('x'); assert.equal(next.status, 201);
    assert.notEqual(next.body.data.version, first.body.data.version);
    assert.equal((await update('x', first.body.data.version, { desc: 'stale' })).status, 409);
  });
  test('unknown fields and invalid price/JSON are rejected without writes', async () => {
    const original = await create('x'); assert.equal(original.status, 201);
    for (const changes of [{ price: '250' }, { price: -1 }, { images: 'not-array' }, { tasks: { move: 9 } }, { version: 100 }, { password_hash: 'injected' }]) {
      assert.equal((await update('x', original.body.data.version, changes)).status, 400);
    }
    assert.equal((await server.readProduct('x')).version, original.body.data.version);
  });
  test('batch conflict rolls back earlier product updates and their history', async () => {
    const x = await create('x'); const y = await create('y'); assert.equal(x.status, 201); assert.equal(y.status, 201);
    await update('y', y.body.data.version, { price: 150 });
    const result = await call('/api/content/batch', 'POST', { operations: [
      { entity: 'products', action: 'update', id: 'x', version: x.body.data.version, changes: { desc: 'rollback' } },
      { entity: 'products', action: 'update', id: 'y', version: y.body.data.version, changes: { price: 999 } },
    ] });
    assert.equal(result.status, 409);
    assert.equal((await server.readProduct('x')).desc, '');
    assert.equal((await server.readProduct('y')).price, 150);
    assert.equal((await server.query("SELECT count(*)::int AS count FROM audit_log WHERE action = 'update'")).rows[0].count, 1);
  });
  test('category rename changes only relationships and bumps product versions', async () => {
    const category = await call('/api/categories', 'POST', { name: 'Old', icon: 'box' }); assert.equal(category.status, 201);
    const x = await create('x', { category: 'Old', desc: 'Keep me' }); assert.equal(x.status, 201);
    const result = await call(`/api/categories/${category.body.data.id}`, 'PATCH', { version: category.body.data.version, changes: { name: 'New' } });
    assert.equal(result.status, 200);
    const row = await server.readProduct('x');
    assert.equal(row.category, 'New'); assert.equal(row.desc, 'Keep me');
    assert.notEqual(row.version, x.body.data.version);
    assert.equal((await update('x', x.body.data.version, { category: 'Old' })).status, 409);
    assert.equal((await update('x', row.version, { category: 'Old' })).status, 400);
  });
  test('deleting a task removes references without overwriting other fields', async () => {
    const task = await call('/api/tasks', 'POST', { id: 'move', title: 'Move' }); assert.equal(task.status, 201);
    const x = await create('x', { tasks: { move: 1 }, desc: 'Keep' }); assert.equal(x.status, 201);
    const result = await call('/api/tasks/move', 'DELETE', { version: task.body.data.version }); assert.equal(result.status, 200);
    const row = await server.readProduct('x'); assert.equal(row.desc, 'Keep'); assert.deepEqual(JSON.parse(row.tasks), {});
    assert.notEqual(row.version, x.body.data.version);
  });
  test('banner save cannot revert a product and settings are versioned per key', async () => {
    const x = await create('x'); assert.equal(x.status, 201);
    const banner = await call('/api/banners', 'POST', { id: 'b', image: '/a.png' }); assert.equal(banner.status, 201);
    await update('x', x.body.data.version, { desc: 'Keep' });
    assert.equal((await call('/api/banners/b', 'PATCH', { version: banner.body.data.version, changes: { image: '/b.png' } })).status, 200);
    assert.equal((await server.readProduct('x')).desc, 'Keep');
    await server.query("INSERT INTO site_settings (key,value) VALUES ('installmentEnabled','true')");
    const data = (await server.request('/api/data')).body;
    assert.equal(data.siteSettings.installmentEnabled, true);
    const body = { key: 'installmentEnabled', version: data.settingVersions.installmentEnabled, changes: { value: false } };
    assert.equal((await call('/api/settings', 'PATCH', body)).status, 200);
    assert.equal((await call('/api/settings', 'PATCH', body)).status, 409);
  });
  test('legacy snapshots and reset cannot bypass version checks', async () => {
    const x = await create('x'); assert.equal(x.status, 201);
    assert.equal((await call('/api/save', 'POST', { products: [], categories: [] })).status, 410);
    assert.equal((await call('/api/reset', 'POST', {})).status, 410);
    assert.ok(await server.readProduct('x'));
  });
  test('audit contains actor and field diff and restricts editor access', async () => {
    const x = await create('x'); assert.equal(x.status, 201);
    await update('x', x.body.data.version, { price: 250 });
    const result = await call('/api/audit?entity=products&id=x&limit=1', 'GET');
    assert.equal(result.status, 200); assert.equal(result.body.total, 2);
    assert.equal(result.body.items[0].actor_id, actor.id);
    assert.deepEqual(result.body.items[0].changes.price, { before: 100, after: 250 });
    const editor = await server.createUser('audit-editor', 'editor');
    const session = await server.request('/api/auth/login', { method: 'POST', body: editor });
    assert.equal((await server.request('/api/audit', { headers: { Cookie: session.cookie.split(';')[0] } })).status, 403);
  });

  test('malformed UUIDs and oversized versions are clean validation errors',async () => {
    assert.equal((await call('/api/categories/' + '-'.repeat(36),'PATCH',{version:1,changes:{name:'Bad'}})).status,400);
    const x = await create('x'); assert.equal(x.status,201);
    assert.equal((await update('x',2147483648,{price:1})).status,400);
    assert.equal((await call('/api/audit?actor=' + '-'.repeat(36),'GET')).status,400);
  });
  test('duplicate create and duplicate batch operations never overwrite a row',async () => {
    const x = await create('x'); assert.equal(x.status,201);
    assert.equal((await create('x',{desc:'Overwrite'})).status,409);
    const operation = {entity:'products',action:'update',id:'x',version:x.body.data.version,changes:{price:1}};
    assert.equal((await call('/api/content/batch','POST',{operations:[operation,operation]})).status,400);
    assert.equal((await server.readProduct('x')).price,100);
  });
  test('category deletion clears links and stale product cannot restore them',async () => {
    const category = await call('/api/categories','POST',{name:'Old'}); assert.equal(category.status,201);
    const x = await create('x',{category:'Old'}); assert.equal(x.status,201);
    const removed = await call('/api/categories/' + category.body.data.id,'DELETE',{version:category.body.data.version});
    assert.equal(removed.status,200); assert.equal(removed.body.changes.length,2);
    assert.equal((await server.readProduct('x')).category,'');
    assert.equal((await update('x',x.body.data.version,{category:'Old'})).status,409);
  });
  test('all entity types reject stale update and delete',async () => {
    for (const [entity,data] of [['categories',{name:'Category'}],['tasks',{id:'task-test',title:'Task'}],['banners',{id:'banner-test',image:'/a.png'}]]) {
      const first = await call('/api/' + entity,'POST',data); assert.equal(first.status,201);
      const field = entity === 'categories' ? 'icon' : entity === 'tasks' ? 'desc' : 'image';
      const path = '/api/' + entity + '/' + first.body.data.id;
      assert.equal((await call(path,'PATCH',{version:first.body.data.version,changes:{[field]:'Changed'}})).status,200);
      assert.equal((await call(path,'PATCH',{version:first.body.data.version,changes:{[field]:'Stale'}})).status,409);
      assert.equal((await call(path,'DELETE',{version:first.body.data.version})).status,409);
    }
  });
  test('batch sorting changes only intended fields and audit filters paginate',async () => {
    const x = await create('x',{desc:'Keep'}); assert.equal(x.status,201);
    const y = await create('y'); assert.equal(y.status,201);
    assert.equal((await call('/api/content/batch','POST',{operations:[
      {entity:'products',action:'update',id:'x',version:x.body.data.version,changes:{sortOrder:2}},
      {entity:'products',action:'update',id:'y',version:y.body.data.version,changes:{sortOrder:1}},
    ]})).status,200);
    assert.equal((await server.readProduct('x')).desc,'Keep');
    const result = await call('/api/audit?actor=' + actor.id + '&from=2020-01-01&to=2100-01-01&limit=2&offset=2','GET');
    assert.equal(result.status,200); assert.equal(result.body.total,4); assert.equal(result.body.items.length,2);
    assert.equal((await call('/api/audit?limit=1000','GET')).status,400);
  });

  test('deleted tasks are not silently restored by server restart',async () => {
    const task = await call('/api/tasks','POST',{id:'last-task',title:'Last'}); assert.equal(task.status,201);
    assert.equal((await call('/api/tasks/last-task','DELETE',{version:task.body.data.version})).status,200);
    await server.restart();
    assert.equal((await server.query('SELECT count(*)::int AS count FROM tasks')).rows[0].count,0);
  });
  test('two personal accounts compete by version and audit names the actual winner',async () => {
    const x = await create('x'); assert.equal(x.status,201);
    const editor = await server.createUser('concurrent-editor','editor');
    const session = await server.request('/api/auth/login',{method:'POST',body:editor});
    const otherHeaders = {Cookie:session.cookie.split(';')[0],'X-CSRF-Token':session.body.csrfToken};
    const results = await Promise.all([
      update('x',x.body.data.version,{desc:'admin'}),
      server.request('/api/products/x',{method:'PATCH',body:{version:x.body.data.version,changes:{desc:'editor'}},headers:otherHeaders}),
    ]);
    assert.deepEqual(results.map(r => r.status).sort(),[200,409]);
    const row = await server.readProduct('x');
    assert.equal(row.updated_by,row.desc === 'admin' ? actor.id : editor.id);
    const audit = await server.query("SELECT actor_id FROM audit_log WHERE action='update' ORDER BY id DESC LIMIT 1");
    assert.equal(audit.rows[0].actor_id,row.updated_by);
  });
});
