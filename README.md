# SaharaCare

SaharaCare is a Next.js App Router application for patient medication tracking, linked family-caregiver monitoring, real patient-doctor appointments, and patient-controlled temporary medical-file sharing. Supabase provides authentication, Postgres data, row-level security, private Storage, caregiver linking, medication schedules, dose history, adherence, notifications, and Realtime updates.

## What is included

- Patient and caregiver sign-up and sign-in
- Patient-owned medication plans and daily schedules
- Automatic creation of today's dose records in the `Asia/Kathmandu` time zone
- Mark-as-taken, late, and missed dose states
- Caregiver linking codes and patient approval
- Caregiver dashboards, adherence history, and durable notifications
- Supabase Realtime updates for dose records and notifications
- Read-only, authenticated AI medication assistance for patients and approved caregivers
- Optional, patient-scoped hackathon Demo Mode
- A nine-section medical-information wizard held only in browser memory
- Deterministic, patient-owned medical-summary PDFs generated locally in the browser
- Real appointments between a patient and an assigned doctor account
- Explicit appointment-scoped sharing of the summary and optional PDF/JPEG/PNG/WEBP files
- Immediate revocation, automatic expiry, private Storage, and scheduled physical cleanup
- A doctor-only, view-only document experience without application download or print controls

Emergency contact shortcuts remain a local demonstration feature. Appointments, temporary share metadata, medication plans, dose states, history, adherence, caregiver monitoring, and medication notifications use Supabase. Medical questionnaire answers and the locally generated PDF are not saved automatically.

## Requirements

