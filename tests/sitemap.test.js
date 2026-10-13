import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSitemap } from '../server/sitemap.js';

const snapshot = () => ({
  products:[{id:"box'&",isVisible:true},{id:'hidden',isVisible:false}],
  categories:[{id:'boxes',name:'Boxes'}],
  tasks:[{id:'move',title:'Moving',desc:'Supplies',titleKk:'Көшу',descKk:'Қаптама'},{id:'repair',title:'Repair',desc:'Supplies',titleKk:'Жөндеу',descKk:''}],
  siteSettings:{hero:{title:'Supplies',titleKk:'Қаптама',description:'Supplies',descriptionKk:'Тауарлар',actionType:'none'}},
});
const locations = xml => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);

test('sitemap lists only canonical published routes and reciprocal existing language alternatives', () => {
  const xml = buildSitemap(snapshot());
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.match(xml, /xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9"/);
  assert.match(xml, /xmlns:xhtml="http:\/\/www.w3.org\/1999\/xhtml"/);
  assert.deepEqual(locations(xml), [
    'https://packera.kz/','https://packera.kz/kk/',
    'https://packera.kz/product/id-box&apos;%26','https://packera.kz/catalog/id-boxes',
    'https://packera.kz/tasks/id-move','https://packera.kz/kk/tasks/id-move','https://packera.kz/tasks/id-repair',
  ]);
  assert.equal((xml.match(/hreflang="kk" href="https:\/\/packera.kz\/kk\/tasks\/id-move"/g) || []).length,2);
  assert.equal((xml.match(/hreflang="ru" href="https:\/\/packera.kz\/tasks\/id-move"/g) || []).length,2);
  assert.doesNotMatch(xml, /hidden|\/kk\/(?:product|catalog)|\/kk\/tasks\/id-repair|localhost|lastmod|changefreq|priority|\/admin|\/api/);
  assert.doesNotMatch(locations(xml).join('\n'), /\?/);
});

test('each sitemap reflects publication, deletion and translation edits without fabricated timestamps', () => {
  const catalog = snapshot();
  const initial = buildSitemap(catalog);
  catalog.products[0].title = 'Renamed';
  assert.equal(buildSitemap(catalog),initial);
  catalog.products[0].isVisible = false;
  catalog.products.push({id:'new',isVisible:true});
  catalog.categories = [];
  catalog.tasks[0].descKk = '';
  catalog.siteSettings.hero.titleKk = '';
  const next = buildSitemap(catalog);
  assert.deepEqual(locations(next), ['https://packera.kz/','https://packera.kz/product/id-new','https://packera.kz/tasks/id-move','https://packera.kz/tasks/id-repair']);
  assert.doesNotMatch(next, /xhtml:link|id-boxes|id-box&apos;|lastmod/);
});
