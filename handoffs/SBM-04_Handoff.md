# SBM-04 Handoff — About screen, 2026-08-08

Same-day continuation of SBM-03. Lee found the gap live-testing the Aptabase build on his own device: no About tab, no way to see version/build number anywhere in the app.

## Session Goal (as opened)

Add a minimal About screen (version, build number, entity/copyright, legal links) to the gear menu.

## What Was Accomplished

1. **`AboutModal` added to `App.js`**, mirroring `PaywallModal`'s visual pattern (dark background, back-button header, mascot icon, `ScrollView` body). Content: mascot (`SB_BOT_ICON_1024_OFFICIAL.png`), "SCREENBot" / "Your AI Screenshot Assistant", version + build number, "© 2026 Frisson Digital, Inc." (corrected entity name, matching Desktop's SBD-33 fix — not the stale "SuperCreativePeople, Inc." still sitting in this repo's own README, out of scope to fix here), Privacy Policy / Terms of Use links.
2. **"About" item added to `GearMenu`**, after Terms of Use, wired to a new `showAbout` state via `onAbout` prop, same pattern as every other gear-menu action.
3. **Version/build read via `expo-application`** (`Application.nativeApplicationVersion` / `nativeBuildVersion`), not `app.json`'s static `version` field — because `eas.json`'s `appVersionSource: remote` means the real build number is assigned remotely by EAS and never written into `app.json`, so only a native runtime read gets the true value. New dependency `expo-application@~7.0.8`, matched against Expo SDK 54's bundled version list (fetched from Expo's own GitHub, not assumed). `expo-constants@~18.0.10` also added as a fallback path.
4. **Confirmed with Lee before building**: this necessarily requires a new build + App Store submission, since the repo has no `expo-updates`/OTA channel configured (verified: no `expo-updates` package, no `runtimeVersion` in `app.json`). Lee's direction: batch this with the Aptabase work from SBM-03 into one next release rather than shipping separately.

## Known Issues / Flagged, Not Resolved

- Same `npm install` gap as SBM-03 — now two rounds of `package.json` changes (Aptabase swap, then `expo-application`/`expo-constants`) without a regenerated `package-lock.json`. Must run `npm install` before the next build attempts to use either.
- Live-verified this session (screenshot from Lee's own device, Aptabase "Session Timeline"): `App_Opened` -> `Screenshot_Uploaded` (trigger: scan_button) -> 6x `Analysis_Complete` (stage: classify) -> `Paywall_Viewed`, all in one real session, ~1m8s, iOS 26.3.1, California. `Purchase_Completed` still unverified (needs an actual purchase to trigger). Note: the session showed 6 `Analysis_Complete` events all at `stage: classify` with no `stage: enrich` events visible in the timeline segment shown — not necessarily a bug (enrich only fires for certain categories/successful matches) but worth a second look if it recurs.
- **App Version anomaly**: Aptabase showed `App Version 1.0.0` for this session despite `app.json` saying `1.2.0`. Not root-caused this session — most likely a dev-client build that was JS-reloaded without a full native rebuild (native Info.plist would still reflect whatever version was baked in at the last actual `expo run:ios`/EAS build). Since the new About screen and this Aptabase field both ultimately read from the same native version APIs, a fresh full rebuild should resolve or clarify both at once. Flagged, not chased down further this session.
- Android `INTERNET` permission for Aptabase still not independently verified for this project (same open item as SBM-03).

## Infrastructure State at Close

Not committed, same as SBM-03 — this sandbox's connected-folder mount cannot `git commit` (unlink restriction on `.git/index.lock`, confirmed in SBM-02). File edits are real and on disk. Commit both SBM-03 and SBM-04's changes together from a real Terminal.

## Next Session (SBM-05) Opens With

- Run `npm install`, then a full `npx expo run:ios` (not a JS-only reload) to pick up Aptabase, the About screen, and hopefully the correct `1.2.0` version string in one clean native build.
- Verify all 5 events including `Purchase_Completed` (sandbox purchase or RevenueCat test), and confirm the About screen shows `1.2.0` and the correct build number.
- Commit and push SBM-03 + SBM-04's combined changes from a real Terminal.
- Once verified clean, this is the batch to submit as the next App Store release (About screen + Aptabase together, per Lee's direction).
- Separately: Lee mentioned wanting to add an updated audio track to the Desktop app's process video loop, to fold into Desktop's own next build alongside the already-pending DMG EULA fix (see `screenbot-desktop/CLAUDE.md`, SBD-33 entry) — logged there, not actioned here, since this session stayed scoped to Mobile per Lee's request.

## Build Order Confirmed

`AboutModal` component -> `GearMenu` "About" item + `onAbout` wiring -> `showAbout` state + render -> `expo-application`/`expo-constants` dependencies -> CLAUDE.md updates.
