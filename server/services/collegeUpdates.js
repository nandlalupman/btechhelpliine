const mongoose = require('mongoose');
const College = require('../models/College');
const CollegeImport = require('../models/CollegeImport');
const snapshot = require('../data/approved-colleges.json');

const sourceFields = row => ({
  sourceId: row.sourceId, sourceUrl: row.sourceUrl,
  sourceYear: row.sourceYear, reviewedAt: row.reviewedAt,
  scope: snapshot.scope
});
const managedFields = row => Object.fromEntries(['city', 'state', 'website', 'admissionMode', 'branches'].map(key => [key, row[key]]));

function additions() {
  return snapshot.records.map(row => ({
    name: row.name, city: row.city, state: row.state, type: row.type,
    website: row.website, admissionMode: row.admissionMode, branches: row.branches,
    cutoffRankCSE: 'Not verified', dataStatus: 'needs_review',
    description: `${row.name} is listed in the JoSAA ${row.sourceYear} institute directory. Check programme eligibility and current admission notices with the institution.`,
    directorySource: sourceFields(row)
  }));
}

async function syncApprovedColleges() {
  if (mongoose.connection.readyState !== 1) throw new Error('College import requires a connected database.');
  await CollegeImport.init();
  const result = { revision: snapshot.revision, added: 0, refreshed: 0, removedByAdmin: 0 };
  const ids = snapshot.records.map(row => row.sourceId);
  const ledger = new Map((await CollegeImport.find({ sourceId: { $in: ids } }).lean()).map(row => [row.sourceId, row]));
  const pendingRows = snapshot.records.filter(row => ledger.get(row.sourceId)?.revision !== snapshot.revision);
  if (!pendingRows.length) return result;
  const unlinked = pendingRows.filter(row => !ledger.get(row.sourceId)?.collegeId);
  if (unlinked.length) {
    const bySource = new Map(additions().map(row => [row.directorySource.sourceId, row]));
    // Batches keep a cold deployment from doing one network round trip per college.
    const inserted = await College.bulkWrite(unlinked.map(row => ({ updateOne: {
      filter: { name: row.name }, update: { $setOnInsert: bySource.get(row.sourceId) }, upsert: true
    } })));
    result.added = inserted.upsertedCount;
    const found = new Map((await College.find({ name: { $in: unlinked.map(row => row.name) } }).select('_id name directorySource').lean()).map(row => [row.name, row]));
    await CollegeImport.bulkWrite(unlinked.map(row => ({ updateOne: {
      filter: { sourceId: row.sourceId }, update: { $setOnInsert: { sourceId: row.sourceId, collegeId: found.get(row.name)._id, managedFields: found.get(row.name).directorySource?.sourceId === row.sourceId ? managedFields(row) : null } }, upsert: true
    } })));
    for (const entry of await CollegeImport.find({ sourceId: { $in: ids } }).lean()) ledger.set(entry.sourceId, entry);
  }
  const current = new Map((await College.find({ _id: { $in: pendingRows.map(row => ledger.get(row.sourceId).collegeId) } }).select('city state website admissionMode branches').lean()).map(row => [String(row._id), row]));
  // Refresh only importer-owned fields that an administrator has not changed.
  // Never upsert an already-linked college: a missing ID means it was removed.
  const refreshed = await College.bulkWrite(pendingRows.map(row => {
    const entry = ledger.get(row.sourceId), college = current.get(String(entry.collegeId));
    const updates = { directorySource: sourceFields(row) };
    for (const [key, value] of Object.entries(managedFields(row))) {
      if (entry.managedFields && college && JSON.stringify(college[key]) === JSON.stringify(entry.managedFields[key])) updates[key] = value;
    }
    return { updateOne: { filter: { _id: entry.collegeId }, update: { $set: updates } } };
  }));
  result.refreshed = refreshed.matchedCount;
  result.removedByAdmin = pendingRows.length - refreshed.matchedCount;
  await CollegeImport.bulkWrite(pendingRows.map(row => ({ updateOne: {
    filter: { sourceId: row.sourceId }, update: { $set: { revision: snapshot.revision, ...(ledger.get(row.sourceId).managedFields ? { managedFields: managedFields(row) } : {}) } }
  } })));
  return result;
}

let pending;
function ensureApprovedColleges() {
  if (!pending) pending = syncApprovedColleges().catch(error => { pending = null; throw error; });
  return pending;
}

function updateSummary() {
  return { reviewedAt: snapshot.reviewedAt, sourceYear: snapshot.sourceYear,
    sourceLabel: snapshot.sourceLabel, sourceUrl: snapshot.sourceUrl,
    additionalInstitutions: snapshot.records.length, scope: snapshot.scope };
}

module.exports = { additions, syncApprovedColleges, ensureApprovedColleges, updateSummary };
