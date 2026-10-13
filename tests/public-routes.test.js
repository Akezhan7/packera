import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publicPath, parsePublicRoute, publicRecord, isPlainNavigation, pageMetadata, hasKazakhPage, pageAlternates } from '../shared/publicRoutes.js';

test('stable public URLs encode IDs and product variants without changing their values', () => {
  for (const kind of ['product', 'category', 'task']) {
    for (const id of ['box-1', '.', '..', 'коробка/большая?x=1', 'box #1']) {
      const path = publicPath(kind, id, '50 × 40 / белый & ?');
      const url = new URL(path, 'https://packera.kz');
      const route = parsePublicRoute(url.pathname + url.search);
      assert.equal(route.kind, kind);
      assert.equal(route.id, id);
      assert.equal(route.size, kind === 'product' ? '50 × 40 / белый & ?' : '');
      assert.equal(parsePublicRoute(url.pathname + '/').id, id);
    }
  }
  assert.deepEqual(parsePublicRoute('/?campaign=1'), { kind: 'home' });
  assert.deepEqual(parsePublicRoute('/admin'), { kind: 'admin' });
  for (const path of ['/product/box-1', '/product/id-%FF', '/product/id-%00', '/product/id-', '/product/id-box/extra', '/other/id-box', '/product/id-' + 'x'.repeat(201)]) {
    assert.equal(parsePublicRoute(path).kind, 'missing', path);
  }
  assert.throws(() => publicPath('product', ''), TypeError);
});

test('public records exclude hidden/deleted products and keep URLs stable after renaming', () => {
  const catalog = { products: [{ id: 'box-1', title: 'Box' }, { id: 'hidden', isVisible: false }], categories: [{ id: 'c1', name: 'Boxes' }], tasks: [{ id: 'move', title: 'Moving' }] };
  for (const [kind, id] of [['product', 'box-1'], ['category', 'c1'], ['task', 'move']]) {
    const route = parsePublicRoute(publicPath(kind, id));
    const record = publicRecord(route, catalog);
    assert.equal(record.id, id);
    const before = pageMetadata(route, record);
    if (kind === 'category') record.name = 'Renamed';
    else record.title = 'Renamed';
    const after = pageMetadata(route, record);
    assert.equal(after.url, before.url);
    assert.notEqual(after.title, before.title);
    assert.ok(after.title.includes('Renamed'));
  }
  assert.equal(publicRecord({ kind: 'product', id: 'hidden' }, catalog), null);
  assert.equal(publicRecord({ kind: 'product', id: 'deleted' }, catalog), null);
  const record = catalog.products[0];
  assert.equal(pageMetadata({ kind: 'product', size: 'large' }, record).url, 'https://packera.kz/product/id-box-1');
  assert.equal(pageMetadata({ kind: 'product' }, { ...record, image: 'javascript:alert(1)' }).image, 'https://packera.kz/Artboard%201.png');
});

test('link interception preserves modified clicks and already handled events', () => {
  assert.equal(isPlainNavigation({ button: 0 }), true);
  for (const modifier of ['ctrlKey', 'metaKey', 'shiftKey', 'altKey', 'defaultPrevented']) {
    assert.equal(isPlainNavigation({ button: 0, [modifier]: true }), false);
  }
  assert.equal(isPlainNavigation({ button: 1 }), false);
});

test('language alternatives require existing translations and never expose untranslated product/category pages', () => {
  const task = {id:'move',title:'Moving',desc:'Supplies',titleKk:'Көшу',descKk:'Қаптама'};
  const catalog = {tasks:[task],products:[{id:'box',title:'Box'}],categories:[{id:'c1',name:'Boxes'}],siteSettings:{hero:{titleKk:'Қаптама',description:'Supplies',descriptionKk:'Тауарлар',actionType:'none'}}};
  const path = publicPath('task','move','','kk');
  assert.equal(path, '/kk/tasks/id-move');
  const route = parsePublicRoute(path);
  assert.equal(route.lang, 'kk');
  assert.equal(publicRecord(route,catalog), task);
  assert.equal(pageMetadata(route,task).title, 'Көшу — Packera.kz');
  assert.deepEqual(pageAlternates(route,task,catalog).map(item => item.url), ['https://packera.kz/tasks/id-move','https://packera.kz/kk/tasks/id-move','https://packera.kz/tasks/id-move']);
  assert.equal(hasKazakhPage({kind:'home'},null,catalog), true);
  for (const kind of ['product','category']) {
    const record = catalog[kind === 'product' ? 'products' : 'categories'][0];
    assert.equal(publicRecord(parsePublicRoute(publicPath(kind,record.id,'','kk')),catalog), null);
    assert.deepEqual(pageAlternates({kind},record,catalog), []);
  }
  task.descKk = '';
  assert.equal(publicRecord(route,catalog), null);
  assert.deepEqual(pageAlternates({kind:'task'},task,catalog), []);
  assert.equal(parsePublicRoute('/kk/admin').kind, 'missing');
});
