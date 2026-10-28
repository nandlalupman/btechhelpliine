(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const key = 'btech:saved-scholarships';
  const valid = value => Array.isArray(value) ? [...new Set(value.filter(s => typeof s === 'string' && /^[a-z0-9-]{1,100}$/.test(s)))].slice(0,100) : [];
  let saved = []; try { saved = valid(JSON.parse(localStorage.getItem(key))); } catch {}
  function buttons() { $$('[data-save-scholarship]').forEach(button => { const active = saved.includes(button.dataset.saveScholarship); button.setAttribute('aria-pressed', String(active)); button.textContent = active ? 'Saved ✓' : 'Save +'; }); }
  function notify(text) { const target = $('.toast'); if (target) { target.textContent = text; target.classList.add('visible'); setTimeout(() => target.classList.remove('visible'), 4000); } }
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-save-scholarship]'); if (!button) return;
    const id = button.dataset.saveScholarship, active = saved.includes(id);
    saved = active ? saved.filter(s => s !== id) : valid([...saved,id]);
    try { localStorage.setItem(key, JSON.stringify(saved)); notify(active ? 'Resource removed from your saved list.' : 'Scholarship resource saved on this browser.'); } catch { notify('Browser storage is unavailable. Copy the page link to keep this resource.'); }
    buttons(); filterScholarships();
  });
  const scholarshipForm = $('#scholarship-filters');
  const params = new URLSearchParams(location.search);
  if (scholarshipForm) for (const name of ['q','state','audience']) if (params.has(name)) scholarshipForm.elements[name].value = params.get(name).slice(0,100);
  function filterScholarships() {
    if (!scholarshipForm) return;
    const q = scholarshipForm.elements.q.value.trim().toLowerCase(), state = scholarshipForm.elements.state.value, audience = scholarshipForm.elements.audience.value, onlySaved = scholarshipForm.elements.saved.checked;
    let count = 0;
    $$('[data-scholarship]').forEach(card => {
      const visible = window.BtechResourceFilters.scholarship({ ...card.dataset, id: card.id }, { q, state, audience, saved: onlySaved }, saved);
      card.hidden = !visible; if (visible) count++;
    });
    $('#scholarship-count').textContent = `${count} ${count === 1 ? 'resource' : 'resources'}${state ? ' for ' + state + ' and national schemes' : ' to explore'}`;
    $('#scholarship-empty').hidden = !!count;
  }
  if (scholarshipForm) {
    scholarshipForm.addEventListener('submit', event => { event.preventDefault(); filterScholarships(); });
    scholarshipForm.addEventListener('input', filterScholarships); scholarshipForm.addEventListener('change', filterScholarships);
    $('[data-reset-scholarships]').addEventListener('click', () => { scholarshipForm.reset(); for (const n of ['q','state','audience']) scholarshipForm.elements[n].value = ''; filterScholarships(); });
  }
  const stateForm = $('#state-filters');
  function filterStates() {
    if (!stateForm) return;
    const q = stateForm.elements.q.value.trim().toLowerCase(), kind = stateForm.elements.kind.value; let count = 0;
    $$('[data-state-card]').forEach(card => { const visible = window.BtechResourceFilters.state(card.dataset, { q, kind }); card.hidden = !visible; if (visible) count++; });
    $('#state-count').textContent = `${count} ${count === 1 ? 'place' : 'places'} to explore`; $('#state-empty').hidden = !!count;
  }
  if (stateForm) { stateForm.addEventListener('submit', event => { event.preventDefault(); filterStates(); }); stateForm.addEventListener('input', filterStates); stateForm.addEventListener('change', filterStates); }
  buttons(); filterScholarships(); filterStates();
})();
