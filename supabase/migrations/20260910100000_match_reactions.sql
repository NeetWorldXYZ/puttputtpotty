-- After-match reactions: canned trash talk and sad-but-funny lines that
-- either player can fire at the other once a match is done. The client maps
-- each key to its text; the server only checks who, when and how often.

create table if not exists public.match_reactions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9_]{2,24}$'),
  created_at timestamptz not null default now()
);
create index if not exists match_reactions_match_idx on public.match_reactions (match_id, created_at);
alter table public.match_reactions enable row level security;

-- Fire one reaction. Only the two players, only once the match is done, at
-- most twenty each per match, and only for an hour after the final putt.
create or replace function public.match_react(in_match uuid, in_key text)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  m public.matches;
begin
  if me is null then raise exception 'not signed in'; end if;
  if in_key !~ '^[a-z0-9_]{2,24}$' then raise exception 'unknown reaction'; end if;
  select * into m from public.matches where id = in_match;
  if not found or (m.p1 <> me and m.p2 is distinct from me) then raise exception 'not your match'; end if;
  if m.status <> 'done' then raise exception 'the match is not over yet'; end if;
  if m.finished_at is not null and m.finished_at < now() - interval '1 hour' then raise exception 'that match is old news'; end if;
  if (select count(*) from public.match_reactions r where r.match_id = in_match and r.user_id = me) >= 20 then
    raise exception 'you have said enough';
  end if;
  insert into public.match_reactions (match_id, user_id, key) values (in_match, me, in_key);
end;
$$;

-- Everything said so far in one of your matches, oldest first.
create or replace function public.match_reactions(in_match uuid)
returns table(user_id uuid, key text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.user_id, r.key, r.created_at
  from public.match_reactions r
  join public.matches m on m.id = r.match_id
  where r.match_id = in_match and (m.p1 = auth.uid() or m.p2 = auth.uid())
  order by r.created_at
  limit 40;
$$;

revoke all on function public.match_react(uuid, text), public.match_reactions(uuid) from public, anon;
grant execute on function public.match_react(uuid, text), public.match_reactions(uuid) to authenticated;
