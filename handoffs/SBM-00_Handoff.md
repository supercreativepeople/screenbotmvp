# SBM-00 Handoff — Repo bootstrap, 2026-08-07

First numbered session for this repo under the naming convention `SBM-NN`
(SCREENBot Mobile), mirroring `SBD-NN` for Desktop and `SBB-NN` for Backend.
Nothing before this point was logged as a numbered session in git; prior
history lived only in commit messages and an external G-DRIVE copy that
should no longer be treated as current.

## What was accomplished

1. Bootstrapped this repo onto the `dev-session-protocol` skill: added
   `CLAUDE.md`, `handoffs/` (this directory), `SERVICES.md`, and
   `tools/check_repo_status.sh` (copied from `screenbot-desktop`, same
   `REPOS` list).
2. Confirmed the in-app paywall copy (`App.js`'s `PaywallModal`) already
   reflects the real usage caps (650/mo, 7,800/yr) with no "unlimited"
   language — this had been flagged as outstanding but the code itself was
   already correct.
3. Added a "Try SCREENBot Desktop" item to the gear menu (`App.js`), linking
   to `https://screenbot.app`. Committed and pushed (`2789b8f`).

## Known issues / flagged, not resolved

- App Store Connect subscription listing copy needs a human check — Claude
  has no App Store Connect access to verify or fix this surface directly.
- RevenueCat / App Store Connect subscriber counts need re-checking
  immediately before any release.
- No pre-existing session history was backfilled into `handoffs/` from
  Notion or G-DRIVE — this bootstrap only covers today forward.
- Android build path is present but untested/unshipped; don't assume
  parity with iOS without checking.

## Infrastructure state at close

Clean and pushed as of this session's close — see
`tools/check_repo_status.sh` output at session close in the parent handoff
for the full four-repo picture.
