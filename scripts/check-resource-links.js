// Read-only, bounded checks of curated public sources. A timeout is reported as
// unavailable to this check, never as evidence that a government scheme closed.
const fs = require('fs');
const path = require('path');
const { states, scholarships } = require('../server/data/student-resources');
const evidence = require('../server/data/college-evidence');
const siteWide = process.argv.includes('--site');
const urls = [...new Set(siteWide ? JSON.parse(fs.readFileSync(path.join(__dirname, '../.local/site-audit.json'), 'utf8')).external.map(item => item.url) : [
  ...states.flatMap(s => [s.governmentUrl, s.directoryUrl, s.scholarship?.[1], s.admission?.[1]]),
  ...scholarships.flatMap(s => [s.sourceUrl, s.applyUrl]),
  ...Object.values(evidence).flatMap(v => [v.feeSource, v.ranking?.sourceUrl, ...v.links.map(l => l[1])])
].filter(Boolean))];
let next = 0;
const results = [];
async function worker() {
  while (next < urls.length) {
    const url = urls[next++];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(url, { signal: controller.signal, redirect: 'follow' });
      let preview = '';
      if (/text\/html/.test(response.headers.get('content-type') || '')) {
        const reader = response.body.getReader(), decoder = new TextDecoder();
        while (preview.length < 500000) { const chunk = await reader.read(); if (chunk.done) break; preview += decoder.decode(chunk.value, { stream: true }); }
        reader.cancel().catch(() => {});
      } else { response.body?.cancel().catch(() => {}); }
      const title = (preview.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]?.replace(/\s+/g,' ').trim() || '';
      results.push({ url, status: response.status, finalUrl: response.url, title: title.slice(0,160), checkedAt: new Date().toISOString() });
    } catch (error) { results.push({ url, status: 'unavailable-to-check', reason: error.cause?.code || error.name, checkedAt: new Date().toISOString() }); }
    finally { clearTimeout(timeout); }
  }
}
(async () => {
  await Promise.all(Array.from({ length: 8 }, worker));
  const destination = path.join(__dirname, siteWide ? '../.local/site-external-link-report.json' : '../.local/resource-link-report.json');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, JSON.stringify(results, null, 2));
  console.log(`Checked ${results.length} sources; ${results.filter(r => r.status === 200).length} returned HTTP 200.`);
  for (const result of results.filter(r => r.status !== 200)) console.log(result.status, result.url);
  console.log('Report:', destination);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
