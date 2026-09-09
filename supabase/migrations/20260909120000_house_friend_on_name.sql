-- The house account befriends a player when they choose a name, not on the
-- anonymous first open. "Golfer 4C85" is the default name; anything else is
-- a decision. Existing automatic links to unnamed golfers are dropped.
create or replace function public.befriend_house()
returns trigger language plpgsql security definer set search_path = public as $$
declare h uuid;
begin
  if new.is_bot or new.house then return new; end if;
  if new.display_name is null or new.display_name ~ '^Golfer [0-9A-Fa-f]{4,12}$' then return new; end if;
  if tg_op = 'UPDATE' and old.display_name is not distinct from new.display_name then return new; end if;
  for h in select id from public.profiles where house and id <> new.id loop
    insert into public.friend_links (a, b, status, requested_by, auto) values (least(h, new.id), greatest(h, new.id), 'accepted', h, true)
      on conflict (a, b) do nothing;
  end loop;
  return new;
end;
$$;
drop trigger if exists profiles_befriend_house on public.profiles;
create trigger profiles_befriend_house after insert or update of display_name on public.profiles for each row execute function public.befriend_house();

delete from public.friend_links l
  using public.profiles h, public.profiles o
  where h.house and l.auto and (l.a = h.id or l.b = h.id)
    and o.id = case when l.a = h.id then l.b else l.a end
    and o.display_name ~ '^Golfer [0-9A-Fa-f]{4,12}$';
