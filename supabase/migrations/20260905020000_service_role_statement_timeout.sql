-- The edge function calls http_fetch_osm through PostgREST as service_role; an
-- Overpass answer can take longer than the 8 s the authenticator role allows.
alter role service_role set statement_timeout = '30s';
notify pgrst, 'reload config';
