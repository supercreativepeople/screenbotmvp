# SBM-02 Handoff — v1.2.0 approved and live, 2026-08-08

Short status-update session. No code changes.

## What was accomplished

1. Lee reported v1.2.0 (Build 9), submitted 2026-08-07 and logged as
   "Waiting for Review" in SBM-01, had been approved. Didn't take that at
   face value — Lee then supplied a screenshot of the App Store Connect
   version page and the Apple "Review of your SCREENBot (iOS) submission
   is complete" email, so the status below is confirmed from those, not
   just his say-so.
2. Verified from the screenshot: App Store Connect shows Build 9 /
   version 1.2.0 with status **"Ready for Distribution."** Verified from
   the email: review completed 2026-08-08, 1:16 PM PDT, submission ID
   `8a42f9ee-a329-4f30-8b7c-8ff2ff190700`, "eligible for distribution."
3. Confirmed via web search that "Ready for Distribution" is Apple's
   current label for what used to be called "Ready for Sale" — i.e. it
   means the version is live, not merely approved-and-pending-release
   ("Pending Developer Release" is the distinct status for that case).
   Apple's own email caveat is that it can take up to 24 hours after
   release for the listing to be publicly visible everywhere, which is
   about propagation, not approval status.
4. Updated `CLAUDE.md`: App Store submission history and Open Items
   sections now reflect the verified live status, submission ID, and
   review-completion timestamp instead of "awaiting review."
5. Updated `SERVICES.md`: Apple App Store Connect row's Last Verified
   date and status moved from "submitted, Waiting for Review" to
   "Ready for Distribution (live), confirmed via screenshot + email."

## Known issues / flagged, not resolved

Unchanged from SBM-01:

- Mixpanel SDK is live in the app despite a lapsed, unpaid subscription —
  see CLAUDE.md "Mixpanel — billing lapsed, SDK still active."
- Android path (`npx expo run:android`) is present but untested/unshipped.

## Infrastructure state at close

See `tools/check_repo_status.sh` output logged at session close.
