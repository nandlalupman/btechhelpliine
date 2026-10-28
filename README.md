# BtechHelpline

Engineering college discovery and admission counselling, built with Express, plain HTML/CSS/JavaScript and MongoDB.

## Run locally

Use Node.js 20.19 or newer (Node 22 LTS recommended).

```powershell
npm install
npm run local
```

Open http://localhost:4173/. The launcher runs the app in the background, watches server changes and writes logs to `.local/server.log`. Running the command again reuses the existing app; `npm run local -- --restart` restarts only this launcher's own process. The app remains running when the terminal command finishes.

When no `MONGODB_URI` is configured, the local runner downloads an official MongoDB binary on first use and starts a loopback-only persistent development database in `.local/database`. The first download is large and can take several minutes. The empty local database receives the directory identities, a local administrator and clearly labelled preview counselling slots. Existing database records are retained across restarts. Administrator credentials are in the ignored `.local/access.json`; never reuse them in production. All local email/SMS previews stay in the local inbox at `/local-tools/` and are not delivered to external recipients.

For a configured MongoDB environment, `npm run dev` or `npm start` serves the normal app on http://localhost:3000 by default. Use `PORT` and `FRONTEND_URL` together to change its origin. Existing Live Server previews on ports 5500/5501 use the backend on port 3000. `npm run local` on port 4173 is the complete application preview.

Public browsing and public rank/guide tools work without MongoDB. Authentication, account storage, booking, enquiries and administration require a working database. Unavailable storage returns a service error; submissions are not pretended to have been saved.

Copy `.env.example` to `.env` locally and configure the existing database, JWT and mail settings. Never commit credentials. Do not run `seed-colleges` against an existing database without a separate backup: the legacy seeder deletes the existing college collection.

## Public experience

- `/`: redesigned homepage, search, featured colleges, guides and consent-based counselling form.
- `/colleges/`: search by college/city/state, state and type filters, pagination.
- `/colleges/:slug/`: server-rendered college pages with canonical URLs and source information.
- `/compare/`: up to three colleges and shareable comparison links.
- `/shortlist/`: browser-saved shortlist; real database colleges also sync to a signed-in account when explicitly saved. Shared lists contain college slugs only.
- `/planner/`: four-year cost calculation, saved budget inputs and a local application checklist.
- `/guides/`: authored admission planning guides and official-source links.
- `/tools/`: shared planning hub, also linked from the homepage and navigation.
- `/rank-explorer/`: official historical JoSAA 2026 Round 5 dataset, preserving exam, category, quota and gender-pool dimensions. OPEN uses CRL; reserved seats use the corresponding category rank; PwD seats use that category's PwD rank. Preparatory ranks are excluded. Results are historical comparisons, not predictions or admission guarantees.
- `/applications/`: browser-only tasks or owner-bound account storage, source URLs, progress, editing/deletion, opt-in email reminders and calendar export with a 24-hour alarm. Browser tasks can be explicitly copied into an account. It does not submit an admission application.
- `/appointments/`: available staff-published slots, atomic reservation, private booking reference, lookup/cancellation and email confirmation. Local sample slots are labelled as development previews.
- `/admission-help/`: English/Hindi keyword retrieval from authored guides with official-source links. It does not call an external LLM or claim to make admission decisions. Selected tool labels support Hindi; the entire legacy website has not been translated.
- `/staff/`: role-protected availability publishing, appointment status/notes, and administrator review moderation. Admin/counsellor portals link here.
- `/messages/`: private questions, account request history, anonymous tracking codes and two-way conversations. The homepage form also saves a trackable private request.
- `/inbox/`: administrator assignment, assigned counsellor queue, search/status filters, priority, follow-up dates, private notes and optional reply emails. See [the message workflow](docs/MESSAGE_WORKFLOW.md) for account setup, ownership and daily operating steps.
- `/sitemap.xml`, `/robots.txt`: generated crawl configuration. Invalid routes return 404.

The established login, student/counsellor/admin portals, institution onboarding, privacy and terms pages remain available at their clean URLs. Legacy `.html` URLs redirect in the Express server and deployment configuration.

## Editing and verification

The shared page templates live in `server/views/site.js` and `server/views/journey.js`; styles/interactions are `public/discover.*` and `public/journey.*`. The original logo assets and BtechHelpline wordmark are preserved. `public/planning.js` is shared with the budget tests. Run `npm run build:home` after changing templates or directory identities to regenerate the static homepage fallback.

Historical ranks live in `server/data/cutoffs.json` with source/year/round/import timestamp. `npm run import:ranks` reimports the current public official JoSAA form; inspect the resulting year, round and diff before publishing. It does not supply future cutoffs or determine quota eligibility.

Reviews default to pending moderation. Only published reviews contribute to displayed review counts/ratings; editing a review returns it to moderation. Public review responses omit the account ID. Images are limited to three bounded embedded PNG/JPEG/WebP files; arbitrary remote image URLs are filtered. A registered account does not establish institutional attendance.

Directory identities in `server/data/directory.json` came from the pre-existing college seed. They are not a freshly audited current admissions dataset. Unsourced numeric claims were intentionally excluded from this fallback. A connected database is authoritative; fallback rows do not resurrect deleted database colleges.

Admins can now enter a source URL, academic year, verification date, median placement, hostel, mess and mandatory annual fees in the college form. Public numeric data is shown only when `dataStatus=verified` and all three evidence fields are present. Otherwise it reads “Not verified”. Review the exact programme/batch and statistical definition in the cited source before marking it verified. Average and median placement remain separate fields. Missing onboarding placements, approvals and faculty statistics no longer receive invented defaults.

Optional Analytics loads only after consent. Conversion events contain college slugs/counts or the form method, not rank, mobile number, email or free-text searches. Analytics page URLs omit query strings and hashes. Authenticated/private pages remain outside the sitemap.

## Checks

```powershell
npm test
npm run build:home
```

Tests cover public HTTP routes, redirects/reset tokens, 404s, structured data, escaping, provenance, budget calculations, enquiry persistence and Analytics consent. Integration tests start an isolated temporary MongoDB instance and local test inbox to check registration/OTP/password login, application ownership, staff permissions, overlapping sessions, double booking, cancellation, reminder opt-in/idempotence and review moderation. Message tests verify anonymous secret tracking, hashed storage, account ownership, assignment restrictions, saved replies, internal-note privacy, closed requests and cursor pagination. They do not alter the user's development database or contact a real mail/SMS service.

The local database and administrator login have been verified through HTTP. Earlier browser QA covered the base mobile design, shortlist, comparison, budget and checklist; browser automation access was rejected during the new feature pass, so no new visual browser verification is claimed.

The persistent Node server checks due email reminders every minute. They are opt-in, run once per saved deadline in its preceding 24 hours and ignore closed/reported tasks. On Vercel, configure a scheduled HTTP job for `/api/journey/reminders/run` with `Authorization: Bearer <CRON_SECRET>`; no always-running worker exists inside a serverless function. Calendar reminders depend on the user's calendar app after import. Live mail requires valid SMTP settings; missing credentials return delivery errors rather than simulated success. Local previews always capture mail, even if other mail credentials are present.

Production database/SMTP/SMS credentials, Search Console ownership and a deployed Vercel preview still need the owner's configuration and live validation. No deployment, real counselling availability, future rank prediction or complete bilingual content set is claimed.

Vercel continues to use `api/index.js`. Public files are included in the function bundle, public pages can render when the database is unavailable, and the catch-all routes reach Express so college URLs, sitemap and 404 handling work. Verify the preview deployment before promoting it, including project output-directory settings and database/mail environment variables.
