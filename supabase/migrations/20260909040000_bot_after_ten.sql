-- A bot sits down after ten seconds of waiting (two with in_quick, for testing alone).
drop function if exists public.match_state(uuid);
create or replace function public.match_state(in_id uuid, in_quick boolean default false)
returns table(id uuid, seed text, code text, status text, holes integer, p1 uuid, p2 uuid, p1_name text, p2_name text, p1_avatar jsonb, p2_avatar jsonb,
  p1_score integer, p1_holes integer[], p1_elapsed_ms integer, p2_score integer, p2_holes integer[], p2_elapsed_ms integer, winner uuid, forfeit boolean, started_at timestamptz, finished_at timestamptz,
  p2_bot boolean, bot_times integer[])
language plpgsql security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  m public.matches;
  bp public.bot_plans;
  bot_total integer;
  wait interval := case when in_quick then interval '2 seconds' else interval '10 seconds' end;
begin
  select * into m from public.matches where matches.id = in_id;
  if not found or (m.p1 <> me and m.p2 is distinct from me) then raise exception 'no such match'; end if;
  -- Nobody came: seat a bot. Only the player who opened the match, only public matches.
  if m.status = 'waiting' and m.code is null and m.p1 = me and m.created_at < now() - wait then
    perform public.seat_bot(in_id);
    select * into m from public.matches where matches.id = in_id;
  end if;
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
    m.p1_score, m.p1_holes, m.p1_elapsed_ms, m.p2_score, m.p2_holes, m.p2_elapsed_ms, m.winner, m.forfeit, m.started_at, m.finished_at,
    exists (select 1 from public.bot_plans b where b.match_id = m.id),
    case when m.p1 = me then (select b.hole_times from public.bot_plans b where b.match_id = m.id) else null end;
end;
$$;
revoke all on function public.match_state(uuid, boolean) from public, anon;
grant execute on function public.match_state(uuid, boolean) to authenticated, service_role;
