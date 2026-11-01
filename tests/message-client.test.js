const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');
const turn = () => new Promise(resolve => setImmediate(resolve));

// Small event/network doubles test request ownership without launching a browser.
function client() {
  const nodes = new Map(), pending = [], store = new Map();
  const ids = ['#my-message-list', '#refresh-my-messages', '#find-message', '#new-message', '#find-message-result', '#message-account', '#new-message-result'];
  function element() {
    return { listeners: {}, innerHTML: '', elements: { subject: { value: '' } }, classList: { toggle() {} }, addEventListener(event, fn) { this.listeners[event] = fn; }, reportValidity: () => true, querySelectorAll: () => [{ disabled: false }] };
  }
  ids.forEach(id => nodes.set(id, element()));
  let panelHTML = '';
  const panel = element();
  Object.defineProperty(panel, 'innerHTML', { get: () => panelHTML, set(html) { panelHTML = html; for (const id of ['#refresh-conversation', '#conversation-reply', '#conversation-reply-status']) nodes.set(id, element()); } });
  nodes.set('#student-conversation', panel);
  const a = 'a'.repeat(24), b = 'b'.repeat(24);
  store.set('btech:message-references', JSON.stringify([null, {}, { id: a, accessKey: '1'.repeat(64), subject: 'A' }, { id: b, accessKey: '2'.repeat(64), subject: 'B' }]));
  const context = { window: {}, location: { search: '' }, URLSearchParams, FormData: class { constructor() { return [['text', 'Reply to B']][Symbol.iterator](); } }, localStorage: { getItem: key => store.get(key), setItem: (key, value) => store.set(key, value) }, document: { querySelector: selector => nodes.get(selector) || null }, fetch: (url, options) => new Promise(resolve => pending.push({ url, options, resolve: data => resolve({ ok: true, json: async () => ({ success: true, data }) }) })) };
  vm.runInNewContext(fs.readFileSync('public/messages.js', 'utf8'), context);
  const click = id => nodes.get('#my-message-list').listeners.click({ target: { closest: () => ({ dataset: { openRequest: id } }) } });
  const data = (id, subject) => ({ request: { _id: id, subject, status: 'new', createdAt: '2026-01-01', message: 'Initial' }, messages: [] });
  return { a, b, nodes, panel, pending, click, data, store };
}

test('switching conversations cannot let a slower response overwrite the selected request', async () => {
  const { a, b, pending, click, data, panel } = client();
  click(a); click(b);
  pending[1].resolve(data(b, 'Selected B')); await turn();
  assert.match(panel.innerHTML, /Selected B/);
  pending[0].resolve(data(a, 'Stale A')); await turn();
  assert.match(panel.innerHTML, /Selected B/);
  assert.doesNotMatch(panel.innerHTML, /Stale A/);
});

test('an in-flight reply stays bound to its original request while another conversation is opened', async () => {
  const { a, b, pending, click, data, panel, nodes } = client();
  click(b); pending[0].resolve(data(b, 'Thread B')); await turn();
  const submit = nodes.get('#conversation-reply').listeners.submit({ preventDefault() {} });
  assert.equal(pending[1].url, '/api/messages/thread/' + b + '/reply');
  assert.equal(JSON.parse(pending[1].options.body).accessKey, '2'.repeat(64));
  click(a); pending[2].resolve(data(a, 'Thread A')); await turn();
  pending[1].resolve({}); await submit; await turn();
  assert.match(panel.innerHTML, /Thread A/);
  assert.equal(pending.length, 3, 'finishing a reply must not reopen the previously selected conversation');
});
