-- Reports can now say what is wrong: closed, renamed (with the new name), or
-- wrong (not a bathroom / wrong spot). A renamed place keeps its id, course,
-- throne and history; the imported pin just shows the corrected name.

alter table public.place_reports add column if not exists details text;
alter table public.place_reports drop constraint if exists place_reports_reason_check;
alter table public.place_reports add constraint place_reports_reason_check check (reason in ('closed', 'renamed', 'wrong'));
create index if not exists place_reports_reporter_idx on public.place_reports (reporter, created_at desc);

-- Imported pins: hidden ones stay off, renamed ones carry their new name.
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
        select p.id, coalesce(l.name, p.name) as name, p.poi_type, p.lat, p.lng,
          st_distance(p.geog, st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography) as d
        from osm_places p
        left join locations l on l.id = p.id
        where st_dwithin(p.geog, st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography, radius_m)
          and (l.status is null or l.status <> 'hidden')
        order by d
        limit lim) p), '[]'::jsonb));
$$;
