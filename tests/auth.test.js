import assert from 'node:assert/strict';
import { describe, before, after, test } from 'node:test';
import { startTestServer } from './helpers/test-server.js';

describe('Server authentication', { concurrency: false }, () => {
  let server;
  before(async () => { server = await startTestServer(); });
  after(async () => { if (server) await server.close(); });

  test('every existing write endpoint rejects an anonymous client', async () => {
    for (const path of ['/api/save', '/api/upload', '/api/reset']) {
      const response = await server.request(path, { method: 'POST', body: {} });
      assert.equal(response.status, 401, `${path} must require a server session`);
    }
  });

  test('sessionStorage or client supplied role cannot grant access', async () => {
    const response = await server.request('/api/upload', {
      method: 'POST', body: { role: 'admin', loggedIn: true },
      headers: { Cookie: 'packerra_admin_logged_in=true', 'X-Role': 'admin' },
    });
    assert.equal(response.status, 401);
  });

  test('unknown credentials and missing session return authentication errors', async () => {
    assert.equal((await server.request('/api/auth/me')).status, 401);
    const response = await server.request('/api/auth/login', {
      method: 'POST', body: { login: 'nonexistent', password: 'Invalid-test-password-42!' },
    });
    assert.equal(response.status, 401);
  });

  async function createUser(login, role = 'admin', mustChange = false) {
    const { randomBytes, scrypt } = await import('node:crypto');
    const { promisify } = await import('node:util');
    const password = 'Test-only-password-42!';
    const salt = randomBytes(16).toString('hex');
    const key = await promisify(scrypt)(password, salt, 64, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });
    const hash = `scrypt$131072$8$1$${salt}$${key.toString('hex')}`;
    const result = await server.query(
      `INSERT INTO admin_users (login, name, role, password_hash, must_change_password)
       VALUES ($1, $1, $2, $3, $4) RETURNING id`, [login, role, hash, mustChange],
    );
    return { id: result.rows[0].id, login, password };
  }

  async function login(user) {
    const response = await server.request('/api/auth/login', { method: 'POST', body: { login: user.login, password: user.password } });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const cookie = response.cookie.split(';')[0];
    return { response, headers: { Cookie: cookie, 'X-CSRF-Token': response.body.csrfToken } };
  }

  test('migration is recorded and public catalogue stays readable', async () => {
    assert.equal((await server.request('/api/data')).status, 200);
    const result = await server.query('SELECT version FROM schema_migrations WHERE version = $1', ['001-auth']);
    assert.equal(result.rows.length, 1);
  });

  test('login creates a safe cookie and stores only a token hash', async () => {
    const user = await createUser('cookie-test');
    const session = await login(user);
    assert.match(session.response.cookie, /HttpOnly/i);
    assert.match(session.response.cookie, /SameSite=Lax/i);
    assert.match(session.response.cookie, /Path=\//i);
    assert.equal(session.response.body.user.role, 'admin');
    assert.equal(session.response.body.user.password_hash, undefined);
    assert.equal(session.response.body.user.password, undefined);
    const token = session.headers.Cookie.split('=')[1];
    const stored = await server.query('SELECT token_hash, expires_at > now() AS valid FROM admin_sessions WHERE user_id = $1', [user.id]);
    assert.equal(stored.rows[0].valid, true);
    assert.notEqual(stored.rows[0].token_hash, token);
    assert.match(stored.rows[0].token_hash, /^[a-f0-9]{64}$/);
    const restored = await server.request('/api/auth/me', { headers: session.headers });
    assert.equal(restored.status, 200);
    assert.equal(restored.body.csrfToken, session.response.body.csrfToken);
    assert.equal(restored.body.user.id, user.id);
  });

  test('wrong password cannot authenticate an existing account', async () => {
    const user = await createUser('wrong-password');
    const result = await server.request('/api/auth/login', { method: 'POST', body: { login: user.login, password: 'Wrong-password-42!' } });
    assert.equal(result.status, 401);
    assert.equal(result.cookie, null);
  });

  test('writes require a matching CSRF token and a trusted Origin', async () => {
    const session = await login(await createUser('csrf-test'));
    const noToken = { Cookie: session.headers.Cookie };
    assert.equal((await server.request('/api/save', { method: 'POST', body: {}, headers: noToken })).status, 403);
    assert.equal((await server.request('/api/upload', { method: 'POST', body: {}, headers: { ...session.headers, 'X-CSRF-Token': 'wrong' } })).status, 403);
    assert.equal((await server.request('/api/upload', { method: 'POST', body: {}, headers: { ...session.headers, Origin: 'https://attacker.example' } })).status, 403);
    // Reaching payload validation proves that the legitimate session passed middleware.
    assert.equal((await server.request('/api/upload', { method: 'POST', body: {}, headers: session.headers })).status, 400);
    assert.equal((await server.request('/api/upload', { method: 'POST', body: {}, headers: { ...session.headers, Origin: server.baseUrl } })).status, 400);
  });

  test('cross site login is rejected without issuing a session', async () => {
    const user = await createUser('origin-test');
    const response = await server.request('/api/auth/login', {
      method: 'POST', body: user, headers: { Origin: 'https://attacker.example' },
    });
    assert.equal(response.status, 403);
    assert.equal(response.cookie, null);
  });

  test('editor cannot reset data even when claiming to be admin', async () => {
    const session = await login(await createUser('editor-test', 'editor'));
    const response = await server.request('/api/reset', { method: 'POST', body: { role: 'admin' }, headers: { ...session.headers, 'X-Role': 'admin' } });
    assert.equal(response.status, 403);
    assert.equal((await server.request('/api/upload', { method: 'POST', body: {}, headers: session.headers })).status, 400);
  });

  test('expired and disabled sessions cannot write', async () => {
    const user = await createUser('expired-test');
    const session = await login(user);
    await server.query('UPDATE admin_sessions SET expires_at = now() - interval \'1 minute\' WHERE user_id = $1', [user.id]);
    assert.equal((await server.request('/api/auth/me', { headers: session.headers })).status, 401);
    const other = await login(user);
    await server.query('UPDATE admin_users SET is_active = FALSE WHERE id = $1', [user.id]);
    assert.equal((await server.request('/api/upload', { method: 'POST', body: {}, headers: other.headers })).status, 401);
  });

  test('logout revokes the session in the database', async () => {
    const session = await login(await createUser('logout-test'));
    assert.equal((await server.request('/api/auth/logout', { method: 'POST', headers: session.headers })).status, 200);
    assert.equal((await server.request('/api/auth/me', { headers: session.headers })).status, 401);
  });

  test('temporary password restricts access until changed and revokes old sessions', async () => {
    const user = await createUser('temporary-test', 'editor', true);
    const first = await login(user);
    const second = await login(user);
    assert.equal(first.response.body.user.mustChangePassword, true);
    assert.equal((await server.request('/api/upload', { method: 'POST', body: {}, headers: first.headers })).status, 403);
    const changed = await server.request('/api/auth/password', {
      method: 'POST', headers: first.headers,
      body: { currentPassword: user.password, newPassword: 'New-test-only-password-57!' },
    });
    assert.equal(changed.status, 200, JSON.stringify(changed.body));
    assert.equal((await server.request('/api/auth/me', { headers: first.headers })).status, 401);
    assert.equal((await server.request('/api/auth/me', { headers: second.headers })).status, 401);
    const updated = await login({ ...user, password: 'New-test-only-password-57!' });
    assert.equal(updated.response.body.user.mustChangePassword, false);
  });

  test('password change rejects wrong current password and weak new password', async () => {
    const user = await createUser('password-validation');
    const session = await login(user);
    const change = body => server.request('/api/auth/password', { method: 'POST', headers: session.headers, body });
    assert.equal((await change({ currentPassword: 'wrong-password-42!', newPassword: 'New-test-only-password-57!' })).status, 401);
    assert.equal((await change({ currentPassword: user.password, newPassword: 'short' })).status, 400);
    assert.equal((await server.request('/api/auth/me', { headers: session.headers })).status, 200);
  });

  test('role is read from database rather than cached cookie claims', async () => {
    const user = await createUser('role-change');
    const session = await login(user);
    await server.query('UPDATE admin_users SET role = $1 WHERE id = $2', ['editor', user.id]);
    assert.equal((await server.request('/api/reset', { method: 'POST', headers: session.headers })).status, 403);
  });

  test('invalid login input is rejected before password hashing', async () => {
    for (const body of [{}, { login: {}, password: 'password' }, { login: 'admin', password: 'x'.repeat(513) }]) {
      assert.equal((await server.request('/api/auth/login', { method: 'POST', body })).status, 400);
    }
  });


  test('non ASCII CSRF token is rejected rather than crashing middleware', async () => {
    const session = await login(await createUser('csrf-ascii-test'));
    const result = await server.request('/api/upload', { method: 'POST', body: {}, headers: { ...session.headers, 'X-CSRF-Token': 'é'.repeat(64) } });
    assert.equal(result.status, 403);
  });

  test('parallel password checks have a bounded concurrency limit', async () => {
    const responses = await Promise.all(Array.from({ length: 5 }, () => server.request('/api/auth/login', {
      method: 'POST', body: { login: 'parallel-test', password: 'Unknown-test-password-42!' },
    })));
    assert.ok(responses.some(response => response.status === 429));
    assert.ok(responses.every(response => [401, 429].includes(response.status)));
  });
  test('repeated failed logins are limited', async () => {
    await login({ login: 'cookie-test', password: 'Test-only-password-42!' });
    for (let i = 0; i < 10; i++) {
      assert.equal((await server.request('/api/auth/login', { method: 'POST', body: { login: 'rate-limit-test', password: 'Invalid-password-42!' } })).status, 401);
    }
    assert.equal((await server.request('/api/auth/login', { method: 'POST', body: { login: 'rate-limit-test', password: 'Invalid-password-42!' } })).status, 429);
  });

  test('production session cookie requires HTTPS', async () => {
    const production = await startTestServer({ production: true });
    try {
      const user = await production.createUser('secure-cookie-test');
      const response = await production.request('/api/auth/login', { method: 'POST', body: user });
      assert.equal(response.status, 200);
      assert.match(response.cookie, /; Secure/i);
      assert.match(response.cookie, /; HttpOnly/i);
    } finally { await production.close(); }
  });

  test('alternative API cannot bypass server authentication', async () => {
    const alternate = await startTestServer({ alternate: true });
    try {
      for (const path of ['/api/save', '/api/upload', '/api/reset']) {
        assert.equal((await alternate.request(path, { method: 'POST', body: {} })).status, 401);
      }
      assert.equal((await alternate.request('/api/data')).status, 200);
    } finally { await alternate.close(); }
  });
});
