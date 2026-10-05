import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startTestServer } from './helpers/test-server.js';
import { migrateIntegrity } from '../server/content.js';

test('migration on handover dump preserves every original field and is repeatable', async () => {
  const server = await startTestServer({restoreDump:true});
  try {
    const snapshots = {};
    for (const [table, original] of Object.entries(server.restoredRows)) {
      const rows = (await server.query(`SELECT * FROM ${table} ORDER BY ${table === 'categories' ? 'name' : table === 'site_settings' ? 'key' : 'id'}`)).rows;
      assert.equal(rows.length,original.length,`${table}: count unchanged`);
      for (let index=0;index<original.length;index++) {
        for (const [key,value] of Object.entries(original[index])) assert.deepEqual(rows[index][key],value,`${table} ${index} ${key}`);
        assert.ok(Number.isInteger(rows[index].version));
      }
      snapshots[table] = rows;
    }
    await Promise.all([migrateIntegrity(server.pool),migrateIntegrity(server.pool)]);
    for (const [table, rows] of Object.entries(snapshots)) {
      const actual = (await server.query(`SELECT * FROM ${table} ORDER BY ${table === 'categories' ? 'name' : table === 'site_settings' ? 'key' : 'id'}`)).rows;
      assert.deepEqual(actual,rows);
    }
    console.log('Restored dump counts:',Object.fromEntries(Object.entries(snapshots).map(([table,rows]) => [table,rows.length])));
  } finally { await server.close(); }
});


test('upgrading an existing installation seeds all tasks and repeats without resetting orders', async () => {
  const server=await startTestServer();
  try {
    await server.clear();
    await server.query('ALTER TABLE products DROP COLUMN "taskSortOrders"');
    await server.query("DELETE FROM schema_migrations WHERE version='003-task-order'");
    await server.query("INSERT INTO tasks(id,title) VALUES ('repair','Repair'),('cleaning','Cleaning')");
    await server.query(`INSERT INTO products(id,title,"sortOrder",tasks) VALUES ('upgrade','Keep',7,'{"repair":1,"cleaning":2}')`);
    const before=await server.readProduct('upgrade');
    await migrateIntegrity(server.pool);
    let row=await server.readProduct('upgrade');
    for(const [key,value] of Object.entries(before))assert.deepEqual(row[key],value,key);
    assert.deepEqual(row.taskSortOrders,{repair:7,cleaning:7});
    await server.query(`UPDATE products SET "taskSortOrders"='{"repair":2,"cleaning":5}' WHERE id='upgrade'`);
    await Promise.all([migrateIntegrity(server.pool),migrateIntegrity(server.pool)]);
    row=await server.readProduct('upgrade');assert.deepEqual(row.taskSortOrders,{repair:2,cleaning:5});
  } finally {await server.close();}
});
