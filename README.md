# SaharaCare

SaharaCare is a Next.js App Router application for patient medication tracking and linked family-caregiver monitoring. Supabase provides authentication, Postgres data, row-level security, caregiver linking, medication schedules, dose history, adherence, notifications, and Realtime updates.

## What is included

- Patient and caregiver sign-up and sign-in
- Patient-owned medication plans and daily schedules
- Automatic creation of today's dose records in the `Asia/Kathmandu` time zone
- Mark-as-taken, late, and missed dose states
- Caregiver linking codes and patient approval
- Caregiver dashboards, adherence history, and durable notifications
- Supabase Realtime updates for dose records and notifications
- Optional, patient-scoped hackathon Demo Mode

Appointments and emergency contacts are still local demonstration features. Medication plans, dose states, history, adherence, caregiver monitoring, and medication notifications use Supabase.

## Requirements

- [Git](https://git-scm.com/downloads)
- [Node.js 20 LTS](https://nodejs.org/) or newer
- npm, which is included with Node.js
- A free or paid [Supabase](https://supabase.com/) account

You do not need a database password or Supabase service-role key in the application. SaharaCare uses only the project's public URL and publishable key in the browser.

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
4. Copy the project URL and an enabled publishable key. Do not use a secret key or the legacy service-role key.

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
NEXT_PUBLIC_DEMO_MODE=false
```

`.env.local` is ignored by Git. Never commit it. Restart the development server after changing an environment variable because `NEXT_PUBLIC_` values are included in the client build.

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

## Security notes

- `.env.local`, `.env`, `.env.*`, `node_modules`, and `.next` are ignored by Git; `.env.example` is intentionally committed.
- Only the Supabase URL and publishable key belong in the frontend environment.
- Never commit a service-role key, secret key, database password, private key, or test-account password.
- All application tables use RLS. Patient identity comes from the authenticated Supabase user rather than browser-submitted ownership fields.

## Fresh-fork checklist

A new developer should be able to follow this sequence without any files from the original developer's laptop:

```text
fork repository
-> clone fork
-> npm install
-> create Supabase project
-> copy .env.example to .env.local
-> apply every migration in order
-> configure Auth URLs and email confirmation
-> npm run dev
-> create patient and caregiver accounts
-> link the caregiver to the patient
-> optionally enable Demo Mode for a disposable patient
```

If a fresh setup fails, do not copy another developer's `.env.local`. Check the migration result, Auth URL configuration, Data API access, and local environment values instead.
