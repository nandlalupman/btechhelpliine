const mongoose = require('mongoose');
const College = require('../models/College');
const directory = require('../data/directory.json');
const { evidenceFor, feeSummary } = require('./collegeEvidence');

const slugify = value => String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const safeUrl = value => {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; } catch { return ''; }
};
const localImages = { 'mnit-jaipur': 'mnit', 'arya-institute-of-engineering-and-technology': 'arya', 'jecrc-university': 'jecrc', 'poornima-college-of-engineering': 'poornima', 'skit-jaipur': 'skit' };
function publicCollege(raw) {
  const row = raw.toObject ? raw.toObject() : raw;
  const slug = slugify(row.name);
  // The legacy seed misclassified SKIT as a state college. Its official brochure
  // identifies it as self-financed: https://www.skit.ac.in/images/pdf/SKIT_BROCHURE_2425.pdf
  const type = slug === 'skit-jaipur' ? 'Private' : row.type || 'Other';
  const image = localImages[slug];
  const evidence = evidenceFor(row.name);
  const verified = row.dataStatus === 'verified' && safeUrl(row.sourceUrl) && row.dataYear && row.verifiedAt;
  const number = key => verified && row[key] != null && Number.isFinite(Number(row[key])) ? Number(row[key]) : null;
  return {
    slug, id: row._id ? String(row._id) : null, name: row.name, type, city: row.city, state: row.state,
    website: safeUrl(row.website), admissionMode: row.admissionMode || 'Confirm with institution',
    branches: row.branches || [], branchPreview: (row.branches || []).slice(0, 2), image: image ? `/assets/colleges/${image}.webp` : '',
    evidence, feeSummary: feeSummary(evidence),
    partner: row.isOnboarded === true, verified: !!verified,
    dataYear: verified ? row.dataYear : null, sourceUrl: verified ? safeUrl(row.sourceUrl) : '',
    verifiedAt: verified ? new Date(row.verifiedAt).toISOString().slice(0, 10) : '',
    feesPerYear: number('feesPerYear'), medianPlacement: number('medianPlacement'),
    avgPlacement: number('avgPlacement'), highestPlacement: number('highestPlacement'),
    hostelPerYear: number('hostelPerYear'), messPerYear: number('messPerYear'), mandatoryFeesPerYear: number('mandatoryFeesPerYear'),
    cutoff: verified ? row.cutoffRankCSE : null
  };
}
async function getCatalogue() {
  let rows = new Map(directory.map(c => [slugify(c.name), publicCollege(c)]));
  let live = false;
  if (mongoose.connection.readyState === 1) {
    try {
      const records = await College.find().select('-facilities -bannerUrl -imageUrl -__v').lean().maxTimeMS(3000);
      rows = new Map(records.map(c => [slugify(c.name), publicCollege(c)]));
      live = true;
    } catch (error) { console.error('Catalogue database unavailable:', error.message); }
  }
  const colleges = [...rows.values()];
  return { colleges, live, featuredSlugs: featured(colleges).map(c => c.slug) };
}
function featured(colleges) {
  const names = ['MNIT Jaipur', 'JECRC University', 'BITS Pilani', 'SKIT Jaipur', 'Poornima College of Engineering', 'Arya Institute of Engineering'];
  const picked = names.map(name => colleges.find(c => c.name.toLowerCase().includes(name.toLowerCase()))).filter(Boolean);
  return [...new Map([...picked, ...colleges].map(c => [c.slug, c])).values()].slice(0, 6);
}
module.exports = { slugify, safeUrl, publicCollege, getCatalogue, featured };
