-- Match courses are generated one attempt-pair per request (edge CPU budget); this tracks the retries.
create table if not exists public.course_gen (
  seed text not null,
  hole_index integer not null,
  tries integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (seed, hole_index)
);
alter table public.course_gen enable row level security;
