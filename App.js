import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet, Text, View, FlatList, ScrollView,
  TouchableOpacity, Image, SafeAreaView,
  Alert, StatusBar, Linking, Modal, TextInput, Share,
  KeyboardAvoidingView, Platform, Dimensions
} from 'react-native';

import * as MediaLibrary from 'expo-media-library';
import { Video, ResizeMode, Audio } from 'expo-av';
import * as ImageManipulator from 'expo-image-manipulator';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { classifyScreenshot, enrichResult, getMusicActions, getMovieActions, getShoppingActions } from './lib/api';
import { saveResults, loadResults, savePrefs, loadPrefs, addToLists, forceAddToList, loadLists, saveLists, removeFromList } from './lib/storage';
import { track, initMixpanel, Events } from './lib/analytics';
import { initRevenueCat, getProStatus, getUsageIdentity, getOfferings, purchasePackage, restorePurchases } from './lib/revenueCat';

// Responsive scaling — base design is 390px wide (iPhone 14/15)
const BASE_WIDTH = 390;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = (size) => Math.round(size * (SCREEN_WIDTH / BASE_WIDTH));

const CAT_ICONS = {
  music:    require('./assets/SB_ICONS/icon-music.png'),
  movies:   require('./assets/SB_ICONS/icon-film.png'),
  dining:   require('./assets/SB_ICONS/icon-dining.png'),
  bars:     require('./assets/SB_ICONS/icon-bars.png'),
  events:   require('./assets/SB_ICONS/icon-events.png'),
  jobs:     require('./assets/SB_ICONS/icon-jobs.png'),
  shopping: require('./assets/SB_ICONS/icon-shopping.png'),
  other:    require('./assets/SB_ICONS/icon-other.png'),
};

const CATEGORIES = [
  { id: 'music',    label: 'Music',    icon: '🎵', color: '#00C7BE' },
  { id: 'movies',   label: 'Movies',   icon: '🎬', color: '#AF52DE' },
  { id: 'dining',   label: 'Dining',   icon: '🍽️', color: '#FF9500' },
  { id: 'bars',     label: 'Bars',     icon: '🍸', color: '#FF2D55' },
  { id: 'events',   label: 'Events',   icon: '🎟️', color: '#5856D6' },
  { id: 'jobs',     label: 'Jobs',     icon: '💼', color: '#007AFF' },
  { id: 'shopping', label: 'Shopping', icon: '🛍️', color: '#34C759' },
  { id: 'other',    label: 'Other',    icon: '📦', color: '#8E8E93' },
];

const BRAND = {
  spotify:      { bg: '#1DB954', text: '#fff' },  // confirmed correct
  apple_music:  { bg: '#000000', text: '#fff', border: '#fff' },
  netflix:      { bg: '#E50914', text: '#fff' },
  apple_tv:     { bg: '#1C1C1E', text: '#fff', border: '#555' },
  hulu:         { bg: '#1CE783', text: '#000' },
  max:          { bg: '#002BE7', text: '#fff' },
  disney:       { bg: '#113CCF', text: '#fff' },
  ticketmaster: { bg: '#026CDF', text: '#fff' },
  stubhub:      { bg: '#E03A3E', text: '#fff' },
  eventbrite:   { bg: '#F05537', text: '#fff' },
  resy:         { bg: '#E03A3E', text: '#fff' },
  opentable:    { bg: '#DA3743', text: '#fff' },
  yelp:         { bg: '#FF1A1A', text: '#fff' },
  google_maps:  { bg: '#4285F4', text: '#fff' },
  apple_maps:   { bg: '#1C1C1E', text: '#fff', border: '#555' },
  waze:         { bg: '#33CCFF', text: '#000' },
  linkedin:     { bg: '#0A66C2', text: '#fff' },
  indeed:       { bg: '#2164F3', text: '#fff' },
  glassdoor:    { bg: '#0CAA41', text: '#fff' },
  amazon:       { bg: '#FF9900', text: '#000' },
  target:       { bg: '#CC0000', text: '#fff' },
  google:       { bg: '#4285F4', text: '#fff' },
  walmart:      { bg: '#0071CE', text: '#fff' },
};


const FREE_SCAN_LIMIT = 3;

const STREAMING_SERVICES = [
  { id: 'netflix',   label: 'Netflix',   icon: '📺' },
  { id: 'max',       label: 'Max',       icon: '🎬' },
  { id: 'hulu',      label: 'Hulu',      icon: '🟢' },
  { id: 'disney',    label: 'Disney+',   icon: '✨' },
  { id: 'apple_tv',  label: 'Apple TV+', icon: '🍎' },
];

