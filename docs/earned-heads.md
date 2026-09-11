# Earned heads: artwork review

Ten code-native vector heads are implemented in the same renderer used by profiles, leaderboards, matches, and the customizer. They share the existing face and hat anchors and have seven colourways. The original five heads and starter/bot selection are unchanged.

Open `?preview=heads` to inspect the artwork without signing in or playing a match. Each card opens a full-body portrait with working hat, face, shirt, and colour selectors and 32/44/60 px portrait samples. It does not mount the game, start presence, equip an avatar, grant a reward, or write a profile.

## Review boundary

This is an **artwork-only draft**. The regular customizer still offers only the five deployed heads. The metadata in `earnedHeads.ts` defines planned milestone rules, not active server grants. Do not merge/publish this as a completed unlock feature. Server-verified permanent unlocks, historical credit, account-transfer handling, and customizer progress still need implementation after artwork review. No database or Edge Function changes are included or deployed.

| Head | Proposed milestone |
| --- | --- |
| Bubble Head | Level 4 / 450 TP |
| Bogey Bot | 10 ranked wins |
| Swamp Thing | Rounds completed at 5 distinct map locations |
| Count Flush | A daily course completed on 10 different dates, not necessarily consecutive |
| Shark Head | 25 lifetime aces |
| Porcelain Phantom | Level 8 / 1,750 TP |
| Trash Panda | Rounds completed at 15 distinct map locations |
| Hot Head | 50 ranked wins |
| Royal Lion | 5 simultaneously held thrones |
| Diamond Dome | Level 12 / 3,850 TP |

Unlocks should be permanent, use existing verified history when available, and never spend TP or change gameplay. In particular, Royal Lion needs a persisted award at the moment the threshold is reached, not a transient current-thrones check. Earned heads must not enter the random starter or bot catalogs.

## Checks

- TypeScript and production build.
- Avatar test suite includes all ten new heads, all expressions and hats, independent part previews, colour/reference integrity, and existing server catalog round trips for the starter choices.
- Browser review on the preview deployment before sharing.
