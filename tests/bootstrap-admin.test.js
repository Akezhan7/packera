import assert from 'node:assert/strict';
import { describe, before, after, test } from 'node:test';
import { startTestServer } from './helpers/test-server.js';
import { createInitialAdmin } from '../scripts/create-admin.js';
import { migrateAuth } from '../server/auth.js';

describe('Initial administrator and repeatable migration', () => {
  let server;
  before(async () => { server = await startTestServer(); });
  after(async () => { if (server) await server.close(); });
  test('invalid password cannot create an account', async () => {
    await assert.rejects(createInitialAdmin(server.pool, { login: 'first-admin', name: 'Test', password: 'short' }), /12/);
    assert.equal((await server.query('SELECT count(*)::int AS count FROM admin_users')).rows[0].count, 0);
  });
  test('bootstrap creates a usable administrator with a hashed password', async () => {
    const password = 'Test-only-bootstrap-72!';
    const user = await createInitialAdmin(server.pool, { login: 'FIRST-ADMIN', name: 'Test Admin', password });
    assert.equal(user.login, 'first-admin');
    assert.equal(user.role, 'admin');
    const stored = await server.query('SELECT password_hash FROM admin_users WHERE id = $1', [user.id]);
    assert.notEqual(stored.rows[0].password_hash, password);
    assert.match(stored.rows[0].password_hash, /^scrypt\$/);
    assert.equal((await server.request('/api/auth/login', { method: 'POST', body: { login: user.login, password } })).status, 200);
  });
  test('a second bootstrap cannot overwrite the existing administrator', async () => {
    await assert.rejects(createInitialAdmin(server.pool, { login: 'second-admin', name: 'Other', password: 'Other-test-password-42!' }), /уже существует/);
    assert.equal((await server.query('SELECT count(*)::int AS count FROM admin_users')).rows[0].count, 1);
  });
  test('reapplying the migration preserves existing users and content', async () => {
    await server.query(`INSERT INTO products (id, title, "desc", images) VALUES ('migration-check', 'Retained', 'Before migration', '["/original.png"]')`);
    await Promise.all([migrateAuth(server.pool), migrateAuth(server.pool)]);
    assert.equal((await server.query('SELECT count(*)::int AS count FROM admin_users')).rows[0].count, 1);
    const product = await server.readProduct('migration-check');
    assert.equal(product.desc, 'Before migration');
    assert.equal(product.images, '["/original.png"]');
    assert.equal((await server.query("SELECT count(*)::int AS count FROM schema_migrations WHERE version = '001-auth'")).rows[0].count, 1);
  });
});
