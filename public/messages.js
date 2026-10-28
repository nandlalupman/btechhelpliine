(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const date = value => value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set';
  const token = () => { try { return localStorage.getItem('token') || ''; } catch { return ''; } };
  const saved = () => { try { const values = JSON.parse(localStorage.getItem('btech:message-references')) || []; return Array.isArray(values) ? values : []; } catch { return []; } };
  function remember(id, accessKey, subject) {
    const values = saved().filter(item => item.id !== id);
    values.unshift({ id, accessKey, subject: subject || 'Admission counselling' });
    try { localStorage.setItem('btech:message-references', JSON.stringify(values.slice(0, 50))); return true; } catch { return false; }
  }
  window.BtechMessages = { remember };
  async function api(url, method = 'GET', body, auth = true) {
    const response = await fetch(url, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(auth && token() ? { Authorization: 'Bearer ' + token() } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) throw new Error(data.error || 'Could not complete the request. Please try again.');
    return data.data;
  }
  const notice = (selector, message, error = false) => { const node = $(selector); if (node) { node.textContent = message; node.classList.toggle('journey-feedback-error', error); } };
  const busy = (form, value) => form.querySelectorAll('button[type=submit]').forEach(button => { button.disabled = value; });
  function formSubmit(form, action, status) {
    form?.addEventListener('submit', async event => { event.preventDefault(); if (!form.reportValidity()) return; busy(form, true); try { await action(Object.fromEntries(new FormData(form))); } catch (error) { notice(status, error.message, true); } finally { busy(form, false); } });
  }
  const statusLabel = status => String(status || 'new').replace(/_/g, ' ');
  const statuses = ['new', 'contacted', 'in_progress', 'counselled', 'closed', 'dropped', 'cancelled'];
  function history(data) {
    const initial = { senderType: 'student', body: data.request.message || 'Admission counselling request submitted.', createdAt: data.request.createdAt };
    return `<div class="conversation-history">${[initial, ...data.messages].map(message => `<article class="conversation-bubble ${message.kind === 'event' ? 'event' : message.senderType === 'team' ? 'team' : ''}"><strong>${message.kind === 'event' ? 'Request update' : message.senderType === 'team' ? 'BtechHelpline team' : 'Student'}</strong><p>${e(message.body)}</p><small>${date(message.createdAt)}${message.delivery && message.delivery !== 'not-requested' ? ' · Email: ' + e(message.delivery) : ''}</small></article>`).join('')}</div>${data.nextCursor ? '<button class="text-button" data-earlier-messages>Load earlier replies ↑</button>' : ''}`;
  }
  const compose = team => `<form id="conversation-reply" class="message-form"><label>${team ? 'Reply to the student' : 'Add to the conversation'}<textarea name="text" rows="4" maxlength="4000" required placeholder="Write your message…"></textarea></label>${team ? '<label class="journey-check"><input type="checkbox" name="notify"><span>Also email this reply (requires the student’s contact consent and configured delivery).</span></label>' : ''}<button class="button button-small" type="submit">Send reply →</button><p id="conversation-reply-status" role="status"></p></form>`;
  const studentPanel = $('#student-conversation');
  if (studentPanel) {
    let current, requests = [];
    const list = $('#my-message-list');
    async function refresh() {
      const browser = saved().map(item => ({ _id: item.id, subject: item.subject, accessKey: item.accessKey, browser: true }));
      let account = [];
      if (token()) {
        try { account = await api('/api/messages/mine'); } catch (error) { notice('#message-account', error.message + ' You can still use a private tracking code.', true); }
      }
      const combined = new Map(browser.map(item => [item._id, item]));
      account.forEach(item => combined.set(item._id, { ...combined.get(item._id), ...item })); requests = [...combined.values()];
      list.innerHTML = requests.length ? requests.map(item => `<button class="message-request" data-open-request="${e(item._id)}" aria-pressed="${current?.id === item._id}"><span class="journey-badge">${e(statusLabel(item.status || 'saved reference'))}</span>${item.lastMessageFrom === 'team' && (!item.studentReadAt || new Date(item.lastMessageAt) > new Date(item.studentReadAt)) ? '<span class="journey-badge">Team replied</span>' : ''}<h3>${e(item.subject)}</h3><small>${item.createdAt ? date(item.createdAt) : 'Private reference saved on this browser'}</small></button>`).join('') : '<p>No saved requests yet. Send a question or enter a private tracking code.</p>';
    }
    async function open(item, older = false) {
      current = { id: item._id || item.id, accessKey: item.accessKey };
      let data = await api('/api/messages/thread/' + current.id, 'POST', { ...(current.accessKey ? { accessKey: current.accessKey } : {}), ...(older && current.before ? { before: current.before } : {}) });
      let collected = data.messages;
      const render = () => {
        const closed = ['closed', 'cancelled', 'dropped'].includes(data.request.status);
        studentPanel.innerHTML = `<span class="eyebrow">YOUR PRIVATE CONVERSATION</span><h2>${e(data.request.subject)}</h2><span class="journey-badge">${e(statusLabel(data.request.status))}</span><p class="message-privacy">${data.request.assigned ? 'A team member is assigned to this request.' : 'Waiting for the team to review and assign your request.'} Replies appear here. <button class="text-button" id="refresh-conversation">Refresh conversation</button></p>${history({ ...data, messages: collected })}${closed ? '<p>This request is closed. You can read the conversation and send a new request using the form.</p>' : compose(false)}`;
        $('#refresh-conversation').addEventListener('click', () => open({ ...item, _id: current.id }).catch(error => notice('#conversation-reply-status', error.message, true)));
        $('[data-earlier-messages]')?.addEventListener('click', async event => { event.target.disabled = true; try { const earlier = await api('/api/messages/thread/' + current.id, 'POST', { accessKey: current.accessKey, before: data.nextCursor }); collected = [...earlier.messages, ...collected]; data.nextCursor = earlier.nextCursor; render(); } catch (error) { notice('#conversation-reply-status', error.message, true); } });
        formSubmit($('#conversation-reply'), async values => { await api('/api/messages/thread/' + current.id + '/reply', 'POST', { text: values.text, accessKey: current.accessKey }); await open({ ...item, _id: current.id }); notice('#conversation-reply-status', 'Your reply is saved.'); await refresh(); }, '#conversation-reply-status');
      };
      render(); await refresh();
    }
    list.addEventListener('click', event => { const button = event.target.closest('[data-open-request]'); if (button) { const item = requests.find(item => item._id === button.dataset.openRequest); open(item).catch(error => { studentPanel.innerHTML = `<h2>Could not open this request.</h2><p>${e(error.message)}</p>`; }); } });
    $('#refresh-my-messages').addEventListener('click', () => refresh().catch(error => notice('#find-message-result', error.message, true)));
    formSubmit($('#find-message'), async values => { const item = await api('/api/messages/access', 'POST', { accessKey: values.accessKey }); remember(item._id, values.accessKey, item.subject); await open({ ...item, accessKey: values.accessKey }); notice('#find-message-result', 'Request opened. Keep the tracking code private.'); }, '#find-message-result');
    const newForm = $('#new-message');
    const subjectHint = new URLSearchParams(location.search).get('subject'); if (subjectHint) newForm.elements.subject.value = subjectHint.slice(0,160);
    if (token()) api('/api/user/me').then(user => { notice('#message-account', `Signed in as ${user.name}. New requests will be saved to your account.`); for (const [name, value] of Object.entries({ name: user.name, email: user.email, mobile: user.phone })) if (!newForm.elements[name].value) newForm.elements[name].value = value; }).catch(() => {});
    formSubmit(newForm, async values => {
      notice('#new-message-result', 'Saving your message…');
      const result = await api('/api/leads', 'POST', { ...values, branch: values.branch.trim() || 'Not Sure', state: values.state.trim() || 'To discuss', contactConsent: newForm.elements.contactConsent.checked, partnerConsent: newForm.elements.partnerConsent.checked });
      const stored = remember(result.leadId, result.accessKey, values.subject);
      $('#new-message-result').innerHTML = `<h3>Message saved.</h3><p>Keep this private tracking code:</p><code class="message-reference">${e(result.accessKey)}</code><p>${stored ? 'A reference is also saved on this browser.' : 'Browser storage is unavailable. Copy the code now so you can return to this conversation.'} The team will review your request.</p>`;
      newForm.elements.message.value = ''; newForm.elements.subject.value = '';
      try { await open({ _id: result.leadId, accessKey: result.accessKey }); } catch (error) { studentPanel.textContent = 'Message saved. Keep the code above. Conversation could not load: ' + error.message; }
    }, '#new-message-result');
    refresh().catch(error => notice('#find-message-result', error.message, true));
  }
  const teamPanel = $('#team-conversation');
  if (teamPanel) {
    let page = 0, selected, members = [], role;
    const filters = $('#inbox-filters');
    async function refresh() {
      const values = new FormData(filters), query = new URLSearchParams({ page: String(page), q: values.get('q'), status: values.get('status') });
      for (const field of ['waiting', 'followUp', 'unassigned']) if (filters.elements[field].checked) query.set(field, '1');
      const data = await api('/api/messages/staff?' + query); members = data.staff; role = data.role;
      $('#team-inbox').hidden = false; $('#unassigned-filter').hidden = role !== 'admin'; notice('#inbox-auth', role === 'admin' ? 'Administrator · all requests. Assign a counsellor to give every request an owner.' : 'Counsellor · only requests assigned to you appear here.');
      $('#inbox-summary').innerHTML = `<span><strong>${e(data.waiting)}</strong> waiting for the team</span><span><strong>${e(data.followUp)}</strong> follow-ups due</span><span><strong>${e(data.total)}</strong> matching requests</span>`;
      $('#inbox-list').innerHTML = data.leads.length ? data.leads.map(item => `<button class="message-request" data-team-request="${e(item._id)}" aria-pressed="${selected === item._id}"><span class="journey-badge">${e(statusLabel(item.status))}</span>${item.lastMessageFrom === 'student' ? '<span class="journey-badge warning">Student message</span>' : ''}<h3>${e(item.subject || 'Admission counselling')}</h3><p>${e(item.name)} · ${e(item.email)}</p><p>${item.assignedTo ? 'Assigned: ' + e(item.assignedTo.name) : 'Unassigned'} · ${e(item.priority)} priority</p><small>Latest message: ${date(item.lastMessageAt || item.createdAt)}${item.followUpAt ? '<br>Follow-up: ' + date(item.followUpAt) : ''}</small></button>`).join('') : '<div class="journey-empty"><h2>Nothing here for these filters.</h2><p>Change the filters or ask your administrator to assign a request.</p></div>';
      $('#inbox-prev').disabled = page === 0; $('#inbox-next').disabled = (page + 1) * 25 >= data.total; notice('#inbox-page', `Page ${page + 1}`);
    }
    async function open(id) {
      selected = id; const data = await api('/api/messages/staff/' + id); let messages = data.messages;
      const render = () => {
        const item = data.request, closed = ['closed', 'cancelled', 'dropped'].includes(item.status);
        const time = item.followUpAt ? new Date(new Date(item.followUpAt) - new Date(item.followUpAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
        teamPanel.innerHTML = `<span class="eyebrow">PRIVATE TEAM WORKSPACE</span><h2>${e(item.subject || 'Admission counselling')}</h2><p><strong>${e(item.name)}</strong><br>${e(item.email)} · ${e(item.phone)}</p><p class="message-privacy">${e(item.preferredBranch)} · ${e(item.preferredState)}${item.jeeRank ? ' · Rank: ' + e(item.jeeRank) : ''}<br>Contact consent: ${item.contactConsent ? 'Yes' : 'Not recorded'} · Partner sharing: ${item.partnerConsent ? 'Yes' : 'No'}</p><form id="request-management" class="message-form"><div class="form-grid"><label>Status<select name="status">${statuses.map(status => `<option value="${status}"${status === item.status ? ' selected' : ''}>${statusLabel(status)}</option>`).join('')}</select></label><label>Priority<select name="priority">${['low', 'medium', 'high'].map(value => `<option${value === item.priority ? ' selected' : ''}>${value}</option>`).join('')}</select></label></div>${role === 'admin' ? `<label>Assigned team member<select name="assignedTo"><option value="">Unassigned</option>${members.map(member => `<option value="${e(member._id)}"${String(member._id) === String(item.assignedTo?._id) ? ' selected' : ''}>${e(member.name)} · ${e(member.role)}</option>`).join('')}</select></label>` : ''}<label>Next follow-up · your local time<input name="followUpAt" type="datetime-local" value="${e(time)}"></label><p class="message-privacy">Follow-up dates organise this inbox. They do not automatically send a message or call the student.</p><button type="submit" class="button button-small button-quiet">Save handover</button><p id="management-result" role="status"></p></form>${history({ ...data, messages })}${closed ? '<p>This request is closed. Update its status to continue replying.</p>' : compose(true)}<section class="message-notes"><span class="eyebrow">INTERNAL · TEAM ONLY</span><h3>Private notes</h3>${(item.notes || []).slice(-20).map(note => `<article class="message-note"><p>${e(note.text)}</p><small>${e(note.addedBy?.name || 'Team member')} · ${date(note.addedAt)}</small></article>`).join('') || '<p>No internal notes yet.</p>'}<form id="internal-note" class="message-form"><label>Private note<textarea name="text" rows="3" maxlength="4000" required placeholder="Context for the next team member…"></textarea></label><button class="button button-small button-quiet" type="submit">Save internal note</button><p id="internal-note-result" role="status"></p></form></section>`;
        $('[data-earlier-messages]')?.addEventListener('click', async event => { event.target.disabled = true; try { const earlier = await api('/api/messages/staff/' + id + '?before=' + data.nextCursor); messages = [...earlier.messages, ...messages]; data.nextCursor = earlier.nextCursor; render(); } catch (error) { notice('#management-result', error.message, true); } });
        formSubmit($('#request-management'), async values => { const payload = { ...values, followUpAt: values.followUpAt ? new Date(values.followUpAt).toISOString() : null }; if (role === 'admin') payload.assignedTo = values.assignedTo || null; await api('/api/messages/staff/' + id, 'PATCH', payload); await refresh(); await open(id); notice('#management-result', 'Assignment, progress and follow-up saved.'); }, '#management-result');
        formSubmit($('#conversation-reply'), async values => { const result = await api('/api/messages/staff/' + id + '/reply', 'POST', { text: values.text, notify: $('#conversation-reply').elements.notify.checked }); await refresh(); await open(id); notice('#conversation-reply-status', result.delivery === 'failed' ? 'Reply saved here. Email could not be delivered; check the mail configuration.' : result.delivery === 'local-preview' ? 'Reply saved. Email captured in the local preview inbox.' : result.delivery === 'smtp' ? 'Reply saved and emailed.' : 'Reply saved in the conversation.'); }, '#conversation-reply-status');
        formSubmit($('#internal-note'), async values => { await api('/api/messages/staff/' + id + '/notes', 'POST', values); await open(id); notice('#internal-note-result', 'Internal note saved. Students cannot see it.'); }, '#internal-note-result');
      }; render();
    }
    $('#inbox-list').addEventListener('click', event => { const button = event.target.closest('[data-team-request]'); if (button) open(button.dataset.teamRequest).catch(error => { teamPanel.innerHTML = `<h2>Could not open the request.</h2><p>${e(error.message)}</p>`; }); });
    filters.addEventListener('submit', event => { event.preventDefault(); page = 0; refresh().catch(error => notice('#inbox-auth', error.message, true)); });
    $('#inbox-prev').addEventListener('click', () => { if (page) page--; refresh().catch(error => notice('#inbox-auth', error.message, true)); });
    $('#inbox-next').addEventListener('click', () => { page++; refresh().catch(error => notice('#inbox-auth', error.message, true)); });
    if (token()) refresh().catch(error => notice('#inbox-auth', error.message, true));
  }
})();
