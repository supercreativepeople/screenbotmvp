# CLAUDE.md

This file provides guidance to Claude when working with code in this repository. Bootstrapped 2026-08-07 as part of adopting the `dev-session-protocol` skill — this repo previously had no `CLAUDE.md`, `handoffs/`, or `SERVICES.md` and relied on a G-DRIVE copy outside git for context, which should no longer be treated as current.

## Project Overview

SCREENBot Mobile — a React Native / Expo iOS (+ Android, untested/unshipped) app. Scans the user's Photos "Screenshots" album, runs on-device OCR (`@react-native-ml-kit/text-recognition`) to extract text, then sends the image + extracted text to the `screenbot-backend` Cloud Run API (see `screenbot-backend/CLAUDE.md`) for AI classification (music, movies, dining, bars, events, jobs, shopping, other) and enrichment (streaming/purchase links). Bundle ID `com.supercreativepeople.screenbotmvp`. Currently a **single main file**: almost the entire app (screens, modals, paywall, gear menu) lives in `App.js` (~1,950 lines) rather than being split into a `screens/`/`components/` tree — worth knowing before searching for a component that "should" be its own file.

## Commands

```bash
npm install
npx expo start          # dev server
npx expo run:ios        # native iOS build
npx expo run:android    # native Android build (untested/unshipped as of 2026-08-07)
```

No test suite as of 2026-08-07.

## Architecture

