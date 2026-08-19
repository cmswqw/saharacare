begin;

-- Browser push endpoints are capability URLs and encryption keys. They stay
-- server-only: browser users receive no direct table grants or RLS policies.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  language text not null default 'en',
  sound_enabled boolean not null default true,
  disabled_at timestamptz,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_check
    check (char_length(endpoint) between 20 and 2048 and endpoint ~ '^https://'),
  constraint push_subscriptions_p256dh_check
    check (char_length(p256dh) between 20 and 512),
  constraint push_subscriptions_auth_key_check
    check (char_length(auth_key) between 10 and 256),
  constraint push_subscriptions_language_check
    check (language in ('en', 'ne'))
);

create index push_subscriptions_user_active_idx
  on public.push_subscriptions (user_id, updated_at desc)
  where disabled_at is null;

create trigger push_subscriptions_set_updated_at
before update on public.push_subscriptions
for each row execute function private.set_updated_at();

alter table public.push_subscriptions enable row level security;
revoke all on table public.push_subscriptions
  from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.push_subscriptions
  to service_role;

-- One delivery row represents one scheduled dose sent to one browser
-- subscription. The unique constraint is the durable duplicate guard.
create table public.medication_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  dose_record_id uuid not null references public.dose_records (id) on delete cascade,
  push_subscription_id uuid references public.push_subscriptions (id) on delete set null,
  scheduled_at timestamptz not null,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint medication_reminder_delivery_unique
    unique (dose_record_id, push_subscription_id),
  constraint medication_reminder_deliveries_status_check
    check (status in ('pending', 'processing', 'sent', 'failed')),
  constraint medication_reminder_deliveries_attempt_count_check
    check (attempt_count between 0 and 3),
  constraint medication_reminder_deliveries_error_length_check
    check (last_error is null or char_length(last_error) <= 120)
);

create index medication_reminder_deliveries_claim_idx
  on public.medication_reminder_deliveries (status, next_attempt_at, scheduled_at)
  where status in ('pending', 'processing', 'failed');
create index medication_reminder_deliveries_patient_created_idx
  on public.medication_reminder_deliveries (patient_id, created_at desc);

create trigger medication_reminder_deliveries_set_updated_at
before update on public.medication_reminder_deliveries
for each row execute function private.set_updated_at();

alter table public.medication_reminder_deliveries enable row level security;
revoke all on table public.medication_reminder_deliveries
  from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.medication_reminder_deliveries
  to service_role;

-- The service-role cron caller materializes today's Kathmandu doses and claims
-- a bounded batch atomically. SECURITY INVOKER keeps this function bound to the
-- caller's privileges, and EXECUTE is granted only to service_role.
create function public.claim_due_medication_reminders(
  reminder_lead_minutes integer default 10,
  reminder_batch_size integer default 100
)
returns table (
  delivery_id uuid,
  subscription_id uuid,
  endpoint text,
  p256dh text,
  auth_key text,
  language text,
  sound_enabled boolean
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  evaluated_at timestamptz := statement_timestamp();
  local_today date := (statement_timestamp() at time zone 'Asia/Kathmandu')::date;
begin
  if reminder_lead_minutes not between 1 and 60
    or reminder_batch_size not between 1 and 500 then
    raise exception 'Invalid medication reminder claim limits'
      using errcode = '22023';
  end if;

  insert into public.dose_records (
    patient_id,
    medication_id,
    schedule_id,
    scheduled_at,
    status
  )
  select
    patient.id,
    medication.id,
    schedule.id,
    ((local_today + schedule.scheduled_time) at time zone 'Asia/Kathmandu'),
    'scheduled'
  from public.profiles as patient
  join public.medications as medication
    on medication.patient_id = patient.id
   and medication.active
  join public.medication_schedules as schedule
    on schedule.medication_id = medication.id
  where patient.role = 'patient'
    and patient.account_status = 'active'
    and extract(dow from local_today)::smallint = any(schedule.days_of_week)
    and (schedule.start_date is null or schedule.start_date <= local_today)
    and (schedule.end_date is null or schedule.end_date >= local_today)
  on conflict (schedule_id, scheduled_at) do nothing;

  insert into public.medication_reminder_deliveries (
    patient_id,
    dose_record_id,
    push_subscription_id,
    scheduled_at
  )
  select
    dose.patient_id,
    dose.id,
    subscription.id,
    dose.scheduled_at
  from public.dose_records as dose
  join public.push_subscriptions as subscription
    on subscription.user_id = dose.patient_id
   and subscription.disabled_at is null
  where dose.status = 'scheduled'
    and dose.taken_at is null
    and dose.scheduled_at > evaluated_at - interval '5 minutes'
    and dose.scheduled_at <= evaluated_at
      + make_interval(mins => reminder_lead_minutes)
  on conflict (dose_record_id, push_subscription_id) do nothing;

  return query
  with candidates as (
    select delivery.id
    from public.medication_reminder_deliveries as delivery
    join public.push_subscriptions as subscription
      on subscription.id = delivery.push_subscription_id
     and subscription.disabled_at is null
    where delivery.attempt_count < 3
      and delivery.scheduled_at > evaluated_at - interval '15 minutes'
      and (
        (
          delivery.status in ('pending', 'failed')
          and delivery.next_attempt_at <= evaluated_at
        )
        or (
          delivery.status = 'processing'
          and delivery.last_attempt_at <= evaluated_at - interval '3 minutes'
        )
      )
    order by delivery.scheduled_at, delivery.created_at
    for update of delivery skip locked
    limit reminder_batch_size
  ),
  claimed as (
    update public.medication_reminder_deliveries as delivery
    set
      status = 'processing',
      attempt_count = delivery.attempt_count + 1,
      last_attempt_at = evaluated_at,
      last_error = null
    from candidates
    where delivery.id = candidates.id
    returning delivery.id, delivery.push_subscription_id
  )
  select
    claimed.id,
    subscription.id,
    subscription.endpoint,
    subscription.p256dh,
    subscription.auth_key,
    subscription.language,
    subscription.sound_enabled
  from claimed
  join public.push_subscriptions as subscription
    on subscription.id = claimed.push_subscription_id;
end;
$$;

revoke all on function public.claim_due_medication_reminders(integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_due_medication_reminders(integer, integer)
  to service_role;

comment on table public.push_subscriptions is
  'Server-only Web Push endpoints and encryption material for patient devices.';
comment on table public.medication_reminder_deliveries is
  'Idempotent delivery state for privacy-preserving scheduled medication reminders.';

commit;
