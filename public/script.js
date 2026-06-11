/* ── DOM References ─────────────────────── */
const menuButton = document.querySelector('.menu-toggle');
const navMenu = document.querySelector('.nav-menu');
const leadForm = document.querySelector('.lead-form');
const leadPopup = document.querySelector('.lead-popup');
const popupForm = document.querySelector('.popup-form');
const popupCloseButtons = document.querySelectorAll('[data-popup-close]');
const faqButtons = document.querySelectorAll('.faq-item button');
const scrollButtons = document.querySelectorAll('[data-scroll-target]');
const header = document.querySelector('.site-header');
const navLinks = document.querySelectorAll('.nav-menu a:not(.nav-cta):not(.auth-nav-item)');

// API URL check (fallback if config.js failed to load)
const BASE_API = typeof API_URL !== 'undefined' ? API_URL : 'http://localhost:3000';

/* ── Mobile Menu ────────────────────────── */
function closeMenu() {
  menuButton?.setAttribute('aria-expanded', 'false');
  navMenu?.classList.remove('open');
  document.body.classList.remove('menu-open');
}

menuButton?.addEventListener('click', () => {
  const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!isOpen));
  navMenu?.classList.toggle('open', !isOpen);
  document.body.classList.toggle('menu-open', !isOpen);
});

navMenu?.addEventListener('click', (e) => {
  if (e.target instanceof HTMLAnchorElement) closeMenu();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeMenu(); closePopup(); }
});

/* ── Scrolled Header ────────────────────── */
let lastScroll = 0;
function handleHeaderScroll() {
  const scrollY = window.scrollY;
  if (scrollY > 20) {
    header?.classList.add('scrolled');
  } else {
    header?.classList.remove('scrolled');
  }
  lastScroll = scrollY;
}

window.addEventListener('scroll', handleHeaderScroll, { passive: true });

/* ── Active Nav Link ────────────────────── */
const sections = document.querySelectorAll('section[id]');

function updateActiveNav() {
  const scrollPos = window.scrollY + 120;
  sections.forEach(section => {
    const top = section.offsetTop;
    const height = section.offsetHeight;
    const id = section.getAttribute('id');
    if (scrollPos >= top && scrollPos < top + height) {
      navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === '#' + id) {
          link.classList.add('active');
        }
      });
    }
  });
}

window.addEventListener('scroll', updateActiveNav, { passive: true });

/* ── Scroll Reveal ──────────────────────── */
const revealElements = document.querySelectorAll('.reveal');

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

revealElements.forEach(el => revealObserver.observe(el));

/* ── Animated Counters ──────────────────── */
function animateCounter(el) {
  const target = parseInt(el.dataset.target, 10);
  const suffix = el.dataset.suffix || '';
  const prefix = el.dataset.prefix || '';
  const duration = 2000;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(eased * target);
    el.textContent = prefix + current.toLocaleString('en-IN') + suffix;
    if (progress < 1) requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
}

/* ── Dynamic Stats Loading ──────────────── */
async function loadDynamicStats() {
  try {
    const res = await fetch(`${BASE_API}/api/colleges/public-stats`);
    const data = await res.json();
    if (res.ok && data.success) {
      const stats = data.data;
      const studentsEl = document.getElementById('stat-students');
      const collegesEl = document.getElementById('stat-colleges');
      const citiesEl = document.getElementById('stat-cities');
      
      if (studentsEl) studentsEl.dataset.target = stats.totalStudentsGuided;
      if (collegesEl) collegesEl.dataset.target = stats.totalColleges;
      if (citiesEl) citiesEl.dataset.target = stats.totalCities;
    }
  } catch (err) {
    console.error('Failed to load dynamic stats:', err);
  } finally {
    const counterElements = document.querySelectorAll('[data-target]');
    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });

    counterElements.forEach(el => counterObserver.observe(el));
  }
}

// Initialize dynamic stats load
loadDynamicStats();

/* ── Form Validation ────────────────────── */
function setError(field, message) {
  const label = field.closest('label');
  const error = label?.querySelector('.field-error');
  if (error) error.textContent = message;
  field.setAttribute('aria-invalid', message ? 'true' : 'false');
}

