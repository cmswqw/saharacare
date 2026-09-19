# SaharaCare security audit — 18 September 2026

## Executive summary and scope

This is a repository audit with local remediation, not a certification or a production penetration test. The existing application, interface, roles, medical workflows, routes and data model were preserved. No commit, push, deployment, hosted migration, account-setting change, credential rotation or history rewrite was performed. Discovered credentials were never used to contact a service. Only public documentation and npm package/advisory metadata were requested externally; repository contents were not uploaded to a scanner.

Initial state: branch `backend-integration`, commit `d1e59e385a5cc5cf31decf4c18fea78f8e1585a5`, clean `git status --short`, no pre-existing uncommitted files, non-shallow repository. All changes listed below belong to this audit. Baseline typecheck, lint, 67 tests and production build passed.

Confirmed issues were found in push destination validation, medical-share revocation/cleanup, mutation origin checks, request-size enforcement, diagnostic privacy, browser protections and a nullable database authorization check. Targeted dependency patches were also applied. There was **no confirmed private-secret exposure** in inspected source, Git objects or public build artifacts. A new SQL migration is prepared locally but remains unapplied and unexecuted against PostgreSQL.

## Verified architecture and trust boundaries

```text
Browser (React/TypeScript, English/Nepali, Tailwind)
  ├─ Next.js App Router pages, server actions and route handlers
  │    ├─ user-session Supabase client → Auth / PostgreSQL Data API → grants + RLS
  │    ├─ restricted server-only admin client → private files, shares, push jobs
  │    └─ authorized, minimized chat context → server-only Gemini provider
  └─ browser Supabase client → Auth / authorized data / Realtime (RLS boundary)
```

The browser does **not** exclusively access data through Next.js. Auth, some profile/medication-related operations and Realtime use the public Supabase client directly; database grants/RLS therefore remain essential. Existing server-only admin workflows use a privileged secret and must enforce authorization before accessing data. This audit did not add privileged clients or move ordinary mutations to them.

The current implementation uses Next.js 15, React 19, TypeScript, Supabase SSR/Auth/PostgreSQL/Realtime/Storage, Gemini, PDF generation/rendering and Web Push. `app/actions`, `app/api`, `lib/data`, `lib/supabase`, migrations and role layouts hold the primary boundaries. The repository contains real medication, dose, appointment and notification flows; emergency-contact components still import mock contacts. Medical KYC drafts and generated PDF object URLs are held in React memory until the patient explicitly shares files. Language/text-size/sound preferences use localStorage; no current caller of the generic `useLocalStorage` hook was found. Chat history is component state, not persistent browser medical storage.

Vercel configuration schedules medical-share cleanup. No tracked GitHub Actions workflow or `.vercel` deployment configuration was found. Local `supabase/config.toml` exposes `public`/`graphql_public`, not `private`; this does not prove hosted settings match.

## Confirmed findings and remediation

Evidence anchors in this section refer to the original commit above unless a current file is explicitly named. No credential values or patient records are reproduced. For **every finding F01–F11**, credential rotation and Git-history rewriting are **not indicated by the available evidence**; no leaked credential was identified. A provider/log review could change that conclusion. Production exploitation was not attempted.

### F01 — Vulnerable dependency versions

