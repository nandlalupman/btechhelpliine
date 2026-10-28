const sources = require('../data/college-evidence');
// Match the institution identity exactly. Never copy another college's source
// facts just because its brand name or city looks similar.
const slug = name => String(name || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function evidenceFor(name) {
  const value = sources[slug(name)];
  return value ? JSON.parse(JSON.stringify(value)) : null;
}
function feeSummary(evidence) {
  const fee = evidence?.feePreview;
  if (!fee || !Number.isFinite(fee.amount) || fee.amount < 0 || !['semester','year','one-time'].includes(fee.period) || !evidence.feeSource || !fee.scope || !fee.year) return null;
  return { ...fee, sourceUrl: evidence.feeSource, reviewedAt: evidence.reviewedAt };
}
async function syncEvidence() {
  const College = require('../models/College');
  const records = await College.find().select('name officialEvidence');
  let matched = 0, updated = 0;
  for (const college of records) {
    const evidence = evidenceFor(college.name);
    if (!evidence) continue;
    matched++;
    if (JSON.stringify(college.officialEvidence) === JSON.stringify(evidence)) continue;
    await College.updateOne({ _id: college._id }, { $set: { officialEvidence: evidence } }); updated++;
  }
  return { matched, updated, sourceRecords: Object.keys(sources).length };
}
module.exports = { evidenceFor, feeSummary, syncEvidence };
