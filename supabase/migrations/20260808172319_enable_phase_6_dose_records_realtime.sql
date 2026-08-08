begin;

-- SaharaCare Phase 6 uses authenticated Postgres Changes subscriptions for
-- dose_records. Existing SELECT RLS continues to decide which caregivers may
-- receive each row; this only enables the table's replication stream.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'dose_records'
  ) then
    execute 'alter publication supabase_realtime add table public.dose_records';
  end if;
end;
$$;

commit;
