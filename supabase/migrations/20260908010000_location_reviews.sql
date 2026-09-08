-- Corrections preserve location IDs, courses, crowns and historical runs.
create table public.location_reviewers (
  user_id uuid primary key references auth.users(id)
);
alter table public.location_reviewers enable row level security;
create table public.location_corrections (
  id text primary key,
  name text,
  hidden boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.location_corrections enable row level security;
create policy "Read approved corrections" on public.location_corrections for select to authenticated using (true);
grant select on public.location_corrections to authenticated;
create table public.location_reports (
  id bigint generated always as identity primary key,
  reporter uuid not null references auth.users(id),
  location_id text not null check (location_id ~ '^(osm:(node|way|relation):[0-9]+|ppp:[a-f0-9]{12})$'),
  location_name text not null check (length(location_name) between 1 and 100),
  reason text not null check (reason in ('closed','name','duplicate','no_bathroom','other')),
  details text not null default '' check (length(details) <= 300),
  status text not null default 'pending' check (status in ('pending','approved','dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);
alter table public.location_reports enable row level security;
create unique index one_pending_location_report on public.location_reports(reporter, location_id) where status='pending';
create or replace function public.can_review_locations() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from location_reviewers where user_id=auth.uid());
$$;
create policy "Review queue" on public.location_reports for select to authenticated using (public.can_review_locations());
grant select on public.location_reports to authenticated;
create or replace function public.report_location(loc text, label text, problem text, note text default '') returns void
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  if (select count(*) from location_reports where reporter=auth.uid() and created_at>now()-interval '1 day') >= 10 then
    raise exception 'You have sent 10 reports today. Try again tomorrow.';
  end if;
  insert into location_reports(reporter,location_id,location_name,reason,details)
    values(auth.uid(),loc,trim(label),problem,trim(note));
end;
$$;
create or replace function public.review_location(report_id bigint, decision text, corrected_name text default null) returns void
language plpgsql security definer set search_path=public as $$
declare r location_reports; n text;
begin
  if not public.can_review_locations() then raise exception 'Reviewer access required'; end if;
  if decision not in ('hide','rename','dismiss','restore') then raise exception 'Invalid decision'; end if;
  select * into r from location_reports where id=report_id and status='pending' for update;
  if not found then raise exception 'Report was already reviewed'; end if;
  n=nullif(trim(corrected_name),'');
  if decision='rename' and (n is null or length(n)>100) then raise exception 'Enter a name up to 100 characters'; end if;
  if decision in ('hide','restore') then
    insert into location_corrections(id,hidden) values(r.location_id,decision='hide')
    on conflict(id) do update set hidden=excluded.hidden, updated_at=now();
  elsif decision='rename' then
    insert into location_corrections(id,name) values(r.location_id,n)
    on conflict(id) do update set name=excluded.name, updated_at=now();
    update locations set name=n where id=r.location_id;
  end if;
  update location_reports set status=case when decision='dismiss' then 'dismissed' else 'approved' end,
    reviewed_at=now(),reviewed_by=auth.uid() where id=report_id;
end;
$$;
revoke all on function public.can_review_locations() from public, anon;
revoke all on function public.report_location(text,text,text,text) from public, anon;
revoke all on function public.review_location(bigint,text,text) from public, anon;
grant execute on function public.can_review_locations() to authenticated;
grant execute on function public.report_location(text,text,text,text) to authenticated;
grant execute on function public.review_location(bigint,text,text) to authenticated;
