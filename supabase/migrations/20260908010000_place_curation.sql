-- Places have a life cycle now: a player's find is pending until an admin
-- approves it (admins' own finds go live at once), and a place three
-- different players report as closed comes off the map. Hidden places keep
-- their history but hold no throne.

alter table public.profiles add column if not exists role text not null default 'player';
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('player', 'admin'));

alter table public.locations add column if not exists status text not null default 'live';
alter table public.locations drop constraint if exists locations_status_check;
alter table public.locations add constraint locations_status_check check (status in ('live', 'pending', 'hidden'));
create index if not exists locations_status_idx on public.locations (status) where status <> 'live';

create table if not exists public.place_reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null references public.profiles(id) on delete cascade,
  location_id text not null references public.locations(id) on delete cascade,
  reason text not null check (reason in ('closed', 'wrong')),
  created_at timestamptz not null default now()
);
create index if not exists place_reports_location_idx on public.place_reports (location_id, created_at desc);
alter table public.place_reports enable row level security;

create or replace function public.is_admin()
returns boolean
language sql stable
set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- A hidden place holds no throne.
create or replace view public.thrones with (security_invoker = on) as
  select distinct on (r.location_id, r.season)
    r.location_id, r.season, r.user_id, p.display_name, p.avatar, r.score, r.par, r.hole_scores, r.elapsed_ms, r.created_at
  from public.runs r
  join public.profiles p on p.id = r.user_id
  join public.locations l on l.id = r.location_id and l.status <> 'hidden'
  where r.location_id is not null and r.hole_scores is not null
  order by r.location_id, r.season, r.score, coalesce(r.elapsed_ms, 2147483647), r.created_at;

-- Pending places are visible to their finder and to admins only.
drop function if exists public.nearby_locations(double precision, double precision, double precision);
create function public.nearby_locations(in_lat double precision, in_lng double precision, radius_m double precision default 2000)
returns table (
  id text, name text, poi_type text, lat double precision, lng double precision, theme text, difficulty text,
  hole_par integer, par integer, distance_m double precision,
  king_name text, king_score integer, king_user uuid, king_since timestamptz, king_holes integer[], king_elapsed_ms integer, king_avatar jsonb,
  run_count bigint, status text
)
language sql stable
set search_path = public
as $$
  select l.id, l.name, l.poi_type, l.lat, l.lng, l.theme, l.difficulty, l.hole_par, l.par,
    st_distance(l.geog, st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography) as distance_m,
    t.display_name as king_name, t.score as king_score, t.user_id as king_user, t.created_at as king_since, t.hole_scores as king_holes, t.elapsed_ms as king_elapsed_ms, t.avatar as king_avatar,
    (select count(*) from public.runs r where r.location_id = l.id and r.season = public.current_season()) as run_count,
    l.status
  from public.locations l
  left join public.thrones t on t.location_id = l.id and t.season = public.current_season()
  where st_dwithin(l.geog, st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography, radius_m)
    and (l.status = 'live' or (l.status = 'pending' and (l.founded_by = auth.uid() or public.is_admin())))
  order by distance_m
  limit 200;
$$;

-- Imported places that were reported closed stay off the map too.
create or replace function public.bathrooms_near(in_lat double precision, in_lng double precision, radius_m double precision default 3000, lim integer default 400)
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'covered', exists (
      select 1 from osm_coverage c
      where in_lat between c.min_lat and c.max_lat and in_lng between c.min_lng and c.max_lng)
      and exists (
        select 1 from osm_places p
        where st_dwithin(p.geog, st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography, 25000)),
    'places', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'poiType', p.poi_type, 'lat', p.lat, 'lng', p.lng) order by p.d)
      from (
        select p.id, p.name, p.poi_type, p.lat, p.lng,
          st_distance(p.geog, st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography) as d
        from osm_places p
        where st_dwithin(p.geog, st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography, radius_m)
          and not exists (select 1 from locations l where l.id = p.id and l.status = 'hidden')
        order by d
        limit lim) p), '[]'::jsonb));
$$;
