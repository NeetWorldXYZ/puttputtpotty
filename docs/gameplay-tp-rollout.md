# Automatic gameplay TP

Rewards start when `20260911090000_gameplay_tp.sql` is applied. There is no historical backfill. Claimed challenge points remain intact and challenges remain bonus rewards.

| Verified event | TP | Frequency |
| --- | ---: | --- |
| Complete a ranked or friend match | 20 | Once per completed match |
| Win that match | +20 | Once per completed match |
| Match ace | +10 | Per ace in a completed match |
| Complete the daily edition | 30 | Once per nine-hole edition (AM or PM) |
| Daily ace | +10 | Per ace, paid when all nine holes are recorded |
| Finish a GPS-verified throne round | 20 | First round at each location per Eastern calendar day |
| Throne-round ace | +10 | Aces in that rewarded round |
| Capture a throne | +50 | First capture at that location per player per season |

No rewards for offline/practice/custom solo courses, unfinished rounds, bots themselves, or forfeiting without a verified completed round. Friend/custom invite matches use the match reward rules. Improving your own throne score is not a new capture. Losing a throne never removes earned TP.

The ledger is written only by triggers on verified `runs` and settled `matches`. Its unique award keys prevent repeated payments. User/course and location advisory locks serialize run inserts. The authenticated `gameplay_reward` read returns only the caller's earned TP for one exact context. Public profile totals combine challenge and gameplay points. The challenges sheet intentionally continues showing challenge-only TP.

## Deployment order

1. Apply `supabase/migrations/20260911090000_gameplay_tp.sql` to the target database through the normal migration process (or run the complete file in Supabase SQL Editor once). It requires the existing production tables and migrations. Test on staging first. Do not re-run the SQL manually after it has been applied.
2. Deploy `server/potty/index.ts` as the existing `potty` Edge Function using the project's existing deployment process. This adds the saved run ID to verified submission responses; the pinned physics engine is unchanged.
3. Verify a completed match returns a nonzero reward via authenticated `gameplay_reward('match:<id>')`. Verify a throne submission returns `runId`, then `gameplay_reward('run:<runId>')` returns its award. Verify two submissions/read retries do not increase the reward. Confirm the profile total equals challenge claims plus gameplay ledger entries.
4. Publish the frontend only after those backend steps succeed. Match, daily and throne result cards display earned TP. Errors explicitly show unavailable rather than a profile total or invented reward. A daily with rejected/missing submissions shows a save warning.

The current workspace has no Supabase management authentication or database connection configured. GitHub/Vercel publishing alone does not perform steps 1–2. Do not merge this PR as an assumption that rewards are already active.

## Verification

`npx vitest run tests/gameplay-tp.test.ts tests/avatar.test.ts tests/ranked-record.test.ts`

The PostgreSQL test applies the real migration to a minimal test schema and exercises completion, wins, aces, incomplete dailies, duplicate updates, forfeits, throne captures, same-day repeats, profile totals, authenticated isolation and denied client reward writes. Run the migration against a staging copy of the full production schema before production rollout.
