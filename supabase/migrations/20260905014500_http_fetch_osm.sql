-- Outbound HTTP for the bathroom search, callable only by the service role.
-- The edge runtime's egress cannot reach the Overpass mirrors; Postgres can.
create extension if not exists http with schema extensions;

create table if not exists public.osm_cells (
  key text primary key,
  places jsonb not null,
  fetched_at timestamptz not null default now()
);
alter table public.osm_cells enable row level security;

create or replace function public.http_fetch_osm(url text, body text default null)
returns table(status int, content text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  host text;
  req extensions.http_request;
begin
  host := lower(substring(url from '^https://([^/]+)/'));
  if host is null or host not in ('overpass-api.de', 'overpass.kumi.systems', 'overpass.private.coffee', 'maps.mail.ru', 'nominatim.openstreetmap.org') then
    raise exception 'host not allowed: %', coalesce(host, url);
  end if;
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '20000');
  if body is null then
    req := ('GET', url, array[extensions.http_header('User-Agent', 'PuttPuttPotty/1.0 (bathroom mini golf)'), extensions.http_header('Accept', 'application/json')], null, null)::extensions.http_request;
  else
    req := ('POST', url, array[extensions.http_header('User-Agent', 'PuttPuttPotty/1.0 (bathroom mini golf)')], 'application/x-www-form-urlencoded', body)::extensions.http_request;
  end if;
  return query select r.status::int, r.content::text from extensions.http(req) r;
end;
$$;

revoke all on function public.http_fetch_osm(text, text) from public, anon, authenticated;
grant execute on function public.http_fetch_osm(text, text) to service_role;
