# Site verification — 1 November 2026

The local server was repeatedly restarting under Node watch mode with the embedded MongoDB dependency tree on Windows. The launcher now runs a stable background process. Use `npm run local -- --restart` after server edits. Existing development database records are preserved.

## Repairs

- Verify a saved login before redirecting; use the account's current server-side role. Keep the intended internal page in the login return URL and reject external return destinations.
- Remove only authentication keys on logout/expiry. Keep shortlists, planning tasks and private tracking references. Temporary account-service failures leave the login intact and offer retry.
- Support trailing slashes on legacy authentication, portal and policy pages while preserving query parameters, including password reset tokens.
- Repair onboarding support/directory links and preserve the old homepage contact anchor.
- Bind message reply actions to their original conversation. Ignore a delayed response after another conversation has been selected. Ignore malformed browser tracking references rather than breaking the message list.
- Ignore invalid saved application records and fall back to English for an unsupported stored language.
- Make admin tab clicks independent of the browser's implicit global event; show textual totals if the external chart library is unavailable. Make registration verification headings and input text readable on the light background.
- Replace the obsolete Andaman government URL with the [official Administration portal](https://andamannicobar.gov.in/), independently opened and checked on this date.

The original logo images and wordmark have not been edited.

## Evidence

- `npm test`: 36 checks cover HTTP routes, canonical redirects, every sitemap page, internal assets/anchors, source provenance, financial tools, authentication, permissions, booking, task ownership, messages and moderation. New client tests exercise expiry without lost saved work, safe login return URLs, current roles and message-selection/reply races using event/network doubles.
- Local HTTP audit: 333 HTML pages, 610 unique first-party links/assets/fragments, no reported failures.
- Bounded external HTTP audit: all 322 discovered external destinations checked; 200 returned HTTP 200, 11 denied access with HTTP 403, one returned HTTP 503 and 110 could not be verified because of DNS, certificate, connection or timeout errors. No HTTP 404 or 410 was returned. A failed check does not establish that an official URL is obsolete.
- Actual local account: 15 authenticated read APIs returned HTTP 200 with successful responses, covering profile, requests, choices, admin lists/stats/onboarding, account tasks, staff slots/appointments/reviews and private inboxes.
- Actual persistent development database: temporary original message, reply and private note survived an app restart. The tracking key was hashed, internal notes stayed private and the test records were removed afterwards.
- Stability: 16 HTTP health checks over 30 seconds retained the same process ID with the database connected.

Ignored reports are stored in `.local/site-audit.json`, `.local/site-external-link-report.json`, `.local/test-run.log`, `.local/portal-api-report.json`, `.local/message-persistence-report.json`, `.local/stability-report.json` and `.local/resource-link-report.json`. They contain local operational details and are not committed.

## Remaining limits

The bounded external-source checker checks 75 curated government/institution URLs. Some return timeouts, DNS failures, certificate errors or access denial from this environment. These errors do not establish that a scheme has closed. Their official source links and government-directory alternatives remain available; current rules and deadlines must come from the authority. HTTP 200 alone also does not establish useful current content.

New visual browser verification is pending: automatic approval review rejected a browser-tab retry as a potential circumvention of a previously blocked browser navigation. No alternate browser, screenshot or browser automation workaround was used. HTTP, source, event/network unit tests and database checks do not verify mobile rendering, visual spacing or every interactive browser gesture.

Production database/mail credentials, delivery and deployment remain outside this local verification. Local mail is captured in the development inbox rather than sent externally.
