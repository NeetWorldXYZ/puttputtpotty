-- The house account (Head Janitor) now sees its automatic friends too, so the
-- friendship is mutual: every named player lands on the house friends list.
create or replace function public.friends_list()
returns table(user_id uuid, display_name text, avatar jsonb, relation text, last_seen_at timestamptz, thrones bigint, invite_id uuid, invite_code text, invite_holes integer, house_tag text)
language sql stable security definer set search_path to 'public' as $$
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
