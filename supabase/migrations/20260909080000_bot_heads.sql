-- Bots get one of the five starter heads too, so the lobby looks like the player base.
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
  heads text[] := array['classic', 'roll', 'turd', 'alien', 'dawg'];
  porcelain text[] := array['white', 'mint', 'pink', 'sky', 'lavender', 'gold', 'onyx'];
  seats text[] := array['white', 'ink', 'red', 'blue', 'wood', 'gold'];
  hats text[] := array['none', 'crown', 'cap', 'tophat', 'plunger', 'halo'];
  faces text[] := array['happy', 'cool', 'sleepy', 'angry', 'wink'];
  balls text[] := array['white', 'tomato', 'lemon', 'lime', 'sky', 'grape', 'bubblegum', 'ink', 'stripe', 'dots', 'tiger'];
  nm text;
begin
  select * into m from public.matches where id = in_match for update;
  if not found or m.status <> 'waiting' or m.code is not null or m.p2 is not null then return; end if;
  select p.id into bot from public.profiles p
    where p.is_bot and not exists (select 1 from public.matches x where x.status = 'playing' and x.p2 = p.id)
    order by random() limit 1;
  if bot is null or (random() < 0.3 and (select count(*) from public.profiles where is_bot) < 12) then
    select x into nm from unnest(names) x where not exists (select 1 from public.profiles where display_name = x) order by random() limit 1;
    if nm is null then nm := 'Golfer ' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4)); end if;
    bot := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change, is_anonymous)
      values ('00000000-0000-0000-0000-000000000000', bot, 'authenticated', 'authenticated', 'bot-' || bot || '@bots.puttputtpotty.invalid', '', now(), '{"provider":"bot","providers":["bot"]}'::jsonb, '{"bot":true}'::jsonb, now(), now(), '', '', '', '', false);
    insert into public.profiles (id, display_name, is_bot, avatar) values (bot, nm, true, jsonb_build_object(
      'head', heads[1 + floor(random() * array_length(heads, 1))::int],
      'porcelain', porcelain[1 + floor(random() * array_length(porcelain, 1))::int],
      'seat', seats[1 + floor(random() * array_length(seats, 1))::int],
      'hat', hats[1 + floor(random() * array_length(hats, 1))::int],
      'face', faces[1 + floor(random() * array_length(faces, 1))::int],
      'ball', balls[1 + floor(random() * array_length(balls, 1))::int]));
  end if;
  n := coalesce(m.holes, 9);
  for i in 1..n loop
    t := t + 8000 + (random() * 9000)::int + (random() * 5000)::int;
    times := times || t;
  end loop;
  update public.matches set p2 = bot, status = 'playing', started_at = now() where id = in_match;
  insert into public.bot_plans (match_id, bot_id, hole_times) values (in_match, bot, times)
    on conflict (match_id) do update set bot_id = excluded.bot_id, hole_times = excluded.hole_times, strokes = '[]'::jsonb, scores = '{}', planned = 0, settle_at = null;
end;
$$;
-- The bots already seated get a head each, so they stop all looking classic.
update public.profiles set avatar = coalesce(avatar, '{}'::jsonb) || jsonb_build_object('head', (array['classic', 'roll', 'turd', 'alien', 'dawg'])[1 + floor(random() * 5)::int])
  where is_bot and (avatar is null or not (avatar ? 'head'));