/* ── Landing Page Lead Submission ────────────────────── */
leadForm?.addEventListener('submit', (e) => {
  e.preventDefault();

  const token = localStorage.getItem('token');
  const fields = {
    name: leadForm.elements.namedItem('name'),
    mobile: leadForm.elements.namedItem('mobile'),
    branch: leadForm.elements.namedItem('branch'),
    state: leadForm.elements.namedItem('state'),
    budget: leadForm.elements.namedItem('budget'),
  };

  // If NOT logged in, email field is required
  let emailInput = null;
  if (!token) {
    emailInput = leadForm.elements.namedItem('email');
  }

  let valid = true;
  const mobileValue = fields.mobile.value.replace(/\D/g, '');

  Object.values(fields).forEach(field => {
    setError(field, '');
    if (!field.value.trim()) { setError(field, 'Required'); valid = false; }
  });

  if (emailInput) {
    setError(emailInput, '');
    if (!emailInput.value.trim()) {
      setError(emailInput, 'Required');
      valid = false;
    } else if (!/\S+@\S+\.\S+/.test(emailInput.value)) {
      setError(emailInput, 'Enter a valid email');
      valid = false;
    }
  }

  if (fields.mobile.value.trim() && !/^\d{10}$/.test(mobileValue)) {
    setError(fields.mobile, 'Enter a 10 digit number');
    valid = false;
  }

  const success = leadForm.querySelector('.form-success');
  if (!valid) { success.textContent = ''; return; }

  const submitBtn = leadForm.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';
  success.textContent = '';
  success.style.color = '';

  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const payload = {
    name: fields.name.value,
    mobile: mobileValue,
    branch: fields.branch.value,
    state: fields.state.value,
    budget: fields.budget.value,
  };

  if (emailInput) {
    payload.email = emailInput.value.trim();
  }

  fetch(`${BASE_API}/api/leads`, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(payload)
  })
  .then(res => {
    if (!res.ok) throw new Error('Submission failed');
    return res.json();
  })
  .then(data => {
    success.textContent = 'Thank you! Our counselling expert will contact you soon.';
    success.style.color = '';
    leadForm.reset();
    prefillLeadForm(); // Reset and pre-fill again
  })
  .catch(err => {
    success.textContent = 'Oops! Failed to submit. Please try again or call us.';
    success.style.color = 'var(--rose)';
  })
  .finally(() => {
    submitBtn.disabled = false;
    submitBtn.textContent = originalBtnText;
  });
});

/* ── Lead Popup ─────────────────────────── */
function openPopup() {
  if (!leadPopup || sessionStorage.getItem('bthLeadPopupShown')) return;
  
  // If already logged in, do not show popup
  if (localStorage.getItem('token')) return;

  sessionStorage.setItem('bthLeadPopupShown', 'true');
  leadPopup.classList.add('open');
  leadPopup.setAttribute('aria-hidden', 'false');
  document.body.classList.add('popup-open');
  leadPopup.querySelector('input')?.focus();
}

function closePopup() {
  if (!leadPopup) return;
  leadPopup.classList.remove('open');
  leadPopup.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('popup-open');
}

popupCloseButtons.forEach(btn => btn.addEventListener('click', closePopup));

window.addEventListener('load', () => {
  const popupDelay = new URLSearchParams(window.location.search).get('popup') === '1' ? 250 : 45000;
  window.setTimeout(openPopup, popupDelay);
});

