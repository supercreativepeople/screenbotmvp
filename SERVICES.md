# SERVICES.md - SCREENBot Mobile (iOS client)

Every external platform/service this project depends on. Update at session close whenever something changes. Credentials are NEVER stored here, pointer only. Mirrored into the cross-project Notion Platform & Service Registry (`https://app.notion.com/p/dd60c5c5ccda496eb10d58f8db0bc8b6`) at session close per the `dev-session-protocol` skill; that Notion database is the cross-project view, this file is the source of truth for this repo specifically.

Rows marked "(shared)" are used by both SCREENBot Desktop and SCREENBot Mobile. See `screenbot-backend/SERVICES.md` for the backend API this app calls.

| Service | Category | Purpose | Account / Org ID | Console URL | Subscription / Tier | Renewal | Credential Location | Status | Last Verified |
|---|---|---|---|---|---|---|---|---|---|
| GitHub - screenbot-mvp | Other | Source code (React Native / Expo, iOS + Android) | github.com/supercreativepeople | https://github.com/supercreativepeople/screenbotmvp | free | n/a | git credential helper (osxkeychain) | Active | 2026-08-07 |
| Expo / EAS | Distribution/Deploy | Build tooling, project ID `41140292-bb49-470b-ab40-bc9339482079` | expo.dev | expo.dev | unknown, check console | unknown | eas.json / expo login | Active | not independently re-verified 2026-08-07 |
| RevenueCat | Payments/Billing | Subscription management (Pro Monthly $4.99, Pro Annual $39.99), entitlement `SCREENBot Pro` | app.revenuecat.com | app.revenuecat.com | unknown, check console | n/a | public iOS SDK key in `lib/revenueCat.js` (RevenueCat public keys are meant to be client-embedded, not secret) | Active | not independently re-verified 2026-08-07 |
| Apple App Store Connect | Distribution/Deploy | iOS app listing, subscription products, TestFlight | appstoreconnect.apple.com | appstoreconnect.apple.com | Apple Developer Program (shared with Desktop's notarization account, unconfirmed if same entity) | annual | Apple ID login | Active | not independently re-verified 2026-08-07 |
| Mixpanel | Analytics | Event tracking (App_Opened, Screenshot_Uploaded, Analysis_Complete) | mixpanel.com | mixpanel.com | unknown, check console | n/a | token in `lib/analytics.js` | Active | not independently re-verified 2026-08-07 — note this is a different analytics platform than Desktop's Aptabase |
| Cloud Run - screenbot-api (shared) | Hosting | Classify/enrich backend this app calls | neat-tangent-474222-m9, us-east1 | see `screenbot-backend/SERVICES.md` | — | — | — | Active | 2026-08-07 |
| Firestore - screenbot-mobile database (shared) | Storage/Database | Usage-cap counters, written by the backend on this app's behalf | neat-tangent-474222-m9 | see `screenbot-backend/SERVICES.md` | — | — | — | Active | not independently re-verified 2026-08-07 |
