const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');
process.env.VERCEL = '1';
const app = require('../server/server');
const { states, scholarships } = require('../server/data/student-resources');
const sources = require('../server/data/college-evidence');
const { publicCollege, featured, getCatalogue } = require('../server/services/catalogue');
const { evidenceFor, feeSummary } = require('../server/services/collegeEvidence');
const { scholarship, state } = require('../public/resource-filters');
const cards = require('../public/college-card');
const { answer } = require('../server/services/help');
let server, base;
before(async () => { server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening',resolve)); base = 'http://127.0.0.1:' + server.address().port; });
after(async () => { await new Promise(resolve => server.close(resolve)); });
test('state directory covers 28 states and 8 union territories exactly once', () => {
  assert.equal(states.length,36); assert.equal(states.filter(s=>s.type==='State').length,28); assert.equal(states.filter(s=>s.type==='UT').length,8);
  assert.equal(new Set(states.map(s=>s.slug)).size,36);
  for (const s of states) { assert.match(s.governmentUrl,/^https:\/\//); assert.match(new URL(s.governmentUrl).hostname,/\.(gov|nic)\.in$/); assert.match(s.reviewedAt,/^\d{4}-\d{2}-\d{2}$/); }
});
test('scholarships retain original sources and do not invent live deadlines or eligibility decisions', () => {
  assert.ok(scholarships.length>=15); assert.equal(new Set(scholarships.map(s=>s.id)).size,scholarships.length);
  for (const s of scholarships) { assert.match(s.sourceUrl,/^https:\/\//); assert.match(s.applyUrl,/^https:\/\//); assert.equal(s.deadline,null); assert.equal(s.applicationStatus,'Check current official notice'); assert.ok(s.checks.length>=2); }
  assert.match(scholarships.find(s=>s.id==='reliance-foundation-ug').provider,/private foundation/);
});
test('scholarship filters include national resources, scope state portals and respect saved/audience filters', () => {
  const record = { id:'pragati',state:'National',audience:'women',search:'AICTE Pragati technical degree' };
  assert.equal(scholarship(record,{state:'Rajasthan'}),true);
  assert.equal(scholarship(record,{audience:'sc'}),false);
  assert.equal(scholarship(record,{saved:true},[]),false); assert.equal(scholarship(record,{saved:true},['pragati']),true);
  assert.equal(scholarship(record,{q:' PRAGATI '}),true);
  assert.equal(scholarship({...record,state:'Maharashtra'},{state:'Rajasthan'}),false);
  assert.equal(state({search:'Rajasthan',kind:'State'},{q:'raja',kind:'State'}),true); assert.equal(state({search:'Delhi',kind:'UT'},{kind:'State'}),false);
});
test('all resource routes render usable HTML, canonical URLs and source links without MongoDB', async () => {
  for (const url of ['/scholarships/','/states/',...scholarships.map(s=>'/scholarships/'+s.id+'/'),...states.map(s=>'/states/'+s.slug+'/')]) {
    const response = await fetch(base+url); assert.equal(response.status,200,url); const html = await response.text(); assert.equal((html.match(/<h1>/g)||[]).length,1,url); assert.match(html,/rel="canonical"/); assert.match(html,/href="https:\/\//); assert.match(html,/\/assets\/logos\/logo.png/);
  }
  for (const url of ['/states/no-such-state/','/scholarships/no-such-scheme/']) assert.equal((await fetch(base+url)).status,404);
  const sitemap = await(await fetch(base+'/sitemap.xml')).text(); assert.match(sitemap,/\/states\/rajasthan\//); assert.match(sitemap,/\/scholarships\/aicte-pragati\//);
});
test('official fee evidence preserves programme, period and year without verifying unrelated figures', () => {
  const mnit = publicCollege({name:'MNIT Jaipur'}), bits = publicCollege({name:'BITS Pilani'}), jecrc = publicCollege({name:'JECRC University'});
  assert.equal(mnit.feeSummary.amount,62500); assert.equal(mnit.feeSummary.period,'semester'); assert.match(mnit.feeSummary.scope,/General\/OBC/);
  assert.equal(bits.feeSummary.amount,291500); assert.equal(bits.feeSummary.period,'semester'); assert.equal(jecrc.feeSummary.amount,245000); assert.equal(jecrc.feeSummary.period,'year');
  for (const c of [mnit,bits,jecrc]) { assert.equal(c.feesPerYear,null); assert.equal(c.avgPlacement,null); assert.equal(c.verified,false); }
  assert.equal(evidenceFor('Poornima University'),null); assert.ok(evidenceFor('Poornima College of Engineering'));
  assert.equal(evidenceFor('BITS Goa'),null); assert.equal(publicCollege({name:'Arya Institute in Another City'}).image,'');
  assert.equal(feeSummary({feePreview:{amount:10,period:'unknown'}}),null);
  for (const evidence of Object.values(sources)) for (const [,url] of evidence.links) assert.match(url,/^https:\/\//);
});
test('server and client use identical college cards with escaped text and explicit fee periods', () => {
  const context = {}; vm.runInNewContext(fs.readFileSync('public/college-card.js','utf8'),context);
  const c = publicCollege({name:'BITS Pilani',city:'Pilani',state:'Rajasthan',admissionMode:'BITSAT'});
  assert.equal(context.BtechCollegeCards.render(c),cards.render(c)); assert.match(cards.render(c),/2,91,500 \/ semester/);
  const malicious = cards.render({name:'<img src=x onerror=alert(1)>',slug:'safe',city:'X',state:'Y',type:'Other',admissionMode:'<script>bad</script>'}); assert.ok(!malicious.includes('<img src=x')); assert.match(malicious,/&lt;script&gt;/);
});
test('home selection is stable and new resources are connected to the assistant', async () => {
  const catalogue = await getCatalogue(); assert.deepEqual(catalogue.featuredSlugs,featured(catalogue.colleges).map(c=>c.slug)); assert.equal(new Set(catalogue.featuredSlugs).size,catalogue.featuredSlugs.length);
  const html = await(await fetch(base+'/')).text(); assert.match(html,/support-home-grid/); assert.match(html,/href="\/scholarships\/"/); assert.match(html,/href="\/states\/"/); assert.match(html,/\/brand.css/);
  assert.ok(answer('Scholarship for engineering').links.some(l=>l.url==='/scholarships/')); assert.ok(answer('राज्य की सरकारी जानकारी','hi').links.some(l=>l.url==='/states/'));
});
