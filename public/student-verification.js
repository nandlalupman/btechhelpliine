(() => {
  const form = document.getElementById('student-verification-form');
  if (!form) return;
  const status = document.getElementById('verification-status');
  const resend = document.getElementById('resend-verification');
  let busy = false, cooldown = 0;
  const show = (message, error = false) => { status.textContent = message; status.classList.toggle('journey-feedback-error', error); };
  async function request(path, payload) {
    const res = await fetch('/api/auth/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(20000) });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Please try again.');
    return data;
  }
  const email = () => form.elements.email.value.trim().toLowerCase();
  async function run(task) {
    if (busy) return;
    busy = true; form.querySelector('[type=submit]').disabled = true; resend.disabled = true;
    try { await task(); } catch (error) { show(error.message, true); }
    finally { busy = false; form.querySelector('[type=submit]').disabled = false; resend.disabled = Date.now() < cooldown; }
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    run(async () => {
      show('Checking your verification code…');
      const data = await request('verify-email-otp', { email: email(), otp: form.elements.otp.value.trim() });
      try { for (const [key, value] of Object.entries({ token: data.token, role: data.user.role, userName: data.user.name, userEmail: data.user.email })) localStorage.setItem(key, value); }
      catch { window.BtechSession.clear(); show('Email verified. Browser storage is unavailable; enable it and log in to continue.', true); return; }
      show('Email verified. Opening your account…');
      const next = window.BtechSession.safeNext(new URLSearchParams(location.search).get('next'));
      location.assign(next || window.BtechSession.destination(data.user.role));
    });
  });
  resend.addEventListener('click', () => {
    if (!form.elements.email.reportValidity() || Date.now() < cooldown) return;
    run(async () => {
      show('Requesting a new code…');
      const data = await request('resend-email-otp', { email: email() });
      show(data.otp ? 'Local preview code: ' + data.otp : 'A new code was sent. Check your inbox and spam folder.');
      cooldown = Date.now() + 30000; resend.textContent = 'Wait 30 seconds to resend';
      setTimeout(() => { resend.disabled = busy; resend.textContent = 'Send a new code'; }, 30000);
    });
  });
})();
