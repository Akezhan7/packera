import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const api = await import('../src/adminApi.js').catch(() => null);

test('client login keeps only user and CSRF in memory and sends credentials', async () => {
  assert.ok(api, 'Shared authenticated API client must exist');
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return Response.json({ user: { id: 'test-id', login: 'test', role: 'editor' }, csrfToken: 'csrf-test' });
  };
  await api.loginAdmin('test', 'Test-password-42!');
  assert.equal(api.currentUser.value.role, 'editor');
  assert.equal(request.options.credentials, 'include');
  assert.deepEqual(JSON.parse(request.options.body), { login: 'test', password: 'Test-password-42!' });
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers['X-CSRF-Token'], 'csrf-test');
    assert.equal(options.credentials, 'include');
    return Response.json({ success: true });
  };
  await api.requestApi('/api/save', { method: 'POST', body: { products: [] } });
});

test('session expiry clears access but keeps caller draft and reports status', async () => {
  assert.ok(api);
  api.currentUser.value = { id: 'test-id', role: 'editor' };
  const draft = { title: 'Unsaved product' };
  globalThis.fetch = async () => Response.json({ error: 'Session expired', code: 'SESSION_EXPIRED' }, { status: 401 });
  await assert.rejects(api.requestApi('/api/save', { method: 'POST', body: draft }), error => error.status === 401);
  assert.equal(api.currentUser.value, null);
  assert.equal(draft.title, 'Unsaved product');
  assert.ok(api.authNotice.value);
});

test('wrong current password does not discard a valid session', async () => {
  assert.ok(api);
  api.currentUser.value = { id: 'test-id', role: 'editor' };
  globalThis.fetch = async () => Response.json({ error: 'Wrong password', code: 'INVALID_CREDENTIALS' }, { status: 401 });
  await assert.rejects(api.requestApi('/api/auth/password', { method: 'POST', body: {} }));
  assert.equal(api.currentUser.value.id, 'test-id');
});

test('network failure is reported without a successful response fallback', async () => {
  assert.ok(api);
  globalThis.fetch = async () => { throw new Error('Network offline'); };
  await assert.rejects(api.requestApi('/api/upload', { method: 'POST', body: {} }), /Network offline/);
});
