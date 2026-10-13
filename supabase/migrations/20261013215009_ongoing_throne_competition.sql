-- Retain the legacy season field/API as one ongoing competition. All existing
-- map, profile, challenge and ranking queries now include every saved round.
create or replace function public.current_season()
returns integer language sql stable set search_path = public
as $$ select 1; $$;

-- Normalize legacy writers too, including an in-flight old Edge Function.
create or replace function public.ongoing_run_competition()
returns trigger language plpgsql set search_path = public
as $$ begin new.season := 1; return new; end; $$;
revoke all on function public.ongoing_run_competition() from public;
create trigger ongoing_run_competition
before insert or update of season on public.runs
for each row execute function public.ongoing_run_competition();

-- Preserve score, timing, identity and history; combine only the competition bucket.
update public.runs set season = 1 where season is distinct from 1;
