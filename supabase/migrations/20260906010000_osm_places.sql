-- Imported OpenStreetMap bathrooms (and venues that have one), so map search
-- is a local query instead of a live call to public Overpass mirrors.
-- Loaded by scripts/osm-import.mjs (GitHub Action "Import OpenStreetMap bathrooms").
create table if not exists public.osm_places (
  id text primary key, -- osm:node:123 / osm:way:123 / osm:relation:123
  name text not null,
  poi_type text not null,
  lat double precision not null,
  lng double precision not null,
  geog geography(Point, 4326) generated always as ((st_setsrid(st_makepoint(lng, lat), 4326))::geography) stored,
  region text not null,
  density integer, -- places within 1 km, filled after import; orders the pre-build
  updated_at timestamptz not null default now()
);
create index if not exists osm_places_geog_idx on public.osm_places using gist (geog);
create index if not exists osm_places_region_idx on public.osm_places (region);
create index if not exists osm_places_density_null_idx on public.osm_places (region) where density is null;
alter table public.osm_places enable row level security;

-- Bounding box of every imported region: inside one, the import is the truth;
-- outside, the server still asks OpenStreetMap live.
create table if not exists public.osm_coverage (
  region text primary key,
  min_lat double precision not null,
  min_lng double precision not null,
  max_lat double precision not null,
  max_lng double precision not null,
  places integer not null default 0,
  imported_at timestamptz not null default now()
);
alter table public.osm_coverage enable row level security;

-- Nearest imported places to a point. Only the API (service role) may call it.
create or replace function public.bathrooms_near(in_lat double precision, in_lng double precision, radius_m double precision default 3000, lim integer default 400)
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'covered', exists (
      select 1 from osm_coverage c
      where in_lat between c.min_lat and c.max_lat and in_lng between c.min_lng and c.max_lng),
    'places', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'poiType', p.poi_type, 'lat', p.lat, 'lng', p.lng) order by p.d)
      from (
        select p.id, p.name, p.poi_type, p.lat, p.lng,
          st_distance(p.geog, st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography) as d
        from osm_places p
        where st_dwithin(p.geog, st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography, radius_m)
        order by d
        limit lim) p), '[]'::jsonb));
$$;
revoke all on function public.bathrooms_near(double precision, double precision, double precision, integer) from public, anon, authenticated;
grant execute on function public.bathrooms_near(double precision, double precision, double precision, integer) to service_role;

-- Fills `density` for a batch of rows of a region; the importer loops until it returns 0.
create or replace function public.osm_refresh_density(in_region text, batch integer default 2000)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare n integer;
begin
  with todo as (
    select id from osm_places where region = in_region and density is null limit batch
  ), upd as (
    update osm_places p
    set density = (select count(*) from osm_places q where st_dwithin(q.geog, p.geog, 1000))
    from todo where p.id = todo.id
    returning 1)
  select count(*) into n from upd;
  return n;
end;
$$;
revoke all on function public.osm_refresh_density(text, integer) from public, anon, authenticated;
grant execute on function public.osm_refresh_density(text, integer) to service_role;

-- Places of a region that have no course yet, busiest neighbourhoods first,
-- split into shards so several pre-build jobs can run at once.
create or replace function public.prebuild_candidates(in_region text, shard integer default 0, shards integer default 1, lim integer default 200)
returns table(id text, name text, poi_type text, lat double precision, lng double precision, density integer)
language sql stable security definer
set search_path = public
as $$
  select p.id, p.name, p.poi_type, p.lat, p.lng, coalesce(p.density, 0)
  from osm_places p
  where p.region = in_region
    and mod(abs(hashtext(p.id)), greatest(shards, 1)) = shard
    and not exists (select 1 from locations l where l.id = p.id)
  order by coalesce(p.density, 0) desc, p.id
  limit lim;
$$;
revoke all on function public.prebuild_candidates(text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.prebuild_candidates(text, integer, integer, integer) to service_role;
