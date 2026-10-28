const dataset = require('../data/cutoffs.json');
function searchRanks({ rank, exam = 'JEE Main', category = 'OPEN', quota = 'AI', gender = 'Gender-Neutral', programme = '', institute = '', includeBeyond = false }) {
  if (!Number.isInteger(Number(rank)) || rank < 1 || rank > 10000000) throw new Error('Enter a valid rank, not a percentile.');
  if (!['JEE Main', 'JEE Advanced'].includes(exam)) throw new Error('Select the examination that produced this rank.');
  for (const [key, value] of Object.entries({ category, quota, gender })) {
    if (!dataset.records.some(row => row[key] === value)) throw new Error(`Select a valid ${key}.`);
  }
  const exact = dataset.records.filter(r => r.exam === exam && r.category === category && r.quota === quota && r.gender === gender && r.programme.toLowerCase().includes(programme.toLowerCase()) && r.institute.toLowerCase().includes(institute.toLowerCase()));
  const matched = exact.filter(r => includeBeyond || Number(rank) <= r.closing).sort((a, b) => Math.abs(a.closing - rank) - Math.abs(b.closing - rank));
  return { source: dataset.source, year: dataset.year, round: dataset.round, importedAt: dataset.importedAt, rankBasis: category === 'OPEN' ? 'Common Rank List (CRL)' : /PwD/i.test(category) ? 'PwD rank within this category' : `${category} category rank`, total: matched.length, matchingDimensionCount: exact.length, records: matched.slice(0, 100).map(r => ({ ...r, withinClosing: rank <= r.closing })) };
}
function rankMetadata() { return { year: dataset.year, round: dataset.round, count: dataset.records.length, source: dataset.source, categories: [...new Set(dataset.records.map(r => r.category))], quotas: [...new Set(dataset.records.map(r => r.quota))], genders: [...new Set(dataset.records.map(r => r.gender))] }; }
module.exports = { searchRanks, rankMetadata };
