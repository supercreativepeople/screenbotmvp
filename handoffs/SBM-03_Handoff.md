# SBM-03 Handoff — Mixpanel to Aptabase swap, 2026-08-08

## Session Goal (as opened)

Replace Mixpanel with Aptabase for Mobile's analytics (Lee's call, confirmed this session: remove Mixpanel entirely rather than run both in parallel), and add monetization-funnel tracking that never existed under Mixpanel.

## What Was Accomplished

1. **`lib/analytics.js` rewritten** for `@aptabase/react-native` (v0.5.0, compatible with this app's React 19.1.0 / RN 0.81.5). `Aptabase.init()` now happens at module load instead of an async `initMixpanel()` call; `track()` wraps the SDK's synchronous `trackEvent()`.
2. **Separate Aptabase app registered for Mobile**, distinct from Desktop's existing "SCREENBot" app, specifically so the two products' events don't land in one combined dashboard. App Key `A-US-1223203856` (Mobile) vs. Desktop's `A-US-0062936593`. Lee registered the new app and pasted the key in chat — confirmed with him first that Aptabase App Keys are meant to be client-embedded (same as the RevenueCat key already in this codebase), not a credential.
3. **Two new events added**, closing a real gap: with 0 paying subscribers and no monetization-funnel tracking under the old 3-event Mixpanel set, there was no way to tell whether people saw the paywall and didn't convert, or never reached it at all.
   - `Paywall_Viewed` — instrumented as a single `useEffect` watching `showPaywall`'s transition to `true` in `App.js`, rather than touching each of the 7 scattered `setShowPaywall(true)` call sites individually.
   - `Purchase_Completed` — added to `lib/revenueCat.js`'s `purchasePackage()`, fired on a successful entitlement grant with `tier` (pro_monthly/pro_annual) and `period_type` (RevenueCat's NORMAL/TRIAL/INTRO) as properties.
4. **`App_Opened` and `Screenshot_Uploaded` carried over unchanged** (same event names, same call sites), just now going to Aptabase instead of Mixpanel. `Analysis_Complete` in `lib/api.js` needed no changes at all since it only imports `track`/`Events` from `./analytics`, agnostic to which backend those hit.
5. **Mixpanel fully removed**: `mixpanel-react-native` out of `package.json`; no leftover imports or call sites anywhere in the app (verified via repo-wide grep). Historical handoffs (SBM-01, SBM-02) left untouched as an accurate record of what was true at the time.
6. **Deliberately not instrumented**: a "result action tapped" event (user taps "Open in Spotify"/Netflix/etc.). Real signal, but `Linking.openURL` appears at 8+ scattered call sites in `App.js`. Skipped this pass per the leanest-viable-path convention; worth adding later if the funnel data shows people converting but not acting on results.
7. **Docs updated**: `CLAUDE.md` (Architecture section, new Analytics section replacing the old Mixpanel-billing-lapsed section, Open Items), `SERVICES.md` (Mixpanel row replaced with Aptabase row), `README.md` (one line: analytics pipeline status).

## Known Issues / Flagged, Not Resolved

- **`npm install` not run.** `package.json` changed (Mixpanel out, Aptabase in) but `package-lock.json` still reflects the old dependency tree — this sandbox's connected-folder mount blocks file deletion (`unlink`) entirely, the same restriction that blocked `git commit` in SBM-02, and a full `npm install` touching `node_modules` was judged too risky to attempt through it (could corrupt the install rather than just leave a lock file). Run `npm install` from a real Terminal before the next build.
- **No live event verified yet.** Haven't run the app on a real device/simulator since the swap, so nothing has actually confirmed events reach the "SCREENBot Mobile" Aptabase dashboard. Check `us.aptabase.com` after the next `npx expo run:ios`.
- **Android's `INTERNET` permission not independently verified.** Aptabase's docs say Android needs it in `AndroidManifest.xml`; this project's Android path is untested/unshipped already (per existing CLAUDE.md caveat), and Expo's default build normally includes this permission, but that wasn't confirmed for this specific project.
- **README.md has other stale content noticed but not fixed** (out of scope for this session): "Unlimited scans" language in the Business Model table (contradicts the real 650/mo, 7,800/yr caps already corrected elsewhere), App Store status still says "In Review" (it's live as of SBM-02), and the entity name says "SuperCreativePeople, Inc." rather than "Frisson Digital, Inc." Only the one analytics-pipeline line was touched, since fixing the rest wasn't part of this session's ask.

## Infrastructure State at Close

Not committed. This session's file edits (via direct Read/Write/Edit, not shell) are real and saved on disk in the connected `~/Projects/screenbot-mvp` folder, but `git commit`/`push` were not attempted in-session given the known FUSE unlink issue from SBM-02 — same fix applies: commit from a real Terminal.

## Next Session (SBM-04) Opens With

- Run `npm install`, then `npx expo run:ios`, confirm the app builds and launches clean.
- Trigger each of the 5 events on a real device/simulator run and confirm all 5 show up in the Aptabase "SCREENBot Mobile" dashboard (Live View).
- Commit and push this session's changes (`lib/analytics.js`, `lib/revenueCat.js`, `App.js`, `package.json`, `CLAUDE.md`, `SERVICES.md`, `README.md`, this handoff) from a real Terminal.
- Decide whether to fix the other stale README content flagged above.
- Resume the SCREENBot Desktop beta check-in (deferred from this session at Lee's request) — 7-day-minus-however-long runway left before the Aug 15 close.

## Build Order Confirmed

`lib/analytics.js` rewrite -> `App.js` import/call-site updates -> `Paywall_Viewed` instrumentation -> `lib/revenueCat.js` `Purchase_Completed` instrumentation -> `package.json` dependency swap -> docs (CLAUDE.md, SERVICES.md, README.md).
