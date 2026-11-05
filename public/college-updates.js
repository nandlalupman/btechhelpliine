(() => {
  const button = document.getElementById('apply-college-updates');
  const status = document.getElementById('college-update-status');
  if (!button || !status) return;
  const base = typeof API_URL === 'string' ? API_URL : location.origin;
  async function request(path = '', method = 'GET') {
    const response = await fetch(base + '/api/admin/college-updates' + path, {
      method, headers: { Authorization: 'Bearer ' + window.BtechSession.read('token') },
      signal: AbortSignal.timeout(25000)
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || 'Could not apply the reviewed directory update. Retry shortly.');
    return result.data;
  }
  async function refresh(prefix = '') {
    const data = await request();
    status.textContent = prefix + data.imported + ' of ' + data.additionalInstitutions + ' reviewed source records are in the database. ' + data.sourceLabel + ' · source year ' + data.sourceYear + ' · reviewed ' + data.reviewedAt + '.';
  }
  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      const result = await request('/sync', 'POST');
      await refresh('Applied: ' + result.added + ' new colleges. ');
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
  });
  refresh().catch(error => { status.textContent = error.message; });
})();
