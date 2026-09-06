-- A region's bounding box overreaches (Michigan's covers Toledo and a slice of
-- Wisconsin). Count a point as covered only if imported places exist within
-- 25 km of it; otherwise the API still asks OpenStreetMap live.
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
        order by d
        limit lim) p), '[]'::jsonb));
$$;
