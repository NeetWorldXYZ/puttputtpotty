-- Quick match never leaves a player waiting: after a short while the edge
-- function seats a bot (a profile like any other) and plans its round with the
-- solver, one hole per request. The plan carries a clock; match_state applies
-- the bot's round when that clock runs out, so the result lands like a real
-- opponent's would, and decides the winner if the player has finished too.

alter table public.profiles add column if not exists is_bot boolean not null default false;

create table if not exists public.bot_plans (
  match_id uuid primary key references public.matches(id) on delete cascade,
  bot_id uuid not null references public.profiles(id),
  hole_times integer[] not null,
  strokes jsonb not null default '[]'::jsonb,
  scores integer[] not null default '{}',
  planned integer not null default 0,
  settle_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.bot_plans enable row level security;

create or replace function public.match_state(in_id uuid)
returns table(id uuid, seed text, code text, status text, holes integer, p1 uuid, p2 uuid, p1_name text, p2_name text, p1_avatar jsonb, p2_avatar jsonb,
  p1_score integer, p1_holes integer[], p1_elapsed_ms integer, p2_score integer, p2_holes integer[], p2_elapsed_ms integer, winner uuid, forfeit boolean, started_at timestamptz, finished_at timestamptz)
language plpgsql security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  m public.matches;
  bp public.bot_plans;
  bot_total integer;
begin
  select * into m from public.matches where matches.id = in_id;
  if not found or (m.p1 <> me and m.p2 is distinct from me) then raise exception 'no such match'; end if;
  -- A bot opponent's round lands when its clock says so.
  if m.status = 'playing' and m.p2_score is null then
    select * into bp from public.bot_plans where bot_plans.match_id = in_id and settle_at is not null and settle_at <= now() and planned >= m.holes;
    if found then
      select coalesce(sum(s), 0) into bot_total from unnest(bp.scores) s;
      update public.matches set p2_score = bot_total, p2_holes = bp.scores, p2_elapsed_ms = bp.hole_times[array_length(bp.hole_times, 1)]
        where matches.id = in_id returning * into m;
      if m.p1_score is not null then
        update public.matches set status = 'done', finished_at = now(),
          winner = case when m.p1_score < m.p2_score or (m.p1_score = m.p2_score and m.p1_elapsed_ms < m.p2_elapsed_ms) then m.p1
                        when m.p2_score < m.p1_score or (m.p1_score = m.p2_score and m.p2_elapsed_ms < m.p1_elapsed_ms) then m.p2
                        else null end
          where matches.id = in_id returning * into m;
      end if;
    end if;
  end if;
  if m.status = 'playing' and m.started_at < now() - (interval '10 minutes') * (m.holes / 3.0) and ((m.p1_score is not null) <> (m.p2_score is not null)) then
    update public.matches set status = 'done', forfeit = true, finished_at = now(),
      winner = case when p1_score is not null then p1 else p2 end
      where matches.id = in_id returning * into m;
  end if;
  return query select m.id, m.seed, m.code, m.status, m.holes, m.p1, m.p2,
    (select display_name from public.profiles where profiles.id = m.p1), (select display_name from public.profiles where profiles.id = m.p2),
    (select avatar from public.profiles where profiles.id = m.p1), (select avatar from public.profiles where profiles.id = m.p2),
    m.p1_score, m.p1_holes, m.p1_elapsed_ms, m.p2_score, m.p2_holes, m.p2_elapsed_ms, m.winner, m.forfeit, m.started_at, m.finished_at;
end;
$$;
grant execute on function public.match_state(uuid) to authenticated, service_role;
