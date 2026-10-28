(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BtechResourceFilters = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function scholarship(record, filters = {}, saved = []) {
    const q = String(filters.q || '').trim().toLowerCase();
    return (!q || String(record.search || '').toLowerCase().includes(q)) &&
      (!filters.state || record.state === 'National' || record.state === filters.state) &&
      (!filters.audience || record.audience === filters.audience) &&
      (!filters.saved || saved.includes(record.id));
  }
  function state(record, filters = {}) {
    return (!filters.q || String(record.search).toLowerCase().includes(String(filters.q).trim().toLowerCase())) && (!filters.kind || record.kind === filters.kind);
  }
  return { scholarship, state };
});
