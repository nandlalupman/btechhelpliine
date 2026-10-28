(() => {
  const KEY = 'cookie-consent';
  let started = false;
  const stored = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  function set(choice) {
    try { localStorage.setItem(KEY, choice); } catch { /* Storage can be unavailable in private mode. */ }
    if (choice === 'accepted') startAnalytics();
    else {
      window['ga-disable-G-6B390BG8Q2'] = true;
      window.gtag?.('consent', 'update', { analytics_storage: 'denied', ad_storage: 'denied' });
    }
    document.querySelectorAll('.cookie-panel, #cookie-consent').forEach(el => { el.hidden = true; el.style.display = 'none'; });
  }
  function startAnalytics() {
    window['ga-disable-G-6B390BG8Q2'] = false;
    if (started) { window.gtag?.('consent', 'update', { analytics_storage: 'granted' }); return; }
    started = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    window.gtag('js', new Date());
    // Query strings can contain personal links or tokens on authentication pages.
    window.gtag('config', 'G-6B390BG8Q2', { page_location: location.origin + location.pathname, page_referrer: '', send_page_view: true });
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=G-6B390BG8Q2';
    document.head.append(script);
  }
  function show() {
    const panel = document.querySelector('.cookie-panel');
    if (panel) { panel.hidden = false; panel.style.removeProperty('display'); }
  }
  window.BtechConsent = { set, show, allowed: () => stored() === 'accepted' };
  document.addEventListener('DOMContentLoaded', () => {
    if (stored() === 'accepted') startAnalytics();
    else if (!stored()) show();
    document.querySelectorAll('[data-consent]').forEach(button => button.addEventListener('click', () => set(button.dataset.consent)));
    document.querySelectorAll('[data-cookie-settings]').forEach(button => button.addEventListener('click', show));
    document.getElementById('accept-cookies')?.addEventListener('click', () => set('accepted'));
    document.getElementById('decline-cookies')?.addEventListener('click', () => set('declined'));
  });
})();
