(() => {
  const form = document.getElementById('student-password-form');
  if (!form) return;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const status = document.getElementById('student-password-status');
    if (form.elements.newPassword.value !== form.elements.confirmPassword.value) { status.textContent = 'The new passwords do not match.'; return; }
    const button = form.querySelector('[type=submit]'); button.disabled = true;
    status.textContent = 'Updating password…';
    try {
      const response = await fetch(API_URL + '/api/user/me/password', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + window.BtechSession.read('token') }, body: JSON.stringify({ oldPassword: form.elements.oldPassword.value, newPassword: form.elements.newPassword.value }), signal: AbortSignal.timeout(20000) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Could not update your password. Please retry.');
      form.reset(); status.textContent = 'Password updated. Use your new password next time you log in.';
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
  });
})();
