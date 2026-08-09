# SBM-07 Handoff — v1.3.0 built and submitted, 2026-08-09

Continuation of SBM-03 through SBM-06. Lee ran the EAS build and submit from his own Terminal; this is the record of that outcome and what's left.

## What Happened

1. `eas build --platform ios --profile production` — succeeded. Build ID `cc060d02-9f23-481d-b9cd-e6a808b59b62`. Credentials (distribution cert, provisioning profile) were already valid, no re-signing needed.
2. `eas submit --platform ios --profile production` — succeeded. Submission ID `9d858200-0236-4163-a2fe-4cfbbcbafecb`. Confirmed from the CLI output: **App Version 1.3.0, Build number 10** — continuing EAS's own sequence from the last shipped Build 9, exactly as expected (the "Build 1" seen during local dev-client testing was never going to be the real number).
3. Apple confirmed the binary uploaded and began processing. Typical processing time is 5-10 minutes; not yet confirmed finished as of this handoff.

## What's Left — One Step, Manual, In App Store Connect

Once Build 10 finishes processing (check https://appstoreconnect.apple.com/apps/6761027461/testflight/ios):

1. Open the v1.3.0 version page in App Store Connect.
2. Update the App Privacy form for Aptabase: declare "Product Interaction" under Usage Data, purpose "Analytics", user identification "No", tracking "No".
3. Paste in the What's New text: "Added an About screen with app version info. Refreshed the scan animation."
4. Submit for review.

This is the only remaining manual step. Everything else — code, build, upload — is done.

## Repo State

Fully synced. Two commits landed this session: `a29c8ce` (the full v1.3.0 feature set) and `f02c7ac` (doc close-out). `git status` clean apart from a harmless stray `_probe2.txt` from earlier sandbox testing.

## Next Session Opens With

Confirm Apple's review outcome for v1.3.0 (approved and live, or any rejection to address). If approved, update CLAUDE.md's App Store submission history with the review completion date/time, same as the SBM-02 v1.2.0 record.
