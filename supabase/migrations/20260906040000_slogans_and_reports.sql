-- Profiles get a slogan; players can report a name or slogan, and three
-- distinct reports reset it automatically.
alter table public.profiles
  add column if not exists slogan text,
  add column if not exists flagged_at timestamptz;

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null references public.profiles(id) on delete cascade,
  reported uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now()
);
create index if not exists reports_reported_idx on public.reports (reported, created_at desc);
alter table public.reports enable row level security;
