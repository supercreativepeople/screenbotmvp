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

- `App.js` — nearly everything: main scan/review flow, `PaywallModal`, `GearMenu`, item detail/edit modals, toasts. See in-file comments for section boundaries.
- `lib/api.js` — talks to the `screenbot-backend` API (`API_BASE = https://screenbot-api-198959034459.us-east1.run.app`). `classifyScreenshot()` posts the image + OCR text + usage identity to `/classify`; `enrichResult()` posts to `/enrich`. Also has the per-category deep-link tables (Spotify/Apple Music, Netflix/Max/Hulu/Disney+/Apple TV+, Amazon/Target/Walmart) used to build "open in app" actions from an enrichment result.
- `lib/revenueCat.js` — RevenueCat SDK wrapper. `initRevenueCat()`, `getProStatus()`, `getUsageIdentity()` (returns `{appUserID, tier}` sent to the backend for usage-cap enforcement — fails safe to `{null, 'free'}` on any RC error so a RevenueCat outage never blocks a scan), `getOfferings()`, `purchasePackage()`, `restorePurchases()`. Entitlement ID is `SCREENBot Pro`.
- `lib/analytics.js` — Mixpanel wrapper (`track()`, `Events`). Note: **Mixpanel, not Aptabase** — Desktop uses Aptabase; the two products use different analytics platforms.
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

## Mixpanel — billing lapsed, SDK still active

`lib/analytics.js`'s Mixpanel integration is still live in the code (hardcoded token, unconditional `initMixpanel()`/`track()` calls on every app open in `App.js`) despite the Mixpanel subscription having lapsed about a month ago (per Lee, too expensive to keep). The client still attempts to transmit events on every launch regardless of the account's billing status — a lapsed subscription doesn't stop the SDK from firing, it just means Mixpanel's backend may now discard what arrives. Not removed this session (would be a real code change, out of scope for a metadata-fix pass) — if the intent is to actually stop using Mixpanel, `mixpanel-react-native` needs to come out of `App.js`/`lib/analytics.js`/`package.json`, not just get removed from App Review notes (App Store Connect's App Privacy nutrition label should still reflect the SDK's presence as long as it's in the binary).

## App Store submission history

- **v1.2.0 (Build 9) submitted 2026-08-07, 9:01 PM — Waiting for Review.** First submission attempt was Build 8 at v1.1.0, rejected same day for the version-numbering reason above. Includes: "Try SCREENBot Desktop" gear-menu link, Privacy/Terms link fix, and the App Store Connect metadata fixes above.

## Open items (as of 2026-08-07)

- v1.2.0 (Build 9) awaiting Apple App Review decision (up to 48 hours per Apple's own estimate).
- Mixpanel SDK still active despite lapsed billing — decide whether to actually remove it from the app, see above.
- Android path (`npx expo run:android`) is present in `app.json`/`package.json` but untested and unshipped — don't assume parity with iOS.
