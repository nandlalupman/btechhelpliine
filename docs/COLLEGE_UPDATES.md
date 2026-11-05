# College data updates

The original directory has 247 institutions. `server/data/approved-colleges.json` adds 48 institution identities reviewed against the official JoSAA 2026 participating-institute directory on 5 November 2026. This snapshot contains name, listed location, website and JoSAA institute code, with the source URL and review date. These facts do not verify fees, placements, accreditation, programmes or an open admission window. Specialised institutes and campuses retain distinct identities. School of Planning and Architecture entries were excluded from these engineering additions.

The source is https://josaa.admissions.nic.in/applicant/seatmatrix/instituteview.aspx, linked from https://josaa.nic.in/participating-institutes/. The official page was readable with the web research tool. Direct Node downloads failed certificate validation at this review, and NIRF rejected automated access with HTTP 403. TLS checks were not disabled. This is a reviewed snapshot, not a claim of a continuously available source API.

## How a reviewed update reaches the website

1. Review the actual official source contents. Retain the source year and a real review date; an HTTP success or unchanged link is not a new fact review.
2. Add genuinely new institutions to the approved snapshot with a stable `sourceId`. Compare existing names, official domains and campus locations before adding. Shared website domains do not make different campuses the same institution. Use `Other` when institution type is not established by the source; leave branches empty when the source does not establish them.
3. Increment the snapshot's `revision` after a reviewed change. Retain stable names and slugs. Name changes need an explicit URL redirect plan. Do not remove an existing snapshot institution merely because a source request failed.
4. Run tests, build the homepage fallback, commit the intended files and push. Vercel consumes the reviewed snapshot after deployment; `api/index.js` applies it once per warm process after connecting to MongoDB. The local launcher applies it on restart.
5. `CollegeImport` binds the stable source ID to its database college. Subsequent revisions refresh source metadata and importer-owned city/state/website/admission-route/branch fields only when an administrator has not changed them. Fees, placements, partner status, branding and reviews are never changed by this importer. A previously imported college deleted by admin is not recreated on a later revision. Existing database colleges with the same exact name are preserved and receive source metadata only.
6. The disconnected public fallback includes the approved additions. With a connected database, database records remain authoritative; deleted colleges are not restored from fallback rows.

Field-level fee or ranking updates belong in `server/data/college-evidence.js` with course, category, period, batch and source context. Never turn semester tuition into an annual total or an institute-wide placement promise. A ranking band is not an exact rank.

## Recurring review

A weekly Codex heartbeat attached to this chat is intended to review official sources on Sunday at 09:00 in the configured local timezone. It applies supported changes, tests them and checks deployment; uncertain facts require review. This runs through the Codex desktop scheduler and depends on the desktop being available. It is not a continuously running Vercel worker or a guarantee that every college field updates instantly. Check the automation's actual schedule/status in Codex before claiming it is active.

Keep the last reviewed values and date if a source fails. Notify only for a published verified update, a refresh failure or a decision requiring human review. Do not change unchanged fact dates merely to make a page appear fresh.

## Deployment access for a private repository

Vercel supports private repositories, but the commit author must have access to the Vercel project. On a Hobby team, that author must be the team owner with the matching GitHub account connected under **Account Settings → Login Connections**. Pro/Enterprise projects require the appropriate team membership. See [Vercel's project collaboration guidance](https://vercel.com/docs/deployments/troubleshoot-project-collaboration).

GitHub recognizes this repository's configured commit author as `nandlalupman`. If private-repository deployment is blocked, check that same account's connection and project access in Vercel. Making a repository private again can affect later automatic deployments until this connection is resolved. This workflow does not change repository visibility or substitute another person's commit identity.

## Commands

`npm run sync:colleges` applies the reviewed snapshot to the configured database (or the launcher's local database). The admin portal's **College directory · Source updates** panel shows the source year, review date and database count; **Apply reviewed updates** retries the deployed snapshot without scraping or resetting administrator data. Only admins can use that control. `npm run local -- --restart` applies it and restarts localhost. `npm test` verifies uniqueness, evidence scope, concurrent/repeated imports, protected administrator edits, source revisions and deleted-college preservation. `npm run build:home` rebuilds the static fallback. Use the live discovery API and affected college pages to verify publication after deployment.
