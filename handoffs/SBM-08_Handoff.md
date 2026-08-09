# SBM-08 Handoff — v1.3.0 submitted for Apple review, session close, 2026-08-09

Closes out the v1.3.0 cycle that ran across SBM-03 through SBM-08 in one continuous session.

## What Happened

Lee completed the App Privacy form and submitted v1.3.0 (Build 10) for Apple review, working directly in App Store Connect:

- App Privacy: declared Product Interaction under Usage Data, purpose Analytics, not linked to user identity, not used for tracking — matches Aptabase's own submission guidance.
- What's New text confirmed correct: "Added an About screen with app version info. Refreshed the scan animation."
- Build 10 (v1.3.0) confirmed attached to the version.
- Submitted for review: **Waiting for Review**, submission ID `96429f6d-d8fb-4fba-bc31-ef7b1f7d0cc2`, Aug 9, 2026 at 1:26 PM PDT.

## Full v1.3.0 Cycle Summary

Everything from Mixpanel-to-Aptabase replacement through this submission:

1. Replaced Mixpanel with Aptabase analytics (SBM-03).
2. Added the About screen to the gear menu (SBM-04).
3. Fixed the scan-loop audio delay (three redundant `Audio.setAudioModeAsync()` calls consolidated to one) and the `SB_SCAN_LOOP_c.mp4` file mixup/bitrate bloat (SBM-05, SBM-06).
4. Committed and pushed all of it to GitHub (`a29c8ce`, `f02c7ac`, `1dc491c`).
5. Built via `eas build` (Build 10) and submitted via `eas submit` (SBM-07).
6. Completed the App Privacy form and submitted for Apple review (this handoff).

## Repo State at Close

`screenbot-mvp`: synced with `origin/main` apart from this handoff and the CLAUDE.md update, plus a harmless untracked `_probe2.txt` (5-byte leftover from sandbox testing, safe to ignore or delete).

Family check across all four SCREENBot repos: `screenbot-backend` and `screenbot-licensing` are clean. `screenbot-desktop` has one uncommitted change (`handoffs/SBD-33_Session_Handoff_2026-08-07.md`) — this was flagged in an earlier part of this same session and explicitly deferred by Lee ("lets focus on the mobile app in this session, I'll chase that in the next session"). Not touched here, still open for the next Desktop session.

## Next Session Opens With

Check Apple's review outcome for v1.3.0 (App Store Connect > SCREENBot > Distribution > 1.3.0). If approved and live, update CLAUDE.md's App Store submission history with the completion timestamp, following the same format as the v1.2.0 record. If rejected, record the reason and scope the fix.

Separately, whenever Lee picks Desktop back up: the SBD-33 handoff has uncommitted local edits waiting, plus the interrupted beta check-in task and the pending audio-track/EULA batch fix noted there.
