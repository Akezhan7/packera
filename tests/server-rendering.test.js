import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'vite';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { publicPath } from '../shared/publicRoutes.js';

const snapshot = () => ({
  products: [{ id:'box', title:'Moving box', desc:'Strong box', category:'Boxes', image:'/products/cover.jpeg', images:['/products/details.jpeg'], specs:{ Material:'Cardboard' }, price:100, unit:'pc', tasks:{move:1}, sizes:[{size:'Small',price:100,image:'/products/small.jpeg'},{size:'Large',price:250,image:'/products/large.jpeg'}] }],
  categories:[{id:'c1',name:'Boxes',sortOrder:0}], tasks:[{id:'move',title:'Moving',desc:'Moving supplies',icon:'truck'}], banners:[],
  siteSettings:{installmentEnabled:true}, settingVersions:{},
});

test('real Vue SSR renders public content, correct variant prices and request-isolated state', async t => {
  const vite = await createServer({ server:{ middlewareMode:true, hmr:false }, appType:'custom' });
  t.after(() => vite.close());
  const { render } = await vite.ssrLoadModule('/src/entry-server.js');
  const product = await render(publicPath('product','box'), snapshot(), 1000);
  assert.match(product, /<h1[^>]*>Moving box<\/h1>/);
  assert.match(product, /Cardboard/);
  assert.match(product, /product-price[^>]*>100 ₸/);
  assert.match(product, /src="\/products\/cover.jpeg"/);
  assert.doesNotMatch(product, /src="\/products\/(?:small|large).jpeg"/);
  const large = await render(publicPath('product','box','Large'), snapshot(), 1000);
  assert.match(large, /product-price[^>]*>250 ₸/);
  assert.match(large, /src="\/products\/large.jpeg"/);
  assert.doesNotMatch(large, /src="\/products\/small.jpeg"/);
  const category = await render(publicPath('category','c1'), snapshot(), 1000);
  assert.match(category, /href="\/product\/id-box"/);
  const home = await render('/', snapshot(), 1000);
  assert.match(home, /href="\/catalog\/id-c1"/);
  assert.match(home, /href="\/tasks\/id-move"/);
  assert.match(await render(publicPath('task','move'), snapshot(), 1000), /href="\/product\/id-box"/);
  const changed = snapshot();
  changed.products[0].title = 'Different box';
  changed.products[0].sizes[0].price = 999;
  const [first, second] = await Promise.all([render(publicPath('product','box'), snapshot(), 1000), render(publicPath('product','box'), changed, 1000)]);
  assert.match(first, /product-price[^>]*>100 ₸/);
  assert.doesNotMatch(first, /Different box|999 ₸/);
  assert.match(second, /Different box/);
  assert.match(second, /product-price[^>]*>999 ₸/);
  assert.equal(changed.products[0].sizes[0].price, 999);
  const bilingual = snapshot();
  Object.assign(bilingual.tasks[0], {titleKk:'Көшу',descKk:'Қаптама материалдары'});
  bilingual.siteSettings.hero = {title:'Moving supplies',titleKk:'Көшуге арналған қаптама',description:'Supplies',descriptionKk:'Үйге арналған',image:'/hero.jpg',actionType:'none'};
  const [ru, kk] = await Promise.all([render('/tasks/id-move',bilingual,1000),render('/kk/tasks/id-move',bilingual,1000)]);
  assert.match(ru, /<h1[^>]*>Moving<\/h1>/);
  assert.match(kk, /<h1[^>]*>Көшу<\/h1>/);
  assert.match(kk, /Қаптама материалдары/);
  assert.match(kk, /href="\/kk\/"/);
  assert.match(kk, /href="\/tasks\/id-move"[^>]*>\s*RU/);
  const kkHome = await render('/kk/',bilingual,1000);
  assert.match(kkHome, /<h1[^>]*>Көшуге және жөндеуге арналған қаптама материалдары<\/h1>/);
  assert.equal((kkHome.match(/<h1\b/g) || []).length, 1);
  assert.doesNotMatch(kkHome, /main-banner-copy/);
  assert.match(kkHome, /href="\/kk\/tasks\/id-move"/);
  assert.match(kkHome, /href="\/product\/id-box"/);
  assert.doesNotMatch(kkHome, /href="\/kk\/(?:product|catalog)\//);
  assert.match(home, /\+7 701 162 3491/);
  assert.match(home, /href="tel:\+77011623491"/);
  assert.match(home, /href="https:\/\/wa.me\/77011623491"/);
  assert.match(home, /Ратушного, 78в/);
  assert.match(home, /Вторник — воскресенье/);
  assert.match(home, /Доставка по всему Казахстану/);
  assert.match(home, /70\s000 ₸/);
  assert.match(home, /Рассрочка: Kaspi, Halyk, Forte/);
  assert.match(kkHome, /Сейсенбі — жексенбі/);
  assert.match(kkHome, /Қазақстан бойынша жеткізу/);
  assert.doesNotMatch(home, /77079440055|707 944 00 55|944 00 77|Кабдолова|Алатауский район|9:00 - 21:00/);

  const data = await vite.ssrLoadModule('/src/data.js');
  const previousProducts = [...data.products];
  const {default:CartDrawer} = await vite.ssrLoadModule('/src/components/CartDrawer.vue');
  try {
    data.products.splice(0,data.products.length,{id:'shipping-test',title:'Box',price:69999,sizes:[]});
    const cart = new Map([['shipping-test::',1]]);
    const below = await renderToString(createSSRApp(CartDrawer,{isOpen:true,cart}));
    assert.match(below, /До бесплатной доставки по Алматы осталось 1 ₸/);
    data.products[0].price = 70000;
    const threshold = await renderToString(createSSRApp(CartDrawer,{isOpen:true,cart}));
    assert.match(threshold, /Доставка по Алматы за наш счет/);
    assert.doesNotMatch(threshold, /До бесплатной доставки/);
  } finally { data.products.splice(0,data.products.length,...previousProducts); }
});
