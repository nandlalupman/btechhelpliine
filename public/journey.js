(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reviewImages = values => (Array.isArray(values) ? values : []).filter(value => typeof value === "string" && value.length <= 400000 && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)).slice(0, 3).map(value => `<img class="journey-review-image" src="${e(value)}" alt="User submitted campus photo" loading="lazy" width="240" height="160">`).join("");
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const save = (key, value) => { localStorage.setItem(key, JSON.stringify(value)); };
  const token = () => { try { return localStorage.getItem('token') || ''; } catch { return ''; } };
  const date = value => new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  const localDate = value => { const d = new Date(value); return new Date(+d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
  const safeLink = value => { try { const url = new URL(value, location.origin); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; } catch { return ''; } };
  const feedback = (selector, message, error = false) => { const target = $(selector); if (target) { target.textContent = message; target.classList.toggle('journey-feedback-error', error); } };
  async function api(url, { method = 'GET', body, auth = false } = {}) {
    const response = await fetch(url, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(auth ? { Authorization: `Bearer ${token()}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw new Error(result.error || 'Service unavailable. Please try again.');
    return result;
  }
  function submit(form, task, errorSelector) {
    form?.addEventListener('submit', async event => {
      event.preventDefault(); const button = form.querySelector('[type=submit]'); if (button) button.disabled = true;
      try { await task(Object.fromEntries(new FormData(form)), form); } catch (error) { feedback(errorSelector, error.message, true); }
      finally { if (button) button.disabled = false; }
    });
  }
  let language = read('btech:tool-language', 'en');
  const translate = () => { document.querySelectorAll('[data-en][data-hi]').forEach(node => { node.textContent = node.dataset[language]; node.lang = language; }); };
  translate();
  $('[data-journey-language]')?.addEventListener('click', () => { language = language === 'en' ? 'hi' : 'en'; translate(); try { save('btech:tool-language', language); } catch {} });
  const rankForm = $('#rank-explorer');
  if (rankForm) {
    const basis = () => { const category = rankForm.elements.category.value; feedback('#rank-basis', category === 'OPEN' ? 'For OPEN seats, enter your Common Rank List (CRL) rank.' : category.includes('PwD') ? 'Enter your PwD rank within this category, not your CRL.' : `Enter your ${category} category rank, not your CRL.`); };
    rankForm.elements.category.addEventListener('change', basis);
    submit(rankForm, async values => {
      feedback('#rank-status', 'Checking the selected historical seat dimensions…');
      const { data } = await api('/api/tools/ranks', { method: 'POST', body: { ...values, rank: Number(values.rank), includeBeyond: rankForm.elements.includeBeyond.checked } });
      feedback('#rank-status', `${data.total.toLocaleString('en-IN')} matching historical rows. Showing ${data.records.length}. Rank basis: ${data.rankBasis}.`);
      $('#rank-results').innerHTML = data.records.length ? `<div class="journey-table-wrap"><table class="journey-table"><caption>JoSAA ${e(data.year)} · Round ${e(data.round)} · Historical seat comparisons</caption><thead><tr><th>Institute & programme</th><th>Seat dimensions</th><th>Opening</th><th>Closing</th><th>Your comparison</th></tr></thead><tbody>${data.records.map(row => `<tr><td><strong>${e(row.institute)}</strong><small>${e(row.programme)}</small></td><td>${e(row.exam)}<br>${e(row.category)} · ${e(row.quota)}<small>${e(row.gender)}</small></td><td>${e(row.opening)}</td><td>${e(row.closing)}</td><td><span class="journey-badge ${row.withinClosing ? '' : 'warning'}">${row.withinClosing ? 'Within closing rank' : 'Beyond closing rank'}</span></td></tr>`).join('')}</tbody></table></div><p class="data-note">A rank at or below a historical closing rank is a comparison only. Seat eligibility, choices, availability, rules and cutoffs can change. <a href="${e(safeLink(data.source))}" target="_blank" rel="noopener">Check the official source ↗</a></p>` : '<div class="journey-empty"><h2>No matching rows for these filters.</h2><p>Check the exam, rank basis and quota, or remove programme and institute filters. This does not establish that you have no admission options.</p></div>';
    }, '#rank-status');
  }
  const applicationForm = $('#application-form');
  if (applicationForm) {
    let applications = [], account = false, storageReady = false;
    const key = 'btech:applications';
    const list = $('#application-list');
    const render = () => {
      applications.sort((a, b) => +new Date(a.deadline) - +new Date(b.deadline));
      list.innerHTML = applications.length ? applications.map(item => `<article class="journey-task"><span class="journey-badge ${+new Date(item.deadline) < Date.now() && !['closed', 'reported'].includes(item.status) ? 'warning' : ''}">${e(item.status)}</span><h3>${e(item.title)}</h3><time datetime="${e(item.deadline)}">${date(item.deadline)}</time>${safeLink(item.sourceUrl) ? `<a href="${e(safeLink(item.sourceUrl))}" target="_blank" rel="noopener">Check saved source ↗</a>` : '<p>No source saved. Confirm this date with the official authority.</p>'}${item.notes ? `<p>${e(item.notes)}</p>` : ''}<p>${item.emailReminder ? item.reminderSentAt ? 'Email reminder processed' : 'Email reminder enabled' : 'Email reminder off'}</p><div class="button-row"><button class="text-button" data-edit-application="${e(item._id)}">Edit</button><button class="text-button" data-delete-application="${e(item._id)}">Remove</button></div></article>`).join('') : '<div class="journey-empty"><h2>Make a little room for your next step.</h2><p>Add an application, document check or reporting deadline using the current official notice.</p></div>';
    };
    const load = async () => {
      if (token()) { const result = await api('/api/journey/applications', { auth: true }); account = true; applications = result.data; feedback('#application-storage', 'Saved in your account'); }
      else { applications = read(key, []); feedback('#application-storage', 'Saved on this browser'); }
      const hint = new URLSearchParams(location.search);
      if (hint.get('task') && !applicationForm.elements.title.value) { applicationForm.elements.title.value = hint.get('task').slice(0,160); const source = hint.get('source'); if (source && /^https?:\/\//i.test(source)) applicationForm.elements.sourceUrl.value = safeLink(source); }
      storageReady = true;
      applicationForm.elements.emailReminder.disabled = !account;
      render();
      const local = read(key, []);
      if (account && local.length) {
        feedback('#application-message', `${local.length} browser-only tasks are still on this device. They have not been copied into your account.`);
        const button = document.createElement('button'); button.type = 'button'; button.className = 'text-button'; button.textContent = 'Copy browser tasks to my account';
        button.addEventListener('click', async () => { button.disabled = true; try { while (local.length) { const item = local[0]; const result = await api('/api/journey/applications', { method: 'POST', auth: true, body: { ...item, emailReminder: false } }); applications.push(result.data); local.shift(); save(key, local); } button.remove(); render(); feedback('#application-message', 'Browser tasks copied into your account.'); } catch (error) { feedback('#application-message', error.message, true); button.disabled = false; } });
        $('#application-message').after(button);
      }
    };
    load().catch(error => { feedback('#application-message', `${error.message} Log in again to use account storage.`, true); });
    submit(applicationForm, async values => {
      if (!storageReady) throw new Error('The saved list is not ready. Refresh, or log in again.');
      const payload = { ...values, deadline: new Date(values.deadline).toISOString(), emailReminder: account && applicationForm.elements.emailReminder.checked };
      let item;
      if (account) item = (await api('/api/journey/applications' + (values.id ? '/' + values.id : ''), { method: values.id ? 'PUT' : 'POST', auth: true, body: payload })).data;
      else item = { ...payload, _id: values.id || crypto.randomUUID(), emailReminder: false };
      const next = [...applications.filter(row => row._id !== item._id), item];
      if (!account) save(key, next);
      applications = next; render(); applicationForm.reset(); feedback('#application-message', account ? 'Task saved to your account.' : 'Task saved on this browser.');
    }, '#application-message');
    applicationForm.addEventListener('reset', () => { setTimeout(() => { applicationForm.elements.id.value = ''; }, 0); });
    list.addEventListener('click', async event => {
      const edit = event.target.closest('[data-edit-application]'), remove = event.target.closest('[data-delete-application]');
      if (edit) { const item = applications.find(row => row._id === edit.dataset.editApplication); if (!item) return; for (const name of ['title', 'sourceUrl', 'notes', 'status']) applicationForm.elements[name].value = item[name] || ''; applicationForm.elements.id.value = item._id; applicationForm.elements.deadline.value = localDate(item.deadline); applicationForm.elements.emailReminder.checked = item.emailReminder; applicationForm.elements.title.focus(); }
      if (remove) { remove.disabled = true; try { const id = remove.dataset.deleteApplication; if (account) await api('/api/journey/applications/' + id, { method: 'DELETE', auth: true }); const next = applications.filter(row => row._id !== id); if (!account) save(key, next); applications = next; render(); feedback('#application-message', 'Task removed.'); } catch (error) { feedback('#application-message', error.message, true); remove.disabled = false; } }
    });
    $('#export-calendar').addEventListener('click', () => {
      if (!applications.length) return feedback('#application-message', 'Add a task before exporting a calendar.');
      const stamp = d => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
      const text = value => String(value || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
      const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BtechHelpline//Application tracker//EN', 'CALSCALE:GREGORIAN', ...applications.flatMap(item => ['BEGIN:VEVENT', `UID:${item._id}@btechhelpline.com`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(item.deadline)}`, `SUMMARY:${text(item.title)}`, `DESCRIPTION:${text([item.notes, item.sourceUrl, 'User-entered deadline. Confirm the official source.'].filter(Boolean).join('\n'))}`, 'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:Saved application deadline tomorrow', 'END:VALARM', 'END:VEVENT']), 'END:VCALENDAR'];
      // Fold long content lines at UTF-8 octet boundaries for calendar importers.
      const folded = lines.map(line => { let output = '', bytes = 0; for (const character of line) { const size = new TextEncoder().encode(character).length; if (bytes + size > 73) { output += '\r\n '; bytes = 1; } output += character; bytes += size; } return output; }).join('\r\n') + '\r\n';
      const url = URL.createObjectURL(new Blob([folded], { type: 'text/calendar;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = 'btechhelpline-applications.ics'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); feedback('#application-message', 'Calendar downloaded. Import it into your calendar app and check its reminder settings.');
    });
  }
  const bookingForm = $('#booking-form');
  if (bookingForm) {
    const slots = bookingForm.elements.slotId;
    const loadSlots = async () => { const result = await api('/api/journey/slots'); slots.innerHTML = '<option value="">Choose an available session</option>' + result.data.map(slot => `<option value="${e(slot._id)}">${date(slot.startAt)} · ${e(slot.durationMinutes)} min · ${e(slot.label)}</option>`).join(''); feedback('#slot-message', result.data.length ? 'Sessions are shown in your device’s time zone.' : 'No sessions are currently published. Please send a counselling request below.'); feedback('#booking-environment', result.localPreview ? 'Local preview: these development slots do not represent live team availability.' : 'Only sessions published by our team appear here.'); };
    loadSlots().catch(error => { slots.innerHTML = '<option value="">Sessions unavailable</option>'; feedback('#slot-message', error.message, true); });
    submit(bookingForm, async values => {
      const result = await api('/api/journey/appointments/' + values.slotId, { method: 'POST', body: { ...values, contactConsent: bookingForm.elements.contactConsent.checked } });
      const reference = result.data.reference;
      $('#booking-result').innerHTML = `<h3>Session booked.</h3><p>${date(result.data.startAt)} · ${e(result.data.durationMinutes)} minutes</p><p>Your private reference: <strong>${e(reference)}</strong></p><p>${result.notification === 'local-preview' ? 'Confirmation saved in the local preview inbox.' : result.notification === 'smtp' ? 'Confirmation email sent.' : 'Email confirmation could not be delivered. Keep this reference to manage your booking.'}</p>`;
      try { save('btech:booking-reference', reference); } catch {}
      $('#booking-manage').elements.reference.value = reference; bookingForm.reset(); await loadSlots();
    }, '#booking-result');
    const manage = $('#booking-manage'); manage.elements.reference.value = read('btech:booking-reference', '');
    const showBooking = async cancel => { const result = await api('/api/journey/appointments/manage', { method: 'POST', body: { reference: manage.elements.reference.value.trim(), cancel } }); const item = result.data; $('#booking-detail').innerHTML = `<div class="journey-task"><span class="journey-badge">${e(item.status)}</span><p>${item.slot ? date(item.slot.startAt) + ' · ' + e(item.slot.durationMinutes) + ' minutes' : 'Session details unavailable'}</p>${item.status === 'booked' ? '<button class="text-button" id="cancel-booking">Cancel this appointment</button>' : ''}</div>`; $('#cancel-booking')?.addEventListener('click', () => { showBooking(true).then(loadSlots).catch(error => feedback('#booking-detail', error.message, true)); }); };
    submit(manage, () => showBooking(false), '#booking-detail');
  }
  const helpForm = $('#guide-assistant');
  if (helpForm) {
    submit(helpForm, async values => { const { data } = await api('/api/tools/help', { method: 'POST', body: { ...values, language } }); $('#help-answer').innerHTML = `<span class="eyebrow">FROM OUR PUBLISHED GUIDES</span><h2>${e(data.title)}</h2><p>${e(data.answer)}</p>${(data.sections || []).map(section => `<h3>${e(section.title)}</h3><p>${e(section.text)}</p>`).join('')}<div class="reading-list">${data.links.map(link => `<p><a href="${e(safeLink(link.url))}"${link.url.startsWith('https:') ? ' target="_blank" rel="noopener"' : ''}>${e(link.title)} →</a></p>`).join('')}</div>${data.note ? `<p class="data-note">${e(data.note)}</p>` : ''}`; }, '#help-answer');
    document.querySelectorAll('[data-help-prompt]').forEach(button => button.addEventListener('click', () => { helpForm.elements.question.value = button.dataset.helpPrompt; helpForm.requestSubmit(); }));
  }
  async function staff() {
    if (!$('#staff-workspace') || !token()) return;
    const me = (await api('/api/user/me', { auth: true })).data;
    if (!['admin', 'counsellor'].includes(me.role)) throw new Error('This workspace requires an administrator or counsellor account.');
    feedback('#staff-auth', `Signed in as ${me.name} · ${me.role}`); $('#staff-workspace').hidden = false;
    const refreshSlots = async () => { const { data } = await api('/api/journey/staff/slots', { auth: true }); $('#staff-slots').innerHTML = data.length ? data.map(slot => `<article class="journey-task"><strong>${e(slot.label)}</strong><p>${date(slot.startAt)} · ${e(slot.durationMinutes)} min · ${slot.cancelled ? 'Cancelled' : slot.booked ? 'Booked' : 'Available'}</p>${!slot.cancelled && !slot.booked ? `<button class="text-button" data-remove-slot="${e(slot._id)}">Remove availability</button>` : ''}</article>`).join('') : '<p>No slots published yet.</p>'; };
    const refreshAppointments = async () => { const { data } = await api('/api/journey/staff/appointments', { auth: true }); $('#staff-appointments').innerHTML = data.length ? data.map(item => `<form class="journey-review" data-staff-appointment="${e(item._id)}"><h3>${e(item.name)} · ${e(item.status)}</h3><p>${item.slotId ? date(item.slotId.startAt) : 'Session unavailable'}<br>${e(item.email)} · ${e(item.phone)}</p><p>${e(item.question)}</p><label>Status<select name="status">${['booked', 'completed', 'cancelled'].map(s => `<option${s === item.status ? ' selected' : ''}>${s}</option>`).join('')}</select></label><label>Private team notes<textarea name="staffNotes" maxlength="2000">${e(item.staffNotes)}</textarea></label><button class="button button-small" type="submit">Save appointment</button><p role="status"></p></form>`).join('') : '<p>No bookings yet.</p>'; document.querySelectorAll('[data-staff-appointment]').forEach(form => form.addEventListener('submit', async event => { event.preventDefault(); const status = form.querySelector('[role=status]'); try { await api('/api/journey/staff/appointments/' + form.dataset.staffAppointment, { method: 'PATCH', auth: true, body: Object.fromEntries(new FormData(form)) }); status.textContent = 'Saved'; await refreshSlots(); } catch (error) { status.textContent = error.message; } })); };
    submit($('#slot-form'), async values => { await api('/api/journey/staff/slots', { method: 'POST', auth: true, body: { ...values, startAt: new Date(values.startAt).toISOString(), durationMinutes: Number(values.durationMinutes) } }); feedback('#slot-form-message', 'Session published.'); await refreshSlots(); }, '#slot-form-message');
    $('#staff-slots').addEventListener('click', async event => { const button = event.target.closest('[data-remove-slot]'); if (!button) return; try { await api('/api/journey/staff/slots/' + button.dataset.removeSlot, { method: 'DELETE', auth: true }); await refreshSlots(); } catch (error) { feedback('#slot-form-message', error.message, true); } });
    await Promise.all([refreshSlots(), refreshAppointments()]);
    if (me.role === 'admin') {
      $('#review-moderation').hidden = false;
      const reviews = async () => { const { data } = await api('/api/journey/staff/reviews', { auth: true }); $('#staff-reviews').innerHTML = data.length ? data.map(item => `<article class="journey-review"><h3>${e(item.collegeId?.name || 'College')} · ${e(item.rating)}/5</h3><p>${e(item.studentName)} · ${e(item.moderationStatus || 'Legacy, awaiting review')}</p><p>${e(item.comment)}</p>${reviewImages(item.images)}<div class="button-row"><button class="text-button" data-review-id="${e(item._id)}" data-review-status="published">Publish</button><button class="text-button" data-review-id="${e(item._id)}" data-review-status="rejected">Reject</button></div></article>`).join('') : '<p>No reviews awaiting moderation.</p>'; };
      await reviews();
      $('#staff-reviews').addEventListener('click', async event => { const button = event.target.closest('[data-review-id]'); if (!button) return; try { await api('/api/journey/staff/reviews/' + button.dataset.reviewId, { method: 'PATCH', auth: true, body: { status: button.dataset.reviewStatus } }); await reviews(); } catch (error) { feedback('#reminder-result', error.message, true); } });
      $('#run-reminders').addEventListener('click', async () => { try { const { data } = await api('/api/journey/staff/reminders/run', { method: 'POST', auth: true }); feedback('#reminder-result', `${data.sent} reminders processed, ${data.failed} failed. Delivery: ${data.delivery}.`); } catch (error) { feedback('#reminder-result', error.message, true); } });
    }
  }
  staff().catch(error => feedback('#staff-auth', error.message, true));
  const outbox = $('#local-outbox');
  if (outbox) {
    const load = async () => { const { data } = await api('/api/dev/outbox'); outbox.innerHTML = data.length ? data.map(item => `<article class="journey-message"><time>${date(item.createdAt)} · Local preview</time><h3>${e(item.subject)}</h3><p>To: ${e(item.to)}</p><pre>${e(item.text)}</pre></article>`).join('') : '<p>No local messages yet. Register a test account to receive a verification OTP.</p>'; };
    load().catch(error => feedback('#local-outbox', error.message, true)); $('#refresh-outbox').addEventListener('click', () => load().catch(error => feedback('#local-outbox', error.message, true)));
  }
  const reviews = $('[data-college-reviews]');
  if (reviews) {
    const target = reviews.querySelector('[data-public-reviews]');
    if (!reviews.dataset.collegeReviews) target.textContent = 'Reviews are available when the online directory is connected.';
    else api('/api/colleges/' + reviews.dataset.collegeReviews + '/reviews').then(({ data }) => { target.innerHTML = data.length ? data.map(item => `<article class="journey-review"><h3>${e(item.studentName)} · ${e(item.rating)}/5</h3><p>${e(item.comment)}</p>${reviewImages(item.images)}<small>${new Date(item.createdAt).toLocaleDateString('en-IN')}</small></article>`).join('') : '<p>No published reviews yet.</p>'; }).catch(() => { target.textContent = 'Reviews are temporarily unavailable.'; });
  }
})();
