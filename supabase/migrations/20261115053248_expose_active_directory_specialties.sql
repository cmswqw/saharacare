begin;

-- Canonical specialty options must not depend on paid/provider availability.
-- Expose only public taxonomy labels, never the private catalog tables.
create function private.get_directory_specialties()
returns table(id text, name_en text, name_ne text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_status='active') then
    raise exception using errcode='42501',message='An active care account is required.';
  end if;
  return query select s.id,s.name_en,s.name_ne from private.directory_specialties s
    -- Module 3's explicitly fictional taxonomy uses the reserved demo- prefix.
    where s.active and s.id not like 'demo-%' order by s.id limit 100;
end;
$$;
revoke all on function private.get_directory_specialties() from public,anon,authenticated;
grant execute on function private.get_directory_specialties() to authenticated;
create function public.get_directory_specialties()
returns table(id text,name_en text,name_ne text)
language sql stable security invoker set search_path='' as $$select * from private.get_directory_specialties();$$;
revoke all on function public.get_directory_specialties() from public,anon,authenticated;
grant execute on function public.get_directory_specialties() to authenticated;

commit;