- `App.js` — nearly everything: main scan/review flow, `PaywallModal`, `AboutModal` (new 2026-08-08), `GearMenu`, item detail/edit modals, toasts. See in-file comments for section boundaries.
- `lib/api.js` — talks to the `screenbot-backend` API (`API_BASE = https://screenbot-api-198959034459.us-east1.run.app`). `classifyScreenshot()` posts the image + OCR text + usage identity to `/classify`; `enrichResult()` posts to `/enrich`. Also has the per-category deep-link tables (Spotify/Apple Music, Netflix/Max/Hulu/Disney+/Apple TV+, Amazon/Target/Walmart) used to build "open in app" actions from an enrichment result.
- `lib/revenueCat.js` — RevenueCat SDK wrapper. `initRevenueCat()`, `getProStatus()`, `getUsageIdentity()` (returns `{appUserID, tier}` sent to the backend for usage-cap enforcement — fails safe to `{null, 'free'}` on any RC error so a RevenueCat outage never blocks a scan), `getOfferings()`, `purchasePackage()`, `restorePurchases()`. Entitlement ID is `SCREENBot Pro`.
- `lib/analytics.js` — Aptabase wrapper (`track()`, `Events`), switched from Mixpanel 2026-08-08. Uses a separate Aptabase app/App Key from Desktop (`A-US-1223203856` vs Desktop's `A-US-0062936593`) so the two products' events land in separate dashboards, not mixed. Both products are on Aptabase now.
- `lib/storage.js` — local persistence (AsyncStorage).

## Monetization

- Free tier: client-side scan limit (pre-existing `FREE_SCAN_LIMIT` gate, out of scope for the backend usage-cap work below).
- Pro Monthly $4.99/mo — 650 scans/month.
- Pro Annual $39.99/yr ($3.33/mo effective) — 7,800 scans/year, pooled.
- Server-side enforcement (Aug 2026, see `screenbot-backend/usage.py`): Firestore-backed per-user counters, ~120/day soft-throttle (scans still run past this but downscale harder, no hard block), hard cap at the monthly/annual period limit. Paywall copy in `App.js`'s `PaywallModal` already reflects these real numbers — confirmed accurate 2026-08-07, no "unlimited" language present.
- **App Store Connect listing copy checked and fixed 2026-08-07.** The live description had "SCREENBot Pro: Unlimited scans + all action buttons unlocked" — corrected to "Up to 650 scans/month (7,800/year on annual)". Support URL, Marketing URL, Copyright, and Privacy/Terms links were also updated to `screenbot.app`/Frisson Digital, Inc. (previously pointed at `supercreativepeople.com`).

## Cross-promotion

Gear menu has a "Try SCREENBot Desktop" item (added 2026-08-07) linking to `https://screenbot.app` — the general marketing site, not the closed-beta site, since Desktop isn't in public release yet. Revisit this link once Desktop's public launch page exists.

## App Store version numbering — read before ever bumping version

`eas.json` has `"appVersionSource": "remote"` with `autoIncrement: true` on the `production` profile. **`autoIncrement` only bumps the iOS build number (`CFBundleVersion`), never the marketing version (`CFBundleShortVersionString`).** The marketing version comes from `app.json`'s `expo.version` field and must be bumped by hand before every release that needs a new version string. Learned the hard way 2026-08-07: `app.json` had said `1.1.0` for a long time (matching a build from around April that was already approved via TestFlight); a new build was submitted still carrying `1.1.0` and Apple rejected it (`ITMS-90186`/`ITMS-90062`), since a resubmission's `CFBundleShortVersionString` must be strictly higher than any previously-approved version. Fixed by bumping `app.json` to `1.2.0` and rebuilding. **Always check `app.json`'s current version against what's actually been approved in App Store Connect before starting a new release build**, don't assume the last-used number is safe to reuse or that autoIncrement handles it.

## RevenueCat status (checked 2026-08-07)

0 active subscriptions, $0 MRR, 0 paid/trialing subscribers in the live RevenueCat project (`app.revenuecat.com`, project `SCREENBot`). The Overview dashboard's "New Customers"/"Active Customers" cards count any app user who initialized the SDK (free tier included) — not paying subscribers, don't read those as revenue. Same zero figure as the last check around Aug 4-5; nothing has changed. RevenueCat's Stripe/Web Billing connection is intentionally not set up — this app only sells through Apple's In-App Purchase, no web checkout path exists in the code.

## Analytics — Mixpanel replaced with Aptabase (2026-08-08)

`mixpanel-react-native` removed entirely: gone from `package.json`, and `lib/analytics.js` now wraps `@aptabase/react-native` instead. Reasons: Mixpanel's billing had lapsed (too expensive at bootstrap stage) while the SDK kept firing regardless; Desktop already uses Aptabase, so this is one vendor relationship instead of two; Aptabase's free tier (20,000 events/month, confirmed from Aptabase's own pricing page, not a stale third-party figure) comfortably covers current volume with 0 paying subscribers. Tradeoff worth knowing: Aptabase is anonymous by design, no user-level tracking (no MAU, no retention cohorts) — acceptable at this stage per Lee.

Event set (deliberately minimal — "Minimum Viable Analytics," 5-10 events, not exhaustive UI tracking):
- `App_Opened` — activation, fired once per app launch (`App.js` top-level `useEffect`).
- `Screenshot_Uploaded` — core action (`App.js`, scan button handler).
- `Analysis_Complete` — value delivered, fired for both the classify and enrich stages (`lib/api.js`).
- `Paywall_Viewed` — new 2026-08-08. Single `useEffect` watching the `showPaywall` state transition to `true` in `App.js`, rather than instrumenting each of the 7 scattered `setShowPaywall(true)` call sites individually.
- `Purchase_Completed` — new 2026-08-08. Fired from `lib/revenueCat.js`'s `purchasePackage()` on a successful entitlement grant, with `tier` (pro_monthly/pro_annual) and `period_type` (RevenueCat's NORMAL/TRIAL/INTRO) as properties. This closes the previous gap: with 0 paying subscribers and no monetization-funnel tracking, there was no way to tell whether people saw the paywall and didn't convert, or never reached it.

Deliberately not instrumented this pass: a "result action tapped" event (user taps "Open in Spotify"/Netflix/etc.) — real signal, but the `Linking.openURL` call appears at 8+ scattered sites in `App.js`; skipped per this repo's "leanest viable path" convention (Section 8) rather than touching that many call sites in one pass. Revisit if the funnel data above shows people converting but not acting on results.

Aptabase App Key (`A-US-1223203856`) lives in `lib/analytics.js`, client-embedded by design (same treatment as the RevenueCat key), not a secret.

## About screen (new 2026-08-08)

Gear menu previously had no way to see the app version or build number — flagged by Lee while testing the Aptabase build on his own device. Added `AboutModal` (`App.js`, mirrors `PaywallModal`'s visual style: dark background, back-button header, mascot icon) plus an "About" item in `GearMenu`, opened via new `showAbout` state. Shows: mascot, "SCREENBot" / "Your AI Screenshot Assistant", version and build number, "© 2026 Frisson Digital, Inc." (the corrected entity name, matching Desktop's SBD-33 EULA fix, not the stale "SuperCreativePeople, Inc." still in this repo's own README), and Privacy/Terms links.

Version/build are read at runtime via `expo-application`'s `Application.nativeApplicationVersion`/`nativeBuildVersion` (new dependency, `~7.0.8`, matches Expo SDK 54's bundled version), not from `app.json`'s static `version` field — necessary because `eas.json`'s `appVersionSource: remote` means the real build number is assigned by EAS at build time and never lands in `app.json` at all (see "App Store version numbering" above). `expo-constants` (`~18.0.10`) added as a fallback only.

**This requires a new build and a new App Store submission to reach real users** — confirmed this session: this app has no `expo-updates`/OTA channel configured (no `expo-updates` package, no `runtimeVersion` in `app.json`), so unlike apps with CodePush-style updates, every code change including this one needs a full native rebuild, a new build number, and App Review. What's currently live (v1.2.0, Build 9) has neither the About screen nor Aptabase in it — both were only visible in this session's testing because Lee ran a local dev-client build on his own device/simulator, not the App Store build.

## App Store submission history

- **v1.2.0 (Build 9) submitted 2026-08-07, 9:01 PM — review completed 2026-08-08, 1:16 PM PDT (Apple confirmation email, submission ID `8a42f9ee-a329-4f30-8b7c-8ff2ff190700`), App Store Connect shows status "Ready for Distribution" — live on the App Store.** ("Ready for Distribution" is Apple's current label for what used to be called "Ready for Sale" — it means live, not just approved-and-pending-release; Apple's own note is that it can take up to 24 hours after release for the listing to be publicly visible everywhere.) First submission attempt was Build 8 at v1.1.0, rejected same day for the version-numbering reason above. Includes: "Try SCREENBot Desktop" gear-menu link, Privacy/Terms link fix, and the App Store Connect metadata fixes above.
- **v1.3.0 code-complete, committed, and pushed 2026-08-09** (`a29c8ce`, `main` on GitHub, up to date with origin). Bundles: Mixpanel-to-Aptabase swap + Paywall_Viewed/Purchase_Completed tracking (SBM-03), About screen (SBM-04), and a revised `SB_SCAN_LOOP_c.mp4` with updated audio (SBM-05/06). All on-device verification confirmed by Lee. Not yet built via EAS or submitted to App Store Connect — see Open Items.

## Open items (as of 2026-08-09)

- **All device verification for v1.3.0 is complete and confirmed by Lee (2026-08-09):** About screen reads "Version 1.3.0 (Build 1)" correctly; scan-loop audio plays from the start with no delay; all 5 Aptabase events fired live in one session (`App_Opened`, `Screenshot_Uploaded`, `Analysis_Complete` x20+, `Paywall_Viewed`, `Purchase_Completed` x2 — `tier: pro_monthly`, `period_type: NORMAL`); App Version reported correctly (no more `1.0.0` anomaly). Everything below the fold in this section is now historical/root-cause record, not open questions.
- **Note on "Build 1":** that build number came from a local `npx expo run:ios --device` build, which doesn't go through EAS's remote build-numbering (`eas.json`'s `appVersionSource: remote` / `autoIncrement` only applies to `eas build`). The actual submitted build will get the next number in EAS's own sequence (last shipped was Build 9), not "1" — expected, not a bug.
- **Two `Purchase_Completed` events fired ~7s apart in the same test session** — worth confirming with Lee whether that was two deliberate test purchases or a single tap somehow firing the tracker twice; `lib/revenueCat.js`'s `track()` call sits once inside `purchasePackage()` with no obvious double-invoke path, so most likely explanation is Lee testing the flow twice, but flagging rather than assuming.
- **Committed and pushed to GitHub 2026-08-09**, commit `a29c8ce` — 15 files changed, includes the SBM-03 through SBM-06 handoffs. `npm install` confirmed run (package-lock.json changed in the same commit).
- **Remaining v1.3.0 submission checklist, in order — all require Lee's own machine/credentials, no sandbox access to EAS or App Store Connect:**
  1. `eas build --platform ios --profile production`
  2. `eas submit --platform ios --profile production`
  3. In App Store Connect: update the App Privacy form for Aptabase (declare "Product Interaction" under Usage Data, purpose "Analytics", user identification "No", tracking "No" — per Aptabase's own submission guide), paste in What's New text (below), submit for review.
- **What's New draft for v1.3.0:** "Added an About screen with app version info. Refreshed the scan animation." Plain, factual, matches the style already used in the live v1.2.0 listing — adjust if Lee wants different wording.
- **Aptabase App Version anomaly — root cause and fix, confirmed resolved 2026-08-09.** Aptabase's own docs say native version auto-detection is unreliable specifically in development-client builds (vs. full production builds), and recommend passing `appVersion` into `init()` directly. `lib/analytics.js` now does this, reading from `Constants.expoConfig.version` so it stays correct automatically on future version bumps.
- **Scan-loop audio delay — root cause and fix, confirmed resolved 2026-08-09.** File ruled out via `ffprobe`: audio packet 0 `pts=-0.021333` (normal ~21ms AAC encoder priming), video packet 0 `pts=0.0` — no meaningful track offset. Desktop's similar-looking symptom ruled out as a shared cause: Desktop's `<video>` tag runs through WebKit (Tauri's macOS webview), which has its own unrelated autoplay-audio-suppression policy that doesn't apply to Mobile's native `expo-av` player — separate bugs that happened to look similar. Actual cause: **three** separate `Audio.setAudioModeAsync()` calls in `App.js` — two near-identical ones in separate `useEffect`s at every app launch, plus a third re-configuring the session again inside `runScan()` right before the scan video mounted. Reconfiguring an already-active `AVAudioSession` category right before playback caused the delay. Consolidated to one call at app launch only, merged the `allowsRecordingIOS: false` option so no config was lost. Also removed a redundant `onReadyForDisplay` -> `playAsync()` call (video already autoplays via `shouldPlay={true}`).
- **`SB_SCAN_LOOP_c.mp4` mixup — found and fixed 2026-08-09.** Lee's audio revision first landed at the wrong filename (`SB_ORGANIZE_LOOP_c.mp4`), then landed correctly but ~48MB versus the original's 4.5MB (~12x video bitrate) since the original had been deliberately compressed for mobile bundle size and the new export skipped that pass. Re-compressed with `ffmpeg` to match the original's target bitrates (~220kbps video / ~43kbps audio) — now 4.27MB, sync confirmed unchanged via `ffprobe`. `assets/REMOVE/` still holds the misplaced revision and the old original as untracked backups — safe to delete once Lee gives the go-ahead (not this session's call to delete unprompted).
- Android path (`npx expo run:android`) is present in `app.json`/`package.json` but untested and unshipped — don't assume parity with iOS. Not verified whether Android needs the `INTERNET` permission added explicitly for Aptabase.
