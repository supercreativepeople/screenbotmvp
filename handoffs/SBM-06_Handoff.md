# SBM-06 Handoff — v1.3.0 verification complete, 2026-08-09

Continuation of SBM-03/04/05. All bugs found during on-device testing are fixed and confirmed working. This closes out the dev/test phase of v1.3.0 — what's left is submission mechanics only.

## What Was Confirmed

Lee tested the rebuilt dev-client app on his own device and confirmed, with screenshots:

1. About screen reads "Version 1.3.0 (Build 1)" and "© 2026 Frisson Digital, Inc." correctly.
2. Scan-loop video plays with audio from the start — no delay.
3. All 5 Aptabase events fired in one live session: `App_Opened`, `Screenshot_Uploaded`, `Analysis_Complete` (20+, mixed classify/enrich stages), `Paywall_Viewed`, `Purchase_Completed` (x2, `tier: pro_monthly`, `period_type: NORMAL`).
4. App Version in Aptabase now reports `1.3.0` correctly (previously stuck reporting `1.0.0`).

## Two Notes for Lee, Not Blockers

- **"Build 1" is expected**, not a bug — it's a local `expo run:ios` build number, not an EAS-assigned one. The real submission build will continue EAS's own sequence (last shipped: Build 9).
- **Two `Purchase_Completed` events fired ~7 seconds apart.** Worth a quick check: was that two deliberate test taps, or did one purchase somehow fire the tracker twice? The code only calls `track()` once per `purchasePackage()` invocation, so a double-tap during testing is the likely explanation, but flagging rather than assuming.

## Root Causes Fixed This Session (full detail in CLAUDE.md "Open items")

- Scan-loop audio delay: three redundant `Audio.setAudioModeAsync()` calls in `App.js`, consolidated to one.
- `SB_SCAN_LOOP_c.mp4` landed at the wrong filename, then landed correctly but at ~12x the original's bitrate — re-compressed with `ffmpeg` to match.
- Aptabase App Version stuck at `1.0.0` — fixed by passing `appVersion` explicitly into `Aptabase.init()`.

## Known Issues / Not Resolved

- **Nothing from SBM-03 through this session is committed to git yet.** Same sandbox restriction as prior handoffs — needs `git add -A && git commit && git push` from a real Terminal.
- `npm install` status unconfirmed — package.json changed (Aptabase in, Mixpanel out, `expo-application`/`expo-constants` added). A prior `package-lock.json` diff suggested this may already have run; not explicitly verified.
- `assets/REMOVE/` still holds two untracked backup video files from the mixup — safe to delete once Lee's ready, not deleted automatically.

## Next Session (SBM-07) Opens With

1. Confirm `npm install` has run.
2. `git add -A && git commit -m "..." && git push`
3. `eas build --platform ios --profile production`
4. `eas submit --platform ios --profile production`
5. In App Store Connect: update the App Privacy form for Aptabase (Product Interaction / Usage Data / Analytics / no user ID / no tracking), paste in What's New text, submit for review.

What's New draft: "Added an About screen with app version info. Refreshed the scan animation."
