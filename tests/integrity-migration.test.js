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
