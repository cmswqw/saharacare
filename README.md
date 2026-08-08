# SaharaCare

SaharaCare is a Next.js App Router project for patient medication tracking and linked family-caregiver monitoring. Supabase provides authentication, Postgres data, row-level authorization, durable notifications, and Realtime updates.

## Local development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and replace the two Supabase placeholders.

3. Start the app:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000).

## Hackathon Demo Setup

Demo Mode is an intentionally separate presentation layer over the real SaharaCare backend. Its controls update actual medication, schedule, dose, notification, history, and adherence records. It never uses a service-role key in the browser and it never deletes authentication users or caregiver links.

### 1. Environment variables

Add these variables to `.env.local` for local development and to the Vercel project's Environment Variables page for a deployed demo:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
NEXT_PUBLIC_DEMO_MODE=true
```

Restart `npm run dev` after changing an environment variable. Redeploy Vercel after changing a Vercel environment variable because `NEXT_PUBLIC_` values are included at build time.

### 2. Apply the Phase 8 migration

Open the Supabase Dashboard, choose **SQL Editor**, paste the complete contents of:

`supabase/migrations/20260808180205_implement_phase_8_hackathon_demo_mode.sql`

Run it once. Do not rerun an already successful migration.

This migration adds the protected `profiles.demo_mode_enabled` flag and the `run_own_demo_action` RPC. Normal patients keep the existing behavior because the new flag defaults to `false`.

### 3. Create the demo patient

1. In SaharaCare, sign up a new account.
2. Choose the **Patient** role.
3. Use the full name **Maya Sharma**.
4. Use an email and password you can enter during the presentation. This README uses `maya-demo@example.com` only as a placeholder—replace it with Maya's real demo email in the SQL below.
5. In Supabase **SQL Editor**, explicitly enable only Maya's disposable patient profile:

   ```sql
   update public.profiles as profile
   set demo_mode_enabled = true
   from auth.users as auth_user
   where profile.id = auth_user.id
     and profile.role = 'patient'
     and lower(auth_user.email) = lower('maya-demo@example.com')
   returning profile.id, profile.full_name, profile.role, profile.demo_mode_enabled;
   ```

The query should return exactly one row for Maya. If it returns no rows, check the email and the Patient role before continuing. Never enable this flag on a real patient's account: reset intentionally replaces that demo patient's medication records.

### 4. Create and link the caregiver

1. Open a private/incognito window or a different browser profile.
2. Sign up a second account with the **Caregiver** role.
3. In Maya's patient window, copy the linking code shown in the caregiver-link section.
4. In the caregiver window, enter Maya's code.
5. Return to Maya's window and accept the pending request.
6. Confirm that the caregiver dashboard shows Maya as an approved patient. Open Maya's patient card to reach the real `/caregiver/patient/[id]` detail route.

The reset operation preserves this accepted caregiver link.

### 5. Reset the presentation data

1. Sign in as Maya.
2. Open **Settings**.
3. Find the dashed **DEMO MODE — Hackathon demo tools** panel.
4. Select **Reset Demo Data** and confirm.
5. Open the patient dashboard and verify:

   - Metformin, 500 mg, scheduled at 8:00 AM in the care plan
   - Vitamin D, scheduled at 1:00 PM
   - Blood Pressure Medicine, scheduled at 8:00 PM
   - three usable dose events for today
   - Metformin is due now
   - seven days of real history rows
   - taken, taken-late, and missed examples
   - weekly adherence calculated from those rows at approximately 89–94%, depending on the current due dose
   - medication notifications for Maya start empty

Reset replaces only Maya's medications, schedules, dose records, and Maya-related medication notifications. It does not remove either sign-in account or the caregiver link.

### 6. Run locally

```bash
npm run dev
```

Keep two sessions open:

- **Window A:** Maya, signed in as the patient
- **Window B:** the accepted caregiver, with the caregiver dashboard open

Do not use two normal tabs in the same browser profile because they share authentication cookies. Use a private window or a separate browser profile.

### 7. Exact 3–5 minute demo sequence

1. Start on the caregiver dashboard in Window B. Explain: “This is the family caregiver who can monitor the elderly patient's medication remotely.”
2. Show Maya's patient card and open her details. Point out the medication schedule and weekly adherence.
3. Switch to Window A and show Maya's patient dashboard. Metformin 500 mg is due now.
4. Click the normal **Mark as Taken** button on the Metformin card.
5. Switch attention to Window B without refreshing it. Supabase Realtime refreshes Maya's status, the notification count changes, and the caregiver can open the durable notification.
6. In Maya's **Settings → Demo Mode**, select **Dose Late**. Window B updates Vitamin D to late and receives a stored late notification.
7. Select **Dose Missed**. Window B updates Blood Pressure Medicine to missed and receives a stored missed notification.
8. Show Maya's recent medication history.
9. Show weekly adherence and explain that it is calculated from real `dose_records`, not a displayed mock percentage.

The **Dose Taken** control is also available as a fast fallback if the normal patient button has already been demonstrated. **Dose Due Now** restores Metformin to a reusable due state. Reset before each full practice or judged run.

### 8. Disable Demo Mode

Set the environment variable to false or remove it, then restart/redeploy:

```dotenv
NEXT_PUBLIC_DEMO_MODE=false
```

No demo controls are rendered when this value is not exactly `true`. Normal SaharaCare behavior continues unchanged.

For defense in depth, also disable Maya's database flag after the hackathon:

```sql
update public.profiles as profile
set demo_mode_enabled = false
from auth.users as auth_user
where profile.id = auth_user.id
  and lower(auth_user.email) = lower('maya-demo@example.com');
```

## Verification commands

```bash
npm run typecheck
npm run lint
npm run build
```

Appointments and emergency contacts remain clearly labeled local demonstration features for later phases. Medication plans, dose states, history, adherence, caregiver monitoring, and in-app medication notifications use Supabase data.
