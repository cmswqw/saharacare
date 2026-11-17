begin;

-- Internal catalog/review/payment records. Only the narrow read RPC below is
-- exposed; existing profiles, appointments and their policies are unchanged.
create table private.directory_specialties (
  id text primary key check (id ~ '^[a-z][a-z0-9_-]{0,63}$'),
  name_en text not null check (char_length(btrim(name_en)) between 1 and 120),
  name_ne text not null check (char_length(btrim(name_ne)) between 1 and 120),
  active boolean not null default true
);

create table private.directory_providers (
  id uuid primary key default gen_random_uuid(),
  provider_type text not null check (provider_type in ('doctor', 'hospital', 'clinic')),
  doctor_profile_id uuid unique references public.profiles(id) on delete restrict,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 200),
  public_phone text check (char_length(public_phone) between 1 and 80),
  public_email text check (char_length(public_email) between 1 and 254),
  public_address text check (char_length(public_address) between 1 and 500),
  fee_amount numeric(12,2) check (fee_amount >= 0 and fee_amount <> 'NaN'::numeric),
  currency text check (currency ~ '^[A-Z]{3}$'),
  active boolean not null default false,
  approval_status text not null default 'pending' check (approval_status in ('pending', 'approved', 'rejected')),
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'verified', 'rejected')),
  is_demo boolean not null default false,
  publication_status text not null default 'draft' check (publication_status in ('draft', 'published', 'suspended')),
  review_notes text,
  verification_reference text,
  reviewed_by uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint directory_provider_identity check ((provider_type = 'doctor') = (doctor_profile_id is not null)),
  constraint directory_provider_fee_currency check (fee_amount is null or currency is not null)
);
create index directory_provider_reviewer_idx on private.directory_providers(reviewed_by);
create index directory_provider_published_idx on private.directory_providers(provider_type, display_name, id)
  where active and approval_status = 'approved' and verification_status = 'verified'
    and not is_demo and publication_status = 'published';

create table private.directory_provider_specialties (
  provider_id uuid not null references private.directory_providers(id) on delete cascade,
  specialty_id text not null references private.directory_specialties(id) on delete restrict,
  primary key (provider_id, specialty_id)
);
create index directory_provider_specialty_idx on private.directory_provider_specialties(specialty_id, provider_id);

-- Facility identities are hospital/clinic providers, not a second auth system.
-- Many affiliations per doctor and many specialties per affiliation are retained.
create table private.directory_affiliations (
  id uuid primary key default gen_random_uuid(),
  doctor_provider_id uuid not null references private.directory_providers(id) on delete cascade,
  facility_provider_id uuid not null references private.directory_providers(id) on delete restrict,
  active boolean not null default false,
  approval_status text not null default 'pending' check (approval_status in ('pending', 'approved', 'rejected')),
  is_demo boolean not null default false,
  fee_amount numeric(12,2) check (fee_amount >= 0 and fee_amount <> 'NaN'::numeric),
  currency text check (currency ~ '^[A-Z]{3}$'),
  unique (doctor_provider_id, facility_provider_id),
  check (doctor_provider_id <> facility_provider_id),
  check (fee_amount is null or currency is not null)
);
create index directory_affiliation_facility_idx on private.directory_affiliations(facility_provider_id);

create table private.directory_affiliation_specialties (
  affiliation_id uuid not null references private.directory_affiliations(id) on delete cascade,
  specialty_id text not null references private.directory_specialties(id) on delete restrict,
  primary key (affiliation_id, specialty_id)
);
create index directory_affiliation_specialty_idx on private.directory_affiliation_specialties(specialty_id, affiliation_id);

create table private.directory_entitlements (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references private.directory_providers(id) on delete cascade,
  plan text not null check (plan in ('listing', 'sponsored')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'revoked')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_demo boolean not null default false,
  payment_reference text unique,
  internal_notes text,
  check (isfinite(starts_at) and isfinite(ends_at) and ends_at > starts_at)
);
create index directory_entitlement_validity_idx on private.directory_entitlements(provider_id, starts_at, ends_at)
  where payment_status = 'paid' and not is_demo;

