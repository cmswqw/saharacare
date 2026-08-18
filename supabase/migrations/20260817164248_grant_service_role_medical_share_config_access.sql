begin;

-- The server-side Supabase client performs appointment sharing as
-- service_role. The expiry trigger is SECURITY INVOKER and reads only this
-- private singleton, so grant schema traversal and the one required table
-- privilege without exposing the schema or config to browser roles.
grant usage on schema private to service_role;
grant select on table private.medical_share_config to service_role;

commit;
