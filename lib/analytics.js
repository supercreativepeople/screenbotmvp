import Aptabase, { trackEvent } from '@aptabase/react-native';
import Constants from 'expo-constants';

// App Key for the "SCREENBot Mobile" app in Aptabase (distinct from Desktop's
// app, so the two products' events don't mix in one dashboard). Aptabase App
// Keys are meant to be client-embedded, same as the RevenueCat key in
// lib/revenueCat.js — not a login credential.
const APP_KEY = 'A-US-1223203856';

// Explicit appVersion, not left to native auto-detection: Aptabase's own docs
// flag that native version detection is unreliable in development-client
// builds specifically (as opposed to full production builds) and recommend
// passing it in directly. Confirmed 2026-08-09 — events kept reporting
// App Version 1.0.0 in Aptabase's dashboard despite app.json/the About
// screen correctly showing 1.3.0. Reads from app.json via expo-constants so
// it stays correct automatically on future version bumps.
Aptabase.init(APP_KEY, { appVersion: Constants.expoConfig?.version });

export function track(event, props = {}) {
  try {
    trackEvent(event, props);
  } catch (e) {
    console.warn('[Aptabase] track error:', e?.message);
  }
}

// ─── Core SCREENBot Events ───────────────────────────────────────────────────
// Minimum-viable set for launch stage (2026-08-08): activation, core action,
// value delivered, and the monetization funnel (previously untracked — the
// actual open question given 0 paying subscribers is whether people see the
// paywall and don't convert, or never reach it at all).

export const Events = {
  APP_OPENED:          'App_Opened',
  SCREENSHOT_UPLOADED: 'Screenshot_Uploaded',
  ANALYSIS_COMPLETE:   'Analysis_Complete',
  PAYWALL_VIEWED:      'Paywall_Viewed',
  PURCHASE_COMPLETED:  'Purchase_Completed',
};