-- Reject malformed identities/relationships even for trusted importers.
create function private.validate_directory_identity()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_table_name = 'directory_providers' then
    if new.provider_type = 'doctor' and not exists (
      select 1 from public.profiles where id = new.doctor_profile_id and role = 'doctor'
    ) then raise exception using errcode = '23514', message = 'A doctor listing requires a doctor profile.'; end if;
    new.updated_at := statement_timestamp();
  else
    if not exists (select 1 from private.directory_providers where id = new.doctor_provider_id and provider_type = 'doctor')
      or not exists (select 1 from private.directory_providers where id = new.facility_provider_id and provider_type in ('hospital', 'clinic'))
    then raise exception using errcode = '23514', message = 'An affiliation requires a doctor and a hospital or clinic.'; end if;
  end if;
  return new;
end;
$$;
revoke all on function private.validate_directory_identity() from public, anon, authenticated;
create trigger directory_provider_validate before insert or update on private.directory_providers
  for each row execute function private.validate_directory_identity();
create trigger directory_affiliation_validate before insert or update on private.directory_affiliations
  for each row execute function private.validate_directory_identity();

-- RLS is defense in depth; browser roles have no raw-table privileges at all.
alter table private.directory_specialties enable row level security;
alter table private.directory_providers enable row level security;
alter table private.directory_provider_specialties enable row level security;
alter table private.directory_affiliations enable row level security;
alter table private.directory_affiliation_specialties enable row level security;
alter table private.directory_entitlements enable row level security;
revoke all on table private.directory_specialties, private.directory_providers,
  private.directory_provider_specialties, private.directory_affiliations,
  private.directory_affiliation_specialties, private.directory_entitlements from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert, update, delete on table private.directory_specialties, private.directory_providers,
  private.directory_provider_specialties, private.directory_affiliations,
  private.directory_affiliation_specialties, private.directory_entitlements to service_role;

-- The ONLY eligibility rule, shared by reads and future booking checks.
-- NULL specialties = explicit general browse; empty array = no matches.
-- Verification is mandatory for all live provider types, never inferred.
create function private.get_eligible_directory_matches(
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
language plpgsql stable security definer set search_path = '' as $$
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
        and e.starts_at <= statement_timestamp() and e.ends_at > statement_timestamp()
    ) as sponsored
    from private.directory_providers p
    where p.active and p.approval_status = 'approved' and p.verification_status = 'verified'
      and not p.is_demo and p.publication_status = 'published'
      and (p.provider_type <> 'doctor' or exists (
        select 1 from public.profiles pr where pr.id = p.doctor_profile_id
          and pr.role = 'doctor' and pr.account_status = 'active'
      ))
      and exists (select 1 from private.directory_entitlements e where e.provider_id = p.id
        and e.payment_status = 'paid' and not e.is_demo
        and e.starts_at <= statement_timestamp() and e.ends_at > statement_timestamp())
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
revoke all on function private.get_eligible_directory_matches(text[], text, uuid) from public, anon, authenticated;
grant execute on function private.get_eligible_directory_matches(text[], text, uuid) to authenticated;

-- Public invoker wrapper exposes only the DTO, never review/payment rows.
create function public.get_directory_matches(
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
language sql stable security invoker set search_path = '' as $$
  select * from private.get_eligible_directory_matches(requested_specialty_ids, requested_provider_type, requested_provider_id);
$$;
revoke all on function public.get_directory_matches(text[], text, uuid) from public, anon, authenticated;
grant execute on function public.get_directory_matches(text[], text, uuid) to authenticated;

comment on function public.get_directory_matches(text[], text, uuid) is
  'Authenticated live paid directory matches. NULL specialties explicitly browses; empty specialties returns none. Alphabetical order; paid placement never implies clinical quality. No review/payment metadata.';
comment on table private.directory_entitlements is
  'Trusted server-managed listing periods [starts_at,ends_at). Sponsored plan includes listing entitlement. No billing gateway or provider self-approval in this migration.';

commit;
