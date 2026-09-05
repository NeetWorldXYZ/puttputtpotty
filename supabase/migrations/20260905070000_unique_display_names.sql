-- Usernames are unique (case-insensitive). Existing duplicates keep the name on the
-- most recently active account; the others get a numeric suffix.
with ranked as (
  select p.id, p.display_name,
    row_number() over (partition by lower(p.display_name) order by (select max(r.created_at) from public.runs r where r.user_id = p.id) desc nulls last, p.id) as rn
  from public.profiles p
)
update public.profiles p set display_name = left(p.display_name, 20) || '·' || ranked.rn
from ranked where ranked.id = p.id and ranked.rn > 1;

create unique index if not exists profiles_display_name_unique on public.profiles (lower(display_name));
