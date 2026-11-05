const { escape: e } = require('./site');

function render(college) {
  const source = college.directorySource;
  if (!source) return '';
  return `<section class="detail-panel" id="directory-source"><span class="eyebrow">OFFICIAL DIRECTORY SOURCE</span><h2>A listing you can trace.</h2><p>JoSAA ${e(source.sourceYear)} · institute code ${e(source.sourceId.replace('josaa:', ''))} · source reviewed ${e(source.reviewedAt)}</p><p>${e(source.scope)}</p><a class="text-link" href="${e(source.sourceUrl)}" target="_blank" rel="noopener noreferrer">Check the JoSAA institute directory ↗</a><p class="data-note">A directory entry does not establish an open application window. Check the current counselling session, course eligibility and institution notices before applying.</p></section>`;
}

module.exports = { render };
