begin;
-- Directory flags alone must not turn a fictional Auth/profile identity live.
-- Retain the single eligibility implementation, grants, DTO and fresh cutoff.
create or replace function private.get_eligible_directory_matches(
  requested_specialty_ids text[] default null,
  requested_provider_type text default null,
  requested_provider_id uuid default null
)
returns table (
  provider_id uuid, provider_type text, doctor_profile_id uuid, display_name text,
  public_phone text, public_email text, public_address text,
  specialty_id text, specialty_name_en text, specialty_name_ne text,
  affiliation_id uuid, facility_id uuid, facility_name text,
  facility_phone text, facility_address text, fee_amount numeric, currency text,
  is_sponsored boolean, sponsorship_label_en text, sponsorship_label_ne text
)
language plpgsql volatile security definer set search_path = '' as $$
declare eligibility_time timestamptz := clock_timestamp();
begin
  if not exists (select 1 from public.profiles where id = (select auth.uid())
    and account_status = 'active' and role in ('patient', 'caregiver', 'doctor', 'admin')) then
    raise exception using errcode = '42501', message = 'An active SaharaCare account is required.';
  end if;
  if (requested_provider_type is not null and requested_provider_type not in ('doctor', 'hospital', 'clinic'))
    or (requested_specialty_ids is not null and (
      cardinality(requested_specialty_ids) > 20 or array_position(requested_specialty_ids, null) is not null
    )) then raise exception using errcode = '22023', message = 'Invalid directory filters.'; end if;

  return query
  with live_providers as (
    select p.*, exists (
      select 1 from private.directory_entitlements e where e.provider_id = p.id
        and e.plan = 'sponsored' and e.payment_status = 'paid' and not e.is_demo
        and e.starts_at <= eligibility_time and e.ends_at > eligibility_time
    ) as sponsored
    from private.directory_providers p
    where p.active and p.approval_status = 'approved' and p.verification_status = 'verified'
      and not p.is_demo and p.publication_status = 'published'
      and (p.provider_type <> 'doctor' or exists (
        select 1 from public.profiles pr where pr.id = p.doctor_profile_id
          and pr.role = 'doctor' and pr.account_status = 'active' and not pr.demo_mode_enabled
      ))
      and exists (select 1 from private.directory_entitlements e where e.provider_id = p.id
        and e.payment_status = 'paid' and not e.is_demo
        and e.starts_at <= eligibility_time and e.ends_at > eligibility_time)
  )
  select p.id, p.provider_type, p.doctor_profile_id, p.display_name,
    p.public_phone, p.public_email, p.public_address,
    s.id, s.name_en, s.name_ne, a.id, f.id, f.display_name, f.public_phone, f.public_address,
    case when p.provider_type = 'doctor' then a.fee_amount else p.fee_amount end,
    case when p.provider_type = 'doctor' then a.currency else p.currency end,
    p.sponsored,
    case when p.sponsored then 'Sponsored · Paid placement'::text else null::text end,
    case when p.sponsored then 'प्रायोजित · सशुल्क स्थान'::text else null::text end
  from live_providers p
  join private.directory_provider_specialties ps on ps.provider_id = p.id
  join private.directory_specialties s on s.id = ps.specialty_id and s.active
  left join private.directory_affiliations a on a.doctor_provider_id = p.id
    and a.active and a.approval_status = 'approved' and not a.is_demo
  left join live_providers f on f.id = a.facility_provider_id and f.provider_type in ('hospital', 'clinic')
  where (requested_specialty_ids is null or s.id = any(requested_specialty_ids))
    and (requested_provider_type is null or p.provider_type = requested_provider_type)
    and (requested_provider_id is null or p.id = requested_provider_id)
    and (p.provider_type <> 'doctor' or (f.id is not null and exists (
      select 1 from private.directory_affiliation_specialties afs where afs.affiliation_id = a.id and afs.specialty_id = s.id
    ) and exists (
      select 1 from private.directory_provider_specialties fps where fps.provider_id = f.id and fps.specialty_id = s.id
    )))
  order by p.display_name, p.id, s.id, a.id
  limit 200;
end;
$$;
commit;
