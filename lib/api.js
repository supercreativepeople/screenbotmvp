import * as FileSystem from 'expo-file-system';
import { track, Events } from './analytics';

const API_BASE = 'https://screenbot-api-198959034459.us-east1.run.app';

export async function classifyScreenshot(imageUri, extractedText, identity) {
  const ext = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
  const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
  const formData = new FormData();
  formData.append('image', { uri: imageUri, name: `ss.${ext}`, type: mime });
  if (extractedText) formData.append('extracted_text', extractedText);
  // Usage-cap identity (Aug 2026) — omitted entirely if unavailable, which the
  // backend treats as free tier / no cap enforcement, not an error.
  if (identity?.appUserID) formData.append('app_user_id', identity.appUserID);
  formData.append('tier', identity?.tier || 'free');
  const res = await fetch(`${API_BASE}/classify`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error(`classify ${res.status}`);
  const result = await res.json();
  track(Events.ANALYSIS_COMPLETE, {
    stage: 'classify',
    category: result?.type || 'unknown',
  });
  return result;
}

export async function enrichResult(classifyData) {
  const res = await fetch(`${API_BASE}/enrich`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(classifyData),
  });
  if (!res.ok) throw new Error(`enrich ${res.status}`);
  const result = await res.json();
  track(Events.ANALYSIS_COMPLETE, {
    stage: 'enrich',
    category: classifyData?.type || 'unknown',
    matched: !!(result?.track_name || result?.title),
  });
  return result;
}


export function getMusicActions(enrichment) {
  const title = enrichment?.track || enrichment?.subject || '';
  const artist = enrichment?.artist || '';
  const query = encodeURIComponent(`${title} ${artist}`.trim());
  return [
    { id: 'spotify',     brand: 'spotify',     label: 'Spotify',     url: `spotify:search:${query}`,               fallback: `https://open.spotify.com/search/${query}` },
    { id: 'apple_music', brand: 'apple_music', label: 'Apple Music', url: `music://music.apple.com/search?term=${query}`, fallback: `https://music.apple.com/search?term=${query}` },
  ];
}

export function getMovieActions(enrichment) {
  const title = enrichment?.subject || enrichment?.title || '';
  const query = encodeURIComponent(title);
  return [
    { id: 'netflix',  brand: 'netflix',  label: 'Netflix',  url: `nflx://www.netflix.com/search?q=${query}`,   fallback: `https://www.netflix.com/search?q=${query}` },
    { id: 'max',      brand: 'max',      label: 'Max',      url: `max://search?q=${query}`,                    fallback: `https://www.max.com/search?q=${query}` },
    { id: 'hulu',     brand: 'hulu',     label: 'Hulu',     url: `hulu://search?q=${query}`,                   fallback: `https://www.hulu.com/search?q=${query}` },
    { id: 'disney',   brand: 'disney',   label: 'Disney+',  url: `disneyplus://search?q=${query}`,             fallback: `https://www.disneyplus.com/search?q=${query}` },
    { id: 'apple_tv', brand: 'apple_tv', label: 'Apple TV+',url: `com.apple.tv://search?query=${query}`,       fallback: `https://tv.apple.com/search?term=${query}` },
  ];
}

export function getShoppingActions(subject) {
  if (!subject) return [];
  const query = encodeURIComponent(subject);
  return [
    { id: 'amazon',  brand: 'amazon',  label: 'Amazon',  url: `com.amazon.mobile.shopping://search?k=${query}`, fallback: `https://www.amazon.com/s?k=${query}` },
    { id: 'target',  brand: 'target',  label: 'Target',  url: `https://www.target.com/s?searchTerm=${query}`,   fallback: `https://www.target.com/s?searchTerm=${query}` },
    { id: 'walmart', brand: 'walmart', label: 'Walmart', url: `https://www.walmart.com/search?q=${query}`,      fallback: `https://www.walmart.com/search?q=${query}` },
  ];
}
