begin;

-- Keep the browser response limited to fields rendered by the admin UI.
create or replace function public.get_admin_directory()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  directory jsonb;
begin
  if (select auth.uid()) is null
    or not exists (
      select 1
      from public.profiles
      where id = (select auth.uid())
        and role = 'admin'
    )
  then
    raise exception using
      errcode = '42501',
      message = 'Admin authorization is required.';
  end if;

  select jsonb_build_object(
    'summary', jsonb_build_object(
      'totalPatients', (
        select count(*) from public.profiles where role = 'patient'
      ),
      'patientsWithCaregiver', (
        select count(distinct links.patient_id)
        from public.caregiver_links as links
        join public.profiles as patients
          on patients.id = links.patient_id
         and patients.role = 'patient'
        join public.profiles as caregivers
          on caregivers.id = links.caregiver_id
         and caregivers.role = 'caregiver'
        where links.status = 'accepted'
      ),
      'patientsWithoutCaregiver', (
        select count(*)
        from public.profiles as patients
        where patients.role = 'patient'
          and not exists (
            select 1
            from public.caregiver_links as links
            join public.profiles as caregivers
              on caregivers.id = links.caregiver_id
             and caregivers.role = 'caregiver'
            where links.patient_id = patients.id
              and links.status = 'accepted'
          )
      ),
      'activeCaregivers', (
        select count(*)
        from public.profiles
        where role = 'caregiver' and account_status = 'active'
      ),
      'activeDoctors', (
        select count(*)
        from public.profiles
        where role = 'doctor' and account_status = 'active'
      )
    ),
    'patients', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', patients.id,
          'displayName', patients.full_name,
          'accountStatus', patients.account_status,
          'caregivers', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', caregivers.id,
                'displayName', caregivers.full_name
              )
              order by caregivers.full_name, caregivers.id
            )
            from public.caregiver_links as links
            join public.profiles as caregivers
              on caregivers.id = links.caregiver_id
             and caregivers.role = 'caregiver'
            where links.patient_id = patients.id
              and links.status = 'accepted'
          ), '[]'::jsonb)
        )
        order by patients.full_name, patients.id
      )
      from public.profiles as patients
      where patients.role = 'patient'
    ), '[]'::jsonb),
    'caregivers', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', caregivers.id,
          'displayName', caregivers.full_name,
          'accountStatus', caregivers.account_status,
          'patients', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', patients.id,
                'displayName', patients.full_name
              )
              order by patients.full_name, patients.id
            )
            from public.caregiver_links as links
            join public.profiles as patients
              on patients.id = links.patient_id
             and patients.role = 'patient'
            where links.caregiver_id = caregivers.id
              and links.status = 'accepted'
          ), '[]'::jsonb)
        )
        order by caregivers.full_name, caregivers.id
      )
      from public.profiles as caregivers
      where caregivers.role = 'caregiver'
    ), '[]'::jsonb),
    'doctors', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', doctors.id,
          'displayName', doctors.full_name,
          'accountStatus', doctors.account_status,
          'role', doctors.role,
          'createdAt', doctors.created_at
        )
        order by doctors.full_name, doctors.id
      )
      from public.profiles as doctors
      where doctors.role = 'doctor'
    ), '[]'::jsonb)
  ) into directory;

  return directory;
end;
$$;

revoke all on function public.get_admin_directory()
  from public, anon, authenticated;
grant execute on function public.get_admin_directory()
  to authenticated;

comment on function public.get_admin_directory() is
  'Minimal, read-only admin account and accepted caregiver-link directory. Contains no medical data.';

commit;
