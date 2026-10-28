(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BtechCollegeCards = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const money = amount => `₹${Number(amount).toLocaleString('en-IN')}`;
  function render(c) {
    const url = '/colleges/' + e(c.slug) + '/';
    const initials = c.name.split(/\s+/).slice(0,3).map(word => word[0]).join('');
    const fee = c.feeSummary;
    const value = fee ? `${money(fee.amount)} / ${fee.period === 'year' ? 'year' : fee.period}` : c.feesPerYear == null ? 'Check official schedule' : `${money(c.feesPerYear)} / year`;
    const title = fee ? `${fee.scope} · ${fee.year}` : c.verified ? `Source year ${c.dataYear}` : 'Current programme fees need confirmation';
    const branches = c.branchPreview || (c.branches || []).slice(0,2);
    return `<article class="college-card" data-college="${e(c.slug)}"><a class="college-image ${c.image ? '' : 'college-image-fallback'}" href="${url}" aria-label="Explore ${e(c.name)}">${c.image ? `<img src="${e(c.image)}" width="600" height="360" loading="lazy" alt="${e(c.name)} campus">` : `<span class="college-monogram" aria-hidden="true">${e(initials)}</span><span class="college-fallback-line" aria-hidden="true"></span>`}<span class="type-badge">${e(c.type === 'State' ? 'State institution' : c.type)}</span></a><button class="save-button icon-button" data-save="${e(c.slug)}" aria-label="Save ${e(c.name)}" aria-pressed="false"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg></button><div class="college-card-body"><p class="college-location">${e(c.city)}<span aria-hidden="true"> · </span>${e(c.state)}</p><h3><a href="${url}">${e(c.name)}</a></h3><div class="college-evidence-label ${c.evidence ? 'has-source' : ''}"><span aria-hidden="true">${c.evidence ? '↗' : '○'}</span> ${c.evidence ? 'Official-source details' : 'Explore & verify'}</div><div class="college-facts"><div class="college-fee-fact"><span>${e(fee?.label || 'Annual tuition')}</span><strong>${e(value)}</strong><small title="${e(title)}">${e(title)}</small></div><div><span>Listed admission route</span><strong>${e(c.admissionMode || 'Confirm with institution')}</strong></div></div>${branches.length ? `<p class="college-branch-preview"><span>Listed:</span> ${branches.map(e).join(' · ')}</p>` : ''}<div class="card-bottom"><label class="compare-check"><input type="checkbox" data-compare="${e(c.slug)}"> Compare</label><a href="${url}" class="card-link">View details <span aria-hidden="true">→</span></a></div></div></article>`;
  }
  return { render };
});
