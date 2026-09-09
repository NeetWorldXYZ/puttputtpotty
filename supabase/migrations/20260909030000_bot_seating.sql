-- Seating a bot no longer depends on the client asking: match_state does it
-- after 15 s of waiting, so even a phone on an older build gets an opponent.
-- match_state also tells the player whether the opponent is a bot (and its
-- clock) so the client can plan its round and show its progress.
create or replace function public.seat_bot(in_match uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  m public.matches;
  bot uuid;
  n integer;
  times integer[] := '{}';
  t integer := 0;
  i integer;
  names text[] := array['Kyle M.', 'Dee Plunge', 'Tanya P.', 'Marcus V.', 'Lou Flush', 'Big Sal', 'Rhonda K.', 'Petey', 'Ana Belle', 'Grumpy Gus', 'J. Wexford', 'Roxy', 'Duke Gilmore', 'Cornbread', 'Old Tom', 'Maddie Q.', 'Two-Putt Tony'];
  porcelain text[] := array['white', 'mint', 'pink', 'sky', 'lavender', 'gold', 'onyx'];
  seats text[] := array['white', 'ink', 'red', 'blue', 'wood', 'gold'];
  hats text[] := array['none', 'crown', 'cap', 'tophat', 'plunger', 'halo'];
  faces text[] := array['happy', 'cool', 'sleepy', 'angry', 'wink'];
  balls text[] := array['white', 'tomato', 'lemon', 'lime', 'sky', 'grape', 'bubblegum', 'ink', 'stripe', 'dots', 'tiger'];
  nm text;
begin
  select * into m from public.matches where id = in_match for update;
  if not found or m.status <> 'waiting' or m.code is not null or m.p2 is not null then return; end if;
  -- A free bot, or a new one while the pool is small.
  select p.id into bot from public.profiles p
    where p.is_bot and not exists (select 1 from public.matches x where x.status = 'playing' and x.p2 = p.id)
    order by random() limit 1;
  if bot is null or (random() < 0.3 and (select count(*) from public.profiles where is_bot) < 12) then
    select x into nm from unnest(names) x where not exists (select 1 from public.profiles where display_name = x) order by random() limit 1;
    if nm is null then nm := 'Golfer ' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4)); end if;
    bot := gen_random_uuid();
    -- profiles.id references auth.users: a bot needs an auth row (never logs in: no password, no session).
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change, is_anonymous)
      values ('00000000-0000-0000-0000-000000000000', bot, 'authenticated', 'authenticated', 'bot-' || bot || '@bots.puttputtpotty.invalid', '', now(), '{"provider":"bot","providers":["bot"]}'::jsonb, '{"bot":true}'::jsonb, now(), now(), '', '', '', '', false);
    insert into public.profiles (id, display_name, is_bot, avatar) values (bot, nm, true, jsonb_build_object(
      'porcelain', porcelain[1 + floor(random() * array_length(porcelain, 1))::int],
      'seat', seats[1 + floor(random() * array_length(seats, 1))::int],
      'hat', hats[1 + floor(random() * array_length(hats, 1))::int],
      'face', faces[1 + floor(random() * array_length(faces, 1))::int],
      'ball', balls[1 + floor(random() * array_length(balls, 1))::int]));
  end if;
  n := coalesce(m.holes, 9);
  for i in 1..n loop
    t := t + 16000 + (7000 * (1.5 + random() * 2))::int + (random() * 6000)::int;
    times := times || t;
  end loop;
  update public.matches set p2 = bot, status = 'playing', started_at = now() where id = in_match;
  insert into public.bot_plans (match_id, bot_id, hole_times) values (in_match, bot, times)
    on conflict (match_id) do update set bot_id = excluded.bot_id, hole_times = excluded.hole_times, strokes = '[]'::jsonb, scores = '{}', planned = 0, settle_at = null;
end;
$$;
revoke all on function public.seat_bot(uuid) from public, anon, authenticated;
grant execute on function public.seat_bot(uuid) to service_role;

drop function if exists public.match_state(uuid);
create function public.match_state(in_id uuid)
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
begin
  select * into m from public.matches where matches.id = in_id;
  if not found or (m.p1 <> me and m.p2 is distinct from me) then raise exception 'no such match'; end if;
  -- Nobody came in 15 seconds: seat a bot.
  if m.status = 'waiting' and m.code is null and m.p1 = me and m.created_at < now() - interval '15 seconds' then
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
grant execute on function public.match_state(uuid) to authenticated, service_role;
