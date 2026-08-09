# SBM-05 Handoff — v1.3.0 opened, 2026-08-08

Same-day continuation of SBM-03/SBM-04. Lee finished testing the Aptabase build on his own device, revised the scan-loop video's audio track, and asked to start the resubmission process.

## Session Goal (as opened)

Open the next Mobile release: bump the version, draft release notes, lay out the full submission checklist.

## What Was Accomplished

1. **`app.json` version bumped 1.2.0 -> 1.3.0.** Required: a resubmission's `CFBundleShortVersionString` must be strictly higher than the last approved version, same rule that caused the Build 8 rejection (see "App Store version numbering" in CLAUDE.md).
2. **Scan-loop video updated.** Lee overwrote `assets/SB_SCAN_LOOP_c.mp4` in place with a revised audio track — same filename, no code change needed (confirmed the correct file: `App.js`'s `scanVideoRef` at line ~1279, `SB_` prefix, not Desktop's `SSB_`-prefixed asset of a similar name, which caused a brief mix-up mid-session before the correct path was confirmed).
3. **Full submission checklist written into CLAUDE.md** ("Open items"), split by what's already done vs. what needs Lee's Terminal/Apple/EAS logins (Claude has no App Store Connect or EAS access).
4. **What's New draft written:** "Added an About screen with app version info. Refreshed the scan animation." Matches the plain, factual style already used in the live v1.2.0 listing.
5. **App Privacy form guidance researched and recorded**, not assumed: per Aptabase's own submission guide, declare "Product Interaction" under Usage Data, purpose "Analytics," user identification "No," tracking "No." This is a manual App Store Connect step, no Claude access to that surface.

## Known Issues / Flagged, Not Resolved

- Nothing from SBM-03, SBM-04, or this session is committed to git yet. Same sandbox filesystem restriction as SBM-02 (`.git/index.lock` unlink blocked). All of it needs `git add -A && git commit && git push` from a real Terminal before anything else.
- `npm install` still hasn't been run (package.json changed across SBM-03 and SBM-04: Aptabase in, Mixpanel out, `expo-application`/`expo-constants` in).
- No full native rebuild (`npx expo run:ios`, not a JS reload) has happened since any of this session's changes. The `1.0.0`-vs-`1.2.0` App Version anomaly flagged in SBM-04 is still unresolved and should get clarified by this rebuild.
- `Purchase_Completed` is the one event of the five still untested live (needs a real or sandbox purchase to trigger).

## Infrastructure State at Close

Not committed — see above. `app.json`, `CLAUDE.md`, and this handoff are the only new changes from this specific leg; the larger uncommitted set also includes everything from SBM-03 and SBM-04.

## Next Session (SBM-06) Opens With

Full checklist, in order (also in CLAUDE.md Open Items):
1. `npm install`
2. `npx expo run:ios` (full rebuild, not JS reload)
3. Verify on device: About screen reads `1.3.0` + correct build number; all 5 events fire in Aptabase including `Purchase_Completed`
4. `git add -A && git commit -m "..." && git push`
5. `eas build --platform ios --profile production`
6. `eas submit --platform ios --profile production`
7. In App Store Connect: update the App Privacy form for Aptabase, paste in the What's New text, submit for review

## Build Order Confirmed

`app.json` version bump -> scan-loop video overwrite (Lee, outside this session's file tools) -> CLAUDE.md submission checklist + What's New draft.
