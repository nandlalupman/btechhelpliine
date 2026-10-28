# Messages: who does what

## Student or parent

1. Open `/messages/` or use the homepage counselling form. Write the question, contact details and contact consent. Partner sharing is a separate optional choice.
2. After a successful database save, keep the private 64-character tracking code. The code is shown once on the confirmation and included in the acknowledgement email. Local development captures this email at `/local-tools/`.
3. Open the request from `/messages/` to read replies or add information. Signed-in submissions also appear in that account. Existing anonymous conversations still require their tracking code, even after registering an account with the same email.
4. Closed, cancelled or dropped requests remain readable. Start a new request for a new question. Never post a password, OTP, payment credential or identity-document number.

Conversations are private, not a public comment wall. A tracking code acts as a secret access credential; do not share it or put it in a URL. Browser references are stored on the same device. If browser storage is unavailable, copy the displayed code before leaving. If a code is lost, contact the team; email address alone is not sufficient to grant conversation access.

## Administrator

1. Log in and open `/inbox/`, also linked from the admin portal and team workspace.
2. Review new/unassigned requests. Search by name, email, phone or subject; filter status, waiting requests and due follow-ups. The queue is paginated in batches of 25.
3. Assign an active counsellor or administrator. Set priority and a next follow-up date. New requests remain unassigned until an administrator chooses an owner.
4. Monitor work and reassign requests when necessary. The administrator can handle every request.

To add a counsellor, first create and verify that person's account through `/register`. In the admin portal's user operations tab, change its role to Counsellor. Confirm the account is active. Role changes are enforced by the backend, not just the page display. Only administrators can assign or reassign conversations.

Local administrator credentials are in `.local/access.json`. They belong to the local development database and must never be deployed or committed.

## Assigned counsellor

1. Log in and open `/inbox/`. Only requests assigned to the logged-in counsellor appear.
2. Read the original question and replies. Send a response in the conversation. The reply is saved before an optional email notification is attempted.
3. Choose “Also email this reply” only when appropriate. The API requires the original contact consent for email delivery. A failed email does not delete the saved reply; the UI reports the delivery failure.
4. Record private context in Internal notes. Set the next follow-up, update status and close the request when complete. Internal notes, priority and follow-up dates are never included in the student's conversation response.

Suggested progression: **new → contacted → in progress → counselled → closed**. A student reply returns the request to the “Waiting for team” queue. A team reply changes a new request to contacted. Status changes made in the inbox appear in the conversation history. Follow-up dates organise the inbox; they do not automatically call or message anyone.

## Storage and access

- MongoDB `leads`: original question, contact/consent details, owner, assignment, status, priority and follow-up. Tracking codes are stored as SHA-256 hashes and excluded from normal document projections.
- MongoDB `conversationmessages`: subsequent replies and status events, linked to the lead. Threads return the latest 50 messages with a cursor for older replies.
- Student access: the account that submitted the request, or the exact private tracking code.
- Staff access: administrator, or the counsellor currently assigned to that lead. Unassigned requests are administrator-only, including through the older counsellor endpoints.
- Internal notes: stored on the lead, visible only to authorised team members; the inbox retains the most recent 100 notes.
- Local development uses the persistent database in `.local/database`. `.local/` includes credentials, private references, mail and database files and is excluded from Git.

## Deployment setup

The application code is ready for a configured MongoDB environment. Set `MONGODB_URI`, the public `FRONTEND_URL`, and SMTP credentials for real email. Use the existing production administrator setup to create the owner account. Do not deploy `LOCAL_PREVIEW=1`, local credentials or preview counselling slots. Search Console and hosting ownership must be configured in the owner's accounts.

`npm test` checks real database writes and role/ownership restrictions in an isolated test database. Run `npm run check:messages` against the running `npm run local` app for an additional persistence check: it creates a uniquely marked test request, verifies its saved reply/private note, restarts only this launcher's own app, verifies the same records remain and removes its test data. The report is saved in ignored `.local/message-persistence-report.json`. No test contacts a real student or sends real mail.
