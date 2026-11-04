# Student accounts and homepage experiences

## Student account

Register at `/register`, then verify the six-digit email code. A student who leaves the registration screen can return at `/verify-email/` to verify or request a fresh code. Verification confirms email access, not college enrolment. Expired codes are rejected; verified accounts use login or password recovery.

The dashboard at `/dashboard` contains profile preferences, saved colleges, counselling requests, unread reply indicators, links to messages, applications, appointments and scholarships, and a password change form. A request's “Read replies & respond” link opens that exact conversation. Account conversations require the owner or authorised staff; private team notes stay hidden from students.

## Homepage student messages

1. Student logs in and opens `/dashboard#my-experience`.
2. They choose a public display name, write an honest experience (20–700 characters), and explicitly consent to publication. Their private counselling conversation is never copied into this submission.
3. Submission is stored in MongoDB as pending. Each student has one current experience. The profile displays its current status.
4. Admin opens `/admin`, expands **Homepage student messages · Review & select**, and chooses **Select for homepage** or **Hide from homepage**. A note can explain the decision to the student. Only admins can moderate.
5. The homepage displays up to 12 recently selected experiences belonging to active, email-verified accounts. Only the chosen name and message are public. There are no invented testimonials or aggregate ratings.
6. Editing a submission immediately removes publication and requires a fresh review. A stale admin approval is rejected when the student's revision has changed. Withdrawing deletes the submission. Account deletion also removes it. Existing open pages update when reloaded.

The admin view shows the 100 most recently updated submissions; **Refresh submissions** reloads them. Review messages for private contact details before selecting them. A student's submitted words are not editable by admin through this interface.

## Verification

`npm test` exercises isolated MongoDB persistence, consent, ownership, admin-only selection, safe HTML output, stale approvals, withdrawal and hidden inactive accounts. Account tests cover registration, expired verification code recovery, password login/change, team responses and private follow-up messages. Email delivery in tests goes to a local outbox; it does not establish production inbox delivery.

`npm run build:home` updates the static homepage fallback. `npm run check:production` checks live public routes, assets and internal links. These are HTTP/source checks, not interactive visual browser testing. Complete a real inbox OTP delivery check separately before promising email delivery reliability.
