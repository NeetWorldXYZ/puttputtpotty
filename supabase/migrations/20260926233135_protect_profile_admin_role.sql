-- Preserve normal profile editing while preventing browser clients from granting admin.
create or replace function public.protect_profile_admin_role()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      if new.role is distinct from 'player' then
        raise exception 'Account roles can only be assigned by the server' using errcode = '42501';
      end if;
    elsif new.role is distinct from old.role then
      raise exception 'Account roles can only be assigned by the server' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.protect_profile_admin_role() from public, anon, authenticated;
drop trigger if exists protect_profile_admin_role on public.profiles;
create trigger protect_profile_admin_role
before insert or update of role on public.profiles
for each row execute function public.protect_profile_admin_role();
