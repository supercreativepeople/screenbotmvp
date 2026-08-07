import AsyncStorage from '@react-native-async-storage/async-storage';

const RESULTS_KEY = 'screenbot_results';
const PREFS_KEY   = 'screenbot_prefs';

// ─── Results persistence ──────────────────────────────────────────────────────

export async function saveResults(items) {
  try {
    await AsyncStorage.setItem(RESULTS_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn('saveResults failed:', e);
  }
}

export async function loadResults() {
  try {
    const raw = await AsyncStorage.getItem(RESULTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export async function clearResults() {
  try {
    await AsyncStorage.removeItem(RESULTS_KEY);
  } catch (e) {
    console.warn('clearResults failed:', e);
  }
}

// ─── User preferences ─────────────────────────────────────────────────────────
// Defaults — user sets these in onboarding

export const DEFAULT_PREFS = {
  musicApp:    null,          // 'spotify' | 'apple_music'
  streaming:   [],            // ['netflix','max','hulu','disney','apple_tv']
  onboarded:   false,
};

export async function savePrefs(prefs) {
  try {
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.warn('savePrefs failed:', e);
  }
}

export async function loadPrefs() {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : { ...DEFAULT_PREFS };
  } catch (e) {
    return { ...DEFAULT_PREFS };
  }
}

// ─── In-app lists (persistent, accumulates across scans) ─────────────────────
// Lists are keyed by category. Each item is a classified+enriched result.

const LISTS_KEY = 'screenbot_lists';

export async function loadLists() {
  try {
    const raw = await AsyncStorage.getItem(LISTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export async function saveLists(lists) {
  try {
    await AsyncStorage.setItem(LISTS_KEY, JSON.stringify(lists));
  } catch (e) {
    console.warn('saveLists failed:', e);
  }
}

// Merge new scan results into existing lists.
// Returns { lists, added, duplicates } where:
//   added      = { category: count } of newly saved items
//   duplicates = { category: [items] } of items skipped because subject already exists
export async function addToLists(newItems, { force = false } = {}) {
  const existing = await loadLists();
  const added = {};
  const duplicates = {};

  for (const item of newItems) {
    const cat = item.category || 'other';
    // 'other' items ARE saved so Saved Lists reflects reality
    if (!existing[cat]) existing[cat] = [];

    // Dedup by subject match
    const dupMatch = existing[cat].find(
      e => e.subject && item.subject && e.subject.toLowerCase() === item.subject.toLowerCase()
    );
    if (dupMatch && !force) {
      if (!duplicates[cat]) duplicates[cat] = [];
      duplicates[cat].push(item);
    } else {
      existing[cat].push({ ...item, savedAt: Date.now() });
      added[cat] = (added[cat] || 0) + 1;
    }
  }

  await saveLists(existing);
  return { lists: existing, added, duplicates };
}

// Force-add specific items regardless of duplicates (user confirmed "Add anyway")
export async function forceAddToList(category, items) {
  const existing = await loadLists();
  if (!existing[category]) existing[category] = [];
  for (const item of items) {
    existing[category].push({ ...item, savedAt: Date.now() });
  }
  await saveLists(existing);
  return existing;
}

export async function removeFromList(category, itemId) {
  const existing = await loadLists();
  if (existing[category]) {
    existing[category] = existing[category].filter(i => i.id !== itemId);
    await saveLists(existing);
  }
  return existing;
}

export async function clearList(category) {
  const existing = await loadLists();
  existing[category] = [];
  await saveLists(existing);
  return existing;
}
