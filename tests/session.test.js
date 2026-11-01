const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');

function session(response, initial = {}) {
  const store = new Map(Object.entries({ token: 'old-token', role: 'student', 'btech:saved': '["mnit-jaipur"]', 'btech:message-references': '["private-reference"]', ...initial }));
  const redirects = [], requests = [];
  const links = [{ href: '/login', textContent: 'Log in' }];
  const context = { window: {}, URL, AbortSignal, Array, location: { origin: 'http://localhost:4173', pathname: '/applications/', search: '?task=Documents', replace: url => redirects.push(url) }, localStorage: { getItem: key => store.get(key), setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) }, document: { readyState: 'loading', addEventListener() {}, querySelectorAll: selector => selector === 'a.login-link' ? links : [] }, fetch: async (url, options) => { requests.push({ url, options }); if (response instanceof Error) throw response; return { status: response.status, ok: response.status === 200, json: async () => response.body }; } };
  vm.runInNewContext(fs.readFileSync('public/session.js', 'utf8'), context);
  return { api: context.window.BtechSession, store, redirects, requests, links };
}

test('an expired session clears authentication only and returns to the requested page after login', async () => {
  const { api, store, redirects, links } = session({ status: 401 });
  await api.protect('student', 'http://localhost:4173');
  assert.equal(store.has('token'), false);
  assert.equal(store.get('btech:saved'), '["mnit-jaipur"]');
  assert.equal(store.get('btech:message-references'), '["private-reference"]');
  assert.equal(redirects[0], '/login?next=%2Fapplications%2F%3Ftask%3DDocuments');
  assert.equal(links[0].href, redirects[0]);
  assert.equal(links[0].textContent, 'Log in');
});

test('a network failure or temporary outage does not log out the user or erase saved work', async () => {
  for (const response of [{ status: 503 }, new Error('Network unavailable')]) {
    const { api, store } = session(response);
    await assert.rejects(api.validate());
    assert.equal(store.get('token'), 'old-token');
    assert.equal(store.get('btech:saved'), '["mnit-jaipur"]');
  }
});

test('portal guards use the verified role and support the shared counsellor/admin portal', async () => {
  const { api, store, redirects } = session({ status: 200, body: { success: true, data: { role: 'admin', name: 'Example admin', email: 'test@example.invalid' } } });
  await api.protect('student', 'http://localhost:4173');
  assert.equal(redirects[0], '/admin');
  assert.equal(store.get('role'), 'admin');
  assert.equal(store.get('token'), 'old-token');
  redirects.length = 0;
  assert.equal((await api.protect(['counsellor', 'admin'], 'http://localhost:4173')).role, 'admin');
  assert.equal(redirects.length, 0);
});

test('login return destinations reject external URLs and authentication loops', () => {
  const { api } = session({ status: 401 });
  for (const value of ['https://example.com/', '//example.com/', '/\\example.com/', '/login', '/login/?next=/login', '/register.html', '/forgot-password?email=x', 'javascript:alert(1)', null]) assert.equal(api.safeNext(value), '', String(value));
  assert.equal(api.safeNext('/messages/?subject=Fees#new-message'), '/messages/?subject=Fees#new-message');
});
