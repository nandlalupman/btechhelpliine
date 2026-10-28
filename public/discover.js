(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const read = (key, fallback) => { try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { toast('Browser storage is unavailable. Your changes last only for this visit.'); return false; } };
  const token = () => { try { return localStorage.getItem('token'); } catch { return null; } };
  let colleges = JSON.parse($('#catalogue-data')?.textContent || '[]');
  const find = slug => colleges.find(c => c.slug === slug);
  const cleanList = value => Array.isArray(value) ? [...new Set(value.filter(x => typeof x === 'string' && /^[a-z0-9-]{1,200}$/.test(x)))].slice(0, 100) : [];
  let saved = cleanList(read('btech:saved', []));
  let compared = cleanList(read('btech:compare', [])).filter(find).slice(0, 3);
  const path = document.body.dataset.page;
  let toastTimer;
  function toast(message) { const el = $('.toast'); if (!el) return; el.textContent = message; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 3500); }
  function track(name, params = {}) { if (window.BtechConsent?.allowed()) window.gtag?.('event', name, params); }
  function updateControls() {
    $$('[data-saved-count]').forEach(el => el.textContent = saved.length);
    $$('[data-save]').forEach(button => { const active = saved.includes(button.dataset.save); button.setAttribute('aria-pressed', String(active)); if (button.classList.contains('save-button')) button.setAttribute('aria-label', `${active ? 'Unsave' : 'Save'} ${find(button.dataset.save)?.name || 'college'}`); else button.textContent = active ? 'Saved to shortlist ✓' : 'Save to shortlist'; });
    $$('[data-compare]').forEach(input => input.checked = compared.includes(input.dataset.compare));
    $$('[data-compare-count]').forEach(el => el.textContent = compared.length);
    const dock = $('.compare-dock'); if (dock) dock.hidden = !compared.length || path === '/compare/';
    $$('[data-compare-link]').forEach(a => a.href = `/compare/?colleges=${compared.join(',')}`);
  }
  async function syncSave(c, active) {
    const authToken = token();
    if (!authToken || !c?.id) return;
    try {
      const response = await fetch(active ? '/api/user/choices' : `/api/user/choices/${c.id}`, { method: active ? 'POST' : 'DELETE', headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' }, ...(active ? { body: JSON.stringify({ collegeId: c.id }) } : {}) });
      if (!response.ok) { const result = await response.json(); if (!String(result.error).includes('already')) toast('Saved on this browser. Account sync is unavailable right now.'); }
    } catch { toast('Saved on this browser. Account sync is unavailable right now.'); }
  }
  function toggleSave(slug) {
    const active = !saved.includes(slug);
    saved = active ? [...saved, slug] : saved.filter(s => s !== slug);
    write('btech:saved', saved); updateControls();
    toast(active ? 'Added to your shortlist.' : 'Removed from your shortlist.');
    track(active ? 'save_college' : 'unsave_college', { college_slug: slug });
    syncSave(find(slug), active);
    if (path === '/shortlist/') renderDirectory();
  }
  function toggleCompare(slug, active) {
    if (!find(slug)) return;
    const shouldAdd = active ?? !compared.includes(slug);
    if (shouldAdd && !compared.includes(slug)) {
      if (compared.length === 3) { toast('Choose up to three colleges. Remove one to add another.'); updateControls(); return; }
      compared.push(slug);
    } else if (!shouldAdd) compared = compared.filter(s => s !== slug);
    write('btech:compare', compared); updateControls();
  }
  const money = n => n == null ? 'Not verified' : `₹${Math.round(n).toLocaleString('en-IN')}`;
  const smallArrow = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg>';
  function card(c) { return window.BtechCollegeCards.render(c); }
  let featuredSlugs = $("#featured-grid [data-college]").map(node => node.dataset.college);
  function renderFeatured(value = "All") {
    const selected = value === "All" ? featuredSlugs.map(find).filter(Boolean) : colleges.filter(c => c.state === value || c.type === value).slice(0,6);
    const grid = $("#featured-grid"); if (!grid) return;
    grid.innerHTML = selected.length ? selected.map(card).join("") : "<p>No matching listings in this selection. Explore the full directory.</p>";
    const status = $("#featured-status"); if (status) status.textContent = `${selected.length} listings to explore${value === "All" ? "" : " · " + value}. Check programme and source details before deciding.`;
    updateControls();
  }
  let limit = 12;
  const filters = $('#directory-filters');
  const params = new URLSearchParams(location.search);
  const sharedSaved = path === '/shortlist/' ? cleanList((params.get('colleges') || '').split(',')).filter(find) : [];
  if (sharedSaved.length) { $('.page-intro h1').textContent = 'A shortlist to explore together.'; $('.page-intro>p').textContent = 'This shared list is separate from your saved colleges. Save the ones you like to your own shortlist.'; }
  if (filters) ['q', 'state', 'type'].forEach(key => { filters.elements[key].value = params.get(key) || ''; });
  function renderDirectory() {
    const grid = $('#directory-grid'); if (!grid) return;
    const q = (filters?.elements.q.value || '').trim().toLowerCase();
    const state = filters?.elements.state.value;
    const type = filters?.elements.type.value;
    const list = colleges.filter(c => (!q || `${c.name} ${c.city} ${c.state}`.toLowerCase().includes(q)) && (!state || c.state === state) && (!type || c.type === type) && (path !== '/shortlist/' || (sharedSaved.length ? sharedSaved : saved).includes(c.slug)));
    $('#results-count').textContent = `${list.length} ${list.length === 1 ? 'college' : 'colleges'}${q || state || type ? ' found' : path === '/shortlist/' ? ' in this shortlist' : ' to explore'}`;
    grid.innerHTML = list.length ? list.slice(0, limit).map(card).join('') : `<div class="empty-state"><h3>${path === '/shortlist/' ? 'Your next chapter starts with a possibility.' : 'Let’s try a different search.'}</h3><p>${path === '/shortlist/' ? 'Tap the heart on a college to keep it here.' : 'Try a college name, a nearby city, or clear the filters.'}</p><a class="button button-small" href="/colleges/">Explore colleges ${smallArrow}</a></div>`;
    $('#load-more').hidden = list.length <= limit;
    updateControls();
  }
  function updateFilterUrl() {
    const url = new URL(location.href);
    ['q', 'state', 'type'].forEach(key => { const value = filters.elements[key].value.trim(); if (value) url.searchParams.set(key, value); else url.searchParams.delete(key); });
    history.replaceState(null, '', url.pathname + url.search);
  }
  filters?.addEventListener('submit', event => { event.preventDefault(); limit = 12; updateFilterUrl(); renderDirectory(); track('filter_colleges'); });
  filters?.addEventListener('change', () => { limit = 12; updateFilterUrl(); renderDirectory(); });
  let searchTimer;
  filters?.elements.q.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { limit = 12; updateFilterUrl(); renderDirectory(); }, 180); });
  $('#load-more')?.addEventListener('click', () => { limit += 12; renderDirectory(); });
  $('[data-reset-filters]')?.addEventListener('click', () => { filters.reset(); filters.elements.q.value = ''; filters.elements.state.value = ''; filters.elements.type.value = ''; limit = 12; updateFilterUrl(); renderDirectory(); });
  $$('[data-feature-filter]').forEach(button => button.addEventListener('click', () => {
    const value = button.dataset.featureFilter;
    renderFeatured(value);
    $$('[data-feature-filter]').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', String(b === button)); });
    updateControls(); track('browse_featured', { category: value });
  }));
  async function copy(text) { try { await navigator.clipboard.writeText(text); toast('Link copied. Share it with someone you trust.'); } catch { const field = document.createElement('textarea'); field.value = text; field.style.cssText = 'position:fixed;left:10px;top:10px;z-index:9999'; document.body.append(field); field.select(); const ok = document.execCommand('copy'); field.remove(); toast(ok ? 'Link copied.' : 'Copy the link from your address bar.'); if (!ok) history.replaceState(null, '', text); } }
  $('[data-share-saved]')?.addEventListener('click', () => {
    const list = sharedSaved.length ? sharedSaved : saved;
    if (!list.length) return toast('Save a college first, then share your shortlist.');
    copy(`${location.origin}/shortlist/?colleges=${list.join(',')}`);
  });
  const slots = $$('[data-compare-slot]');
  if (slots.length) {
    const selected = cleanList((params.get('colleges') || '').split(',')).filter(find).slice(0, 3);
    if (selected.length) compared = selected;
    slots.forEach((select, i) => select.value = compared[i] || '');
    renderComparison();
  }
  function renderComparison() {
    const selected = slots.map(s => find(s.value)).filter(Boolean);
    const table = $('#comparison-table'); if (!table) return;
    if (!selected.length) { table.innerHTML = '<caption>Your college comparison</caption><tbody><tr><th>Ready when you are</th><td>Choose a college above to begin.</td></tr></tbody>'; return; }
    const rows = [
      ['College', c => `<a href="/colleges/${esc(c.slug)}/">${esc(c.name)}</a>`], ['Location', c => esc(`${c.city}, ${c.state}`)], ['Type', c => esc(c.type)],
      ['Published fee component', c => c.feeSummary ? `${esc(c.feeSummary.label)}: ${money(c.feeSummary.amount)} / ${esc(c.feeSummary.period)}<br><small>${esc(c.feeSummary.scope)} · ${esc(c.feeSummary.year)}</small>` : 'No reviewed programme fee snapshot'], ['Listed admission route', c => esc(c.admissionMode)], ['Annual tuition', c => money(c.feesPerYear)], ['Annual hostel', c => money(c.hostelPerYear)],
      ['Annual mess', c => money(c.messPerYear)], ['Other annual mandatory fees', c => money(c.mandatoryFeesPerYear)],
      ['Median placement', c => c.medianPlacement == null ? 'Not verified' : `₹${c.medianPlacement} LPA`],
      ['Listed branches', c => c.branches.map(esc).join('<br>') || 'Confirm with institution'],
      ['Source & year', c => c.verified ? `<a href="${esc(c.sourceUrl)}" rel="noopener" target="_blank">${esc(c.dataYear)} · verified ${esc(c.verifiedAt)} ↗</a>` : 'Current numeric data not verified'],
      ['Partnership', c => c.partner ? 'Institution partner; data verification is separate' : 'Directory listing; no partnership implied']
    ];
    table.innerHTML = `<caption>Your college comparison</caption><tbody>${rows.map(([label, value], i) => `<tr><th scope="row">${label}</th>${selected.map(c => `<td class="${i === 0 ? 'compare-name' : ''}">${value(c)}</td>`).join('')}</tr>`).join('')}</tbody>`;
  }
  slots.forEach(slot => slot.addEventListener('change', () => {
    const value = slot.value;
    if (value && slots.some(s => s !== slot && s.value === value)) { slot.value = ''; toast('That college is already in your comparison.'); }
    compared = slots.map(s => s.value).filter(Boolean); write('btech:compare', compared);
    history.replaceState(null, '', `/compare/${compared.length ? `?colleges=${compared.join(',')}` : ''}`);
    renderComparison(); updateControls(); track('compare_colleges', { count: compared.length });
  }));
  $('[data-share-compare]')?.addEventListener('click', () => compared.length ? copy(`${location.origin}/compare/?colleges=${compared.join(',')}`) : toast('Choose at least one college first.'));
  document.addEventListener('click', event => {
    const save = event.target.closest('[data-save]'); if (save) toggleSave(save.dataset.save);
    const add = event.target.closest('[data-add-compare]'); if (add) { toggleCompare(add.dataset.addCompare, true); toast('Your comparison is ready in the bar below.'); }
    if (event.target.closest('[data-clear-compare]')) { compared = []; write('btech:compare', compared); updateControls(); }
    const navLink = event.target.closest('.navigation a'); if (navLink) { $('.navigation').classList.remove('open'); $('.nav-toggle').setAttribute('aria-expanded', 'false'); }
  });
  document.addEventListener('change', event => { if (event.target.matches('[data-compare]')) toggleCompare(event.target.dataset.compare, event.target.checked); });
  $('.nav-toggle')?.addEventListener('click', () => { const open = $('.navigation').classList.toggle('open'); $('.nav-toggle').setAttribute('aria-expanded', String(open)); $('.nav-toggle').setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation'); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { $('.navigation').classList.remove('open'); $('.nav-toggle').setAttribute('aria-expanded', 'false'); } });
  const budgetForm = $('#budget-form');
  if (budgetForm) {
    const values = read('btech:budget', {});
    [...budgetForm.elements].forEach(el => { if (el.name && values[el.name] != null) el.value = values[el.name]; });
    function calculate() {
      const data = Object.fromEntries(new FormData(budgetForm));
      try { const result = window.BtechPlanning.budget(data); $('#budget-total').textContent = money(result.total); $('#budget-note').textContent = result.total ? 'Based on your inputs. Confirm all costs with your institution.' : 'Add your figures to build a planning estimate.'; $('#budget-years').innerHTML = result.years.map((n, i) => `<div class="budget-year"><span>Year ${i + 1}</span><strong>${money(n)}</strong></div>`).join(''); write('btech:budget', data); } catch (error) { $('#budget-note').textContent = error.message; }
    }
    budgetForm.addEventListener('submit', event => { event.preventDefault(); if (budgetForm.reportValidity()) { calculate(); track('calculate_budget'); } });
    budgetForm.addEventListener('reset', () => { try { localStorage.removeItem('btech:budget'); } catch {} setTimeout(calculate, 0); });
    if (Object.keys(values).length) calculate();
    const tasks = read('btech:tasks', {});
    $$('[data-task]').forEach(input => { input.checked = tasks[input.dataset.task] === true; input.addEventListener('change', () => { tasks[input.dataset.task] = input.checked; write('btech:tasks', tasks); }); });
  }
  $('#enquiry-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget; if (!form.reportValidity()) return;
    const status = $('.form-status'); const submit = form.querySelector('[type=submit]');
    const data = Object.fromEntries(new FormData(form));
    data.contactConsent = form.elements.contactConsent.checked;
    data.partnerConsent = form.elements.partnerConsent.checked;
    if (!data.jeeRank) delete data.jeeRank;
    submit.disabled = true; status.textContent = 'Sending your request…';
    try {
      const response = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token() ? { Authorization: `Bearer ${token()}` } : {}) }, body: JSON.stringify(data) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(response.status === 503 ? 'Online requests are temporarily unavailable. Call +91 95096 98089 or message us on WhatsApp.' : result.error || 'We could not send your request. Please try again.');
      const key = result.data?.accessKey;
      if (key) window.BtechMessages?.remember(result.data.leadId, key, 'Admission counselling');
      status.textContent = 'Request saved. Our team will review it. ';
      if (key) { const label = document.createElement('span'); label.textContent = 'Keep this private tracking code: '; const code = document.createElement('code'); code.className = 'message-reference'; code.textContent = key; status.append(label, code); }
      const link = document.createElement('a'); link.href = '/messages/'; link.textContent = 'Open your messages →'; status.append(link);
      form.reset(); track('generate_lead', { method: 'counselling_form' });
    } catch (error) { status.textContent = error.message || 'Could not connect. Please call +91 95096 98089.'; }
    finally { submit.disabled = false; }
  });
  renderDirectory(); updateControls();
  // A static hosting fallback may precede the dynamic root route. Refresh its
  // featured cards from the public catalogue when live records are available.
  if (path === '/') fetch('/api/discovery').then(r => r.ok ? r.json() : null).then(result => {
    if (!result?.live || !Array.isArray(result.colleges)) return;
    colleges = result.colleges;
    featuredSlugs = result.featuredSlugs || featuredSlugs;
    renderFeatured($("[data-feature-filter].active")?.dataset.featureFilter || "All");
    updateControls();
  }).catch(() => {});
  // Merge real account choices into the browser list; never erase a local shortlist.
  if (colleges.length && token()) fetch('/api/user/choices', { headers: { Authorization: `Bearer ${token()}` } }).then(r => r.ok ? r.json() : null).then(result => {
    if (result?.success && Array.isArray(result.data)) { const ids = result.data.map(c => c._id); saved = [...new Set([...saved, ...colleges.filter(c => c.id && ids.includes(c.id)).map(c => c.slug)])]; write('btech:saved', saved); updateControls(); if (path === '/shortlist/') renderDirectory(); }
  }).catch(() => {});
})();
