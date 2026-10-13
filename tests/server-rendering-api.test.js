import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startTestServer } from './helpers/test-server.js';
import { publicPath } from '../shared/publicRoutes.js';

// Run after npm run build: checks the production SSR bundle against real writes.
test('SSR immediately reflects addressed admin saves and excludes hidden products', async t => {
  const server = await startTestServer();
  t.after(() => server.close());
  const user = await server.createUser('ssr-test');
  const session = await server.request('/api/auth/login', {method:'POST',body:user});
  const headers = {Cookie:session.cookie.split(';')[0], 'X-CSRF-Token':session.body.csrfToken};
  const write = (path, method, body) => server.request(path, {method,body,headers});
  const category = await write('/api/categories','POST',{name:'SSR boxes'});
  assert.equal(category.status,201);
  const task = await write('/api/tasks','POST',{id:'ssr-move',title:'SSR move'});
  assert.equal(task.status,201);
  const created = await write('/api/products','POST',{
    id:'ssr-box',title:'SSR box',category:'SSR boxes',price:100, tasks:{'ssr-move':1},
    sizes:[{size:'Large',price:250}],specs:{Material:'Cardboard'},
  });
  assert.equal(created.status,201,JSON.stringify(created.body));
  const sitemap = () => server.request('/sitemap.xml');
  assert.match((await sitemap()).body, /<loc>https:\/\/packera.kz\/product\/id-ssr-box<\/loc>/);
  const path = publicPath('product','ssr-box','Large');
  const first = await server.request(path);
  assert.equal(first.status,200);
  assert.match(first.body, /<h1[^>]*>SSR box<\/h1>/);
  assert.match(first.body, /product-price[^>]*>250 ₸/);
  assert.match(first.body, /Cardboard/);
  const getSchema = html => JSON.parse(html.match(/<script id="packera-structured-data" type="application\/ld\+json">([^<]*)<\/script>/)[1]).find(item => item['@type'] === 'Product');
  assert.equal(getSchema(first.body).offers.price,250);
  const updated = await write('/api/products/ssr-box','PATCH',{
    version:created.body.data.version,changes:{title:'Updated SSR box',sizes:[{size:'Large',price:350}]},
  });
  assert.equal(updated.status,200,JSON.stringify(updated.body));
  const next = await server.request(path);
  assert.match(next.body, /<h1[^>]*>Updated SSR box<\/h1>/);
  assert.match(next.body, /product-price[^>]*>350 ₸/);
  assert.equal(getSchema(next.body).offers.price,350);
  assert.equal(getSchema(next.body).name,'Updated SSR box');
  const api = (await server.request('/api/data')).body;
  const state = JSON.parse(next.body.match(/<script id="packera-state" type="application\/json">([^<]*)<\/script>/)[1]);
  assert.deepEqual(state.catalog.products[0], api.products[0]);
  assert.match((await server.request(publicPath('category',category.body.data.id))).body, /href="\/product\/id-ssr-box"/);
  assert.match((await server.request(publicPath('task','ssr-move'))).body, /href="\/product\/id-ssr-box"/);
  const hidden = await write('/api/products/ssr-box','PATCH',{version:updated.body.data.version,changes:{isVisible:false}});
  assert.equal(hidden.status,200);
  assert.doesNotMatch((await sitemap()).body, /product\/id-ssr-box/);
  assert.equal((await server.request(path)).status,404);
  assert.doesNotMatch((await server.request('/')).body, /Updated SSR box/);
  const deleted = await write('/api/products/ssr-box','DELETE',{version:hidden.body.data.version});
  assert.equal(deleted.status,200);
  const deletedTask = await write('/api/tasks/ssr-move','DELETE',{version:task.body.data.version});
  assert.equal(deletedTask.status,200);
  assert.doesNotMatch((await sitemap()).body, /tasks\/id-ssr-move/);
  assert.equal((await server.request(path)).status,404);
});
