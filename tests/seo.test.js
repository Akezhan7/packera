import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, copyFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import { seoHeaders, createPublicPagesRouter } from '../server/seo.js';
import { publicPath } from '../shared/publicRoutes.js';

test('public page metadata uses the actual canonical domain and existing preview image', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /rel="canonical" href="https:\/\/packera\.kz\/"/);
  assert.match(html, /property="og:url" content="https:\/\/packera\.kz\/"/);
  const image = html.match(/property="og:image" content="https:\/\/packera\.kz\/([^"]+)"/)[1];
  assert.ok((await readFile(new URL(`../public/${decodeURIComponent(image)}`, import.meta.url))).length);
  assert.doesNotMatch(html, /https:\/\/packerra\.kz/);
});

test('SEO routing preserves storefront/admin and distinguishes missing pages from valid pages', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'pakera-seo-'));
  await copyFile(new URL('../index.html', import.meta.url), join(dir, 'index.html'));
  for (const name of ['robots.txt', '404.html']) await copyFile(new URL(`../public/${name}`, import.meta.url), join(dir, name));
  const app = express();
  app.set('trust proxy', 1);
  app.use(seoHeaders);
  app.get('/api/data', (_req, res) => res.json({ products: [] }));
  app.use(express.static(dir, { index:false }));
  const records = {
    product: { id: 'box/a', title: 'Box <script> & "large"', desc: 'Safe <b>description</b>', image: '/products/box.jpeg', isVisible: true, sizes:[{size:'large',price:250}], specs:{Warning:'</script><script>alert(1)</script>'} },
    category: { id: 'category-1', name: 'Boxes' },
    task: { id: 'move', title: 'Moving', desc: 'Moving supplies' },
  };
  app.use(createPublicPagesRouter(dir, async () => ({
    products:[records.product,{id:'hidden-marker',title:'Hidden marker',isVisible:false}].filter(Boolean), categories:[records.category], tasks:[records.task],
    banners:[], siteSettings:{}, settingVersions:{},
  }), async () => '<main>Rendered content</main>'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, headers = {}) => fetch(base + path, { redirect: 'manual', headers });
  assert.equal((await request('/')).status, 200);
  const admin = await request('/admin');
  assert.equal(admin.status, 200);
  assert.equal(admin.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.equal(admin.headers.get('cache-control'), 'no-store');
  assert.match(await admin.text(), /id="app"/);
  const data = await request('/api/data');
  assert.equal(data.status, 200);
  assert.equal(data.headers.get('x-robots-tag'), 'noindex, nofollow');
  const robots = await request('/robots.txt');
  assert.match(robots.headers.get('content-type'), /text\/plain/);
  const rules = await robots.text();
  assert.match(rules, /User-agent: \*/);
  assert.match(rules, /Allow: \/api\/data/);
  assert.doesNotMatch(rules, /Disallow: \/admin/);
  assert.match(rules, /Sitemap: https:\/\/packera.kz\/sitemap.xml/);
  const map = await request('/sitemap.xml');
  assert.equal(map.status,200);
  assert.match(map.headers.get('content-type'), /application\/xml/);
  assert.equal(map.headers.get('cache-control'),'no-store');
  assert.equal(map.headers.get('x-robots-tag'),null);
  const mapXml = await map.text();
  assert.ok(mapXml.includes('<loc>https://packera.kz/product/id-box%2Fa</loc>'));
  assert.doesNotMatch(mapXml, /hidden-marker|size=|<html/);
  for (const path of ['/missing-page', '/assets/missing.js', '/products/missing.jpeg', '/missing-sitemap.xml', '/llms.txt']) {
    const response = await request(path);
    assert.equal(response.status, 404, path);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.doesNotMatch(await response.text(), /id="app"/);
  }
  for (const kind of ['product', 'category', 'task']) {
    const path = publicPath(kind, records[kind].id);
    const response = await request(path + '?size=large');
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const html = await response.text();
    assert.ok(html.includes(`rel="canonical" href="https://packera.kz${path}"`));
    assert.match(html, /<div id="app"><main>Rendered content<\/main><\/div>/);
    const stateText = html.match(/<script id="packera-state" type="application\/json">([^<]*)<\/script>/)[1];
    const state = JSON.parse(stateText);
    assert.equal(state.url, path + '?size=large');
    assert.equal(state.catalog.products.length, 1);
    assert.equal(state.catalog.products[0].specs.Warning, '</script><script>alert(1)</script>');
    assert.doesNotMatch(stateText, /<|hidden-marker/);
    if (kind === 'product') {
      assert.match(html, /<title>Box &lt;script&gt; &amp; &quot;large&quot; — Packera.kz<\/title>/);
      assert.match(html, /name="description"\s+content="Safe &lt;b&gt;description&lt;\/b&gt;"/);
      assert.match(html, /property="og:image" content="https:\/\/packera.kz\/products\/box.jpeg"/);
      assert.doesNotMatch(html, /<script> & "large"/);
    }
    const trailing = await request(path + '/?size=large');
    assert.equal(trailing.status, 308);
    assert.equal(trailing.headers.get('location'), path + '?size=large');
    const missing = await request(publicPath(kind, 'deleted'));
    assert.equal(missing.status, 404);
  }
  const productPath = publicPath('product', records.product.id);
  const schema = JSON.parse((await (await request(productPath + '?size=large')).text()).match(/<script id="packera-structured-data" type="application\/ld\+json">([^<]*)<\/script>/)[1]);
  assert.equal(schema.find(item => item['@type'] === 'Product').offers.price, 250);
  assert.equal(schema.find(item => item['@type'] === 'Product').additionalProperty[0].value, '</script><script>alert(1)</script>');
  assert.doesNotMatch(await (await request(productPath)).text(), /hreflang=/);
  Object.assign(records.task, {titleKk:'Көшу',descKk:'Қаптама материалдары'});
  const taskPath = publicPath('task','move');
  for (const path of [taskPath, '/kk' + taskPath]) {
    const html = await (await request(path)).text();
    assert.ok(html.includes(`rel="canonical" href="https://packera.kz${path}"`));
    assert.ok(html.includes(`hreflang="ru" href="https://packera.kz${taskPath}"`));
    assert.ok(html.includes(`hreflang="kk" href="https://packera.kz/kk${taskPath}"`));
    assert.match(html, path.startsWith('/kk') ? /<html lang="kk">/ : /<html lang="ru">/);
    assert.equal((html.match(/property="og:locale"/g) || []).length,1);
    assert.match(html, path.startsWith('/kk') ? /property="og:locale" content="kk_KZ"/ : /property="og:locale" content="ru_KZ"/);
  }
  records.task.descKk = '';
  assert.equal((await request('/kk' + taskPath)).status,404);
  assert.doesNotMatch(await (await request(taskPath)).text(), /hreflang=/);
  assert.equal((await request('/kk' + productPath)).status,404);
  assert.equal((await request('/kk/')).status,404);
  const invalidSize = await request(productPath + '?size=missing&campaign=1');
  assert.equal(invalidSize.status, 307);
  assert.equal(invalidSize.headers.get('location'), productPath + '?campaign=1');
  assert.equal((await request(publicPath('product','hidden-marker'))).status, 404);
  records.product.title = 'Renamed box';
  assert.match(await (await request(productPath)).text(), /<title>Renamed box — Packera.kz<\/title>/);
  records.product.isVisible = false;
  assert.doesNotMatch(await (await request('/sitemap.xml')).text(), /product\/id-box%2Fa/);
  const hidden = await request(productPath);
  assert.equal(hidden.status, 404);
  assert.equal(hidden.headers.get('x-robots-tag'), 'noindex, nofollow');
  records.product = null;
  assert.equal((await request(productPath)).status, 404);
  for (const path of ['/product/id-%ZZ', '/catalog/id-', '/tasks/id-move/extra']) {
    assert.equal((await request(path)).status, 404, path);
  }
  for (const [path, target] of [['/index.html?a=1', '/?a=1'], ['/admin/?a=1', '/admin?a=1']]) {
    const response = await request(path);
    assert.equal(response.status, 308);
    assert.equal(response.headers.get('location'), target);
  }
  const canonical = await request('/?a=1', { 'X-Forwarded-Host': 'packera.kz', 'X-Forwarded-Proto': 'https' });
  assert.equal(canonical.status, 200);
  for (const host of ['packera.kz', 'www.packera.kz', 'packerra.kz', 'www.packerra.kz']) {
    const response = await request('/?a=1', { 'X-Forwarded-Host': host, 'X-Forwarded-Proto': 'http' });
    assert.equal(response.status, 308);
    assert.equal(response.headers.get('location'), 'https://packera.kz/?a=1');
  }
});
