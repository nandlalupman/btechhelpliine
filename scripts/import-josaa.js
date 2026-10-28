// Import public historical ranks directly from JoSAA, retaining every seat dimension.
const fs = require('fs');
const path = require('path');
const URL = 'https://josaa.admissions.nic.in/applicant/SeatAllotmentResult/CurrentORCR.aspx';
const decode = s => String(s).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;|&#160;/g, ' ').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const attr = (s, name) => decode((s.match(new RegExp(`\\b${name}="([^"]*)"`, 'i')) || [])[1] || '');
let html = '', cookies = '';
function inputs() {
  const form = new URLSearchParams();
  for (const match of html.matchAll(/<input\b[^>]*>/gi)) {
    const name = attr(match[0], 'name'); if (name && attr(match[0], 'type') === 'hidden') form.set(name, attr(match[0], 'value'));
  }
  for (const match of html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)) {
    const options = [...match[2].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)];
    const option = options.find(o => /selected=/i.test(o[1])) || options[0];
    if (option) form.set(attr(match[1], 'name'), attr(option[1], 'value'));
  }
  return form;
}
function options(suffix) {
  for (const match of html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)) {
    if (attr(match[1], 'name').endsWith(suffix)) return [...match[2].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)].map(o => ({ value: attr(o[1], 'value'), label: decode(o[2]) }));
  }
  return [];
}
async function request(body) {
  const response = await fetch(URL, { method: body ? 'POST' : 'GET', headers: { ...(cookies ? { Cookie: cookies } : {}), ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded', Referer: URL } : {}) }, ...(body ? { body } : {}), signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`Official source returned HTTP ${response.status}`);
  const set = response.headers.getSetCookie(); if (set.length) cookies = set.map(c => c.split(';')[0]).join('; ');
  html = await response.text();
  fs.mkdirSync(path.join(__dirname, '../.local'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '../.local/josaa-latest.html'), html);
}
async function select(suffix, value) {
  const body = inputs(); const name = 'ctl00$ContentPlaceHolder1$' + suffix;
  body.set(name, value); body.set('__EVENTTARGET', name); body.set('__EVENTARGUMENT', ''); await request(body);
}
(async () => {
  await request();
  const year = Number((decode(html).match(/Joint Seat Allocation Authority\s*(20\d\d)/i) || [])[1]);
  if (!year) throw new Error('Could not verify source year');
  const rounds = options('ddlroundno').filter(o => /^\d+$/.test(o.value) && Number(o.value) > 0);
  const round = rounds.at(-1).value;
  await select('ddlroundno', round);
  for (const suffix of ['ddlInstype', 'ddlInstitute', 'ddlBranch']) {
    const opts = options(suffix); console.log(suffix, JSON.stringify(opts.slice(0, 8)));
    const all = opts.find(o => /^all/i.test(o.label));
    if (!all) throw new Error(`No all-values option for ${suffix}; inspect .local/josaa-latest.html`);
    await select(suffix, all.value);
  }
  const body = inputs();
  const seatAll = options('ddlSeattype').find(o => /^all/i.test(o.label));
  if (seatAll) body.set('ctl00$ContentPlaceHolder1$ddlSeattype', seatAll.value);
  body.set('__EVENTTARGET', '');
  const buttons = [...html.matchAll(/<input\b[^>]*>/gi)].map(m => ({ type: attr(m[0], 'type'), name: attr(m[0], 'name'), value: attr(m[0], 'value') }));
  const button = buttons.find(b => b.type === 'submit' && /submit|show|search/i.test(b.value));
  if (!button) throw new Error('Could not find the public search button');
  body.set(button.name, button.value); await request(body);
  const records = [];
  for (const match of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m => decode(m[1]));
    if (cells.length !== 7 || !/^\d/.test(cells[5]) || !/^\d/.test(cells[6])) continue;
    const [institute, programme, quota, category, gender, openingRaw, closingRaw] = cells;
    if (/P/i.test(openingRaw + closingRaw)) continue; // Preparatory ranks are a different list.
    const exam = /Indian Institute of Technology|^IIT\b/i.test(institute) ? 'JEE Advanced' : /Indian Institute of Science,/i.test(institute) ? 'Unsupported' : 'JEE Main';
    records.push({ institute, programme, quota, category, gender, opening: Number(openingRaw.replace(/,/g, '')), closing: Number(closingRaw.replace(/,/g, '')), exam });
  }
  if (records.length < 100) throw new Error(`Only ${records.length} rows parsed; no dataset written`);
  const dataset = { source: URL, year, round: Number(round), importedAt: new Date().toISOString(), notes: 'Official historical opening/closing ranks. Preparatory ranks excluded. CRL for OPEN, category ranks for reserved categories, PwD category ranks for PwD seats. Not a prediction.', records };
  fs.writeFileSync(path.join(__dirname, '../server/data/cutoffs.json'), JSON.stringify(dataset));
  console.log(`Imported ${records.length} official ${year} round ${round} records.`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