- **Severity/classification:** Critical upstream advisories for installed Next.js; high for sharp; high advisory but development-only exposure for js-yaml. Confirmed affected package versions, not a proven production compromise.
- **Evidence:** `package.json:23` pinned Next.js `15.5.22`; lockfile resolved sharp `0.35.3` and ESLint's js-yaml `4.3.1`. `npm audit --json --ignore-scripts` reported GHSA-p293-qw3h-jr36, GHSA-2xp9-vwfh-vxw4, GHSA-rgj7-g3m4-5g8c and GHSA-2883-xcg3-v3hh.
- **Cause/attack path/impact:** affected Next.js Windows hosting and image-processing code could permit code execution under the advisory conditions, affecting all server-held data; malicious YAML can exhaust developer/CI CPU. Windows is the local environment; Vercel's production OS and reachable AVIF inputs were not verified. No claim that a current upload route exposes AVIF optimization.
- **Smallest fix:** Next.js and matching ESLint config `15.5.24`; existing sharp override pinned to `0.35.4`; only js-yaml updated to `4.3.2` in the lockfile. Related platform binaries changed accordingly; unrelated packages were not upgraded. Install scripts were disabled.
- **Verification:** package-version diff, npm audit, typecheck, lint, tests and build. One PDF.js advisory remains, discussed separately below.
- Sources: [Next.js Windows advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36), [Next.js AVIF advisory](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4), [sharp advisory](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c), [js-yaml advisory](https://github.com/nodeca/js-yaml/security/advisories/GHSA-2883-xcg3-v3hh).

### F02 — Arbitrary HTTPS destinations in push subscriptions

- **Severity/classification:** High; confirmed authenticated server-side request forgery path.
- **Evidence:** `lib/notifications/subscription.ts:33,55` checked only HTTPS; `lib/notifications/web-push.ts:81` passed the stored endpoint to `webpush.sendNotification`.
- **Cause/attack path/affected data:** an active patient with a due dose and valid generated subscription keys could register a loopback/private/arbitrary HTTPS URL. Cron then sent from the server to that destination. This exposed server network reachability; the push payload itself was already generic, not medication details.
- **Fix:** shared push-service hostname allowlist used at enrollment and immediately before delivery. Reject credentials, custom ports, fragments and non-approved/IP destinations. Invalid legacy rows are disabled without contacting their endpoint. Existing FCM, Mozilla, Apple and Windows providers are supported; uncommon/custom providers now fail closed until reviewed.
- **Verification:** actual parser tests for approved providers, private IPs, lookalike hosts and URL tricks; real dispatcher code against local fakes verifies zero sends for an invalid legacy endpoint.

### F03 — Medical data could enter diagnostics

- **Severity/classification:** Medium; confirmed unsafe logging sinks. Historical disclosure into provider logs was not investigated.
- **Evidence:** `app/actions/phase4.ts:200`, `app/actions/appointments.ts:152` logged database `message/details/hint`; `app/api/chat/route.ts:101` logged provider free-text messages after key-pattern redaction.
- **Cause/attack path/impact:** PostgreSQL constraint details can contain a complete failing medical/appointment row; model-provider errors can echo medical input or secrets in unrecognized formats. Log readers/export destinations could receive patient content beyond its intended audience.
- **Fix:** allow only structured database codes; remove invalid returned medication values from logs. Provider diagnostics retain controlled classifications/status, known error names/codes, configured model/provider and app-generated request ID/latency, not provider text/IDs. Public assistant errors remain generic.
- **Verification:** synthetic PHI/error-field regression tests; review of remaining console calls and browser bundle references. Owner should review existing production log access and retention without copying medical data into this report. This follows [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).

### F04 — Revocation failures could be reported as success

- **Severity/classification:** Medium; confirmed confidentiality-control failure.
- **Evidence:** `app/api/medical-shares/[shareId]/route.ts:21` ignored the revocation update result; the next line returned success. `app/api/appointments/[appointmentId]/medical-share/route.ts:86` ignored old-share revocation errors.
- **Cause/attack path/impact:** a failed database update could leave the assigned doctor authorized while the patient believed access was revoked or replaced.
- **Fix:** require successful update plus a returned revoked row before reporting success. Replacement files remain pending until old-share revocation succeeds; failures enter cleanup and return a generic failure. Removed the unprovable promise that no partial share could ever remain.
- **Verification:** execute real routes with local fake database success/error/missing-row outcomes, successful replacement, failed old-share revocation, and file readiness assertions. Storage and database are still separate systems, so exceptional network failures are not an atomic transaction; owner monitoring/reconciliation remains important.

### F05 — Cleanup batch starvation retained expired medical files

- **Severity/classification:** Medium; confirmed retention-control defect.
- **Evidence:** `app/api/cron/medical-share-cleanup/route.ts:14` selected the first 100 expired/revoked share records, including already-empty records, which remain as audit history.
- **Cause/attack path/impact:** completed records can keep occupying every batch, preventing later expired files from being physically removed. Access expiry still denies viewing, but storage retention exceeds intent.
- **Fix:** inner-join remaining file metadata when selecting cleanup candidates; check database errors before reporting completed work. Keep audit records intact.
- **Verification:** real cleanup route with 100 completed shares before a 101st uncleaned share; verifies the later file is removed. Actual hosted scheduler/storage behavior not tested.

### F06 — Missing explicit origin checks on medical-share mutations

- **Severity/classification:** Medium; confirmed missing defense on privileged cookie-authenticated POST/DELETE routes, exploitation conditional on origin/cookie environment.
- **Evidence:** both medical-share mutation route entry points lacked origin validation; the existing push mutation route already required it.
- **Cause/attack path/impact:** SameSite=Lax mitigates ordinary cross-site POST but not an untrusted same-site sibling origin. A browser could submit an unwanted medical share for a known appointment. This is not a claim that such an attacker-controlled sibling currently exists.
- **Fix:** reuse the existing same-origin mutation guard before authentication/data access.
- **Verification:** actual routes reject an untrusted sibling origin before touching Auth/admin clients; valid same-origin mutation tests pass. Reverse-proxy forwarding-header integrity is a deployment assumption for the existing guard and requires owner review.

### F07 — Body-size limits were applied after unbounded parsing

- **Severity/classification:** Medium; confirmed resource-exhaustion weakness.
- **Evidence:** `app/api/chat/route.ts:138` parsed JSON after checking only optional Content-Length; medical upload `route.ts:34` parsed multipart before file-size checks; push route `:39,77` parsed arbitrary JSON.
- **Cause/attack path/impact:** absent/forged lengths or oversized unused fields can allocate excessive memory before validation. Chat parsing was reachable before authentication; other paths required authentication.
- **Fix:** common actual-stream byte limit, cancellation on overflow, controlled invalid/oversized responses. Preserve chat's 24 KB budget; allow 4 KB for push JSON; multipart cap derives from existing per-file/count limits plus bounded encoding overhead. File signature/count/per-file checks remain.
- **Verification:** tests for exact limit, malformed JSON/UTF-8 handling path, Unicode, missing/forged/oversized Content-Length, stream cancellation and malformed/oversized multipart. Hosting-layer limits/timeouts may be stricter; this is not distributed rate limiting.

### F08 — Raw database errors returned to the sharing UI

- **Severity/classification:** Low; confirmed internal error disclosure.
- **Evidence:** medical upload `route.ts:53` returned `shareError.message`.
- **Cause/attack path/impact:** a patient triggering a failed insert could receive schema/constraint/provider details; database messages are not a safe public contract.
- **Fix:** return a controlled generic sharing failure; preserve useful controlled validation feedback.
- **Verification:** injected synthetic private-schema error is absent from the real route's response.

### F09 — NULL audit fields bypassed notification authorization

- **Severity/classification:** Medium; confirmed database authorization/integrity defect.
- **Evidence:** `supabase/migrations/20260819222740_implement_doctor_availability_and_caregiver_appointments.sql:756` compares nullable `updated_by`/`cancelled_by` with `<>` inside a denial condition. `notify_appointment_participants` is SECURITY DEFINER and callable by authenticated users.
- **Cause/attack path/affected users:** SQL NULL yields UNKNOWN, not TRUE, so the denial branch can be skipped. An active unrelated/former caregiver with a previously known appointment UUID can inject a false cancellation notice; NULL historical update actors also permit false reschedule notices. The underlying appointment is not changed, but the patient receives misleading information.
- **Fix:** NEW idempotent migration `supabase/migrations/20260917181841_harden_appointment_notification_authorization.sql`: NULL-safe `IS DISTINCT FROM`, current accepted relationship via the existing helper, active caregiver, matching event actor and persisted appointment state. Same function signature/content and effective EXECUTE privileges; no new privilege, schema exposure or RLS change.
- **Verification:** five local migration/source regression checks passed. Rollback-only synthetic SQL supplied in `tests/sql/appointment-notification-authorization.sql`. **PostgreSQL runtime and hosted tests NOT RUN**: no local PostgreSQL/Docker/PGlite runtime found; remote execution prohibited. Owner must review/test/apply before relying on the fix in production.

### F10 — No repository-wide external-framing/referrer protections

- **Severity/classification:** Medium configuration gap; missing repository controls confirmed, hosted header overrides unknown.
- **Evidence:** original `next.config.ts:3` configured only Strict Mode; sensitive HTML pages had no app-wide framing/referrer policy. Medical-file responses had their own stronger controls.
- **Cause/attack path/impact:** external framing can enable clickjacking of sensitive controls; outgoing requests can expose page paths absent a restrictive referrer policy.
- **Fix:** SAMEORIGIN / `frame-ancestors 'self'`, no-referrer, nosniff, restricted permissions, base/form constraints, private no-store API responses. Same-origin/blob PDF previews remain allowed. No script-src nonce rollout or full XSS-proof CSP is claimed.
- **Verification:** config assertions and production build. Authenticated visual/browser verification and deployed headers remain owner checks. Guidance: [OWASP HTTP headers](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html).

### F11 — SSR session cookies lacked an explicit production Secure flag

- **Severity/classification:** Medium configuration gap, impact conditional on HTTP reachability/HSTS.
- **Evidence:** `lib/supabase/client.ts:4`, `server.ts:7`, `middleware.ts:7` supplied no cookie options; installed SSR defaults set SameSite=Lax and HttpOnly=false, with no Secure flag.
- **Cause/attack path/impact:** without enforced HTTPS/HSTS, a browser can send non-Secure session cookies to an HTTP origin, exposing session material to a network attacker.
- **Fix:** consistently set Secure in production and SameSite=Lax in browser/server/middleware clients; development HTTP remains supported. HTTPS is required for production. Do not flip HttpOnly independently: the existing Supabase browser client needs session access for refresh, per [Supabase SSR guidance](https://supabase.com/docs/guides/auth/server-side/advanced-guide). A server-only session architecture would be a separate project, not this repair.
- **Verification:** all client configurations checked; typecheck/build pass. Actual production cookie/HSTS/browser-refresh behavior not exercised.

## Suspected issues, residual risks and owner decisions

Each item below has **no demonstrated credential exposure and no current rotation/history-cleanup requirement**. Do not treat a source observation as proof of a hosted exploit.

| ID / severity / classification | Exact evidence and root cause | Attack path, affected data and impact | Smallest next step and verification |
|---|---|---|---|
| S01 Medium, suspected policy inconsistency | `lib/auth.ts:32`, `lib/chat/context.ts:77`, medical routes' role-only queries; active status checked in appointment/push paths only | If inactive means global suspension, old sessions can retain other medical capabilities | Owner define inactive semantics; then enforce consistently in RLS/RPCs/server paths with inactive-user tests. Not silently changed. |
| S02 Low–Medium, suspected excess profile scope | appointment migration `:805` helper and medical migration `:301` profile policy; row SELECT includes more than display name | Appointment participants/former creators may read linking_code and other profile columns after relationship ends; doesn't itself grant medication/file access | Decide minimal participant fields and retention, then use narrow RPC/view/grants and test former caregiver/direct Data API reads. |
| S03 Medium, deployment-dependent abuse risk | `lib/chat/rate-limit.ts:11` process-local Map; upload/push routes have no durable shared quota | Multiple instances/restarts and repeated authorized uploads can bypass aggregate limits or increase cost | Review Vercel/provider limits; choose shared quota storage or platform rules with explicit policy and multi-instance/load tests. Not a speculative infrastructure replacement. |
| S04 High upstream advisory, current exploit path not established | `package.json:25` PDF.js 5.6.205; `SecureDocumentViewer.tsx:28` uses getDocument/page.render(canvas), no PDFViewer/PDFScriptingManager/annotation scripting | GHSA-hq66-cqwq-w95j requires scripting-enabled PDF viewer; that integration is not used here. Malicious PDF handling remains sensitive | Keep residual npm alert visible; review/test the minimum patched major version 6.2.108 in a separate controlled rendering change if desired. No unverified major upgrade or audit suppression. [Maintainer advisory](https://github.com/mozilla/pdf.js/security/advisories/GHSA-hq66-cqwq-w95j). |
| S05 Medium, unverified file/provider privacy risks | `lib/medical-files/validation.ts:1`; `lib/chat/context.ts:196` includes display name and authorized context | Magic bytes are not malware scanning; Gemini receives authorized names/context under current workflow; provider retention/consent settings unknown | Owner review vendor retention/consent, malware/CDR need, file/pixel/page resource budgets, storage retention and privacy policy. Do not upload real patient files for testing. |
| S06 Medium, unverified concurrency/atomicity | appointment migration slot/unique-key logic; medical upload performs storage/database operations separately | Concurrent availability edits or uploads and partial network failures may produce contention/orphan files; duplicate legitimate notification calls are not idempotent | Isolated database concurrency tests, failure injection and reconciliation design before any broader schema/workflow change. Existing booking actor/slot logic not replaced. |

## Secrets, history and false positives

No Gitleaks, TruffleHog or detect-secrets executable was installed locally; none was installed for this task. A temporary local redacting scanner used known credential patterns plus exact matching of private environment values without printing them. It inspected current text/binary artifacts, environment files/backups/logs, all locally available blobs/commit messages and renamed/deleted file history. No credentials were authenticated or validated online.

Pre-final-build scan: 688 current files / approximately 1.22 GB, including 94 public/distribution artifacts and 366 internal build/cache artifacts; no skipped/unreadable files. All 14 local commits (12 branch-reachable plus two unreachable/reflog commits), all 481 local blobs (137 without a committed path) and commit messages were inspected. The nested `saharacare` repository contained one commit with only `.gitattributes`. A post-build scan is recorded in verification below.

Expected ignored private configuration: `.env.local:4` Supabase server secret `[REDACTED]`, `:7` cron secret `[REDACTED]`, `:9` Gemini key `[REDACTED]`, `:12` VAPID private key `[REDACTED]`. They were not found in tracked/history/public/client/server-build content. `.env.example` contains placeholders. These ignored private values are not evidence of publication.

False positives/public identifiers:

- Supabase URL, publishable/anon key and VAPID public key are intentional public identifiers. Their safety depends on the separate authorization controls, not secrecy.
- SDK `WORKLOAD_IDENTITY_API_KEY_PLACEHOLDER` and synthetic test keys/user-password URLs are not real credentials.
- URL-pattern matches crossing binary webpack-cache record boundaries were not real connection strings.
- An initially suspected caregiver-link column-grant gap was rejected: PostgreSQL table-level REVOKE also removes corresponding column grants. No unnecessary migration was made. [PostgreSQL REVOKE](https://www.postgresql.org/docs/current/sql-revoke.html).
- Signup metadata is constrained to the application's self-signup patient/caregiver/doctor roles; admin cannot be self-selected. Existing authorization queries the stored profile, not arbitrary JWT user_metadata.
- The PDF.js affected version is real, not a fabricated advisory, but current canvas-only usage does not establish the advisory's scripting-enabled attack path.

No credential rotation or Git-history cleanup is mandated by these results. If the owner identifies exposure in remote-only branches, deployment logs or shared backups, rotate that provider credential first; deleting a file or rewriting history does not invalidate it. Do not publish raw scanner output/keys or rewrite history without coordination. The workspace is inside OneDrive: cloud-sync access/retention was not reviewed.

## Secure controls already present

- `auth.getUser()` validates identities; sensitive handlers independently authorize instead of relying on frontend guards. Auth callback destinations are fixed role routes, not arbitrary return URLs. PKCE/cookie refresh is supported by the existing SSR implementation. No complete password-reset flow was found to exercise.
- Browser-visible Supabase client reads only public variables. Admin, Gemini and Web Push modules use `server-only`; inspected client imports do not reach privileged entry modules. Environment objects are not broadly serialized/logged.
- All 13 public application tables enable RLS in local migrations. Role/admin/demo edits are restricted by column grants; admin medical-data denial policies and minimal directory responses exist. SELECT/INSERT/UPDATE/DELETE grants/policies were reviewed with later migrations considered, not in isolation.
- Medication creation remains user-scoped, role/owner checked and atomic with schedules; dose integrity/weekday/timezone/duplicate protection remains. Appointment audit fields derive from auth.uid/profile, with accepted caregiver checks and existing free-slot/collision protection.
- Internal config remains outside exposed schemas and browser-denied. Service-role access to private medical configuration is narrowly granted; existing privileged functions use fixed search paths and explicit execution grants. No unsafe user-built dynamic SQL was found.
- Medical storage is private, generated paths avoid filename path injection, upload type/signature/count/size validation exists, and file viewing checks assigned participants, readiness, expiration, revocation, cancellation and hash. No permanent public file URLs are returned; files are proxied with no-store/sandbox headers.
- Gemini credentials/context retrieval remain server-side; authorized patient/accepted caregiver context is selectively fetched with bounded fields/rows. The model has no database credentials or mutation tools. Prompt text cannot change server access checks. Deterministic emergency/medication-safety replies remain unchanged.
- React renders text without application `dangerouslySetInnerHTML`/eval sinks. No medical localStorage persistence or analytics logging was found. Reminder push content is generic; cron uses a timing-safe secret comparison.

## Exact repository changes

| Files | Reason |
|---|---|
| `app/actions/appointments.ts`, `app/actions/phase4.ts` | Remove medical/row contents from diagnostics. |
| `lib/security-diagnostics.ts` (new) | Narrow safe database-code logging. |
| `app/api/chat/route.ts`, `lib/chat/gemini-adapter.ts` | Bound request bytes and remove provider free-text logging. |
| `lib/request-body.ts` (new) | Reusable bounded stream/JSON reader. |
| `app/api/push-subscriptions/route.ts` | Bound subscription mutation JSON. |
| `lib/notifications/subscription.ts`, `lib/notifications/web-push.ts` | Restrict push destinations on enrollment and delivery. |
| `app/api/appointments/[appointmentId]/medical-share/route.ts` | Origin check, bounded multipart, safe errors, confirm supersession before publication. |
| `app/api/medical-shares/[shareId]/route.ts` | Origin check and confirmed revocation result. |
| `app/api/cron/medical-share-cleanup/route.ts` | Avoid retention starvation and check database errors. |
| `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts` | Consistent production Secure/SameSite cookies. |
| `next.config.ts` | Compatible baseline headers and API no-store. |
| `package.json`, `package-lock.json` | Only relevant security patch updates and associated binaries. |
| `supabase/migrations/20260917181841_harden_appointment_notification_authorization.sql` (new) | Fix NULL/relationship/event authorization in one existing RPC. |
| `tests/medical-files.test.ts`, `tests/push-notifications.test.ts` | Behavioral access, failure, retention and SSRF regression coverage. |
| `tests/server-module.ts` (new) | Run actual server code against explicit fakes; unmocked external modules fail, environment is synthetic. |
| `tests/security-hardening.test.ts` (new) | Logging, byte limits, headers, cookies and canvas-only viewer regression coverage. |
| `tests/database-security.test.ts` (new) | Latest migration definition/grants/guard regression checks. |
| `tests/sql/appointment-notification-authorization.sql` (new) | Optional owner-run synthetic rollback-only SQL verification. |
| `tests/run-tests.ts` | Include the new security suites. |
| `SECURITY_AUDIT.md` (new) | Findings, evidence, limits, commands and owner handoff. |

No already-applied migration, UI component, route destination or medical data schema was edited. Build/cache/tsbuildinfo artifacts remain ignored.

## Verification and limitations

| Check | Before | After |
|---|---|---|
| `npm run typecheck` | PASSED | PASSED |
| `npm run lint` | PASSED | PASSED |
| `npm test` | PASSED, 67 tests | PASSED, 91 tests |
| `npm run build` | PASSED, Next 15.5.22 | PASSED, Next 15.5.24 |
| `npm audit --json --ignore-scripts` | FAILED: 4 flagged packages | FAILED: 1 high PDF.js advisory remains; not hidden/suppressed |
| Diff whitespace / scope review | Clean starting tree | PASSED; final review repeated before handoff |
| Redacted files/history scan | No confirmed exposure | Final rebuilt artifact scan recorded below |
| Local synthetic route/service checks | Existing tests | PASSED: unauthorized/unrelated/expired/revoked/cancelled/pending file scenarios, revocation failures, cleanup, SSRF and body limits |
| PostgreSQL migration execution / real RLS integration | NOT RUN | NOT RUN — no installed isolated PostgreSQL runtime; remote execution prohibited |
| Actual provider sends / hosted Auth / production headers | NOT RUN | NOT RUN — credentials were not used |
| Authenticated browser/PDF preview/end-to-end role workflow | NOT RUN | NOT RUN — no browser automation dependency installed; source/build/test verification only |

The first added test run exposed a TypeScript parameter-property incompatibility with Node's strip-only test runner. The new error class was corrected to ordinary fields; subsequent suites pass. This was an introduced test compatibility failure, not a pre-existing app failure. Build emits webpack cache-size notices; lint emits Next's existing `next lint` deprecation notice. Neither was suppressed.

Known limitations: no hosted database/schema/grant/storage drift check, advisors, real sessions, production deployment config, provider logs, historical remote-only objects, credential validity checks, cryptographic secret entropy proof, malware scans, or encrypted/compressed payload decoding. Regex/exact-match scanning cannot prove absence of all unknown credentials. Source-based SQL tests do not prove PostgreSQL execution or concurrent authorization behavior. The CSP is a compatibility baseline, not a complete script policy. RLS source inspection does not replace authenticated Data API testing on a deployed database.

## Commands actually run

Representative shell commands below were run, not proposed deployment instructions. `Get-Content`/`rg` source reads and `apply_patch` edits additionally covered the files named above. Git output containing credentials was never printed; the scanner invoked object reads internally and emitted metadata only.

```text
git status --short
git rev-parse HEAD
git branch --show-current
git rev-parse --is-shallow-repository
rg --files (excluding dependencies/generated output for source inventory)
Get-Command gitleaks,trufflehog,detect-secrets -ErrorAction SilentlyContinue
npm run typecheck
npm run lint
npm test
npm run build
npm audit --json --ignore-scripts
npm ls next sharp pdfjs-dist js-yaml
npm install --ignore-scripts --no-fund --no-audit
npm update js-yaml --ignore-scripts --no-fund --no-audit
git -c core.safecrlf=false diff --check
git -c core.safecrlf=false diff --numstat
git diff --stat
node --no-warnings --experimental-strip-types --test tests/database-security.test.ts
node --no-warnings --experimental-strip-types --loader ./tests/alias-loader.mjs --test tests/medical-files.test.ts tests/push-notifications.test.ts
```

The already-cached Supabase CLI 2.114.0 was inspected with `--help`/migration help. `supabase migration new harden_appointment_notification_authorization` hit an existing-directory CLI error; it was generated in a unique temporary workdir using the CLI and the new empty file moved into the repository without overwrite, then populated. No install or remote CLI operation was used.

Secret scanner commands: `git ls-files -z`, `git check-ignore`, `git rev-list --all --count`, `git rev-list --all --reflog --count`, `git fsck --no-reflogs --unreachable --no-progress`, `git cat-file --batch-all-objects --batch-check`, `git ls-tree -rz <commit>`, internal `git cat-file blob/commit <object>` and nested-repository history reads. The temporary scanner and its redacted results were kept outside the repository.

Public references included Supabase documentation search/changelog, current Next.js data-security guidance, OWASP logging/headers/SSRF, PostgreSQL REVOKE and maintainer advisories. Supabase skill guidance informed RLS/grant and server-client review; no hosted advisor/migration call was made because the user's narrower scope forbids it. Explicit grants remain important under the [current Supabase Data API default change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically). See also [Next.js data security](https://nextjs.org/docs/app/guides/data-security) and [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api).

## Owner checklist and manual actions

- [ ] Review the local diff. Nothing is committed or deployed. Existing production remains unchanged until an authorized release.
- [ ] Review the new notification migration; apply it first to an isolated disposable/staging Supabase database using the existing migration workflow. Run `tests/sql/appointment-notification-authorization.sql` there as the database owner, then independently test authenticated Data API access. The synthetic fixture script rolls back but is **not** a production test.
- [ ] Verify linked caregiver notifications succeed; NULL actors, unrelated/former/inactive caregivers, unauthenticated/wrong-role users and wrong event states produce no notifications. Confirm RLS stays enabled and anon cannot execute the RPC. Then schedule an explicitly authorized production migration/deployment; this audit did not do it.
- [ ] In an authorized staging browser, test login/logout/confirmation/refresh, patient medication save, own and linked-caregiver appointment booking, unrelated caregiver denial, free slots/double booking, patient share/revoke, assigned vs unrelated doctor, expired/revoked/cancelled files, generated PDF preview and reminder enrollment in supported browsers. Test English/Nepali UI remains unchanged.
- [ ] Inspect hosted Supabase grants/RLS/advisors/private-schema exposure and bucket privacy. Do **not** expose `private` or add browser access to its config. Confirm production email confirmation, password policy, CAPTCHA/MFA/session settings; local development settings are not evidence of production configuration.
- [ ] Verify Vercel HTTPS/HSTS, Secure/SameSite cookies, framing/no-store headers, trusted proxy headers, body/time limits, provider quotas, cron delivery and storage cleanup progression. Confirm no private key uses `NEXT_PUBLIC_` and no medical content reaches logging/analytics.
- [ ] Resolve inactive-account/profile-minimization policy and durable abuse limits. Review Gemini data handling and upload malware/retention needs.
- [ ] Review the remaining PDF.js advisory; keep canvas-only/no-scripting integration guarded, and plan a separately validated patched-major upgrade if required. Do not treat npm audit as passing.
- [ ] Review GitHub secret scanning/push protection and cloud-sync sharing if desired. No rotation/history rewrite is indicated now; rotate through the relevant provider only if additional evidence establishes exposure.

## Final verification note and Git status

Final verification completed after all code and report changes:

- `npm run typecheck`: **PASSED**.
- `npm run lint`: **PASSED**, no warnings/errors (the command prints Next.js's deprecation notice for `next lint`).
- `npm test`: **PASSED**, 91/91 tests.
- `npm run build`: **PASSED** using Next.js 15.5.24; all 22 static-generation steps/pages completed. The build prints non-failing webpack cache serialization notices.
- `npm audit --json --ignore-scripts`: **FAILED** because one high-severity PDF.js advisory remains, explicitly classified as S04. No critical, moderate or low alerts remain.
- `git -c core.safecrlf=false diff --check`: **PASSED**.
- Generated `.next/routes-manifest.json`: confirmed the expected framing, MIME, referrer, permissions, CSP and API no-store headers.
- Post-build redacted scan: 692 current files / 1,202,360,272 bytes, 94 public/distribution artifacts, 366 internal build/cache artifacts, all 14 locally available commits and all 481 available Git blobs; zero skipped files. **No confirmed private secret appeared in source, history or public/server bundles.** Expected `.env.local` entries remained ignored. Repeated webpack-cache candidates were previously classified binary-boundary/sentinel false positives; test candidates are explicitly synthetic.

Final `git status --short` is intentionally dirty with only the audit changes listed in the exact-change table. No commit, push, deployment or hosted migration was performed:

```text
 M app/actions/appointments.ts
 M app/actions/phase4.ts
 M app/api/appointments/[appointmentId]/medical-share/route.ts
 M app/api/chat/route.ts
 M app/api/cron/medical-share-cleanup/route.ts
 M app/api/medical-shares/[shareId]/route.ts
 M app/api/push-subscriptions/route.ts
 M lib/chat/gemini-adapter.ts
 M lib/notifications/subscription.ts
 M lib/notifications/web-push.ts
 M lib/supabase/client.ts
 M lib/supabase/middleware.ts
 M lib/supabase/server.ts
 M next.config.ts
 M package-lock.json
 M package.json
 M tests/medical-files.test.ts
 M tests/push-notifications.test.ts
 M tests/run-tests.ts
?? SECURITY_AUDIT.md
?? lib/request-body.ts
?? lib/security-diagnostics.ts
?? supabase/migrations/20260917181841_harden_appointment_notification_authorization.sql
?? tests/database-security.test.ts
?? tests/security-hardening.test.ts
?? tests/server-module.ts
?? tests/sql/
```

SaharaCare is materially hardened against the confirmed repository-level issues above, but this audit does not establish that the deployed system is completely secure. The unapplied migration, hosted configuration/drift, browser workflows, real RLS integration and provider/privacy decisions still require the owner actions listed above.
