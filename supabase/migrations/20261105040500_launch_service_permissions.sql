-- This project has restricted default privileges; the verified Edge function needs explicit access.
grant select,insert,update,delete on table public.throne_defenses,public.activity_events,public.notification_preferences,
 public.push_devices,public.place_review_history,public.location_visits,public.token_wallets,public.wallet_ledger,
 public.remote_attempts,public.private_courses,public.private_course_members,public.private_course_runs,
 public.store_transactions,public.store_entitlements,public.store_revocations to service_role;
-- The new developer branch omits legacy PostgREST role grants; restore only what the game uses.
grant select,insert,update,delete on public.avatar_gear_catalog,public.avatar_gear_unlocks,public.avatar_head_unlocks,public.bot_plans,public.challenge_claims,public.checkins,public.course_gen,public.course_holes,public.friend_links,public.link_codes,public.locations,public.match_invites,public.matches,public.osm_cells,public.osm_coverage,public.osm_places,public.place_reports,public.player_activity_days,public.player_carts,public.profiles,public.reports,public.runs to service_role;
grant select on public.thrones to service_role;
grant select on public.profiles,public.locations,public.runs,public.matches,public.course_holes,public.thrones to anon,authenticated;
revoke truncate,references,trigger on public.avatar_gear_catalog,public.avatar_gear_unlocks,public.avatar_head_unlocks,public.bot_plans,public.challenge_claims,public.checkins,public.course_gen,public.course_holes,public.friend_links,public.link_codes,public.locations,public.match_invites,public.matches,public.osm_cells,public.osm_coverage,public.osm_places,public.place_reports,public.player_activity_days,public.player_carts,public.profiles,public.reports,public.runs from anon,authenticated,public;
