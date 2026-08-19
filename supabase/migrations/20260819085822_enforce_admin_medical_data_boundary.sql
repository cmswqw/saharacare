begin;

-- Restrictive policies are combined with every existing permissive policy.
-- This prevents a newly promoted admin from retaining medical access through
-- an old patient identity or accepted caregiver relationship.
create policy medications_deny_admin
on public.medications
as restrictive
for all
to authenticated
using (not (select private.current_user_has_role('admin')))
with check (not (select private.current_user_has_role('admin')));

create policy medication_schedules_deny_admin
on public.medication_schedules
as restrictive
for all
to authenticated
using (not (select private.current_user_has_role('admin')))
with check (not (select private.current_user_has_role('admin')));

create policy dose_records_deny_admin
on public.dose_records
as restrictive
for all
to authenticated
using (not (select private.current_user_has_role('admin')))
with check (not (select private.current_user_has_role('admin')));

create policy notifications_deny_admin
on public.notifications
as restrictive
for all
to authenticated
using (not (select private.current_user_has_role('admin')))
with check (not (select private.current_user_has_role('admin')));

create policy appointments_deny_admin
on public.appointments
as restrictive
for all
to authenticated
using (not (select private.current_user_has_role('admin')))
with check (not (select private.current_user_has_role('admin')));

create policy appointment_medical_shares_deny_admin
on public.appointment_medical_shares
as restrictive
for all
to authenticated
using (not (select private.current_user_has_role('admin')))
with check (not (select private.current_user_has_role('admin')));

create policy appointment_medical_files_deny_admin
on public.appointment_medical_files
as restrictive
for all
to authenticated
using (not (select private.current_user_has_role('admin')))
with check (not (select private.current_user_has_role('admin')));

commit;