- [Git](https://git-scm.com/downloads)
- [Node.js 20.19](https://nodejs.org/) or newer
- npm, which is included with Node.js
- A free or paid [Supabase](https://supabase.com/) account
- A [Google AI Studio](https://aistudio.google.com/apikey) Gemini API key for the optional assistant

The browser uses only the project URL and publishable key. Secure file upload, download, revocation, and cleanup routes additionally require a Supabase secret key on the server. Both that key and the Gemini key are server-only and must never use a `NEXT_PUBLIC_` prefix.

## How to run SaharaCare locally

### 1. Fork and clone

1. Open the SaharaCare repository on GitHub.
2. Select **Fork** and create a fork under your GitHub account.
3. Clone your fork, replacing `<your-github-username>`:

   ```bash
   git clone https://github.com/<your-github-username>/saharacare.git
   cd saharacare
   ```

### 2. Install dependencies

Confirm Node and npm are available:

```bash
node --version
npm --version
```

Install the pinned dependencies from `package-lock.json`:

```bash
npm install
```

### 3. Create a Supabase project

1. Sign in to [Supabase](https://supabase.com/dashboard).
2. Create a new project and wait until its status is healthy.
3. Open **Project Settings -> API Keys**.
4. Copy the project URL and an enabled publishable key.
5. Create or copy a server-side secret key for temporary medical-file operations. Never put it in browser code or use a `NEXT_PUBLIC_` name.

For projects using the newer Data API defaults, confirm that the `public` schema is exposed in the project's Data API settings. The migrations explicitly grant only the table and function permissions SaharaCare needs, and RLS still controls which rows an authenticated user may access.

### 4. Create `.env.local`

Copy the committed template:

macOS or Linux:

```bash
cp .env.example .env.local
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Fill in the new file:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SECRET_KEY=your-server-only-secret-key
MEDICAL_FILE_MAX_BYTES=10485760
MEDICAL_FILE_MAX_COUNT=6
CRON_SECRET=replace-with-a-long-random-secret
NEXT_PUBLIC_DEMO_MODE=false
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-3.5-flash-lite
```

Create your own key in Google AI Studio. `GEMINI_MODEL` is optional and defaults to the stable `gemini-3.5-flash-lite`; change it only to a compatible model available to your Gemini API project. `.env.local` is ignored by Git. Never commit it. Restart the development server after changing an environment variable.

The Gemini free tier is intended for development and demo use in the current SaharaCare setup. A production healthcare deployment requires a separate privacy, data-processing, compliance, and provider-retention review before real sensitive patient data is sent to the model. SaharaCare does not claim HIPAA compliance, zero retention, or an equivalent provider guarantee from this configuration.

`MEDICAL_FILE_MAX_BYTES` may be lowered but cannot exceed the private bucket's 10 MB database limit. `MEDICAL_FILE_MAX_COUNT` defaults to 6. Generate `CRON_SECRET` as a long random value; Vercel uses it to authenticate the cleanup request automatically.

### 5. Apply the database migrations

Apply every SQL file in `supabase/migrations` in filename order. Together they recreate the full SaharaCare database:

1. `20260808150906_create_saharacare_phase_2_schema.sql` - tables, constraints, profile trigger, grants, indexes, and RLS policies
2. `20260808155758_implement_phase_4_linking_and_medication_saves.sql` - linking codes and atomic medication/schedule saves
3. `20260808164551_implement_phase_5_dose_records.sql` - daily dose materialization and dose actions
4. `20260808172319_enable_phase_6_dose_records_realtime.sql` - dose-record Realtime publication
5. `20260808173745_implement_phase_7_history_adherence_notifications.sql` - history, adherence evaluation, notifications, and notification Realtime publication
6. `20260808180205_implement_phase_8_hackathon_demo_mode.sql` - protected Demo Mode
7. `20260811155622_fix_medication_schedule_upsert_ambiguity.sql` - medication schedule upsert hotfix
8. `20260811162226_fix_demo_enabled_daily_dose_generation.sql` - daily dose generation hotfix for demo-enabled patients
9. `20260817153031_implement_medical_kyc_appointment_sharing.sql` - doctor role, real appointments, temporary share metadata, RLS, expiry, and private Storage bucket

Do not skip the two hotfix migrations. Do not edit or combine migrations after they have been applied.

#### Recommended for beginners: SQL Editor

1. In the Supabase Dashboard, open **SQL Editor**.
2. Open the first migration file locally.
3. Copy its complete contents into a new query and select **Run**.
4. Wait for success before continuing with the next filename.
5. Stop if a migration reports an error; do not continue with a partial schema.

Each migration is transactional. Run each successful migration only once.

#### Alternative: Supabase CLI

Choose either SQL Editor or the CLI for the initial setup. Do not switch methods halfway through, because CLI migration history will not know about files applied manually in SQL Editor.

From the repository root:

```bash
npx supabase init
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push --dry-run
npx supabase db push
```

The project ref is the identifier in your Supabase Dashboard URL. `link` may request the database password you chose when creating the project. Never commit that password.

### 6. Configure Supabase Authentication

In Supabase Dashboard, open **Authentication -> URL Configuration** and set:

```text
Site URL: http://localhost:3000
Redirect URL: http://localhost:3000/auth/callback
```

Under the Email authentication provider, choose one development workflow:

- Keep email confirmation enabled and use email addresses you can access, then click the confirmation link before signing in.
- Temporarily disable email confirmation for local-only testing. Re-enable it before using the project beyond development.

If confirmation is enabled, a placeholder `example.com` address cannot receive the confirmation message.

### 7. Confirm Realtime

The Phase 6 and Phase 7 migrations add `dose_records` and `notifications` to the `supabase_realtime` publication automatically. No manual Realtime toggle should be needed when those migrations succeed.

You can verify in SQL Editor:

```sql
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename in ('dose_records', 'notifications')
order by tablename;
```

Expected result: one row for `dose_records` and one for `notifications`.

### 8. Start SaharaCare

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Create the patient and caregiver demo accounts

No passwords or accounts are seeded into the repository. Create disposable accounts through the normal SaharaCare sign-up flow.

### Patient: Maya Sharma

1. Open `/signup`.
2. Choose the **Patient** role.
3. Enter the full name **Maya Sharma**.
4. Use an email address you control if email confirmation is enabled.
5. Choose a local test password. Do not add it to this README or commit it anywhere.
6. Confirm the email if required, then sign in.
7. The patient dashboard displays Maya's private linking code.

### Caregiver

1. Open a private/incognito window or a separate browser profile. Two ordinary tabs share authentication cookies.
2. Sign up with the **Caregiver** role using another test account.
3. Copy Maya's linking code from the patient dashboard.
4. Enter the code in the caregiver linking form.
5. Return to Maya's patient window and accept the pending request.
6. Return to the caregiver window and confirm Maya appears on the caregiver dashboard.

### Doctor

1. Open another private/incognito browser profile.
2. Choose the **Doctor** role on `/role` and create a separate doctor account.
3. Confirm its email if required, then sign in and verify `/doctor` opens.
4. Return to the patient session. The doctor should now appear in the appointment request form.

For a production healthcare deployment, replace open doctor registration with an administrator-controlled identity-verification process. The current flow is appropriate for the SaharaCare prototype but does not independently verify medical licensure.

## Medical summary and appointment sharing

1. As the patient, open **Medical info** and complete the nine sections.
2. Review each section, create the PDF, preview it, and optionally download the patient-owned copy.
3. Open **Appointments**, choose the doctor, facility, date, time, and reason, then submit.
4. Open the appointment. Select the generated summary and/or additional accepted files, review the doctor/date/file list, and choose **Share securely**.
5. In the doctor session, open the assigned appointment and view the active files in-app.
6. Revoke from the patient session and confirm doctor access fails immediately.

The sharing grace period defaults to 60 minutes after `appointments.ends_at`. An administrator can change the centralized value in SQL without accepting an expiry from the browser:

```sql
update private.medical_share_config
set grace_minutes = 60
where singleton = true;
```

The allowed range is 0 to 1,440 minutes.

## Temporary-file cleanup

`vercel.json` schedules `/api/cron/medical-share-cleanup` hourly at minute 17. Add the same `CRON_SECRET` to the deployed Vercel project. Vercel sends it as a bearer token. If SaharaCare is deployed elsewhere, configure that platform's scheduler to make an hourly `GET` request with:

```text
Authorization: Bearer <CRON_SECRET>
```

Access is denied from the server clock as soon as a share expires, is revoked, or its appointment is cancelled. Cleanup then removes the private objects and temporary file rows; access control does not wait for the cleanup job.

## Optional Demo Mode

Demo Mode changes real rows for one explicitly enabled disposable patient. It does not use mock medication data or a service-role key in the browser.

Two independent settings must both be enabled:

1. The application environment variable:

   ```dotenv
   NEXT_PUBLIC_DEMO_MODE=true
   ```

2. The patient's protected database field: `profiles.demo_mode_enabled`.

Restart `npm run dev` after changing the environment variable.

### Enable Demo Mode for one patient

Replace the placeholder email with the actual disposable patient email, then run this in Supabase SQL Editor:

```sql
update public.profiles as profile
set demo_mode_enabled = true
from auth.users as auth_user
where profile.id = auth_user.id
  and profile.role = 'patient'
  and lower(auth_user.email) = lower('patient@example.com')
returning
  profile.id,
  profile.full_name,
  profile.role,
  profile.demo_mode_enabled;
```

The query must return exactly one patient row. Never enable this on a real patient: **Reset Demo Data** intentionally replaces that patient's medication, schedule, dose, and medication-notification rows. It preserves authentication accounts and caregiver links.

Sign in as that patient, open **Settings**, and use the **Demo Mode - Hackathon demo tools** panel to reset or move demo doses through due, taken, late, and missed states.

### Disable Demo Mode

Set the local environment value back to false:

```dotenv
NEXT_PUBLIC_DEMO_MODE=false
```

Then disable the database flag, replacing the placeholder email:

```sql
update public.profiles as profile
set demo_mode_enabled = false
from auth.users as auth_user
where profile.id = auth_user.id
  and lower(auth_user.email) = lower('patient@example.com');
```

Restart the application afterward.

## Verification commands

Run these before sharing changes:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

`next lint` currently prints a Next.js deprecation notice, but it should report no ESLint warnings or errors.

## Troubleshooting

- **Authentication returns to the wrong page:** recheck the Site URL and exact `/auth/callback` redirect URL.
- **Sign-in fails after sign-up:** confirm the email or temporarily disable confirmation for local development.
- **A table or RPC returns `42501`:** confirm all migrations ran in order and that `public` is available through the Data API. Do not solve permission errors with a service-role browser key.
- **No Realtime update:** verify the two publication rows using the query above, then keep patient and caregiver sessions in separate browser profiles.
- **No dose appears today:** confirm the medication is active, the current weekday is in `days_of_week`, the schedule date range includes today, and both hotfix migrations were applied.
- **Demo controls are missing:** both `NEXT_PUBLIC_DEMO_MODE=true` and the patient's `demo_mode_enabled=true` flag are required.
- **Assistant unavailable:** add a valid server-only `GEMINI_API_KEY`, confirm the configured `GEMINI_MODEL` is available to the Gemini API project, and restart the development server.
- **Caregiver cannot use the assistant:** the patient must accept the caregiver link before that patient appears in the assistant selector.
- **No doctors appear:** create and confirm a doctor account after applying migration 9.
- **Secure file storage is not configured:** add `SUPABASE_SECRET_KEY` to the server environment and restart the application.
- **Cleanup returns 401:** configure the same non-empty `CRON_SECRET` in the deployment and scheduler.

## Security notes

- `.env.local`, `.env`, `.env.*`, `node_modules`, and `.next` are ignored by Git; `.env.example` is intentionally committed.
- Only the Supabase URL, publishable key, and non-secret UI flags belong in the frontend environment. `SUPABASE_SECRET_KEY`, `CRON_SECRET`, and `GEMINI_API_KEY` are server-only.
- Never commit a service-role key, secret key, database password, private key, or test-account password.
- All application tables use RLS. Patient identity comes from the authenticated Supabase user rather than browser-submitted ownership fields.
- Medical questionnaire answers stay in React memory and are never sent to Supabase, Gemini, analytics, or application logs.
- The private `appointment-medical-files` bucket has no authenticated-object policy. Server routes revalidate the user, authoritative appointment participant, role, cancellation, revocation, and expiry before every file response.
- Upload routes validate count, size, declared MIME type, magic bytes, filename, and SHA-256 integrity before a share becomes ready. Failed uploads are compensated so no partial share remains active.
- A secret-key client exists only in server-only modules. No service-role or secret key is exposed to browser bundles.
- View-only controls are an application UX and access-policy guarantee, not a claim that screenshots can be technically prevented.
- The assistant revalidates authentication and caregiver access for every request, sends question-specific context without database IDs, renders model output as plain text, and cannot mutate SaharaCare data.
- Chat history is kept only in the current browser component for V1 and is not saved in the SaharaCare database. The server sends only bounded conversation history and question-specific authorized medication context to Gemini; provider processing remains subject to the configured Gemini service terms and settings.
- The included rapid-request guard is process-local. A horizontally scaled or serverless production deployment should replace it with a shared rate limiter; it is not presented as a cross-instance guarantee.

## Fresh-fork checklist

A new developer should be able to follow this sequence without any files from the original developer's laptop:

```text
fork repository
-> clone fork
-> npm install
-> create Supabase project
-> copy .env.example to .env.local
-> add a server-only Gemini API key
-> add the server-only Supabase and cleanup secrets
-> apply every migration in order
-> configure Auth URLs and email confirmation
-> npm run dev
-> create patient, caregiver, and doctor accounts
-> link the caregiver to the patient
-> request an appointment and test temporary sharing/revocation
-> optionally enable Demo Mode for a disposable patient
```

If a fresh setup fails, do not copy another developer's `.env.local`. Check the migration result, Auth URL configuration, Data API access, and local environment values instead.
