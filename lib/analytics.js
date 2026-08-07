import { Mixpanel } from 'mixpanel-react-native';

const TOKEN = 'cd16379b922b713c345744308ae440d7';

let _mp = null;

export async function initMixpanel() {
  if (_mp) return _mp;
  _mp = new Mixpanel(TOKEN, true); // trackAutomaticEvents = true
  await _mp.init();
  return _mp;
}

export async function track(event, props = {}) {
  try {
    const mp = await initMixpanel();
    mp.track(event, props);
  } catch (e) {
    console.warn('[Mixpanel] track error:', e?.message);
  }
}

// ─── Core SCREENBot Events ───────────────────────────────────────────────────

export const Events = {
  APP_OPENED:          'App_Opened',
  SCREENSHOT_UPLOADED: 'Screenshot_Uploaded',
  ANALYSIS_COMPLETE:   'Analysis_Complete',
};
