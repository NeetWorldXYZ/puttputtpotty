-- The house account: everybody's first friend, like Tom. New players get
-- an accepted friendship with it the moment their profile exists; players
-- already here are backfilled; it carries a tag in friend lists.
alter table public.profiles add column if not exists house boolean not null default false;
alter table public.profiles add column if not exists house_tag text;

create or replace function public.befriend_house()
returns trigger language plpgsql security definer set search_path = public as $$
declare h uuid;
begin
  if new.is_bot then return new; end if;
  for h in select id from public.profiles where house and id <> new.id loop
    insert into public.friend_links (a, b, status, requested_by) values (least(h, new.id), greatest(h, new.id), 'accepted', h)
      on conflict (a, b) do nothing;
  end loop;
  return new;
end;
$$;
drop trigger if exists profiles_befriend_house on public.profiles;
create trigger profiles_befriend_house after insert on public.profiles for each row execute function public.befriend_house();

-- friends_list carries the tag.
drop function if exists public.friends_list();
create or replace function public.friends_list()
returns table(user_id uuid, display_name text, avatar jsonb, relation text, last_seen_at timestamptz, thrones bigint, invite_id uuid, invite_code text, invite_holes integer, house_tag text)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.avatar,
    case when l.status = 'accepted' then 'friend' when l.requested_by = auth.uid() then 'outgoing' else 'incoming' end,
    p.last_seen_at,
    (select count(*) from public.thrones t where t.user_id = p.id and t.season = public.current_season()),
    inv.id, inv.code, inv.holes,
    case when p.house then p.house_tag else null end
  from public.friend_links l
  join public.profiles p on p.id = case when l.a = auth.uid() then l.b else l.a end
  left join lateral (
    select i.id, m.code, m.holes from public.match_invites i join public.matches m on m.id = i.match_id
    where i.from_user = p.id and i.to_user = auth.uid() and i.status = 'sent' and m.status = 'waiting' and i.created_at > now() - interval '30 minutes'
    order by i.created_at desc limit 1
  ) inv on true
  where (l.a = auth.uid() or l.b = auth.uid()) and l.status in ('accepted', 'pending')
  order by (l.status = 'pending' and l.requested_by <> auth.uid()) desc, (inv.id is not null) desc, p.house desc, p.last_seen_at desc nulls last, p.display_name;
$$;
revoke all on function public.friends_list() from public, anon;
grant execute on function public.friends_list() to authenticated;

-- The tag on a profile page too.
create or replace function public.house_tag_of(in_user uuid)
returns text language sql stable set search_path = public as $$
  select case when p.house then p.house_tag else null end from public.profiles p where p.id = in_user;
$$;
grant execute on function public.house_tag_of(uuid) to anon, authenticated, service_role;
