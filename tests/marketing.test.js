import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as marketing from '../shared/marketing.js';

test('publication window uses absolute time and excludes end boundary', () => {
  const now = Date.parse('2026-10-09T10:00:00Z');
  const base = {isActive:true,sortOrder:0};
  const input = [
    {...base,id:'off',isActive:false},
    {...base,id:'future',startsAt:'2026-10-09T16:00:00+05:00'},
    {...base,id:'ended',endsAt:'2026-10-09T15:00:00+05:00'},
    {...base,id:'second',sortOrder:2},
    {...base,id:'first',startsAt:'2026-10-09T15:00:00+05:00'},
  ];
  assert.deepEqual(marketing.getActiveBanners(input, now).map(b=>b.id), ['first','second']);
  assert.equal(input[0].id, 'off');
});
test('banner links accept internal paths and HTTP URLs, reject executable schemes', () => {
  for (const value of ['/catalog#boxes', '#tasks-wizard-section', 'https://example.com/promo', 'http://example.com']) assert.equal(marketing.isSafeLink(value),true,value);
  for (const value of ['javascript:alert(1)', 'data:text/html,x', '//example.com', '/\\evil.com', '', ' https://example.com', 'https://']) assert.equal(marketing.isSafeLink(value),false,value);
});
test('banner validation rejects unsafe links, missing targets and reversed dates', () => {
  const base = {image:'/banner.jpg',actionType:'none',actionTarget:'',startsAt:'',endsAt:''};
  assert.equal(marketing.validateMarketingRecord(base), '');
  assert.ok(marketing.validateMarketingRecord({...base,actionType:'link',actionTarget:'javascript:alert(1)'}));
  assert.ok(marketing.validateMarketingRecord({...base,actionType:'product'}));
  assert.ok(marketing.validateMarketingRecord({...base,startsAt:'2026-10-10T00:00:00Z',endsAt:'2026-10-09T00:00:00Z'}));
  assert.ok(marketing.validateMarketingRecord({...base,startsAt:'2026-10-09T15:00'}));
});
test('information action requires content in both languages', () => {
  const base = {image:'/banner.jpg',actionType:'info',title:'Акция',description:'Условия'};
  assert.ok(marketing.validateMarketingRecord(base));
  assert.equal(marketing.validateMarketingRecord({...base,titleKk:'Науқан',descriptionKk:'Шарттар'}), '');
});
test('optional banner copy still requires both translations when provided', () => {
  assert.ok(marketing.validateMarketingRecord({image:'/banner.jpg',title:'Акция',actionType:'none'}));
  assert.equal(marketing.validateMarketingRecord({image:'/banner.jpg',title:'Акция',titleKk:'Науқан',actionType:'none'}), '');
});
