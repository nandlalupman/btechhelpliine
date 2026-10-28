const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');
process.env.VERCEL = '1'; // Do not start a real DB connection or the development listener.
const app = require('../server/server');
const mongoose = require('mongoose');
const College = require('../server/models/College');
const Lead = require('../server/models/Lead');
const { publicCollege, getCatalogue, safeUrl } = require('../server/services/catalogue');
const { placementData, collegeDescription } = require('../server/utils/collegeData');
const { budget } = require('../public/planning');
let server, base;
before(async () => { server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => { await new Promise(resolve => server.close(resolve)); });

test('public routes render real HTML without a database and missing pages return 404', async () => {
  for (const url of ['/', '/colleges/', '/colleges/mnit-jaipur/', '/compare/', '/planner/', '/shortlist/', '/guides/', '/guides/btech-admission-checklist/']) {
    const response = await fetch(base + url); assert.equal(response.status, 200, url);
    const html = await response.text(); assert.match(html, /<h1>/); assert.match(html, /rel="canonical"/);
    assert.equal((html.match(/<h1>/g) || []).length, 1, url);
    for (const schema of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) assert.doesNotThrow(() => JSON.parse(schema[1]));
  }
  for (const url of ['/not-a-real-page', '/colleges/not-a-real-college/', '/guides/no-such-guide/', '/api/no-such-endpoint']) assert.equal((await fetch(base + url)).status, 404, url);
});
test('canonical redirects terminate and preserve reset-password tokens', async () => {
  for (const [url, location] of [['/colleges?state=Rajasthan', '/colleges/?state=Rajasthan'], ['/colleges/mnit-jaipur', '/colleges/mnit-jaipur/'], ['/index.html', '/'], ['/reset-password.html?token=example', '/reset-password?token=example']]) {
    const response = await fetch(base + url, { redirect: 'manual' }); assert.equal(response.status, 301, url); assert.equal(response.headers.get('location'), location);
    assert.equal((await fetch(base + location)).status, 200);
  }
});
test('SSR escapes search input and JSON script content', async () => {
  const response = await fetch(base + '/colleges/?q=' + encodeURIComponent('"><img src=x onerror=alert(1)>'));
  const html = await response.text(); assert.ok(!html.includes('value=""><img')); assert.match(html, /&lt;img/);
  const malicious = publicCollege({ name: '</script><script>alert(1)</script>', city: 'X', state: 'Y', website: 'javascript:alert(1)' });
  assert.equal(malicious.website, ''); assert.equal(safeUrl('https://user:password@example.com'), '');
});
test('sitemap exposes college and guide pages, omits private tools and fake modification dates', async () => {
  const xml = await (await fetch(base + '/sitemap.xml')).text();
  assert.match(xml, /\/colleges\/mnit-jaipur\//); assert.match(xml, /\/guides\/btech-admission-checklist\//);
  assert.ok(!xml.includes('/dashboard')); assert.ok(!xml.includes('/shortlist/')); assert.ok(!xml.includes('<lastmod>'));
  assert.match(await (await fetch(base + '/robots.txt')).text(), /Sitemap: https:\/\/www.btechhelpline.com\/sitemap.xml/);
});
test('directory provides unique stable pages and hides unsourced financial claims', async () => {
  const { colleges } = await getCatalogue(); assert.ok(colleges.length > 200);
  assert.equal(new Set(colleges.map(c => c.slug)).size, colleges.length);
  assert.ok(colleges.every(c => /^[a-z0-9-]+$/.test(c.slug)));
  const baseData = { name: 'Test College', feesPerYear: 100000, avgPlacement: 50 };
  assert.equal(publicCollege(baseData).feesPerYear, null);
  assert.equal(publicCollege({ ...baseData, dataStatus: 'verified', sourceUrl: 'https://example.edu/report', dataYear: 2026, verifiedAt: new Date('2026-10-01') }).feesPerYear, 100000);
  assert.equal(publicCollege({ ...baseData, dataStatus: 'verified', sourceUrl: '' }).feesPerYear, null);
});
test('college verification requires evidence; onboarding does not invent placements or faculty', async () => {
  assert.deepEqual(placementData({}), { avgPlacement: null, highestPlacement: null });
  assert.deepEqual(placementData({ placements: [{ poolName: 'B.Tech', medianCTC: 8 }] }), { avgPlacement: null, highestPlacement: null });
  assert.ok(!collegeDescription({ name: 'Test', city: 'Jaipur', state: 'Rajasthan' }).includes('AICTE'));
  const college = new College({ name: 'Test', city: 'Jaipur', state: 'Rajasthan', type: 'Private', admissionMode: 'Test', cutoffRankCSE: 'Not reported', description: 'Test', dataStatus: 'verified' });
  await assert.rejects(() => college.validate(), /sourceUrl|dataYear|verifiedAt/);
});
test('budget applies annual growth only to recurring expenses and adds one-time costs once', () => {
  const result = budget({ tuition: 100000, hostel: 50000, mess: 30000, other: 20000, oneTime: 25000, increase: 10 });
  assert.deepEqual(result.years.map(Math.round), [225000, 220000, 242000, 266200]);
  assert.equal(Math.round(result.total), 953200);
  assert.equal(budget({}).total, 0); assert.throws(() => budget({ tuition: -1 })); assert.throws(() => budget({ increase: 31 })); assert.throws(() => budget({ hostel: 'not a number' }));
});
test('lead endpoint persists the submitted rank, category, contact preference and consent', async () => {
  const previousReady = mongoose.connection.readyState;
  const previousSave = Lead.prototype.save;
  const email = require('../server/utils/email'); const previousMail = email.sendLeadConfirmation;
  let saved;
  try {
    mongoose.connection.readyState = 1;
    Lead.prototype.save = async function () { await this.validate(); saved = this.toObject(); return this; };
    email.sendLeadConfirmation = async () => {};
    const response = await fetch(base + '/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Local Test', mobile: '9876543210', email: 'test@example.invalid', branch: 'Computer Science Engineering', state: 'Rajasthan', jeeRank: '12345', category: 'EWS', contactConsent: true, partnerConsent: false, preferredContactTime: 'Evening' }) });
    assert.equal(response.status, 201); assert.equal(saved.jeeRank, '12345'); assert.equal(saved.category, 'EWS'); assert.equal(saved.partnerConsent, false); assert.equal(saved.contactConsent, true); assert.ok(saved.consentAt); assert.equal(saved.preferredContactTime, 'Evening');
    const invalid = await fetch(base + '/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Local Test', mobile: '9876543210', email: 'test@example.invalid', branch: 'CSE', state: 'Rajasthan', jeeRank: '-5' }) }); assert.equal(invalid.status, 400);
  } finally { mongoose.connection.readyState = previousReady; Lead.prototype.save = previousSave; email.sendLeadConfirmation = previousMail; }
});
test('Analytics is not loaded before consent or after decline; query tokens are excluded', () => {
  for (const initial of [null, 'declined', 'accepted']) {
    const store = new Map(initial ? [['cookie-consent', initial]] : []); const scripts = []; let ready;
    const context = { window: {}, location: { origin: 'https://www.btechhelpline.com', pathname: '/reset-password', search: '?token=secret' }, localStorage: { getItem: k => store.get(k) || null, setItem: (k, v) => store.set(k, v) }, document: { addEventListener: (event, fn) => { ready = fn; }, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, createElement: () => ({}), head: { append: el => scripts.push(el) } } };
    vm.runInNewContext(fs.readFileSync('public/consent.js', 'utf8'), context); ready();
    assert.equal(scripts.length, initial === 'accepted' ? 1 : 0);
    context.window.BtechConsent.set('declined'); assert.equal(context.window['ga-disable-G-6B390BG8Q2'], true);
    context.window.BtechConsent.set('accepted'); assert.equal(scripts.length, 1);
    const config = context.window.dataLayer.find(args => args[0] === 'config'); assert.ok(!config[2].page_location.includes('secret'));
  }
});
test('all inline application scripts remain syntactically valid after legacy updates', () => {
  for (const file of fs.readdirSync('public').filter(x => x.endsWith('.html'))) {
    const html = fs.readFileSync('public/' + file, 'utf8');
    for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (/type=["']application\//.test(match[1]) || /\bsrc=/.test(match[1])) continue;
      assert.doesNotThrow(() => new vm.Script(match[2], { filename: file }), file);
    }
    assert.ok(!html.includes('https://www.googletagmanager.com/gtag/js'), file);
  }
});
