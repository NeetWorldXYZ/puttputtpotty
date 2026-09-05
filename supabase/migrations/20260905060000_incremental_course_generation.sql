-- Courses are generated one hole per request (edge CPU budget); progress lives on the row.
alter table public.locations
  add column if not exists gen_holes integer not null default 0,
  add column if not exists gen_tries integer not null default 0;
update public.locations set gen_holes = jsonb_array_length(holes) where holes is not null;
