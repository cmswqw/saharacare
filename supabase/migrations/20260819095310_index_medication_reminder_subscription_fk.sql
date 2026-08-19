begin;

create index medication_reminder_deliveries_subscription_idx
  on public.medication_reminder_deliveries (push_subscription_id)
  where push_subscription_id is not null;

commit;
