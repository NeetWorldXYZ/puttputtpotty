# Round-specific TP

Live database inspection revealed an existing throne_points function absent from the repository. This change preserves its rates and all existing gameplay/challenge balances. It adds missing match aces at the existing 15 TP ace rate, including already completed matches. Re-reading a result does not grant anything: totals are derived from verified records.

| Event | TP |
| --- | ---: |
| Finish a ranked or friend match | 10 |
| Win a match | +30 |
| Ace | +15 |
| Verified throne round | 25 |
| Complete a daily edition | 15 |

No new capture bonus, repeat caps, reward ledger or profile/account-transfer replacement is introduced. Challenges remain additive. Existing partial daily ace behavior is preserved; the round card waits for all nine verified holes before displaying course earnings.

Apply the included migration to add gameplay_reward and reconcile throne_points, deploy server/potty/index.ts (adds runId), then publish the frontend. The authenticated RPC is read-only and only returns the caller's earnings for one match, throne run, or daily course. It returns unavailable for missing or unfinished rounds. Failed/duplicate daily submissions display a warning rather than a false award.

Tests use PostgreSQL to verify existing rates, totals, repeated reads, match aces, daily completion, forfeits and caller isolation. Check existing live balances increase by exactly completed-match ace count times 15 after migration.

## Verified deployment

Applied to the confirmed putt-putt-potty project on 2026-09-11 as round_tp_earned_and_match_aces. The aggregate profile balance increased from 2295 to 2715, exactly the independently computed 420 missing match-ace TP. SQL assertions validated exact-match and throne-run rewards against existing verified records. Anonymous callers cannot execute gameplay_reward; authenticated callers can, scoped to their own records. Edge function potty version 28 is active with JWT verification retained. Frontend changes remain in the review branch until publication approval.
