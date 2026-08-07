import Purchases, { LOG_LEVEL } from 'react-native-purchases';

const RC_API_KEY_IOS = 'appl_PHYrkoHeaqpbsaRvpOzfPCDANwU';
const ENTITLEMENT_ID = 'SCREENBot Pro';

export async function initRevenueCat() {
  try {
    Purchases.setLogLevel(LOG_LEVEL.ERROR);
    await Purchases.configure({ apiKey: RC_API_KEY_IOS });
  } catch (e) {
    console.warn('[RC] configure error:', e);
  }
}

export async function getProStatus() {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
  } catch (e) {
    console.error('[RC] getProStatus error:', e);
    return false;
  }
}

// Stable per-user identity + tier, sent to the backend so the usage-cap
// tracker (Aug 2026) can enforce per-user daily/monthly limits for Pro.
// Returns tier: 'free' | 'pro_monthly' | 'pro_annual'. On any RC failure,
// returns { appUserID: null, tier: 'free' } — the backend no-ops the cap
// check when appUserID is missing, so this fails safe (no scan blocked).
export async function getUsageIdentity() {
  try {
    const appUserID = await Purchases.getAppUserID();
    const customerInfo = await Purchases.getCustomerInfo();
    const ent = customerInfo.entitlements.active[ENTITLEMENT_ID];
    let tier = 'free';
    if (ent) {
      const pid = (ent.productIdentifier || '').toLowerCase();
      tier = pid.includes('annual') ? 'pro_annual' : 'pro_monthly';
    }
    return { appUserID, tier };
  } catch (e) {
    console.warn('[RC] getUsageIdentity error:', e);
    return { appUserID: null, tier: 'free' };
  }
}

export async function getOfferings(retries = 3, delayMs = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const offerings = await Purchases.getOfferings();
      if (offerings.current) return offerings.current;
      return null;
    } catch (e) {
      if (attempt < retries) {
        await new Promise(res => setTimeout(res, delayMs));
      } else {
        console.warn('[RC] getOfferings failed after', retries, 'attempts:', e.message);
        return null;
      }
    }
  }
  return null;
}

export async function purchasePackage(rcPackage) {
  try {
    const { customerInfo } = await Purchases.purchasePackage(rcPackage);
    return {
      success: customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined,
      customerInfo,
    };
  } catch (e) {
    if (e.userCancelled) return { success: false, cancelled: true };
    console.error('[RC] purchasePackage error:', e);
    return { success: false, error: e.message };
  }
}

export async function restorePurchases() {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return {
      success: customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined,
      customerInfo,
    };
  } catch (e) {
    console.error('[RC] restorePurchases error:', e);
    return { success: false, error: e.message };
  }
}
