# SBM-01 Handoff — App Store resubmission (v1.2.0), 2026-08-07

Continuation of the same day's SBM-00 bootstrap. Goal this session: get Mobile
resubmitted to the App Store, covering the App Store Connect listing copy
and RevenueCat checks flagged as open items in SBM-00/screenbot-desktop's
SBD-33.

## What was accomplished

1. **App Store Connect listing copy audited and fixed.** Description had
   "SCREENBot Pro: Unlimited scans + all action buttons unlocked" —
   inaccurate against the real caps (650/mo, 7,800/yr). Corrected to
   "Up to 650 scans/month (7,800/year on annual)". Everything else in the
   description (free tier "3 scans/month", App Review notes pricing) was
   already accurate.
2. **Support URL, Marketing URL, Copyright, Privacy Policy, and Terms of
   Use links updated** from `supercreativepeople.com/screenbot/*` to
   `screenbot.app/*` and "Frisson Digital, Inc." Verified all three
   `screenbot.app` pages are live and already reflect the correct caps,
   entity name, and pricing independently.
3. **RevenueCat checked** (`app.revenuecat.com`, SCREENBot project):
   0 active subscriptions, $0 MRR, 0 paid/trialing subscribers — confirmed
   via the filtered "Active subscribers" customer list, not just the
   Overview cards (which count all SDK-initialized users, including free
   tier, and can mislead). Same zero figure as the last check ~Aug 4-5.
   Confirmed RevenueCat's Stripe/Web Billing connection is intentionally
   unconfigured — this app has no web checkout path, Apple IAP only.
4. **New version built and submitted, with a real rejection in the
   middle.** First attempt: bumped nothing, built Build 8 still carrying
   `app.json`'s existing `1.1.0`, submitted, Apple rejected it
   (`ITMS-90186` invalid pre-release train, `ITMS-90062` version must be
   higher than previously-approved `1.1.0` — turned out Build 7 from
   around April had already been approved, likely via TestFlight, at that
   same `1.1.0`). Root cause: `eas.json`'s `autoIncrement` only bumps the
   iOS build number, never the marketing version; `appVersionSource:
   remote` doesn't change that. Fixed by bumping `app.json` to `1.2.0`
   (Lee's call on the correct next number in the real sequence:
   1.0.0 → 1.1.0 → 1.2.0), rebuilding (Build 9), and resubmitting.
   Documented in CLAUDE.md so this doesn't get rediscovered next release.
5. **v1.2.0 (Build 9) submitted to App Review 2026-08-07, 9:01 PM.**
   Waiting for Review as of session close. Apple's own estimate is up to
   48 hours.
6. **Mixpanel investigated, not removed.** Lee noted the Mixpanel
   subscription lapsed ~a month ago on cost grounds and asked to remove it
   from the App Review notes. Checked the actual code first: the SDK is
   still fully wired (hardcoded token, unconditional init/track calls on
   every app open) and still attempts to transmit data regardless of
   billing status. Flagged this before any notes were edited — removing
   the notes reference without removing the SDK would have made the notes
   inaccurate relative to the binary and the App Privacy label. Left both
   the code and the review notes untouched pending a real decision.

## Known issues / flagged, not resolved

- Mixpanel SDK is live in the app despite a lapsed, unpaid subscription —
  see CLAUDE.md "Mixpanel — billing lapsed, SDK still active". Needs an
  actual code change (remove `mixpanel-react-native` and its call sites)
  if the intent is to really stop using it, not a notes-only edit.
- v1.2.0 / Build 9 outcome not yet known — Apple review pending.
- `licensing`, `backend`, and `desktop` repos each still have separate
  open items of their own (see their respective CLAUDE.md files).

## Infrastructure state at close

Clean and pushed as of this session's close — see
`tools/check_repo_status.sh` output logged at the parent session's close.
