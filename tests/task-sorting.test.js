import { makeUpdateOperation } from '../src/adminApi.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareTaskProducts, makeTaskSortOperations } from '../src/taskSorting.js';

test('sorting one task and moving zones never changes another task or category', () => {
  const products=[
    {id:'a',version:1,sortOrder:7,categorySortOrder:9,tasks:{repair:1,cleaning:1},taskSortOrders:{repair:0,cleaning:0}},
    {id:'b',version:2,sortOrder:8,categorySortOrder:10,tasks:{repair:1,cleaning:1},taskSortOrders:{repair:1,cleaning:1}}
  ];
  const order=id=>[...products].sort((a,b)=>compareTaskProducts(a,b,id)).map(p=>p.id);
  const apply=operations=>operations.filter(Boolean).forEach(op=>Object.assign(products.find(p=>p.id===op.id),op.changes));
  apply(makeTaskSortOperations({1:[products[1],products[0]],2:[],3:[]},'repair'));
  assert.deepEqual(order('repair'),['b','a']);
  assert.deepEqual(order('cleaning'),['a','b']);
  apply(makeTaskSortOperations({1:[products[1]],2:[products[0]],3:[]},'repair'));
  assert.equal(products[0].tasks.repair,2);assert.equal(products[0].tasks.cleaning,1);
  assert.deepEqual(order('cleaning'),['a','b']);
  apply(makeTaskSortOperations({1:[products[1],products[0]],2:[],3:[]},'cleaning'));
  assert.equal(products[0].tasks.repair,2);
  assert.deepEqual(products.map(p=>p.sortOrder),[7,8]);
  assert.deepEqual(products.map(p=>p.categorySortOrder),[9,10]);
});

test('newly assigned task has stable ordering without sharing global sortOrder', () => {
  const a={id:'a',sortOrder:100,taskSortOrders:{}};
  const b={id:'b',sortOrder:0,taskSortOrders:{}};
  assert.ok(compareTaskProducts(a,b,'move')<0);
});


test('current product editor preserves per-task ranks while changing global order and membership', () => {
  const original={id:'p',version:3,sortOrder:4,tasks:{move:1,repair:2},taskSortOrders:{move:5,repair:6}};
  const operation=makeUpdateOperation('products',original,{sortOrder:8,tasks:{move:1}});
  assert.deepEqual(operation.changes,{sortOrder:8,tasks:{move:1},taskSortOrders:{move:5}});
});
