// Shared mapping: a submitted claim is not an independently verified fact.
const positiveNumber = value => value !== '' && value != null && Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
const collegeDescription = request => `${request.name} is an engineering institution in ${request.city}, ${request.state}. Check the institution's official website for current programmes, eligibility, fees and approvals.`;
const placementData = request => {
  const pool = (request.placements || []).find(p => /tech|cse/i.test(p.poolName || ''));
  return { avgPlacement: positiveNumber(pool?.averageCTC), highestPlacement: positiveNumber(pool?.highestCTC) };
};
module.exports = { positiveNumber, collegeDescription, placementData };
