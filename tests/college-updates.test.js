const { test } = require('node:test');
const assert = require('node:assert/strict');
const snapshot = require('../server/data/approved-colleges.json');
const { additions } = require('../server/services/collegeUpdates');
const { getCatalogue, publicCollege, slugify } = require('../server/services/catalogue');

test('reviewed additions retain unique source identities and do not turn directory data into financial verification', async () => {
  assert.equal(snapshot.records.length, 48);
  assert.equal(new Set(snapshot.records.map(row => row.sourceId)).size, 48);
  assert.equal(new Set(snapshot.records.map(row => slugify(row.name))).size, 48);
  for (const row of additions()) {
    const college = publicCollege(row);
    assert.equal(new URL(college.directorySource.sourceUrl).hostname, 'josaa.admissions.nic.in');
    assert.match(college.directorySource.sourceId, /^josaa:\d+$/);
    assert.equal(college.directorySource.reviewedAt, snapshot.reviewedAt);
    assert.equal(college.verified, false);
    assert.equal(college.feesPerYear, null);
    assert.equal(college.avgPlacement, null);
    assert.deepEqual(college.branches, []);
  }
  const catalogue = await getCatalogue();
  assert.equal(catalogue.live, false);
  assert.equal(catalogue.colleges.length, 295);
  assert.equal(new Set(catalogue.colleges.map(row => row.slug)).size, 295);
});
