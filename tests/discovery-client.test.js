const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const cards = require('../public/college-card');

const colleges = Array.from({ length: 30 }, (_, index) => ({
  slug: 'institute-' + index, name: 'Institute ' + index, city: 'Test town',
  state: index < 18 ? 'Rajasthan' : 'Uttar Pradesh', type: index % 2 ? 'Private' : 'NIT', branches: []
}));

function client(search = '', page = '/colleges/') {
  function element(values = {}) {
    return { listeners: {}, value: '', hidden: false, innerHTML: '', textContent: '',
      classList: { contains: () => false, add() {}, remove() {}, toggle() {} },
      setAttribute() {}, addEventListener(name, listener) { this.listeners[name] = listener; }, ...values };
  }
  const nodes = new Map();
  const fields = Object.fromEntries(['q', 'state', 'type'].map(key => [key, element()]));
  const filters = element({ elements: fields, reset() { for (const field of Object.values(fields)) field.value = ''; } });
  for (const name of ['directory-grid', 'results-count', 'load-more', 'featured-grid', 'featured-status']) nodes.set('#' + name, element());
  nodes.set('#directory-filters', filters);
  nodes.set('#catalogue-data', element({ textContent: JSON.stringify(colleges) }));
  nodes.set('[data-reset-filters]', element());
  const tabs = ['All', 'Rajasthan'].map(value => element({ dataset: { featureFilter: value } }));
  const location = { origin: 'https://example.test', pathname: page, search, href: 'https://example.test' + page + search };
  const history = { replaceState(state, title, value) { const url = new URL(value, location.href); Object.assign(location, { href: url.href, pathname: url.pathname, search: url.search }); } };
  let timerId = 0; const timers = new Map();
  const context = { window: { BtechCollegeCards: cards }, URL, URLSearchParams, location, history,
    localStorage: { getItem: () => null, setItem() {} },
    document: { body: { dataset: { page } }, querySelector: selector => nodes.get(selector) || null,
      querySelectorAll: selector => selector === '#featured-grid [data-college]' ? [{ dataset: { college: colleges[0].slug } }] : selector === '[data-feature-filter]' ? tabs : [], addEventListener() {} },
    fetch: async () => ({ ok: true, json: async () => ({ live: false }) }),
    setTimeout(fn) { const id = ++timerId; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); } };
  vm.runInNewContext(fs.readFileSync('public/discover.js', 'utf8'), context);
  const visible = () => [...nodes.get('#directory-grid').innerHTML.matchAll(/data-college="([^"]+)"/g)].map(match => match[1]);
  return { nodes, fields, filters, location, visible, tabs,
    clickMore() { let prevented = false; nodes.get('#load-more').listeners.click({ preventDefault() { prevented = true; } }); return prevented; },
    search() { fields.q.listeners.input(); for (const [id, fn] of timers) { timers.delete(id); fn(); } } };
}

test('college directory initializes without a featured-grid crash and Show more displays every next batch', () => {
  const view = client();
  assert.equal(view.visible().length, 12);
  assert.equal(view.clickMore(), true); assert.equal(view.visible().length, 24);
  assert.equal(new URL(view.location.href).searchParams.get('limit'), '24');
  view.clickMore(); assert.equal(view.visible().length, 30);
  assert.equal(new Set(view.visible()).size, 30);
  assert.equal(view.nodes.get('#load-more').hidden, true);
});

test('state/type filters, Find colleges, search and reset keep matching results and reset pagination', () => {
  const view = client();
  view.fields.state.value = 'Rajasthan'; view.filters.listeners.change();
  assert.equal(view.visible().length, 12);
  view.clickMore(); assert.equal(view.visible().length, 18);
  view.fields.type.value = 'Private';
  let prevented = false;
  view.filters.listeners.submit({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(view.visible().length, 9);
  assert.ok(view.visible().every(slug => colleges.find(c => c.slug === slug).type === 'Private'));
  const url = new URL(view.location.href);
  assert.equal(url.searchParams.get('state'), 'Rajasthan'); assert.equal(url.searchParams.get('type'), 'Private');
  view.fields.q.value = ' institute 1 '; view.search();
  assert.equal(view.visible().length, 5);
  view.nodes.get('[data-reset-filters]').listeners.click();
  assert.equal(view.visible().length, 12); assert.equal(view.location.search, '');
});

test('shared filtered URLs populate controls and render the correct colleges', () => {
  const view = client('?state=Rajasthan&type=Private&q=Institute%201');
  assert.equal(view.fields.state.value, 'Rajasthan');
  assert.equal(view.visible().length, 5);
  assert.equal(view.nodes.get('#load-more').hidden, true);
});

test('refreshing an expanded filtered URL keeps the selected filters and number of visible results', () => {
  const view = client('?state=Rajasthan&limit=24');
  assert.equal(view.visible().length, 18);
  assert.equal(view.fields.state.value, 'Rajasthan');
  assert.equal(view.nodes.get('#load-more').hidden, true);
  view.fields.state.value = ''; view.filters.listeners.change();
  assert.equal(view.visible().length, 12);
  assert.equal(new URL(view.location.href).searchParams.has('limit'), false);
});

test('homepage feature tabs render through the same script without stopping initialization', () => {
  const view = client('', '/');
  view.tabs[1].listeners.click();
  const html = view.nodes.get('#featured-grid').innerHTML;
  assert.equal([...html.matchAll(/data-college=/g)].length, 6);
  assert.match(view.nodes.get('#featured-status').textContent, /Rajasthan/);
});
