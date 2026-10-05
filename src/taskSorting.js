import { makeUpdateOperation } from './adminApi.js';

export function compareTaskProducts(a,b,taskId) {
  return (Number(a.taskSortOrders?.[taskId]) || 0) - (Number(b.taskSortOrders?.[taskId]) || 0)
    || String(a.id).localeCompare(String(b.id));
}

export function makeTaskSortOperations(zones,taskId) {
  const operations=[];
  for (const level of [1,2,3]) zones[level].forEach((product,index) => {
    operations.push(makeUpdateOperation('products',product,{
      tasks:{...product.tasks,[taskId]:level},
      taskSortOrders:{...product.taskSortOrders,[taskId]:index}
    }));
  });
  return operations;
}
