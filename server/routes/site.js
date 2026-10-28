const express = require('express');
const path = require('path');
const { getCatalogue } = require('../services/catalogue');
const guides = require('../data/guides');
const views = require('../views/site');
const journey = require('../views/journey');
const messages = require('../views/messages');
const resources = require('../views/resources');
const { states, scholarships } = require('../data/student-resources');
const router = express.Router({ strict: true });
const handle = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const canonicalPaths = ['/colleges', '/compare', '/shortlist', '/planner', '/guides', '/tools', '/rank-explorer', '/applications', '/appointments', '/admission-help', '/staff', '/local-tools', '/messages', '/inbox', '/scholarships', '/states'];
router.get(canonicalPaths, (req, res) => res.redirect(301, req.path + '/' + (req.originalUrl.includes('?') ? '?' + req.originalUrl.split('?')[1] : '')));
router.get(['/index', '/index.html'], (req, res) => res.redirect(301, '/'));
router.get('/', handle(async (req, res) => res.send(views.renderHome((await getCatalogue()).colleges))));
router.get('/api/discovery', handle(async (req, res) => res.json({ success: true, ...(await getCatalogue()) })));
router.get('/colleges/', handle(async (req, res) => res.send(views.directoryPage((await getCatalogue()).colleges, { query: typeof req.query.q === 'string' ? req.query.q.slice(0, 100) : '' }))));
router.get('/shortlist/', handle(async (req, res) => res.send(views.directoryPage((await getCatalogue()).colleges, { saved: true }))));
router.get('/compare/', handle(async (req, res) => res.send(views.comparePage((await getCatalogue()).colleges))));
router.get('/planner/', (req, res) => res.send(views.plannerPage()));
router.get('/scholarships/', (req, res) => res.send(resources.scholarshipsPage()));
router.get('/states/', (req, res) => res.send(resources.statesPage()));
router.get(['/scholarships/:slug', '/states/:slug'], (req, res) => res.redirect(301, req.path + '/'));
router.get('/scholarships/:slug/', (req, res) => {
  const scheme = scholarships.find(s => s.id === req.params.slug);
  if (!scheme) return res.status(404).send(views.notFound());
  res.send(resources.scholarshipsPage(scheme));
});
router.get('/states/:slug/', handle(async (req, res) => {
  const state = states.find(s => s.slug === req.params.slug);
  if (!state) return res.status(404).send(views.notFound());
  res.send(resources.statesPage(state, (await getCatalogue()).colleges));
}));
router.get('/messages/', (req, res) => res.set('Cache-Control', 'private, no-store').send(messages.messagesPage()));
router.get('/inbox/', (req, res) => res.set('Cache-Control', 'private, no-store').send(messages.inboxPage()));
for (const [url, render] of Object.entries({ tools: 'toolsPage', 'rank-explorer': 'rankPage', applications: 'applicationsPage', appointments: 'appointmentsPage', 'admission-help': 'helpPage', staff: 'staffPage' })) {
  router.get(`/${url}/`, (req, res) => res.send(journey[render]()));
}
router.get('/local-tools/', (req, res) => {
  if (!require('./local').isLocalPreview(req)) return res.status(404).send(views.notFound());
  res.set('Cache-Control', 'no-store').send(journey.localPage());
});
router.get(['/colleges/:slug', '/guides/:slug'], (req, res) => res.redirect(301, req.path + '/'));
router.get('/colleges/:slug/', handle(async (req, res) => {
  const { colleges } = await getCatalogue();
  const college = colleges.find(c => c.slug === req.params.slug);
  if (!college) return res.status(404).send(views.notFound());
  if (!req.path.endsWith('/')) return res.redirect(301, req.path + '/');
  res.send(views.collegePage(college, colleges));
}));
router.get('/guides/', (req, res) => res.send(views.guidePage()));
router.get('/guides/:slug/', (req, res) => {
  const guide = guides.find(g => g.slug === req.params.slug);
  if (!guide) return res.status(404).send(views.notFound());
  if (!req.path.endsWith('/')) return res.redirect(301, req.path + '/');
  res.send(views.guidePage(guide));
});
router.get('/robots.txt', (req, res) => res.type('text/plain').send('User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: https://www.btechhelpline.com/sitemap.xml\n'));
router.get('/sitemap.xml', handle(async (req, res) => {
  const { colleges } = await getCatalogue();
  const urls = ['/', '/colleges/', '/planner/', '/tools/', '/rank-explorer/', '/admission-help/', '/guides/', '/scholarships/', '/states/', ...scholarships.map(s => `/scholarships/${s.id}/`), ...states.map(s => `/states/${s.slug}/`), ...guides.map(g => `/guides/${g.slug}/`), ...colleges.map(c => `/colleges/${c.slug}/`)];
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url => `<url><loc>https://www.btechhelpline.com${views.escape(url)}</loc></url>`).join('')}</urlset>`);
}));
// Keep the established authentication, administration and onboarding pages.
const legacy = ['login', 'register', 'forgot-password', 'reset-password', 'admin', 'dashboard', 'counsellor', 'onboard', 'privacy', 'terms'];
router.get(legacy.map(name => `/${name}.html`), (req, res) => res.redirect(301, req.path.replace(/\.html$/, '') + (req.originalUrl.includes('?') ? '?' + req.originalUrl.split('?')[1] : '')));
router.get(legacy.map(name => `/${name}`), (req, res) => res.sendFile(path.join(__dirname, '../../public', `${req.path.slice(1)}.html`)));
module.exports = router;