async function extractTextFromImage(uri) {
  try { return (await TextRecognition.recognize(uri)).text || ''; }
  catch { return ''; }
}
async function compressImage(uri) {
  try {
    const r = await ImageManipulator.manipulateAsync(
      uri, [{ resize: { width: 1080 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );
    return r.uri;
  } catch { return uri; }
}

const ActionBtn = ({ action, color, onPress }) => {
  if (!action) return null;
  const open = () => {
    if (onPress) onPress();
    Linking.openURL(action.url).catch(() => Linking.openURL(action.fallback));
  };
  return (
    <TouchableOpacity style={[styles.actionBtn, { borderColor: color }]} onPress={open}>
      <Text style={[styles.actionBtnText, { color }]}>{action.label}</Text>
    </TouchableOpacity>
  );
};

// ── Manual Sort Modal ──────────────────────────────────────────────────────────
// Shown on cards where auto-sort failed (no category or 'other').
// User picks a destination folder; onSelect(categoryId) writes the assignment.
const ManualSortModal = ({ visible, onSelect, onDismiss }) => (
  <Modal visible={visible} animationType="slide" transparent onRequestClose={onDismiss}>
    <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onDismiss}>
      <TouchableOpacity style={styles.modalBox} activeOpacity={1}>
        <TouchableOpacity
          onPress={onDismiss}
          style={{ alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 2, marginBottom: 12 }}
        >
          <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600' }}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.modalTitle}>Sort to Folder</Text>
        <Text style={styles.modalSub}>Pick a destination for this screenshot</Text>
        {CATEGORIES.filter(c => c.id !== 'other').map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={styles.sortFolderRow}
            onPress={() => onSelect(cat.id)}
          >
            <Text style={styles.sortFolderIcon}>{cat.icon}</Text>
            <Text style={[styles.sortFolderLabel, { color: cat.color }]}>{cat.label}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.sortFolderRow} onPress={() => onSelect('other')}>
          <Text style={styles.sortFolderIcon}>📦</Text>
          <Text style={[styles.sortFolderLabel, { color: '#8E8E93' }]}>Other</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ marginTop: 16, paddingVertical: 14, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#222' }}
          onPress={onDismiss}
        >
          <Text style={{ color: '#555', fontSize: 15, fontWeight: '600' }}>Cancel</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </TouchableOpacity>
  </Modal>
);

// ── Image Review Modal ────────────────────────────────────────────────────────
// Fullscreen viewer for a screenshot. Shows:
//   - Full image (tap anywhere on image to dismiss)
//   - Scrollable read-only metadata panel below
//   - Edit Info button → opens EditMetadataModal
//   - Share button → iOS share sheet
const ImageReviewModal = ({ visible, item, onDismiss, onEditInfo, onMoveToOther }) => {
  if (!item) return null;
  const uri   = item.localUri || item.uri;
  const enr   = item.enrichment || {};
  const title = enr.track_name || enr.title || item.subject || '—';
  const sub   = enr.artist_name || item.artist || enr.year || item.context || '';
  const notes = item.extractedText || '';

  const handleShare = async () => {
    try {
      await Share.share(
        { message: `${title}${uri ? '\n' + uri : ''}`, url: uri || undefined, title },
        { dialogTitle: 'Share or open in another app' }
      );
    } catch (e) {
      Alert.alert('Could not share', e.message);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onDismiss}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#222' }}>
          <TouchableOpacity onPress={onDismiss} style={{ paddingHorizontal: 4 }}>
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600' }}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={{ color: '#888', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>Original</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView contentContainerStyle={{ flexGrow: 1 }} bounces={false}>
          {/* Full image */}
          {uri ? (
            <Image
              source={{ uri }}
              style={{ width: '100%', height: 420 }}
              resizeMode="contain"
            />
          ) : (
            <View style={{ width: '100%', height: 420, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#555', fontSize: 15 }}>No image available</Text>
            </View>
          )}

          {/* Metadata panel — read-only, scrollable */}
          <View style={{ padding: 20, paddingBottom: 40 }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 4 }}>{title}</Text>
            {!!sub && <Text style={{ color: '#888', fontSize: 14, marginBottom: 16 }}>{sub}</Text>}

            <Text style={{ color: '#555', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Extracted Text</Text>
            <View style={{ backgroundColor: '#1C1C1E', borderRadius: 10, padding: 12, marginBottom: 24, borderWidth: 1, borderColor: '#2C2C2E' }}>
              <Text style={{ color: notes ? '#ccc' : '#444', fontSize: 14, lineHeight: 22 }}>
                {notes || 'No extracted text'}
              </Text>
            </View>

            {/* Action buttons */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#AF52DE', borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' }}
                onPress={onEditInfo}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15, textAlign: 'center' }}>Edit Info</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#000', borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' }}
                onPress={handleShare}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15, textAlign: 'center' }}>↗ Share</Text>
              </TouchableOpacity>
              {onMoveToOther && item?.category !== 'other' && (
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: '#007AFF', borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' }}
                  onPress={onMoveToOther}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15, textAlign: 'center' }}>Move to Other</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

// ── Edit Metadata Modal ────────────────────────────────────────────────────────
// Opened via Edit Info inside ImageReviewModal. Editable fields only.
const EditMetadataModal = ({ visible, item, onSave, onDismiss }) => {
  const [subject, setSubject] = useState('');
  const [artist,  setArtist]  = useState('');
  const [notes,   setNotes]   = useState('');

  useEffect(() => {
    if (visible && item) {
      setSubject(item.subject || '');
      setArtist(item.artist || item.enrichment?.artist_name || '');
      setNotes(item.extractedText || '');
    }
  }, [visible, item]);

  const handleSave = () => {
    onSave({ subject: subject.trim(), artist: artist.trim(), extractedText: notes.trim() });
  };

  if (!item) return null;
  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onDismiss}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#222' }}>
          <TouchableOpacity onPress={onDismiss} style={{ paddingHorizontal: 4 }}>
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600' }}>Cancel</Text>
          </TouchableOpacity>
          <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>Edit Info</Text>
          <TouchableOpacity onPress={handleSave} style={{ paddingHorizontal: 4 }}>
            <Text style={{ color: '#AF52DE', fontSize: 17, fontWeight: '700' }}>Save</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 80 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.metaFieldLabel}>Subject / Title</Text>
            <TextInput
              style={[styles.metaInput, { marginBottom: 16 }]}
              value={subject}
              onChangeText={setSubject}
              placeholderTextColor="#555"
              placeholder="e.g. Tame Impala – The Less I Know The Better"
              returnKeyType="next"
            />

            <Text style={styles.metaFieldLabel}>Artist / Author</Text>
            <TextInput
              style={[styles.metaInput, { marginBottom: 16 }]}
              value={artist}
              onChangeText={setArtist}
              placeholderTextColor="#555"
              placeholder="e.g. Tame Impala"
              returnKeyType="next"
            />

            <Text style={styles.metaFieldLabel}>Notes / Extracted Text</Text>
            <TextInput
              style={[styles.metaInput, { height: 220, textAlignVertical: 'top', paddingTop: 10 }]}
              value={notes}
              onChangeText={setNotes}
              placeholderTextColor="#555"
              placeholder="Additional context…"
              multiline
              scrollEnabled
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const DetailCard = ({ item, onMusicTap, onUpdateItem, onOpenImage, onSaveItem, onGoToLibrary, alreadyInLibrary = false, onProAction }) => {
  const [showSortModal,   setShowSortModal]   = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showEditModal,   setShowEditModal]   = useState(false);

  const needsManualSort = !item.category || item.category === 'other';

  const handleManualSort = (categoryId) => {
    setShowSortModal(false);
    const destCat = CATEGORIES.find(c => c.id === categoryId);
    onUpdateItem && onUpdateItem({ ...item, category: categoryId }, destCat);
  };

  const handleMetadataSave = (updates) => {
    setShowEditModal(false);
    onUpdateItem && onUpdateItem({ ...item, ...updates });
  };

  const cat     = CATEGORIES.find(c => c.id === (item.category || 'other'));
  const enr     = item.enrichment || {};
  const enrichable = item.category === 'music' || item.category === 'movies';
  const enriching  = enrichable && item.enrichment === null;
  const musicActions = item.category === 'music'  ? getMusicActions(enr)  : [];
  const movieActions = item.category === 'movies' ? getMovieActions(enr)  : [];
  const shoppingActions = item.category === 'shopping' ? getShoppingActions(item.subject) : [];

  const diningActions = item.category === 'dining' ? [
    { id: 'resy',       brand: 'resy',        label: 'Resy',       url: `https://resy.com/search?query=${encodeURIComponent(item.subject || '')}`,       fallback: 'https://resy.com' },
    { id: 'opentable',  brand: 'opentable',   label: 'OpenTable',  url: `https://www.opentable.com/s/?term=${encodeURIComponent(item.subject || '')}`,    fallback: 'https://www.opentable.com' },
  ] : [];

  const eventActions = item.category === 'events' ? [
    { id: 'ticketmaster', brand: 'ticketmaster', label: 'Ticketmaster', url: `https://www.ticketmaster.com/search?q=${encodeURIComponent(item.subject || '')}`,  fallback: 'https://www.ticketmaster.com' },
    { id: 'stubhub',      brand: 'stubhub',      label: 'StubHub',      url: `https://www.stubhub.com/find/s/?q=${encodeURIComponent(item.subject || '')}`,       fallback: 'https://www.stubhub.com' },
    { id: 'eventbrite',   brand: 'eventbrite',   label: 'Eventbrite',      url: `https://www.eventbrite.com/d/online/${encodeURIComponent(item.subject || '')}/`,     fallback: 'https://www.eventbrite.com' },
  ] : [];

  const jobActions = item.category === 'jobs' ? [
    { id: 'linkedin',   brand: 'linkedin',    label: 'LinkedIn',  url: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(item.subject || '')}`, fallback: 'https://www.linkedin.com/jobs' },
    { id: 'indeed',     brand: 'indeed',      label: 'Indeed',   url: `https://www.indeed.com/q-${encodeURIComponent(item.subject || '')}-jobs.html`,             fallback: 'https://www.indeed.com' },
    { id: 'glassdoor',  brand: 'glassdoor',   label: 'Glassdoor',  url: `https://www.glassdoor.com/Job/jobs.htm?suggestCount=0&keyword=${encodeURIComponent(item.subject || '')}`, fallback: 'https://www.glassdoor.com' },
  ] : [];

  const barActions = item.category === 'bars' ? [
    { id: 'yelp',       brand: 'yelp',        label: 'Yelp',         url: `https://www.yelp.com/search?find_desc=${encodeURIComponent(item.subject || '')}&find_loc=near+me`, fallback: 'https://www.yelp.com' },
    { id: 'gmaps',      brand: 'google_maps', label: 'Google Maps',  url: `https://maps.google.com/?q=${encodeURIComponent(item.subject || '')}`,                            fallback: 'https://maps.google.com' },
  ] : [];
  const artwork = enr.artwork_url || (enr.poster_url ? `https://image.tmdb.org/t/p/w200${enr.poster_url}` : null);

  return (
    <>
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: cat?.color || '#666' }]}
      onPress={() => setShowReviewModal(true)}
      activeOpacity={0.85}
    >
      {(artwork || item.localUri || item.uri)
        ? <Image source={{ uri: artwork || item.localUri || item.uri }} style={styles.thumb} />
        : <View style={[styles.thumb, { backgroundColor: cat?.color || '#333', alignItems: 'center', justifyContent: 'center' }]}><Text style={{ fontSize: 24 }}>{cat?.icon || '📦'}</Text></View>
      }
      <View style={styles.textBlock}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[styles.cardTitle, { flex: 1 }]} numberOfLines={1}>
            {enr.track_name || enr.title || item.subject || 'Unidentified'}
          </Text>
          {alreadyInLibrary ? (
            <TouchableOpacity
              style={[styles.libBadge, { backgroundColor: '#2A1A3E', borderWidth: 1, borderColor: '#AF52DE' }]}
              onPress={(e) => { e.stopPropagation && e.stopPropagation(); onGoToLibrary && onGoToLibrary(); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.libBadgeText, { color: '#AF52DE' }]}>In Library</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.libBadge, { backgroundColor: '#0A1F3D', borderWidth: 1, borderColor: '#007AFF' }]}
              onPress={(e) => { e.stopPropagation && e.stopPropagation(); onSaveItem && onSaveItem(); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.libBadgeText, { color: '#007AFF' }]}>New</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.cardSubtitle} numberOfLines={1}>
          {enr.artist_name || enr.year || item.artist || item.extractedText?.slice(0, 60) || ''}
        </Text>
        {item.category === 'music' && enr.genre ? <Text style={styles.cardMeta}>{enr.genre}</Text> : null}
        <View style={styles.actionsRow}>
          {enriching ? (
            <Text style={styles.enrichingLabel}>⏳ finding info…</Text>
          ) : item.category === 'music' && musicActions.length > 0 ? (
            musicActions.map(a => {
              const b = BRAND[a.brand] || { bg: '#2C2C2E', text: '#fff' };
              return (
                <TouchableOpacity key={a.id}
                  style={[styles.brandBtn, { backgroundColor: b.bg, borderColor: b.border || 'transparent' }]}
                  onPress={() => { if (onProAction) { onProAction(); return; } onMusicTap && onMusicTap(a); Linking.openURL(a.url).catch(() => Linking.openURL(a.fallback)); }}>
                  <Text style={[styles.brandBtnText, { color: b.text }]}>{a.label}</Text>
                </TouchableOpacity>
              );
            })
          ) : item.category === 'movies' && movieActions.length > 0 ? (
            movieActions.map(a => {
              const b = BRAND[a.brand] || { bg: '#2C2C2E', text: '#fff' };
              return (
                <TouchableOpacity key={a.id}
                  style={[styles.brandBtn, { backgroundColor: b.bg, borderColor: b.border || 'transparent' }]}
                  onPress={() => { if (onProAction) { onProAction(); return; } Linking.openURL(a.url).catch(() => Linking.openURL(a.fallback)); }}>
                  <Text style={[styles.brandBtnText, { color: b.text }]}>{a.label}</Text>
                </TouchableOpacity>
              );
            })
          ) : shoppingActions.length > 0 ? (
            <>
              <Text style={styles.serviceGroupLabel}>BUY</Text>
              {shoppingActions.map(a => {
                const b = BRAND[a.brand] || {};
                return (
                  <TouchableOpacity key={a.id}
                    style={[styles.brandBtn, { backgroundColor: b.bg || '#2C2C2E', borderColor: b.border || 'transparent' }]}
                    onPress={() => { if (onProAction) { onProAction(); return; } Linking.openURL(a.url).catch(() => Linking.openURL(a.fallback)); }}>
                    <Text style={[styles.brandBtnText, { color: b.text || '#fff' }]}>{a.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </>
          ) : diningActions.length > 0 ? (
            <>
              <Text style={styles.serviceGroupLabel}>RESERVE</Text>
              {diningActions.map(a => {
                const b = BRAND[a.brand] || {};
                return (
                  <TouchableOpacity key={a.id}
                    style={[styles.brandBtn, { backgroundColor: b.bg || '#2C2C2E', borderColor: b.border || 'transparent' }]}
                    onPress={() => { if (onProAction) { onProAction(); return; } Linking.openURL(a.url).catch(() => Linking.openURL(a.fallback)); }}>
                    <Text style={[styles.brandBtnText, { color: b.text || '#fff' }]}>{a.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </>
          ) : eventActions.length > 0 ? (
            <>
              <Text style={styles.serviceGroupLabel}>BUY TICKETS</Text>
              {eventActions.map(a => {
                const b = BRAND[a.brand] || {};
                return (
                  <TouchableOpacity key={a.id}
                    style={[styles.brandBtn, { backgroundColor: b.bg || '#2C2C2E', borderColor: b.border || 'transparent' }]}
                    onPress={() => { if (onProAction) { onProAction(); return; } Linking.openURL(a.url).catch(() => Linking.openURL(a.fallback)); }}>
                    <Text style={[styles.brandBtnText, { color: b.text || '#fff' }]}>{a.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </>
          ) : jobActions.length > 0 ? (
            <>
              <Text style={styles.serviceGroupLabel}>APPLY</Text>
              {jobActions.map(a => {
                const b = BRAND[a.brand] || {};
                return (
                  <TouchableOpacity key={a.id}
                    style={[styles.brandBtn, { backgroundColor: b.bg || '#2C2C2E', borderColor: b.border || 'transparent' }]}
                    onPress={() => { if (onProAction) { onProAction(); return; } Linking.openURL(a.url).catch(() => Linking.openURL(a.fallback)); }}>
                    <Text style={[styles.brandBtnText, { color: b.text || '#fff' }]}>{a.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </>
          ) : barActions.length > 0 ? (
            <>
              <Text style={styles.serviceGroupLabel}>FIND</Text>
              {barActions.map(a => {
                const b = BRAND[a.brand] || {};
                return (
                  <TouchableOpacity key={a.id}
                    style={[styles.brandBtn, { backgroundColor: b.bg || '#2C2C2E', borderColor: b.border || 'transparent' }]}
                    onPress={() => { if (onProAction) { onProAction(); return; } Linking.openURL(a.url).catch(() => Linking.openURL(a.fallback)); }}>
                    <Text style={[styles.brandBtnText, { color: b.text || '#fff' }]}>{a.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </>
          ) : enrichable && item.enrichment !== null ? (
            <Text style={styles.noMatchLabel}>No match found</Text>
          ) : null}
        </View>

        {/* ── Card footer ── */}
        {/* Other: Open Original (→ review screen) + Sort Manually */}
        {/* Non-Other: Open Original (→ review screen) + Edit Info */}
        <View style={styles.cardFooterRow}>

          {needsManualSort && (
            <TouchableOpacity style={[styles.cardFooterBtn, styles.cardFooterBtnSort]} onPress={() => setShowSortModal(true)}>
              <Text style={[styles.cardFooterBtnText, { color: '#AF52DE' }]}>Sort Manually</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      </TouchableOpacity>

      <ManualSortModal
        visible={showSortModal}
        onSelect={handleManualSort}
        onDismiss={() => setShowSortModal(false)}
      />
      <ImageReviewModal
        visible={showReviewModal}
        item={item}
        onDismiss={() => setShowReviewModal(false)}
        onEditInfo={() => { setShowReviewModal(false); setShowEditModal(true); }}
        onMoveToOther={() => {
          setShowReviewModal(false);
          const moved = { ...item, category: 'other' };
          onUpdateItem && onUpdateItem(moved, CATEGORIES.find(c => c.id === 'other'));
        }}
      />
      <EditMetadataModal
        visible={showEditModal}
        item={item}
        onSave={(updates) => { handleMetadataSave(updates); setShowEditModal(false); }}
        onDismiss={() => setShowEditModal(false)}
      />
    </>
  );
};

// Chips always blank on open
const ServicePickerModal = ({ visible, onDone, onDismiss }) => {
  const [musicApp,  setMusicApp]  = useState(null);
  const [streaming, setStreaming] = useState([]);
  useEffect(() => { if (visible) { setMusicApp(null); setStreaming([]); } }, [visible]);
  const toggleMusic  = (id) => setMusicApp(prev => prev === id ? null : id);
  const toggleStream = (id) =>
    setStreaming(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const finish = async () => {
    const p = { musicApp, streaming, onboarded: true };
    await savePrefs(p);
    onDone(p);
  };
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onDismiss}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onDismiss}>
        <TouchableOpacity style={styles.modalBox} activeOpacity={1}>
          <Image source={require('./assets/screenbot-mascot-BOT.png')} style={styles.modalMascot} resizeMode="contain" />
          <Text style={styles.modalTitle}>We found your stuff. 🎯</Text>
          <Text style={styles.modalSub}>Where should we send it?</Text>
          <Text style={styles.modalSection}>Music</Text>
          <View style={styles.chipRow}>
            {[{ id: 'spotify', brand: 'spotify', label: 'Spotify' }, { id: 'apple_music', label: 'Apple Music' }].map(s => (
              <TouchableOpacity key={s.id} style={[styles.chip, musicApp === s.id && styles.chipSelected]} onPress={() => toggleMusic(s.id)}>
                <Text style={[styles.chipText, musicApp === s.id && styles.chipTextSelected]}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.modalSection}>Streaming Services</Text>
          <View style={styles.chipRow}>
            {STREAMING_SERVICES.map(s => (
              <TouchableOpacity key={s.id} style={[styles.chip, streaming.includes(s.id) && styles.chipSelected]} onPress={() => toggleStream(s.id)}>
                <Text style={[styles.chipText, streaming.includes(s.id) && styles.chipTextSelected]}>{s.icon} {s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.doneBtn} onPress={finish}>
            <Text style={styles.doneBtnText}>Let's Go →</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

// ── Paywall Modal ─────────────────────────────────────────────────────────────
const PaywallModal = ({ visible, onDismiss, onPurchase }) => {
  const annualMonthly = (39.99 / 12).toFixed(2);
  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onDismiss}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1C1C1E' }}>
          <TouchableOpacity onPress={onDismiss} style={{ paddingHorizontal: 4 }}>
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600' }}>‹ Back</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 28, paddingBottom: 48, alignItems: 'center' }}>

          {/* Header */}
          <Image source={require('./assets/SB_BOT_ICON_1024_OFFICIAL.png')} style={{ width: 90, height: 90, marginBottom: 12 }} resizeMode="contain" />
          <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800', textAlign: 'center', marginBottom: 8 }}>
            Unlock SCREENBot Pro
          </Text>
          <Text style={{ color: '#888', fontSize: 15, textAlign: 'center', marginBottom: 24, lineHeight: 22 }}>
            Hundreds of scans a month, per-item actions, and organized lists.
          </Text>

          {/* Feature list */}
          {[
            'Up to 650 scans/month (Annual: 7,800/year)',
            'Tap any result to search Spotify, Apple Music, Netflix, Amazon & more — opens directly in the app so you can act on it',
            'Save results to categorized lists',
            'Edit info on any screenshot',
          ].map((f, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 12 }}>
              <Text style={{ color: '#AF52DE', fontWeight: '800', fontSize: 16, marginRight: 10 }}>✓</Text>
              <Text style={{ color: '#ccc', fontSize: 15 }}>{f}</Text>
            </View>
          ))}

          <View style={{ height: 1, backgroundColor: '#222', width: '100%', marginVertical: 24 }} />

          {/* Annual — highlighted */}
          <TouchableOpacity
            style={{ width: '100%', backgroundColor: '#AF52DE', borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginBottom: 12, borderWidth: 2, borderColor: '#CF8EFF' }}
            onPress={() => onPurchase('annual')}
          >
            <View style={{ backgroundColor: '#CF8EFF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 6 }}>
              <Text style={{ color: '#000', fontSize: 11, fontWeight: '800' }}>BEST VALUE — SAVE 33%</Text>
            </View>
            <Text style={{ color: '#fff', fontSize: 19, fontWeight: '800' }}>Pro Annual — $39.99/yr</Text>
            <Text style={{ color: '#CF8EFF', fontSize: 13, marginTop: 3 }}>${annualMonthly}/month, billed annually</Text>
          </TouchableOpacity>

          {/* Monthly */}
          <TouchableOpacity
            style={{ width: '100%', backgroundColor: '#1C1C1E', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: '#AF52DE' }}
            onPress={() => onPurchase('monthly')}
          >
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>Pro Monthly — $4.99/mo</Text>
            <Text style={{ color: '#888', fontSize: 12, marginTop: 3 }}>Cancel anytime</Text>
          </TouchableOpacity>

          {/* Legal disclosure — required by Apple */}
          <Text style={{ color: '#888', fontSize: 11, textAlign: 'center', marginBottom: 20, lineHeight: 16, paddingHorizontal: 8 }}>
            Subscriptions auto-renew unless cancelled at least 24 hours before the end of the current period. Manage or cancel anytime in App Store Settings.
          </Text>

          {/* Restore + dismiss */}
          <TouchableOpacity onPress={() => onPurchase('restore')} style={{ marginBottom: 16 }}>
            <Text style={{ color: '#888', fontSize: 13, textDecorationLine: 'underline' }}>Restore Purchases</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDismiss} style={{ marginBottom: 12 }}>
            <Text style={{ color: '#888', fontSize: 13 }}>Maybe later</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 16, justifyContent: 'center' }}>
            <TouchableOpacity onPress={() => Linking.openURL('https://supercreativepeople.com/screenbot/privacy')}>
              <Text style={{ color: '#444', fontSize: 11, textDecorationLine: 'underline' }}>Privacy Policy</Text>
            </TouchableOpacity>
            <Text style={{ color: '#333', fontSize: 11 }}>·</Text>
            <TouchableOpacity onPress={() => Linking.openURL('https://supercreativepeople.com/screenbot/terms')}>
              <Text style={{ color: '#444', fontSize: 11, textDecorationLine: 'underline' }}>Terms of Use</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const GearMenu = ({ visible, onClose, onActionButtons, onSortResults, onScanAgain, onMyLists, onUpgrade, isPro }) => (
  <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
    <TouchableOpacity style={styles.gearOverlay} activeOpacity={1} onPress={onClose}>
      <View style={styles.gearMenu}>
        <TouchableOpacity style={styles.gearItem} onPress={() => { onClose(); onMyLists(); }}>
          <Text style={styles.gearItemText}>My Lists</Text>
        </TouchableOpacity>
        <View style={styles.gearDivider} />
        <TouchableOpacity style={styles.gearItem} onPress={() => { onClose(); onScanAgain(); }}>
          <Text style={styles.gearItemText}>Scan Again</Text>
        </TouchableOpacity>
        <View style={styles.gearDivider} />
        {!isPro && (
          <>
            <TouchableOpacity style={styles.gearItem} onPress={() => { onClose(); onUpgrade(); }}>
              <Text style={[styles.gearItemText, { color: '#AF52DE' }]}>⚡ Upgrade to Pro</Text>
            </TouchableOpacity>
            <View style={styles.gearDivider} />
          </>
        )}
        <TouchableOpacity style={styles.gearItem} onPress={() => { onClose(); Linking.openURL('https://supercreativepeople.com/screenbot/privacy'); }}>
          <Text style={styles.gearItemText}>Privacy Policy</Text>
        </TouchableOpacity>
        <View style={styles.gearDivider} />
        <TouchableOpacity style={styles.gearItem} onPress={() => { onClose(); Linking.openURL('https://supercreativepeople.com/screenbot/terms'); }}>
          <Text style={styles.gearItemText}>Terms of Use</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  </Modal>
);

// Confirmation toast
const Toast = ({ message, visible }) => {
  if (!visible) return null;
  return (
    <View style={styles.toast}>
      <Text style={styles.toastText}>{message}</Text>
    </View>
  );
};

export default function App() {
  // Configure audio session so video plays with sound
  React.useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
    });
  }, []);

  const [screen,           setScreen]           = useState('welcome');
  const [processed,        setProcessed]        = useState([]);
  const [sessionScanned,   setSessionScanned]   = useState(false); // true after first scan this session
  const [welcomeAnimDone,  setWelcomeAnimDone]  = useState(__DEV__ ? true : false); // skip animation in dev/Expo Go
  const scanCursorRef = React.useRef(null);  // endCursor for next-50 pagination (ref avoids stale closure)
  const [selectedImage,    setSelectedImage]    = useState(null);  // uri for fullscreen preview
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [prefs,            setPrefs]            = useState(null);
  const [showPicker,       setShowPicker]       = useState(false);
  const [showGear,         setShowGear]         = useState(false);
  const [gleanCounts,      setGleanCounts]      = useState({});
  const [actionStep,       setActionStep]       = useState(null); // 'music' | 'movies' | null
  const [musicAppChoice,   setMusicAppChoice]   = useState(null); // selected in action wizard
  const [selectedStreams,  setSelectedStreams]  = useState({}); // movieId -> serviceId
  const [lists,            setLists]            = useState({}); // category -> [items]
  const [scanSummary,      setScanSummary]      = useState(null); // { added: {music:6, movies:12} }
  const [scanDuplicates,   setScanDuplicates]   = useState({});  // { category: [items] } skipped as dupes
  const [scanNewIds,       setScanNewIds]       = useState(new Set()); // IDs of items added as new this scan
  const [addAllNewDone,    setAddAllNewDone]    = useState(false);     // grays out Add All New after tap
  const [activeList,       setActiveList]       = useState(null); // category string for list detail
  const [listOrigin,       setListOrigin]       = useState('results'); // where back btn on list screen goes
  const [listScrollTarget, setListScrollTarget] = useState(null); // item id to scroll to on list open
  const [listHighlightId,  setListHighlightId]  = useState(null); // item id to keep highlighted in list
  const listFlatRef = React.useRef(null);
  const [toast,            setToast]            = useState(null);
  const [selectedListItem, setSelectedListItem] = useState(null);
  const [screenshotsProcessed, setScreenshotsProcessed] = useState(0); // lifetime count — NOT a storage/bytes claim; nothing is deleted or offloaded today
  const scanVideoPositionRef = React.useRef(0); // tracks video position without causing re-renders
  const scanVideoRef = React.useRef(null);   // ref to stop scan video when gleaning starts
  const gleanVideoRef = React.useRef(null);  // ref to explicitly play gleaning video on ready
  const [scanSessionCount,  setScanSessionCount]  = useState(0);    // how many scans this app session // lifetime MB freed across all scans
  const [isPro,            setIsPro]            = useState(false); // Pro subscription status — driven by RevenueCat
  const [scanCount,        setScanCount]        = useState(0);     // scans used this month
  const [showPaywall,      setShowPaywall]      = useState(false); // paywall modal // item for ImageReviewModal from list screen
  const [editingListItem,  setEditingListItem]  = useState(null); // item for EditMetadataModal from list screen

  // In dev: auto-resume to results if data exists (avoids re-scanning on every hot reload)
  // In production: always land on welcome
  useEffect(() => {
    initMixpanel().then(() => track(Events.APP_OPENED));
    initRevenueCat().then(() => getProStatus().then(pro => setIsPro(pro))).catch(e => console.warn('[RC] init failed:', e));
    // Allow audio to play through speaker regardless of silent switch
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });
  }, []);

  useEffect(() => {
    (async () => {
      const [saved, p, savedLists] = await Promise.all([loadResults(), loadPrefs(), loadLists()]);
      if (saved?.length) {
        setProcessed(saved);
        // setScreen auto-resume disabled — always land on welcome

        // One-time backfill: if processed has 'other' items but lists.other is empty,
        // migrate them in so Saved Lists reflects reality without requiring a rescan.
        const mergedLists = savedLists || {};
        const otherInProcessed = saved.filter(i => (i.category || 'other') === 'other');
        if (otherInProcessed.length > 0 && !(mergedLists.other?.length > 0)) {
          const { lists: backfilled } = await addToLists(otherInProcessed);
          setLists(backfilled);
        } else {
          if (savedLists) setLists(savedLists);
        }
      } else {
        if (savedLists) setLists(savedLists);
      }
      if (p) {
        setPrefs(p);
        if (p.screenshotsProcessed) setScreenshotsProcessed(p.screenshotsProcessed);
        // isPro is now driven by RevenueCat — see initRevenueCat below
        // Reset scan count if we're in a new calendar month
        const now = new Date();
        const monthKey = `${now.getFullYear()}-${now.getMonth()}`;
        if (p.scanMonthKey === monthKey) {
          setScanCount(p.scanCount || 0);
        } else {
          // New month — reset count
          setScanCount(0);
          savePrefs({ ...p, scanCount: 0, scanMonthKey: monthKey });
        }
      }
    })();
  }, []);

const getOtherActions = (item) => {
  const subj = (item.subject || '').toLowerCase();
  const ctx  = (item.context || '').toLowerCase();
  const q    = encodeURIComponent(item.subject || '');
  if (ctx.includes('recipe') || subj.includes('recipe')) return [{ id: 'google',       brand: 'google',       label: 'Search', url: `https://www.google.com/search?q=${q}+recipe` }];
  if (ctx.includes('map') || ctx.includes('location') || ctx.includes('trail') || ctx.includes('park')) return [{ id: 'maps',    brand: 'apple_maps', label: 'Maps', url: `https://maps.google.com/?q=${q}` }];
  if (ctx.includes('ad') || ctx.includes('billboard') || ctx.includes('product')) return [{ id: 'google',       brand: 'google',       label: 'Search', url: `https://www.google.com/search?q=${q}` }, { id: 'amazon',       brand: 'amazon',       label: 'Amazon', url: `https://www.amazon.com/s?k=${q}` }];
  if (ctx.includes('social') || ctx.includes('tiktok') || ctx.includes('instagram') || ctx.includes('tweet')) return [{ id: 'google',       brand: 'google',       label: 'Search', url: `https://www.google.com/search?q=${q}` }];
  if (ctx.includes('article') || ctx.includes('news') || ctx.includes('blog')) return [{ id: 'google',       brand: 'google',       label: 'Search', url: `https://www.google.com/search?q=${q}` }];
  return [{ id: 'google', label: 'Google', url: `https://www.google.com/search?q=${q}` }];
};

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleActionFired = (category, currentPrefs) => {
    if (category === 'music') {
      if (currentPrefs?.musicApp === 'spotify') {
        showToast('✅ Added to SCREENBot playlist in Spotify');
      } else {
        showToast('✅ SCREENBot playlist updated in Apple Music');
      }
    } else if (category === 'movies') {
      showToast('✅ Opening in your streaming app…');
    }
  };

  const ensurePermission = async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission Required', 'Photo library access is needed.'); return false; }
    return true;
  };

  const classifyAsset = async (asset, identity) => {
    try {
      const info          = await MediaLibrary.getAssetInfoAsync(asset);
      const uri           = info.localUri || info.uri;
      const compressed    = await compressImage(uri);
      const extractedText = await extractTextFromImage(compressed);
      const data          = await classifyScreenshot(compressed, extractedText, identity);
      // Usage-cap hit (Aug 2026) — the backend returns type:"other" with a
      // cap_exceeded marker instead of an error, so surface it distinctly
      // rather than silently filing a fake "other" result.
      if (data.metadata?.context === 'cap_exceeded') {
        return { ...asset, capExceeded: true, _usage: data._usage || null };
      }
      const catRaw        = (data.type || 'other').toLowerCase();
      const cat           = CATEGORIES.some(c => c.id === catRaw) ? catRaw : 'other';
      return {
        ...asset, localUri: uri, category: cat,
        subject: data.metadata?.subject || null,
        artist:  data.metadata?.artist  || null,
        context: data.metadata?.context || null,
        extractedText, enrichment: null, _classifyData: data, _usage: data._usage || null,
      };
    } catch (e) { console.error("CLASSIFY_ERR", asset.id, e?.message || e); return { ...asset, category: 'other', subject: null, enrichment: null }; }
  };

  const enrichInBackground = async (items) => {
    const enrichable = items.filter(i => i.category === 'music' || i.category === 'movies');
    for (const item of enrichable) {
      if (!item._classifyData) continue;
      const enr = await enrichResult(item._classifyData);
      setProcessed(prev => {
        const updated = prev.map(p => p.id === item.id ? { ...p, enrichment: enr } : p);
        saveResults(updated);
        setGleanCounts(gc => ({ ...gc, [item.category]: (gc[item.category] || 0) + 1 }));
        return updated;
      });
    }
  };

  const runScan = useCallback(async () => {
    if (!(await ensurePermission())) return;
    // Gate: free tier limited to 3 scans/month
    if (!isPro && scanCount >= FREE_SCAN_LIMIT) {
      setShowPaywall(true);
      return;
    }
    track(Events.SCREENSHOT_UPLOADED, { trigger: 'scan_button' });
    // Pre-configure audio session immediately so video plays without delay
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });
    setSessionScanned(true);
    scanCursorRef.current = null; // reset cursor on manual scan
    // Odd scans (1,3,5…) start fresh; even scans (2,4,6…) resume from last position
    // scanSessionCount is 0-indexed before increment: 0=scan1, 1=scan2, 2=scan3, etc.
    // Reset when scanSessionCount is even (0,2,4…) → scan 1,3,5…
    if (scanSessionCount % 2 === 0) scanVideoPositionRef.current = 0;
    setScanSessionCount(prev => prev + 1);
    setScreen('scanning');
    setSelectedCategory(null);
    setProcessed([]);
    setGleanCounts({});
    setAddAllNewDone(false);
    // Target the Screenshots smart album directly
    let assets = [];
    try {
      const albums = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });
      const ssAlbum = albums.find(a => a.title === 'Screenshots');
      if (ssAlbum) {
        console.log('Screenshots album found, count:', ssAlbum.assetCount);
        const mediaOpts = { first: 50, mediaType: 'photo', album: ssAlbum, sortBy: [['creationTime', false]] };
        if (scanCursorRef.current) mediaOpts.after = scanCursorRef.current;
        const media = await MediaLibrary.getAssetsAsync(mediaOpts);
        assets = media.assets;
        scanCursorRef.current = media.hasNextPage ? media.endCursor : null;
        console.log('Assets loaded:', assets.length);
      } else {
        console.log('No Screenshots album found, falling back');
      }
    } catch (e) { console.log('Album error:', e.message); }
    // Fallback: all recent photos
    if (!assets.length) {
      const media = await MediaLibrary.getAssetsAsync({
        first: 50, mediaType: 'photo', sortBy: [['creationTime', false]],
      });
      assets = media.assets;
      console.log('Fallback assets:', assets.length);
    }
    const identity = await getUsageIdentity();
    const results = [];
    let capHit = null;
    for (let i = 0; i < assets.length; i += 3) {
      const chunk = await Promise.all(assets.slice(i, i + 3).map(a => classifyAsset(a, identity)));
      const hit = chunk.find(item => item.capExceeded);
      if (hit) { capHit = hit; break; } // stop spending the moment the cap is hit
      results.push(...chunk);
    }
    setProcessed(results);
    await saveResults(results);

    if (capHit) {
      const period = capHit._usage?.period === 'annual' ? 'annual' : 'monthly';
      Alert.alert(
        'Scan limit reached',
        `You've hit your ${period} scan limit for Pro. ${results.length ? `${results.length} screenshot${results.length !== 1 ? 's' : ''} were processed before the limit.` : ''} It resets automatically — check back soon.`
      );
      if (!results.length) { setScreen('welcome'); return; } // nothing to show — don't also fire the generic "no screenshots found" alert below
    } else {
      // Non-blocking heads-up once a user crosses 80% of their period budget,
      // so hitting the ceiling later isn't a surprise.
      const lastUsage = results.length ? results[results.length - 1]?._usage : null;
      if (lastUsage?.periodLimit && lastUsage.periodCount / lastUsage.periodLimit >= 0.8) {
        showToast(`You've used ${lastUsage.periodCount} of ${lastUsage.periodLimit} scans this ${lastUsage.period === 'annual' ? 'year' : 'month'}`);
      }
    }

    // If nothing was found at all, bounce back to welcome with a message
    if (!results.length) {
      Alert.alert('No screenshots found', 'We couldn\'t find a Screenshots album on your device. Try taking a screenshot first, then scan again.');
      setScreen('welcome');
      return;
    }

    setScreen('gleaning');
    if (scanVideoRef.current) {
      scanVideoRef.current.stopAsync().catch(() => {});
    }
    enrichInBackground(results);
    setTimeout(async () => {
      // Auto-save all results to in-app lists
      // Increment monthly scan count
      const now = new Date();
      const monthKey = `${now.getFullYear()}-${now.getMonth()}`;
      const newCount = scanCount + 1;
      setScanCount(newCount);
      savePrefs({ ...prefs, scanCount: newCount, scanMonthKey: monthKey });

      // Lifetime count of screenshots processed (honest count — no storage is actually freed today)
      setScreenshotsProcessed(prev => {
        const newTotal = prev + results.length;
        savePrefs({ ...prefs, screenshotsProcessed: newTotal });
        return newTotal;
      });

      const { lists: updatedLists, added, duplicates } = await addToLists(results);
      setLists(updatedLists);
      setScanDuplicates(duplicates || {});
      // Track which items were genuinely new this scan for badge display
      const newIds = new Set();
      const dupSubjects = new Set(
        Object.values(duplicates || {}).flat().map(i => (i.subject || '').toLowerCase())
      );
      results.forEach(i => {
        // New if: no subject (can't be a dupe), OR subject not found in duplicates
        if (!i.subject || !dupSubjects.has(i.subject.toLowerCase())) newIds.add(i.id);
      });
      setScanNewIds(newIds);
      const hasAdded = Object.keys(added).length > 0;
      const hasDupes = Object.keys(duplicates || {}).length > 0;
      if (hasAdded || hasDupes) {
        setScanSummary({ added });
        setScreen('summary');
      } else {
        setScreen('results');
      }
    }, 2500);
  }, []);

  const renderFolder = ({ item }) => {
    const count = processed.filter(p => (p.category || 'other') === item.id).length;
    return (
      <TouchableOpacity
        style={[styles.folder, { opacity: count ? 1 : 0.3, borderColor: item.color }]}
        disabled={!count}
        onPress={() => { setSelectedCategory(item.id); setScreen('category'); }}
      >
        <Image source={CAT_ICONS[item.id]} style={styles.folderIcon} resizeMode="contain" />
        <Text style={styles.folderLabel}>{item.label}</Text>
        <Text style={[styles.folderCount, { color: item.color }]}>{count}</Text>
      </TouchableOpacity>
    );
  };

  const renderResultTile = ({ item }) => {
    const count = processed.filter(p => (p.category || 'other') === item.id).length;
    if (!count) return null;
    // Use scanSummary.added for accurate new count — lists state may lag on first render
    const newCount = scanSummary?.added?.[item.id] || 0;
    const dupeCount = count - newCount;
    return (
      <TouchableOpacity
        style={[styles.resultTile, { borderColor: item.color }]}
        onPress={() => { setSelectedCategory(item.id); setScreen('category'); }}
      >
        <View style={styles.resultTileLeft}>
          <Image source={CAT_ICONS[item.id]} style={styles.resultTileIcon} resizeMode="contain" />
          <View>
            <Text style={styles.resultTileLabel}>{item.label}</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 2, alignItems: 'center' }}>
              {newCount > 0 && (
                <Text style={[styles.resultTileCount, { color: item.color }]}>{newCount} new</Text>
              )}
              {dupeCount > 0 && (
                <Text style={[styles.resultTileCount, { color: '#555' }]}>· {dupeCount} already in library</Text>
              )}
            </View>
          </View>
        </View>
        {newCount > 0 && (
          <View style={[styles.stateBadge, { backgroundColor: '#1A2E1A' }]}>
            <Text style={[styles.stateBadgeText, { color: item.color }]}>New</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const nonEmptyCats = CATEGORIES.filter(c => processed.some(p => (p.category || 'other') === c.id));


  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Toast message={toast} visible={!!toast} />

      <PaywallModal
        visible={showPaywall}
        onDismiss={() => setShowPaywall(false)}
        onPurchase={async (tier) => {
          if (tier === 'restore') {
            const result = await restorePurchases();
            if (result.success) {
              setIsPro(true);
              setShowPaywall(false);
              showToast('✅ Pro restored — 650 scans/month unlocked');
            } else {
              Alert.alert('Restore Purchases', 'No active subscription found.');
            }
            return;
          }
          const offering = await getOfferings();
          if (!offering) {
            Alert.alert('Error', 'Could not load subscription options. Please try again.');
            return;
          }
          const pkg = tier === 'annual' ? offering.annual : offering.monthly;
          if (!pkg) {
            Alert.alert('Error', 'Subscription package not available.');
            return;
          }
          const result = await purchasePackage(pkg);
          if (result.success) {
            setIsPro(true);
            setShowPaywall(false);
            showToast('✅ Pro unlocked — 650 scans/month');
          } else if (!result.cancelled) {
            Alert.alert('Purchase Failed', result.error || 'Something went wrong. Please try again.');
          }
        }}
      />
      <ServicePickerModal
        visible={showPicker}
        onDone={(p) => { setPrefs(p); setShowPicker(false); setProcessed(prev => [...prev]); }}
        onDismiss={() => setShowPicker(false)}
      />
      <GearMenu
        visible={showGear}
        onClose={() => setShowGear(false)}
        onActionButtons={() => setScreen('results')}
        onSortResults={() => setScreen('sort')}
        onScanAgain={() => setScreen('welcome')}
        onMyLists={() => { setActiveList(null); setScreen('lists'); }}
        onUpgrade={() => { setShowGear(false); setShowPaywall(true); }}
        isPro={isPro}
      />

      {/* WELCOME ANIMATION — plays once on first open */}
      {screen === 'welcome' && !welcomeAnimDone && (
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <Video
            source={require('./assets/SB_BOT_WELCOME1_c.mp4')}
            style={{ flex: 1, width: '100%' }}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={true}
            isLooping={false}
            isMuted={false}
            volume={1.0}
            useNativeControls={false}
            onPlaybackStatusUpdate={(status) => {
              if (status.isLoaded && status.didJustFinish) {
                setWelcomeAnimDone(true);
              }
              // Fallback: if video has been playing for 4+ seconds, advance regardless
              if (status.isLoaded && status.positionMillis >= 4000) {
                setWelcomeAnimDone(true);
              }
            }}
          />
        </View>
      )}

      {/* WELCOME */}
      {screen === 'welcome' && welcomeAnimDone && (
        <View style={styles.welcomeScreen}>
          <TouchableOpacity style={styles.gearBtnWelcome} onPress={() => setShowGear(true)}>
            <Text style={styles.gearBtnText}>⚙️</Text>
          </TouchableOpacity>

          {/* Hero group — centred in upper portion */}
          <View style={styles.welcomeHero}>
            <Image source={require('./assets/SB_BOT_ICON_1024_OFFICIAL.png')} style={styles.welcomeLogo} resizeMode="contain" />
            <Text style={styles.welcomeTagline}>Your screenshots, organized — 50 at a time</Text>
          </View>

          {/* Flexible spacer pushes actions to bottom */}
          <View style={{ flex: 1 }} />

          {/* Actions — pinned to bottom */}
          <View style={styles.welcomeActions}>
            <TouchableOpacity style={styles.scanBtnLarge} onPress={runScan}>
              <Text style={styles.scanBtnLargeText}>
                {sessionScanned ? 'Scan Next 50' : 'Scan My Screenshots'}
              </Text>
            </TouchableOpacity>
            {!isPro && (
              <Text style={{ color: scanCount >= FREE_SCAN_LIMIT ? '#E50914' : '#888', fontSize: scale(11), marginTop: 4, textAlign: 'center' }}>
                {scanCount >= FREE_SCAN_LIMIT
                  ? 'Free scan limit reached — upgrade to Pro'
                  : `${FREE_SCAN_LIMIT - scanCount} free scan${FREE_SCAN_LIMIT - scanCount !== 1 ? 's' : ''} remaining this month`}
              </Text>
            )}
            {screenshotsProcessed > 0 && (
              <View style={{ marginTop: 14, backgroundColor: '#1C1C1E', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 20, borderWidth: 1, borderColor: '#2C2C2E', alignSelf: 'stretch' }}>
                <Text style={{ color: '#007AFF', fontWeight: '800', fontSize: 15, textAlign: 'center' }}>
                  {screenshotsProcessed} screenshot{screenshotsProcessed !== 1 ? 's' : ''} processed
                </Text>
                <Text style={{ color: '#555', fontSize: 11, textAlign: 'center', marginTop: 2 }}>organized into your lists</Text>
              </View>
            )}
            {sessionScanned && (
              <TouchableOpacity onPress={() => setScreen('results')} style={{ marginTop: 8 }}>
                <Text style={styles.resumeLink}>View last results ({processed.length} screenshots)</Text>
              </TouchableOpacity>
            )}
            {Object.values(lists).some(arr => arr.length > 0) && (
              <TouchableOpacity
                onPress={() => { setActiveList(null); setScreen('lists'); }}
                style={{ marginTop: 16, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 14, borderWidth: 1, borderColor: '#AF52DE', alignItems: 'center', width: '100%' }}
              >
                <Text style={{ color: '#AF52DE', fontWeight: '700', fontSize: 16 }}>My Lists</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
      {screen === 'scanning' && (
        <View style={styles.scanningScreen}>
          <Video
            ref={scanVideoRef}
            source={require('./assets/SB_SCAN_LOOP_c.mp4')}
            style={{ width: '100%', height: '100%' }}
            resizeMode={ResizeMode.COVER}
            shouldPlay={true}
            isLooping={true}
            isMuted={false}
            volume={1.0}
            positionMillis={scanVideoPositionRef.current}
            onPlaybackStatusUpdate={(status) => {
              if (status.isLoaded && status.positionMillis) {
                scanVideoPositionRef.current = status.positionMillis;
              }
            }}
            onReadyForDisplay={() => {
              scanVideoRef.current?.playAsync().catch(() => {});
            }}
            useNativeControls={false}
          />
        </View>
      )}

      {/* GLEANING */}
      {screen === 'gleaning' && (
        <View style={styles.scanningScreen}>
          <Video
            ref={gleanVideoRef}
            source={require('./assets/SB_ORGANIZE_LOOP_c.mp4')}
            style={{ width: '100%', height: '100%' }}
            resizeMode={ResizeMode.COVER}
            shouldPlay={true}
            isLooping={false}
            isMuted={false}
            volume={1.0}
            useNativeControls={false}
          />
        </View>
      )}

      {/* RESULTS — This Scan */}
      {screen === 'results' && (
        <>
          <View style={[styles.header, { borderBottomColor: '#007AFF', borderBottomWidth: 2 }]}>
            <TouchableOpacity onPress={() => setScreen(scanSummary ? 'summary' : 'welcome')} style={{ paddingHorizontal: 8 }}>
              <Text style={styles.back}>‹ Back</Text>
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: '#007AFF' }]}>This Scan</Text>
            <TouchableOpacity onPress={() => setShowGear(true)} style={styles.gearBtn}>
              <Text style={styles.gearBtnText}>⚙️</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={nonEmptyCats}
            keyExtractor={(i, idx) => (i.id || '') + '_' + idx}
            contentContainerStyle={{ padding: 16 }}
            renderItem={renderResultTile}
            ListHeaderComponent={
              <Text style={styles.scanSummaryLarge}>{processed.length} screenshots processed</Text>
            }
            ListFooterComponent={null}
          />
        </>
      )}

      {/* SORT */}
      {screen === 'sort' && (
        <>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setScreen('results')}><Text style={styles.back}>← Back</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setShowGear(true)} style={styles.gearBtn}><Text style={styles.gearBtnText}>⚙️</Text></TouchableOpacity>
          </View>
          <FlatList
            data={CATEGORIES} numColumns={2} keyExtractor={(i, idx) => i.id + '_cat_' + idx}
            columnWrapperStyle={styles.row} contentContainerStyle={{ padding: 16 }}
            renderItem={renderFolder}
            ListHeaderComponent={<Text style={styles.scanSummary}>{processed.length} screenshots processed</Text>}
          />
        </>
      )}

      {/* CATEGORY */}
      {screen === 'category' && selectedCategory && (() => {
        const cat = CATEGORIES.find(c => c.id === selectedCategory);
        const catItemsAll = processed.filter(p => (p.category || 'other') === selectedCategory);
        // New items (added this scan) first, library items after
        const catItems = [
          ...catItemsAll.filter(i => scanNewIds.has(i.id)),
          ...catItemsAll.filter(i => !scanNewIds.has(i.id)),
        ];
        // Build service options for this category
        const serviceMap = {
          music:    [{ id: 'spotify',      brand: 'spotify',      label: 'Spotify',      url: `https://open.spotify.com/search/${encodeURIComponent(catItems.map(i => i.subject || '').filter(Boolean).join(' '))}` }, { id: 'apple_music',  brand: 'apple_music',  label: 'Apple Music', url: `https://music.apple.com/search?term=${encodeURIComponent(catItems.map(i => i.subject || '').filter(Boolean).join(' '))}` }],
          movies:   [{ id: 'netflix',      brand: 'netflix',      label: 'Netflix',        url: `https://www.netflix.com/search?q=${encodeURIComponent(catItems[0]?.subject || '')}` }, { id: 'appletv',      brand: 'apple_tv',     label: 'Apple TV+',     url: `https://tv.apple.com/search?term=${encodeURIComponent(catItems[0]?.subject || '')}` }, { id: 'hulu',         brand: 'hulu',         label: 'Hulu',           url: `https://www.hulu.com/search?q=${encodeURIComponent(catItems[0]?.subject || '')}` }],
          dining:   [{ id: 'resy',         brand: 'resy',         label: 'Resy',         url: `https://resy.com/search?query=${encodeURIComponent(catItems[0]?.subject || '')}` }, { id: 'opentable',   brand: 'opentable',   label: 'OpenTable',    url: `https://www.opentable.com/s/?term=${encodeURIComponent(catItems[0]?.subject || '')}` }],
          bars:     [{ id: 'yelp',         brand: 'yelp',         label: 'Yelp',         url: `https://www.yelp.com/search?find_desc=bars&find_loc=near+me` }, { id: 'gmaps',       brand: 'google_maps', label: 'Google Maps',  url: `https://maps.google.com/?q=bars+near+me` }],
          events:   [{ id: 'ticketmaster', brand: 'ticketmaster', label: 'Ticketmaster', url: `https://www.ticketmaster.com/search?q=${encodeURIComponent(catItems[0]?.subject || '')}` }, { id: 'stubhub',     brand: 'stubhub',     label: 'StubHub',      url: `https://www.stubhub.com/find/s/?q=${encodeURIComponent(catItems[0]?.subject || '')}` }, { id: 'eventbrite',  brand: 'eventbrite',  label: 'Eventbrite',   url: `https://www.eventbrite.com/d/online/${encodeURIComponent(catItems[0]?.subject || '')}/` }],
          jobs:     [{ id: 'linkedin',     brand: 'linkedin',     label: 'LinkedIn',     url: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(catItems.map(i => i.subject || '').filter(Boolean).join(' '))}` }, { id: 'indeed',      brand: 'indeed',      label: 'Indeed',       url: `https://www.indeed.com/jobs?q=${encodeURIComponent(catItems.map(i => i.subject || '').filter(Boolean).join('+'))}` }],
          shopping: [{ id: 'amazon',       brand: 'amazon',  label: 'Amazon',         url: `https://www.amazon.com/s?k=${encodeURIComponent(catItems.map(i => i.subject || '').filter(Boolean).join(' '))}` }, { id: 'target',      brand: 'target',  label: 'Target',         url: `https://www.target.com/s?searchTerm=${encodeURIComponent(catItems.map(i => i.subject || '').filter(Boolean).join(' '))}` }],
        };
        const services = serviceMap[selectedCategory] || [];
        return (
          <View style={{ flex: 1 }}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => setScreen(scanSummary ? 'summary' : 'welcome')}><Text style={styles.back}>‹ Back</Text></TouchableOpacity>
              <Text style={[styles.listHeaderTitle, { color: cat?.color }]}>{cat?.icon} {cat?.label}</Text>
              <TouchableOpacity onPress={() => setShowGear(true)} style={styles.gearBtn}><Text style={styles.gearBtnText}>⚙️</Text></TouchableOpacity>
            </View>
            <FlatList
              data={catItems}
              keyExtractor={(i, idx) => (i.id || '') + '_cat_' + idx}
              contentContainerStyle={{ padding: 16, paddingBottom: services.length ? 110 : 16 }}
              renderItem={({ item }) => {
                // Item is 'New' if it was added this scan (scanNewIds)
                // regardless of current library state
                const alreadyInLib = !scanNewIds.has(item.id);
                return (
                  <DetailCard
                    item={item}
                    alreadyInLibrary={alreadyInLib}
                    onProAction={!isPro ? () => setShowPaywall(true) : null}
                    onSaveItem={async () => {
                      if (!alreadyInLib) {
                        const { lists: updatedLists } = await addToLists([item]);
                        setLists(updatedLists);
                        setScanNewIds(prev => { const s = new Set(prev); s.delete(item.id); return s; });
                        showToast(`✅ Saved to My ${cat?.label}`);
                      }
                    }}
                    onOpenImage={async () => {
                      if (!alreadyInLib) {
                        const { lists: updatedLists } = await addToLists([item]);
                        setLists(updatedLists);
                        setScanNewIds(prev => { const s = new Set(prev); s.delete(item.id); return s; });
                      }
                      setSelectedListItem(item);
                    }}
                    onGoToLibrary={() => {
                      setListOrigin('category');
                      setActiveList(selectedCategory);
                      setListScrollTarget(item.id);
                      setListHighlightId(item.id);
                      setScreen('list');
                    }}
                    onMusicTap={(a) => {
                      if (!isPro) { setShowPaywall(true); return; }
                      Linking.openURL(a.url).catch(() => Linking.openURL(a.fallback));
                    }}
                    onUpdateItem={(updatedItem, destCat) => {
                      setProcessed(prev => {
                        const next = prev.map(p =>
                          (p.id === updatedItem.id || p.uri === updatedItem.uri) ? updatedItem : p
                        );
                        saveResults(next);
                        return next;
                      });
                      if (destCat && updatedItem.category !== selectedCategory) {
                        showToast(`📂 Moved to ${destCat.label}`);
                      }
                    }}
                  />
                );
              }}
            />
            <View style={styles.categoryFooter}>
              {(() => {
                const newCatItems = catItems.filter(i => scanNewIds.has(i.id));
                if (newCatItems.length === 0) return null;
                return (
                  <TouchableOpacity
                    style={{ backgroundColor: '#AF52DE', borderRadius: 14, paddingVertical: 13, alignItems: 'center', width: '100%' }}
                    onPress={async () => {
                      const { lists: updatedLists, added } = await addToLists(newCatItems);
                      setLists(updatedLists);
                      setScanNewIds(prev => {
                        const s = new Set(prev);
                        newCatItems.forEach(i => s.delete(i.id));
                        return s;
                      });
                      const newCount = added[selectedCategory] || 0;
                      if (newCount > 0) showToast(`✅ ${newCount} added to My ${cat?.label}`);
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Add All New</Text>
                  </TouchableOpacity>
                );
              })()}
            </View>
          </View>
        );
      })()}

      {/* ACTION WIZARD */}
      {/* SUMMARY SCREEN — shown after scan, lists what was saved */}
      {screen === 'summary' && scanSummary && scanSummary.added && (
        <View style={{ flex: 1 }}>
          <View style={styles.header}>
            <View style={{ width: 60 }} />
            <View style={{ width: 60 }} />
            <TouchableOpacity onPress={() => setShowGear(true)} style={styles.gearBtn}><Text style={styles.gearBtnText}>⚙️</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.summaryContent}>
          <Text style={styles.summaryEmoji}>✅</Text>
          <Text style={styles.summaryTitle}>Saved to Your Lists</Text>
          {screenshotsProcessed > 0 && (
            <Text style={{ color: '#007AFF', fontWeight: '700', fontSize: 14, marginBottom: 8 }}>
              {screenshotsProcessed} processed lifetime
            </Text>
          )}
          <View style={{ flexDirection: 'row', gap: 10, width: '100%', marginBottom: 24 }}>
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: '#007AFF', borderRadius: 16, paddingVertical: 14, alignItems: 'center' }}
              onPress={() => setScreen('results')}
            >
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Scan Results</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: '#AF52DE', borderRadius: 16, paddingVertical: 14, alignItems: 'center' }}
              onPress={() => { setActiveList(null); setScreen('lists'); }}
            >
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>My Lists</Text>
            </TouchableOpacity>
          </View>
          {(scanNewIds.size > 0 || addAllNewDone) && (
            <TouchableOpacity
              disabled={addAllNewDone}
              style={{ backgroundColor: '#AF52DE', borderRadius: 16, paddingVertical: 14, alignItems: 'center', width: '100%', marginBottom: 20, opacity: addAllNewDone ? 0.4 : 1 }}
              onPress={async () => {
                const allNew = processed.filter(i => scanNewIds.has(i.id));
                if (!allNew.length) return;
                const { lists: updatedLists, added } = await addToLists(allNew);
                setLists(updatedLists);
                setScanNewIds(new Set());
                setAddAllNewDone(true);
                const total = Object.values(added).reduce((a, b) => a + b, 0);
                if (total > 0) showToast(`✅ ${total} added to your lists`);
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Add All New</Text>
            </TouchableOpacity>
          )}
          <View style={styles.summaryCards}>
            {CATEGORIES.filter(c => (scanSummary.added?.[c.id]) || (scanDuplicates[c.id] && scanDuplicates[c.id].length > 0)).map(cat => {
              // Live new count from scanNewIds so badge clears when items are individually saved
              const liveNewCount = processed.filter(p => (p.category || 'other') === cat.id && scanNewIds.has(p.id)).length;
              const dupeItems  = scanDuplicates[cat.id] || [];
              const totalInLib = (lists[cat.id] || []).length;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.summaryCard, { borderColor: liveNewCount > 0 ? '#007AFF' : '#AF52DE' }]}
                  onPress={() => { setSelectedCategory(cat.id); setScreen('category'); }}
                >
                  <Image source={CAT_ICONS[cat.id]} style={styles.summaryCardIcon} resizeMode="contain" />
                  <View style={styles.summaryCardText}>
                    <Text style={styles.summaryCardLabel}>{cat.label}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                      {liveNewCount > 0 && (
                        <Text style={[styles.summaryCardCount, { color: '#007AFF' }]}>
                          +{liveNewCount} new
                        </Text>
                      )}
                      {totalInLib > 0 && liveNewCount === 0 && (
                        <Text style={[styles.summaryCardCount, { color: '#666' }]}>
                          · {totalInLib} in library
                        </Text>
                      )}
                      {dupeItems.length > 0 && (
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation && e.stopPropagation();
                            Alert.alert(
                              'Already Saved',
                              `${dupeItems.map(i => i.subject || 'Unknown').join(', ')} ${dupeItems.length === 1 ? 'is' : 'are'} already in My ${cat.label}. Add again?`,
                              [
                                { text: 'Skip', style: 'cancel' },
                                { text: 'Skip', style: 'cancel' },
                                { text: 'Add Anyway', style: 'default', onPress: async () => {
                                  setLists(updated);
                                  setScanDuplicates(prev => ({ ...prev, [cat.id]: [] }));
                                  showToast(`✅ Added to ${cat.label}`);
                                }},
                              ],
                              { userInterfaceStyle: 'dark' }
                            );
                          }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={[styles.summaryCardCount, { color: '#666' }]}>

                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  <Text style={[styles.summaryCardArrow, { color: liveNewCount > 0 ? '#007AFF' : '#AF52DE' }]}>›</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          </ScrollView>
        </View>
      )}

      {/* LIST DETAIL SCREEN — browse + manage a category list */}
      {/* LISTS OVERVIEW — all categories */}
      {screen === 'lists' && (
        <View style={{ flex: 1 }}>
          <View style={[styles.header, { borderBottomColor: '#AF52DE', borderBottomWidth: 2 }]}>
            <TouchableOpacity onPress={() => setScreen(scanSummary ? 'summary' : 'results')}>
              <Text style={styles.back}>‹ Back</Text>
            </TouchableOpacity>
            <Text style={{ color: '#AF52DE', fontWeight: '800', fontSize: 17 }}>My Lists</Text>
            <TouchableOpacity onPress={() => setShowGear(true)} style={styles.gearBtn}><Text style={styles.gearBtnText}>⚙️</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {CATEGORIES.map(cat => {
              const count = (lists[cat.id] || []).length;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.summaryCard, { borderColor: count ? cat.color : '#333', marginBottom: 10, opacity: count ? 1 : 0.4 }]}
                  onPress={() => { if (count) { setListOrigin('lists'); setActiveList(cat.id); setScreen('list'); } }}
                >
                  <Image source={CAT_ICONS[cat.id]} style={styles.summaryCardIcon} resizeMode="contain" />
                  <View style={styles.summaryCardText}>
                    <Text style={styles.summaryCardLabel}>My {cat.label}</Text>
                    <Text style={[styles.summaryCardCount, { color: count ? cat.color : '#555' }]}>
                      {count ? `${count} saved` : 'Empty'}
                    </Text>
                  </View>
                  {count > 0 && <Text style={styles.summaryCardArrow}>›</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {screen === 'list' && activeList && (() => {
        const cat = CATEGORIES.find(c => c.id === activeList);
        const items = lists[activeList] || [];
        return (
          <View style={{ flex: 1 }}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => setScreen(listOrigin === 'category' ? 'category' : listOrigin)}>
                <Text style={styles.back}>‹ Back</Text>
              </TouchableOpacity>
              <Text style={[styles.listHeaderTitle, { color: '#AF52DE' }]}>
                {cat?.icon} {({'music': 'My Music', 'movies': 'My Movies', 'dining': 'My Dining', 'bars': 'My Bars', 'events': 'My Events', 'jobs': 'My Jobs', 'shopping': 'My Shopping', 'other': 'My Other'}[activeList] || `My ${cat?.label}`)}
              </Text>
              <TouchableOpacity onPress={() => setShowGear(true)} style={styles.gearBtn}><Text style={styles.gearBtnText}>⚙️</Text></TouchableOpacity>
            </View>
            {items.length === 0 ? (
              <View style={styles.emptyList}>
                <Text style={styles.emptyListText}>Your {cat?.label} list is empty.</Text>
                <Text style={styles.emptyListSub}>Scan screenshots to add items.</Text>
              </View>
            ) : (
              <FlatList
                ref={listFlatRef}
                data={items}
                keyExtractor={(item, i) => (item.id || '') + '_' + i}
                contentContainerStyle={{ padding: 16 }}
                onLayout={() => {
                  if (listScrollTarget && listFlatRef.current) {
                    const idx = items.findIndex(i => i.id === listScrollTarget);
                    if (idx >= 0) {
                      listFlatRef.current.scrollToIndex({ index: idx, animated: true, viewPosition: 0.3 });
                    }
                    setListScrollTarget(null);
                  }
                }}
                onScrollToIndexFailed={(info) => {
                  // Fallback: scroll to approximate offset then retry
                  listFlatRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
                  setTimeout(() => {
                    listFlatRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.3 });
                  }, 200);
                }}
                renderItem={({ item }) => {
                  const enr = item.enrichment || {};
                  const title = enr.track_name || enr.title || item.subject || '—';
                  const sub = enr.artist_name || item.artist || enr.year || item.context || '';
                  const artwork = enr.artwork_url || (enr.poster_url ? `https://image.tmdb.org/t/p/w200${enr.poster_url}` : null);
                  const imgUri = artwork || item.localUri || item.uri;
                  // Service actions per category
                  const q = encodeURIComponent(item.subject || title);
                  const listActions = {
                    music:    [{ id: 'spotify', brand: 'spotify',      label: 'Spotify',      url: `https://open.spotify.com/search/${q}` }, { id: 'apple',   brand: 'apple_music', label: 'Apple Music',  url: `https://music.apple.com/search?term=${q}` }],
                    movies:   [{ id: 'netflix', brand: 'netflix',      label: 'Netflix',      url: `https://www.netflix.com/search?q=${q}` }, { id: 'appletv', brand: 'apple_tv',    label: 'Apple TV+',    url: `https://tv.apple.com/search?term=${q}` }, { id: 'hulu', brand: 'hulu', label: 'Hulu', url: `https://www.hulu.com/search?q=${q}` }],
                    dining:   [{ id: 'resy',    brand: 'resy',         label: 'Resy',         url: `https://resy.com/search?query=${q}` }, { id: 'ot',      brand: 'opentable',   label: 'OpenTable',    url: `https://www.opentable.com/s/?term=${q}` }],
                    bars:     [{ id: 'yelp',    brand: 'yelp',         label: 'Yelp',         url: `https://www.yelp.com/search?find_desc=${q}&find_loc=near+me` }, { id: 'maps', brand: 'apple_maps', label: 'Maps', url: `https://maps.google.com/?q=${q}` }],
                    events:   [{ id: 'tm',      brand: 'ticketmaster', label: 'Ticketmaster', url: `https://www.ticketmaster.com/search?q=${q}` }, { id: 'sb',      brand: 'stubhub',     label: 'StubHub',      url: `https://www.stubhub.com/find/s/?q=${q}` }],
                    jobs:     [{ id: 'li',      brand: 'linkedin',     label: 'LinkedIn',     url: `https://www.linkedin.com/jobs/search/?keywords=${q}` }, { id: 'ind',     brand: 'indeed',      label: 'Indeed',       url: `https://www.indeed.com/jobs?q=${q}` }],
                    shopping: [{ id: 'amz',     brand: 'amazon',       label: 'Amazon',       url: `https://www.amazon.com/s?k=${q}` }, { id: 'tgt',     brand: 'target',      label: 'Target',       url: `https://www.target.com/s?searchTerm=${q}` }],
                    other:    [{ id: 'google',  brand: 'google',       label: 'Google',       url: `https://www.google.com/search?q=${q}` }],
                  };
                  const actions = listActions[activeList] || listActions.other;
                  const cat = CATEGORIES.find(c => c.id === activeList);
                  const isTarget = !!listHighlightId && item.id === listHighlightId;
                  return (
                    <TouchableOpacity
                      style={[styles.listItem, { flexDirection: 'column', alignItems: 'flex-start' }, isTarget && { borderColor: '#AF52DE', borderWidth: 1.5 }]}
                      activeOpacity={0.7}
                      onPress={() => { setListHighlightId(null); setSelectedListItem(item); }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                        {imgUri ? <Image source={{ uri: imgUri }} style={{ width: 44, height: 44, borderRadius: 6, marginRight: 10 }} /> : null}
                        <View style={[styles.listItemText, { flex: 1 }]}>
                          <Text style={styles.listItemTitle} numberOfLines={1}>{title}</Text>
                          {!!sub && <Text style={styles.listItemSub} numberOfLines={1}>{sub}</Text>}
                        </View>

                      </View>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' }}>
                        {actions.map(a => {
                          const b = BRAND[a.brand] || {};
                          return (
                            <TouchableOpacity
                              key={a.id}
                              style={[styles.serviceChip, { borderColor: b.border || b.bg || '#333', borderWidth: 1, backgroundColor: b.bg || '#1A1A1A', flexDirection: 'row', alignItems: 'center', gap: 4, opacity: isPro ? 1 : 0.55 }]}
                              onPress={() => {
                                if (isPro) {
                                  Linking.openURL(a.url).catch(() => {});
                                } else {
                                  setShowPaywall(true);
                                }
                              }}
                            >
                              {!isPro && <Text style={{ color: '#aaa', fontSize: 10 }}>🔒</Text>}
                              <Text style={[styles.serviceChipText, { color: b.text || '#fff', fontSize: 12 }]}>{a.label}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
            {items.length > 0 && (() => {
              const q = encodeURIComponent(items.map(i => i.subject || '').filter(Boolean).join(' '));
              const listServiceMap = {
                music:    [{ id: 'spotify', brand: 'spotify',      label: 'Spotify',      url: `https://open.spotify.com/search/${q}` }, { id: 'apple',   brand: 'apple_music',  label: 'Apple Music',  url: `https://music.apple.com/search?term=${q}` }],
                movies:   [{ id: 'netflix', brand: 'netflix',      label: 'Netflix',      url: `https://www.netflix.com/search?q=${encodeURIComponent(items[0]?.subject || '')}` }, { id: 'appletv', brand: 'apple_tv', label: 'Apple TV+', url: `https://tv.apple.com/search?term=${encodeURIComponent(items[0]?.subject || '')}` }, { id: 'hulu', brand: 'hulu', label: 'Hulu', url: `https://www.hulu.com/search?q=${encodeURIComponent(items[0]?.subject || '')}` }],
                dining:   [{ id: 'resy',    brand: 'resy',         label: 'Resy',         url: `https://resy.com/search?query=${q}` }, { id: 'ot',      brand: 'opentable',    label: 'OpenTable',    url: `https://www.opentable.com/s/?term=${q}` }],
                bars:     [{ id: 'yelp',    brand: 'yelp',         label: 'Yelp',         url: `https://www.yelp.com/search?find_desc=bars&find_loc=near+me` }],
                events:   [{ id: 'tm',      brand: 'ticketmaster', label: 'Ticketmaster', url: `https://www.ticketmaster.com/search?q=${q}` }, { id: 'sb',      brand: 'stubhub',      label: 'StubHub',      url: `https://www.stubhub.com/find/s/?q=${q}` }],
                jobs:     [{ id: 'li',      brand: 'linkedin',     label: 'LinkedIn',     url: `https://www.linkedin.com/jobs/search/?keywords=${q}` }, { id: 'ind',     brand: 'indeed',       label: 'Indeed',       url: `https://www.indeed.com/jobs?q=${q}` }],
                shopping: [{ id: 'amz',     brand: 'amazon',       label: 'Amazon',       url: `https://www.amazon.com/s?k=${q}` }, { id: 'tgt',     brand: 'target',       label: 'Target',       url: `https://www.target.com/s?searchTerm=${q}` }],
              };
              const sendServices = listServiceMap[activeList] || [];
              if (!sendServices.length) return null;
              const ctaLabel = {
                music:    'Create Playlist',
                movies:   'Find to Watch',
                dining:   'Make a Reservation',
                bars:     'Find a Bar',
                events:   'Get Tickets',
                jobs:     'Apply',
                shopping: 'Shop',
                other:    'Search',
              }[activeList] || 'Open';
              const showMaps = activeList === 'bars' || activeList === 'dining';
              const mapsQuery = encodeURIComponent(items.map(i => i.subject || '').filter(Boolean).join(' ') || activeList);
              return (
                <View style={styles.categoryFooter}>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    {sendServices.map(svc => {
                      const b = BRAND[svc.brand] || { bg: '#AF52DE', text: '#fff' };
                      return (
                        <TouchableOpacity
                          key={svc.id}
                          style={{ flex: 1, backgroundColor: b.bg, borderRadius: 14, paddingVertical: 13, alignItems: 'center', minWidth: 80, borderWidth: b.border ? 1 : 0, borderColor: b.border || 'transparent' }}
                          onPress={() => {
                            Alert.alert(
                              ctaLabel,
                              `Opens ${svc.label} and leaves SCREENBot. Your list stays saved.`,
                              [{ text: 'Cancel', style: 'cancel' }, { text: 'Open', onPress: () => {
                                if (!isPro) { setShowPaywall(true); return; }
                                Linking.openURL(svc.url).catch(() => {});
                              }}]
                            );
                          }}
                        >
                          <Text style={{ color: b.text, fontWeight: '800', fontSize: 15 }}>{svc.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                    {showMaps && (
                      <TouchableOpacity
                        style={{ flex: 1, backgroundColor: '#AF52DE', borderRadius: 14, paddingVertical: 13, alignItems: 'center', minWidth: 80 }}
                        onPress={() => {
                          if (!isPro) { setShowPaywall(true); return; }
                          Alert.alert(
                            'Open in Maps',
                            'Choose your navigation app',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Apple Maps', onPress: () => Linking.openURL(`maps://?q=${mapsQuery}`).catch(() => Linking.openURL(`https://maps.apple.com/?q=${mapsQuery}`)) },
                              { text: 'Google Maps', onPress: () => Linking.openURL(`comgooglemaps://?q=${mapsQuery}`).catch(() => Linking.openURL(`https://maps.google.com/?q=${mapsQuery}`)) },
                              { text: 'Waze', onPress: () => Linking.openURL(`waze://?q=${mapsQuery}&navigate=yes`).catch(() => Linking.openURL(`https://waze.com/ul?q=${mapsQuery}`)) },
                            ]
                          );
                        }}
                      >
                        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Maps</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })()}
          </View>
        );
      })()}
      {/* IMAGE REVIEW from Saved Lists */}
      <ImageReviewModal
        visible={!!selectedListItem}
        item={selectedListItem}
        onDismiss={() => setSelectedListItem(null)}
        onEditInfo={() => {
          const item = selectedListItem;
          setSelectedListItem(null);
          setTimeout(() => setEditingListItem(item), 300);
        }}
        onMoveToOther={selectedListItem?.category !== 'other' ? async () => {
          const item = selectedListItem;
          setSelectedListItem(null);
          // Remove from current list
          const afterRemove = await removeFromList(item.category || activeList, item.id);
          // Add to other
          const moved = { ...item, category: 'other' };
          const updated = { ...afterRemove };
          if (!updated.other) updated.other = [];
          updated.other.push({ ...moved, savedAt: Date.now() });
          await saveLists(updated);
          setLists(updated);
          showToast('📂 Moved to Other');
        } : undefined}
      />

      {/* EDIT METADATA from Saved Lists */}
      <EditMetadataModal
        visible={!!editingListItem}
        item={editingListItem}
        onSave={async (updates) => {
          if (!editingListItem) return;
          const updated = { ...editingListItem, ...updates };
          // Update the item in lists state and persist
          setLists(prev => {
            const cat = editingListItem.category || 'other';
            const next = { ...prev, [cat]: (prev[cat] || []).map(i => i.id === editingListItem.id ? updated : i) };
            saveLists(next);
            return next;
          });
          setEditingListItem(null);
          showToast('✅ Updated');
        }}
        onDismiss={() => setEditingListItem(null)}
      />

      {/* FULLSCREEN IMAGE PREVIEW — via ImageReviewModal on DetailCards */}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:             { flex: 1, backgroundColor: '#000' },
  welcomeScreen:         { flex: 1, alignItems: 'center', paddingTop: scale(60), paddingBottom: scale(48) },
  gearBtnWelcome:        { position: 'absolute', top: 16, right: 16, zIndex: 10, padding: 8 },
  welcomeHero:           { alignItems: 'center' },
  welcomeActions:        { alignItems: 'center', width: '100%', paddingHorizontal: scale(28) },
  welcomeBot:            { width: scale(260), height: scale(263) },
  welcomeLogo:           { width: scale(312), height: scale(312) },
  welcomeTagline:        { color: '#888', fontSize: scale(9), fontWeight: '400', fontStyle: 'italic', marginTop: scale(-12), letterSpacing: 0.2, textAlign: 'center' },
  scanBtnLarge:          { backgroundColor: '#AF52DE', paddingVertical: scale(16), paddingHorizontal: scale(36), borderRadius: scale(28), marginTop: scale(16) },
  scanBtnLargeText:      { color: '#fff', fontWeight: '800', fontSize: scale(18) },
  resumeLink:            { color: '#8B5CF6', fontSize: scale(13), textDecorationLine: 'underline' },
  categoryFooter:        { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#111', borderTopWidth: 1, borderTopColor: '#333', padding: 16, paddingBottom: 28 },
  saveListBtn:           { borderWidth: 1.5, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  saveListBtnText:       { fontWeight: '700', fontSize: 15 },
  categoryFooterLabel:   { color: '#888', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  serviceChip:           { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginRight: 10 },
  serviceChipText:       { fontWeight: '700', fontSize: 14 },
  scanHint:              { color: '#fff', fontSize: 13, marginTop: 8, textAlign: 'center' },
  scanningScreen:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadingGif:            { width: 300, height: 300 },
  textCycleGif:          { width: 340, height: 110 },
  gleaningText:          { color: '#888', fontSize: 20, fontWeight: '600', letterSpacing: 0.5, marginTop: 8 },

  header:                { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#222' },
  headerLogo:            { height: 56, width: 280 },
  gearBtn:               { paddingHorizontal: 8, paddingVertical: 6 },
  gearBtnText:           { fontSize: 28 },
  back:                  { color: '#fff', fontSize: 18, fontWeight: '600' },
  headerTitle:           { color: '#fff', fontSize: 17, fontWeight: '800', flex: 1, textAlign: 'center' },
  scanSummaryLarge:      { color: '#aaa', fontSize: 16, fontWeight: '600', marginBottom: 20, marginTop: 4 },
  scanSummary:           { color: '#888', fontSize: 13, marginBottom: 16 },
  resultTile:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1C1C1E', borderRadius: 16, padding: 18, marginBottom: 12, borderWidth: 1 },
  resultTileLeft:        { flexDirection: 'row', alignItems: 'center', gap: 14 },
  resultTileIcon:        { width: 40, height: 48 },
  resultTileLabel:       { color: '#fff', fontWeight: '700', fontSize: 16 },
  resultTileCount:       { fontSize: 13, fontWeight: '600', marginTop: 2 },
  stateBadge:            { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12 },
  stateDone:             { backgroundColor: '#0A3D0A' },
  statePending:          { backgroundColor: '#2C2C2E' },
  stateBadgeText:        { fontSize: 13, fontWeight: '700' },
  stateBadgeTextDone:    { color: '#4CD964' },
  stateBadgeTextPending: { color: '#888' },
  nudgeBtn:              { backgroundColor: '#2C2C2E', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8, marginBottom: 24 },
  nudgeBtnText:          { color: '#AF52DE', fontWeight: '700', fontSize: 14 },
  row:                   { justifyContent: 'space-between', marginBottom: 14 },
  folder:                { width: '48%', backgroundColor: '#1C1C1E', borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1 },
  folderIcon:            { width: 52, height: 62, marginBottom: 6 },
  folderLabel:           { color: '#fff', fontWeight: '600', fontSize: 14 },
  folderCount:           { fontWeight: '800', marginTop: 4, fontSize: 20 },
  setServicesBtn:        { backgroundColor: '#2C2C2E', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, alignSelf: 'flex-start', marginBottom: 16 },
  setServicesBtnText:    { color: '#AF52DE', fontWeight: '700', fontSize: 13 },
  card:                  { flexDirection: 'row', backgroundColor: '#1C1C1E', padding: 12, borderRadius: 12, marginBottom: 10, borderLeftWidth: 4, alignItems: 'flex-start' },
  thumb:                 { width: 60, height: 60, borderRadius: 8, marginRight: 12, backgroundColor: '#333' },
  textBlock:             { flex: 1 },
  cardTitle:             { color: '#fff', fontWeight: '700', fontSize: 15 },
  cardSubtitle:          { color: '#999', fontSize: 13, marginTop: 2 },
  cardMeta:              { color: '#555', fontSize: 11, marginTop: 2 },
  actionsRow:            { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  actionBtn:             { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1 },
  enrichingLabel:        { color: '#666', fontSize: 12, fontStyle: 'italic', marginTop: 6 },
  noMatchLabel:          { color: '#444', fontSize: 12, marginTop: 6 },
  streamChip:            { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#2C2C2E', marginRight: 6, marginTop: 6 },
  streamChipSelected:    { backgroundColor: '#AF52DE', borderWidth: 1, borderColor: '#CF8EFF' },
  streamChipText:        { color: '#ccc', fontSize: 12, fontWeight: '600' },
  streamChipTextSelected:{ color: '#fff', fontWeight: '800' },
  watchBtn:              { marginTop: 10, backgroundColor: '#AF52DE', borderRadius: 12, paddingVertical: 9, paddingHorizontal: 14, alignSelf: 'flex-start' },
  watchBtnText:          { color: '#fff', fontWeight: '800', fontSize: 13 },
  actionBtnText:         { fontSize: 12, fontWeight: '600' },
  // Manual Sort Modal
  sortFolderRow:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2C2C2E' },
  sortFolderIcon:        { fontSize: 22, marginRight: 14 },
  sortFolderLabel:       { fontSize: 16, fontWeight: '700' },
  // Edit Metadata Modal
  openOriginalShareBtn:  { backgroundColor: '#2C2C2E', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  openOriginalShareText: { color: '#AF52DE', fontWeight: '700', fontSize: 15 },
  metaFieldLabel:        { color: '#888', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 4 },
  metaInput:             { backgroundColor: '#2C2C2E', color: '#fff', borderRadius: 10, padding: 10, fontSize: 14, borderWidth: 1, borderColor: '#3A3A3C' },
  // Card footer buttons
  cardFooterRow:         { flexDirection: 'row', gap: 8, marginTop: 10 },
  cardFooterBtn:         { flex: 1, backgroundColor: '#2C2C2E', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, alignItems: 'center' },
  cardFooterBtnSort:     { borderWidth: 1, borderColor: '#AF52DE' },
  cardFooterBtnText:     { color: '#888', fontSize: 12, fontWeight: '600' },
  modalOverlay:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalBox:              { backgroundColor: '#1C1C1E', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, paddingBottom: 40 },
  modalMascot:           { width: 80, height: 80, alignSelf: 'center', marginBottom: 12 },
  modalTitle:            { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 6 },
  modalSub:              { color: '#888', fontSize: 14, marginBottom: 20 },
  modalSection:          { color: '#fff', fontWeight: '700', fontSize: 15, marginBottom: 10 },
  chipRow:               { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip:                  { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: '#444', backgroundColor: '#2C2C2E' },
  chipSelected:          { borderColor: '#AF52DE', backgroundColor: '#2E1A3E' },
  chipText:              { color: '#888', fontSize: 13, fontWeight: '600' },
  chipTextSelected:      { color: '#AF52DE' },
  doneBtn:               { backgroundColor: '#AF52DE', borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 8 },

  // Summary screen
  summaryScreen:         { flex: 1, backgroundColor: '#000' },
  summaryContent:        { alignItems: 'center', padding: 24, paddingBottom: 48 },
  summaryEmoji:          { fontSize: 56, marginTop: 24, marginBottom: 8 },
  summaryTitle:          { color: '#fff', fontSize: 26, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  summarySub:            { color: '#888', fontSize: 14, textAlign: 'center', marginBottom: 28 },
  summaryCards:          { width: '100%', gap: 10, marginBottom: 16 },
  summaryCard:           { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2C2C2E', borderRadius: 16, padding: 16, borderWidth: 1.5 },
  summaryCardIcon:       { width: 44, height: 52, marginRight: 14 },
  summaryCardText:       { flex: 1 },
  summaryCardLabel:      { color: '#fff', fontWeight: '700', fontSize: 16 },
  summaryCardCount:      { fontSize: 13, fontWeight: '600', marginTop: 2 },
  summaryCardArrow:      { color: '#888', fontSize: 22, fontWeight: '400' },

  // List detail screen
  listHeaderTitle:       { fontWeight: '800', fontSize: 17 },
  emptyList:             { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyListText:         { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  emptyListSub:          { color: '#555', fontSize: 14, textAlign: 'center' },
  listItem:              { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1C1E', borderRadius: 12, padding: 14, marginBottom: 10 },
  listItemText:          { flex: 1 },
  listItemTitle:         { color: '#fff', fontSize: 15, fontWeight: '600' },
  listItemSub:           { color: '#888', fontSize: 13, marginTop: 2 },
  listItemRemove:        { padding: 6 },
  listItemRemoveText:    { color: '#555', fontSize: 16, fontWeight: '600' },
  doneBtnText:           { color: '#fff', fontWeight: '800', fontSize: 16 },
  gearOverlay:           { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end', alignItems: 'flex-end', padding: 16, paddingTop: 80 },
  gearMenu:              { backgroundColor: '#2C2C2E', borderRadius: 16, width: 220, overflow: 'hidden' },
  gearItem:              { paddingVertical: 14, paddingHorizontal: 18 },
  gearItemText:          { color: '#fff', fontSize: 15, fontWeight: '600' },
  brandBtn:              { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, marginRight: 6, marginTop: 6 },
  brandBtnText:          { fontSize: 13, fontWeight: '800' },
  serviceGroupLabel:     { color: '#fff', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 8, marginBottom: 4, width: '100%' },
  gearDivider:           { height: 1, backgroundColor: '#3A3A3C' },
  libBadge:              { backgroundColor: '#2C2C2E', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  libBadgeText:          { color: '#555', fontSize: 11, fontWeight: '700' },
  libBadgeNew:           { backgroundColor: '#0A3D0A' },
  libBadgeTextNew:       { color: '#4CD964' },
  // Action wizard
  actionScreen:          { flex: 1 },
  actionHeader:          { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, paddingTop: 12 },
  skipBtn:               { paddingVertical: 8, paddingHorizontal: 12 },
  skipBtnText:           { color: '#555', fontSize: 14 },
  actionContent:         { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  actionScrollView:      { flex: 1 },
  actionScrollContent:   { paddingHorizontal: 24, paddingBottom: 40, alignItems: 'center' },
  actionEmoji:           { fontSize: 52, marginBottom: 12 },
  actionTitle:           { color: '#fff', fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  actionSub:             { color: '#888', fontSize: 16, textAlign: 'center', marginBottom: 28 },
  serviceRow:            { flexDirection: 'row', gap: 14, marginBottom: 36 },
  serviceChip:           { paddingVertical: 14, paddingHorizontal: 22, borderRadius: 16, borderWidth: 1, borderColor: '#444', backgroundColor: '#1C1C1E' },
  serviceChipSelected:   { borderColor: '#AF52DE', backgroundColor: '#2E1A3E' },
  serviceChipText:       { color: '#888', fontSize: 16, fontWeight: '700' },
  serviceChipTextSelected: { color: '#AF52DE' },
  songPreviewList:       { width: '100%', gap: 10 },
  songPreviewRow:        { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#222', paddingBottom: 8 },
  songPreviewTitle:      { color: '#fff', fontWeight: '600', fontSize: 14, flex: 1 },
  songPreviewArtist:     { color: '#666', fontSize: 13, flex: 1, textAlign: 'right' },
  moreLabel:             { color: '#555', fontSize: 13, marginTop: 8, textAlign: 'center' },
  movieActionCard:       { width: '100%', backgroundColor: '#1C1C1E', borderRadius: 14, padding: 16, marginBottom: 12 },
  movieActionTitle:      { color: '#fff', fontWeight: '700', fontSize: 16, marginBottom: 10 },
  movieActionYear:       { color: '#888', fontWeight: '400' },
  streamRow:             { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toast:                 { position: 'absolute', top: 70, left: 24, right: 24, backgroundColor: '#1C3D1C', borderRadius: 16, padding: 18, zIndex: 999, borderWidth: 1, borderColor: '#4CD964', shadowColor: '#4CD964', shadowOpacity: 0.3, shadowRadius: 10, elevation: 10 },
  toastText:             { color: '#4CD964', fontWeight: '800', fontSize: 15, textAlign: 'center', letterSpacing: 0.2 },
});
