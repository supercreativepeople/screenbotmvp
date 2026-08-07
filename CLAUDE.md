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
- Server-side enforcement (Aug 2026, see `screenbot-backend/usage.py`): Firestore-backed per-user counters, ~120/day soft-throttle (scans still run past this but downscale harder, no hard block), hard cap at the monthly/annual period limit. Paywall copy in `App.js`'s `PaywallModal` already reflects these real numbers — confirmed accurate 2026-08-07, no "unlimited" language present. The **App Store Connect subscription listing itself** (a separate surface Claude has no direct access to) still needs a human check that its copy matches.

## Cross-promotion

Gear menu has a "Try SCREENBot Desktop" item (added 2026-08-07) linking to `https://screenbot.app` — the general marketing site, not the closed-beta site, since Desktop isn't in public release yet. Revisit this link once Desktop's public launch page exists.

## Open items (as of 2026-08-07)

- App Store Connect listing copy needs a human check against the real caps above (Claude has no App Store Connect access).
- RevenueCat / App Store Connect subscriber counts need re-checking immediately before any release (was zero as of ~Aug 4-5 per screenbot-desktop's handoffs — that number was for the Desktop beta context, re-verify the Mobile number separately).
- Android path (`npx expo run:android`) is present in `app.json`/`package.json` but untested and unshipped — don't assume parity with iOS.
