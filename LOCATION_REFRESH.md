# Location freshness rollout

This change keeps imported places fast, adds an explicit live nearby refresh,
and provides a moderated corrections queue. It does not rebuild courses or delete
thrones/runs. OpenStreetMap remains community data: a successful refresh is not
a guarantee that a business is still open or has an accessible bathroom.

## Required deployment order

1. Apply `supabase/migrations/20260908010000_location_reviews.sql` to Supabase.
2. Add the intended administrator's authenticated game user UUID to
   `public.location_reviewers(user_id)` using Supabase's SQL editor. Use the game
   profile UUID, not a display name. There is deliberately no public self-enrollment.
3. Deploy the updated `server/potty/index.ts` as the existing potty Edge Function.
4. Deploy the frontend. Review corrections appears in Map tools only to reviewers.

The frontend build does not deploy Supabase functions or migrations. Until those
steps are done, refresh reports that the server does not support it and reports
cannot be submitted. Do not announce these features live before backend rollout.

## Immediate bulk reseed

GitHub Actions > Import OpenStreetMap bathrooms > Run workflow > regions:
`michigan` (or the desired state list). Use the branch containing this change.
The existing job downloads a current extract and updates imported POIs without
changing course IDs. Michigan is scheduled daily; the full USA stays weekly.
Required existing Actions secrets: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
These are server secrets and must never go in VITE_ variables or the browser.

For faster local discovery use Map > Refresh nearby. This bypasses the permanent
import short circuit and the phone cache, while reusing server results under five
minutes old to limit upstream traffic. Ordinary searches reuse live results for
24 hours before falling back to fast imports. Failed refreshes keep existing pins
and show an error. Responses cap at 1000 results; absence from a refresh is never
treated as proof of closure. Live changes overlay the seed and remain in server
cache; periodic imports provide durable regional updates.

## Corrections

Report this location accepts closed, wrong name, duplicate, inaccessible bathroom,
and other reports. Ten per player per day; one pending report per player/place.
Review corrections lets authorized reviewers rename, hide, restore or dismiss.
Review decisions are atomic and checked server-side. Renames retain the same ID;
hide/restore changes map visibility without erasing historical achievements.
Approved corrections overlay source data so later imports do not undo them.
Reopen the map after review to refresh corrections on other devices. Retired
locations reject new check-ins; existing historical course data remains available.

The existing Found one GPS flow remains available for missing bathrooms.
No paid places provider or new billing account is introduced.

## Validation

Run `npm run build` and `npm test -- tests/osm-import.test.ts`.
After migration, verify unauthenticated writes and non-reviewer decisions fail;
submit a report as a player, approve as a reviewer, and confirm its map pin changes
while its runs/thrones and course IDs are preserved. Database integration requires
a Supabase test deployment; local TypeScript build does not validate PostgreSQL.