popupForm?.addEventListener('submit', (e) => {
  e.preventDefault();

  const fields = {
    name: popupForm.elements.namedItem('popupName'),
    mobile: popupForm.elements.namedItem('popupMobile'),
    branch: popupForm.elements.namedItem('popupBranch'),
  };

  let valid = true;
  const mobileValue = fields.mobile.value.replace(/\D/g, '');

  Object.values(fields).forEach(field => {
    setError(field, '');
    if (!field.value.trim()) { setError(field, 'Required'); valid = false; }
  });

  if (fields.mobile.value.trim() && !/^\d{10}$/.test(mobileValue)) {
    setError(fields.mobile, 'Enter a 10 digit number');
    valid = false;
  }

  const success = popupForm.querySelector('.popup-success');
  if (!valid) { success.textContent = ''; return; }

  const submitBtn = popupForm.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';
  success.textContent = '';
  success.style.color = '';

  // Popup form is always anonymous (since logged-in users won't see it),
  // but let's prompt or generate a default email to satisfy backend validation,
  // or use phone@btechhelpline.com as a fallback.
  const anonymousEmail = `${mobileValue}@btechhelpline-lead.com`;

  fetch(`${BASE_API}/api/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: fields.name.value,
      mobile: mobileValue,
      branch: fields.branch.value,
      email: anonymousEmail,
      state: 'Not Specified',
      budget: 'Not Specified',
      source: 'Popup Form'
    })
  })
  .then(res => {
    if (!res.ok) throw new Error('Submission failed');
    return res.json();
  })
  .then(data => {
    success.textContent = 'Thank you! Our expert will contact you soon.';
    popupForm.reset();
    window.setTimeout(closePopup, 1800);
  })
  .catch(err => {
    success.textContent = 'Oops! Please try again.';
    success.style.color = '#f87171';
  })
  .finally(() => {
    submitBtn.disabled = false;
    submitBtn.textContent = originalBtnText;
  });
});

/* ── Carousel Scroll ────────────────────── */
scrollButtons.forEach(button => {
  if (button.hasAttribute('onclick')) return;
  button.addEventListener('click', () => {
    const target = document.getElementById(button.dataset.scrollTarget);
    if (!target) return;
    const dir = Number(button.dataset.scrollDir || 1);
    target.scrollBy({ left: dir * Math.min(target.clientWidth * 0.88, 360), behavior: 'smooth' });
  });
});

/* ── FAQ Accordion ──────────────────────── */
faqButtons.forEach(button => {
  button.addEventListener('click', () => {
    const item = button.closest('.faq-item');
    const panel = item?.querySelector('.faq-panel');
    const isOpen = button.getAttribute('aria-expanded') === 'true';

    faqButtons.forEach(otherBtn => {
      const otherPanel = otherBtn.closest('.faq-item')?.querySelector('.faq-panel');
      otherBtn.setAttribute('aria-expanded', 'false');
      if (otherPanel) otherPanel.style.maxHeight = '0px';
    });

    if (!isOpen && panel) {
      button.setAttribute('aria-expanded', 'true');
      panel.style.maxHeight = panel.scrollHeight + 'px';
    }
  });
});

/* ── Smooth scroll for all anchor links ─── */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

/* ── Dynamic Authentication UI Configuration ────────────────────── */
function updateAuthUI() {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  const navMenu = document.getElementById('nav-menu');

  if (!navMenu) return;

  // Remove any previous auth-related elements
  const existingAuthItems = navMenu.querySelectorAll('.auth-nav-item');
  existingAuthItems.forEach(el => el.remove());

  if (token && role) {
    let dashboardUrl = 'dashboard.html';
    if (role === 'admin') dashboardUrl = 'admin.html';
    else if (role === 'counsellor') dashboardUrl = 'counsellor.html';

    // Dashboard link
    const dashLink = document.createElement('a');
    dashLink.href = dashboardUrl;
    dashLink.className = 'auth-nav-item';
    dashLink.textContent = 'Dashboard';
    dashLink.style.fontWeight = '700';
    dashLink.style.color = '#3b82f6';
    navMenu.insertBefore(dashLink, navMenu.lastElementChild);

    // Logout link
    const logoutLink = document.createElement('a');
    logoutLink.href = '#';
    logoutLink.className = 'auth-nav-item';
    logoutLink.textContent = 'Logout';
    logoutLink.style.color = '#f87171';
    logoutLink.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.clear();
      window.location.reload();
    });
    navMenu.insertBefore(logoutLink, navMenu.lastElementChild);

    // Hide landing page email field since they are authenticated
    const emailWrapper = document.getElementById('email-field-wrapper');
    if (emailWrapper) emailWrapper.style.display = 'none';

  } else {
    // Login link
    const loginLink = document.createElement('a');
    loginLink.href = 'login.html';
    loginLink.className = 'auth-nav-item';
    loginLink.textContent = 'Login';
    navMenu.insertBefore(loginLink, navMenu.lastElementChild);

    // Register link
    const regLink = document.createElement('a');
    regLink.href = 'register.html';
    regLink.className = 'auth-nav-item';
    regLink.textContent = 'Register';
    regLink.style.color = '#10b981';
    navMenu.insertBefore(regLink, navMenu.lastElementChild);
    
    // Ensure email field is visible
    const emailWrapper = document.getElementById('email-field-wrapper');
    if (emailWrapper) emailWrapper.style.display = 'block';
  }
}

/* ── Pre-fill landing page form for logged-in students ── */
async function prefillLeadForm() {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  if (!token || role !== 'student' || !leadForm) return;

  try {
    const res = await fetch(`${BASE_API}/api/user/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (res.ok && data.success) {
      const user = data.data;
      leadForm.elements.namedItem('name').value = user.name;
      leadForm.elements.namedItem('mobile').value = user.phone;
      if (user.preferredBranch) leadForm.elements.namedItem('branch').value = user.preferredBranch;
      if (user.preferredState) leadForm.elements.namedItem('state').value = user.preferredState;
    }
  } catch (err) {
    console.error('Prefill lead form error:', err);
  }
}

// Initialise authentication UI state
document.addEventListener('DOMContentLoaded', () => {
  updateAuthUI();
  prefillLeadForm();

  // Mobile dropdown toggles
  document.querySelectorAll('.dropdown-trigger').forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      if (window.innerWidth <= 768) {
        e.preventDefault();
        const dropdown = trigger.closest('.dropdown');
        dropdown.classList.toggle('open');
        const isExpanded = dropdown.classList.contains('open');
        trigger.setAttribute('aria-expanded', String(isExpanded));
      }
    });
  });
});
