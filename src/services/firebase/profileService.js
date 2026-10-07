/**
 * profileService (Firebase) — profile CRUD, discovery, blocking, admin ops.
 *
 * Screens keep the exact same calls as before; only the storage changed.
 * Rules of note (enforced by `firestore.rules`, not by hiding buttons):
 *  - a profile document can only be written by its owner or an admin
 *  - Gold/premium fields are rejected on profiles (entitlements live in
 *    `goldEntitlements/{uid}`, which clients can only read)
 */
import {
  deleteDoc,
  getDoc,
  getDocs,
  limit as fsLimit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

import { LIMITS } from '../../config/env';
import { isKnownArea, isSameAreaGroup } from '../../constants/areas';
import { getFirebaseAuth } from './firebaseConfig';
import { deleteProfilePhoto, photoPathFromValue } from '../supabase/storage';
import { uploadProfilePhotoViaBackend } from '../backend/photoService';
import {
  blockDocId,
  col,
  docRef,
  docToModel,
  docsToModels,
  friendlyError,
  nowIso,
} from './helpers';
import {
  collectCandidates,
  fetchBlockedUids,
  fetchOutgoingTargets,
  fetchProfileDoc,
  fetchRecentlyActive,
} from './deck';
import * as premiumService from './premiumService';

/* ------------------------------------------------------------------ *
 * Photos — local picker URIs are uploaded via backend (Render) before *
 * the profile is saved. Firestore only ever receives the photo URL.   *
 * ------------------------------------------------------------------ */

const isLocalUri = (uri) => {
  if (typeof uri === 'string') {
    return /^(file|content|data|asset):/.test(uri);
  }
  if (typeof uri === 'object' && uri !== null && typeof uri.uri === 'string') {
    return /^(file|content|data|asset):/.test(uri.uri);
  }
  return false;
};

/** Replace device-local URIs with backend-uploaded URLs; clean up removed photos. */
const persistPhotos = async (uid, patch, previousPhotos = []) => {
  if (!Array.isArray(patch.photos)) return patch;

  const photos = [];
  for (const photo of patch.photos) {
    if (!isLocalUri(photo)) {
      photos.push(photo);
      continue;
    }
    try {
      const asset = typeof photo === 'object' && photo !== null ? photo : null;
      const uri = asset?.uri || photo;
      const { url } = await uploadProfilePhotoViaBackend(uri, asset);
      photos.push(url);
    } catch (error) {
      if (__DEV__) {
        console.warn(
          '[photos] upload failed:',
          error?.status || error?.name || 'unknown',
          error?.message || '',
        );
      }
      throw error;
    }
  }

  const keptPaths = new Set(
    photos.map((photo) => photoPathFromValue(photo, uid)).filter(Boolean),
  );
  await Promise.all(
    previousPhotos
      .map((photo) => photoPathFromValue(photo, uid))
      .filter((path) => path && !keptPaths.has(path))
      .map((path) => deleteProfilePhoto(path)),
  );

  return { ...patch, photos };
};

/* ------------------------------------------------------------------ *
 * Reads                                                               *
 * ------------------------------------------------------------------ */

/** Profile by uid. Own profile also carries the (read-only) Gold entitlement. */
export const getProfile = async (uid) => {
  if (!uid) return null;
  try {
    const snapshot = await getDoc(docRef('profiles', uid));
    if (!snapshot.exists()) return null;
    const profile = docToModel(snapshot);
    if (profile.uid === getFirebaseAuth().currentUser?.uid) {
      const entitlement = await premiumService.getEntitlement(uid);
      profile.gold = entitlement.isGold ? entitlement : null;
      profile.plan = entitlement.isGold ? 'gold' : profile.plan || 'free';
    }
    return profile;
  } catch (error) {
    throw new Error(friendlyError(error, 'Could not load that profile.'));
  }
};

export const getMyProfile = async () => getProfile(getFirebaseAuth().currentUser?.uid);

export const createProfile = async (uid, data) => {
  const existing = await getProfile(uid);
  if (existing) return updateProfile(uid, data);
  try {
    await setDoc(docRef('profiles', uid), {
      ...strip(data),
      uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw new Error(friendlyError(error, 'Could not create your profile.'));
  }
  return getProfile(uid);
};

/** Keys the client may never write on a profile document. */
const FORBIDDEN_PROFILE_KEYS = ['uid', 'gold', 'premium', 'plan', 'role'];

const strip = (patch) => {
  const out = {};
  Object.entries(patch || {}).forEach(([key, value]) => {
    if (value === undefined) return;
    if (FORBIDDEN_PROFILE_KEYS.includes(key)) return;
    out[key] = value;
  });
  return out;
};

export const updateProfile = async (uid, patch) => {
  const existing = await getProfile(uid);
  const withPhotos = await persistPhotos(uid, patch, existing?.photos || []);
  try {
    await setDoc(
      docRef('profiles', uid),
      { ...strip(withPhotos), uid, updatedAt: serverTimestamp() },
      { merge: true },
    );
  } catch (error) {
    throw new Error(friendlyError(error, 'Could not save your profile.'));
  }
  return getProfile(uid);
};

/** Heartbeat for the "Active now" lists. */
export const touchActivity = async (uid) => {
  if (!uid) return;
  try {
    await updateDoc(docRef('profiles', uid), { lastActiveAt: serverTimestamp() });
  } catch {
    // Profile may not exist yet — activity is optional.
  }
};

const ageOf = (profile) => {
  const d = new Date(profile.dateOfBirth);
  let age = new Date().getFullYear() - d.getFullYear();
  const month = new Date().getMonth() - d.getMonth();
  if (month < 0 || (month === 0 && new Date().getDate() < d.getDate())) age -= 1;
  return age;
};

const isVisible = (profile, me) => {
  if (!profile || profile.uid === me.uid) return false;
  if (profile.suspended) return false;
  if ((me.blockedUids || []).includes(profile.uid)) return false;
  return true;
};

/**
 * Discover deck — paginated, respects gender interest + age preferences.
 * Malindi / Watamu / surrounding members from your own area group come first.
 */
export const getDiscoverProfiles = async (myUid, { page = 0 } = {}) => {
  const me = await fetchProfileDoc(myUid);
  if (!me) return [];

  const [excludedTargets, blocked, hiddenLikers] = await Promise.all([
    fetchOutgoingTargets(myUid),
    fetchBlockedUids(myUid),
    // 🔒 a locked incoming like must never be discoverable until Gold or a match
    premiumService.getHiddenLikerUids(myUid),
  ]);
  const excluded = new Set([myUid, ...excludedTargets, ...blocked, ...hiddenLikers]);

  const pageSize = LIMITS.discoverPageSize;
  const needed = page * pageSize + pageSize;

  const candidates = await collectCandidates({
    interestedInGender: me.gender,
    need: needed,
    filter: (profile) =>
      !excluded.has(profile.uid) &&
      !profile.suspended &&
      (me.interestedIn || []).includes(profile.gender) &&
      (profile.interestedIn || []).includes(me.gender) &&
      ageOf(profile) >= (me.preferences?.minAge || 18) &&
      ageOf(profile) <= (me.preferences?.maxAge || 99) &&
      isVisible(profile, me),
  });

  // Malindi-focused ordering: own Malindi / Watamu / surrounding group first.
  candidates.sort(
    (a, b) =>
      (isSameAreaGroup(me.area, b.area) ? 1 : 0) - (isSameAreaGroup(me.area, a.area) ? 1 : 0) ||
      (b.boostedUntil ? 1 : 0) - (a.boostedUntil ? 1 : 0),
  );

  const start = page * pageSize;
  return candidates.slice(start, start + pageSize);
};

/** Singles near you — approximate distance only, respects location toggle. */
export const getNearbyProfiles = async (myUid, take = 8) => {
  const me = await fetchProfileDoc(myUid);
  if (!me) return [];

  const [blocked, hiddenLikers] = await Promise.all([
    fetchBlockedUids(myUid),
    // 🔒 locked incoming likes stay hidden from nearby too
    premiumService.getHiddenLikerUids(myUid),
  ]);
  const excluded = new Set([myUid, ...blocked, ...hiddenLikers]);

  const km = (a, b) => {
    if (!a?.location || !b?.location) return null;
    const R = 6371;
    const r = (x) => (x * Math.PI) / 180;
    const dLat = r(b.location.lat - a.location.lat);
    const dLng = r(b.location.lng - a.location.lng);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(r(a.location.lat)) * Math.cos(r(b.location.lat)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  };

  const candidates = await collectCandidates({
    interestedInGender: me.gender,
    need: 400,
    maxDocs: 900,
    filter: (profile) =>
      !excluded.has(profile.uid) &&
      !profile.suspended &&
      isKnownArea(profile.area) &&
      (me.interestedIn || []).includes(profile.gender),
  });

  return candidates
    .map((profile) => ({
      ...profile,
      distanceKm: profile.showLocation === false ? null : km(me, profile),
    }))
    .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999))
    .slice(0, take);
};

/** Active now — recently active profiles around your area. */
export const getActiveProfiles = async (myUid, take = 12) => {
  const me = await fetchProfileDoc(myUid);
  if (!me) return [];

  const [blocked, hiddenLikers, recent] = await Promise.all([
    fetchBlockedUids(myUid),
    // 🔒 locked incoming likes stay hidden from Active too
    premiumService.getHiddenLikerUids(myUid),
    fetchRecentlyActive({ sinceIso: new Date(Date.now() - 24 * 36e5).toISOString(), limit: 80 }),
  ]);
  const excluded = new Set([myUid, ...blocked, ...hiddenLikers]);

  return recent
    .filter(
      (profile) =>
        !excluded.has(profile.uid) &&
        !profile.suspended &&
        isKnownArea(profile.area) &&
        (me.interestedIn || []).includes(profile.gender),
    )
    .slice(0, take);
};

/**
 * People who liked you — delegates ALL visibility/privacy rules to
 * premiumService (3 free + Gold unlock, redacted locked rows).
 */
export const getLikedYouProfiles = async (myUid) => premiumService.getLikesYou(myUid);

/* ------------------------------------------------------------------ *
 * Blocking                                                            *
 * ------------------------------------------------------------------ */

export const blockUser = async (myUid, otherUid) => {
  const id = blockDocId(myUid, otherUid);
  const existing = await getDoc(docRef('blocks', id));
  if (existing.exists()) return docToModel(existing);

  const block = { id, uid: myUid, blockedUid: otherUid, createdAt: nowIso() };
  await setDoc(docRef('blocks', id), {
    id,
    uid: myUid,
    blockedUid: otherUid,
    createdAt: serverTimestamp(),
  });

  // A block also hides every match between the pair.
  const snapshot = await getDocs(query(col('matches'), where('uids', 'array-contains', myUid)));
  const pairs = docsToModels(snapshot).filter((m) => m.uids.includes(otherUid));
  await Promise.all(pairs.map((m) => updateDoc(docRef('matches', m.id), { blocked: true })));

  return block;
};

export const unblockUser = async (myUid, otherUid) => {
  try {
    await deleteDoc(docRef('blocks', blockDocId(myUid, otherUid)));
  } catch {
    // Already gone.
  }
};

export const getBlockedUsers = async (myUid) => {
  const snapshot = await getDocs(query(col('blocks'), where('uid', '==', myUid), fsLimit(500)));
  const profiles = [];
  for (const row of docsToModels(snapshot)) {
    const profile = await fetchProfileDoc(row.blockedUid);
    if (profile) profiles.push(profile);
  }
  return profiles;
};

export const isBlocked = async (myUid, otherUid) => {
  const blocked = await fetchBlockedUids(myUid);
  return blocked.has(otherUid);
};

export const countActiveAround = async (myUid) =>
  (await getActiveProfiles(myUid, 100)).length;

export const viewerHasBlockedMe = async (myUid) => {
  const snapshot = await getDocs(
    query(col('blocks'), where('blockedUid', '==', myUid), fsLimit(500)),
  );
  return docsToModels(snapshot).map((b) => b.uid);
};

/* ------------------------------------------------------------------ *
 * Admin (rules require users/{uid}.role == 'admin')                   *
 * ------------------------------------------------------------------ */

/** Admin: profiles waiting for selfie review. */
export const getPendingVerifications = async () => {
  const snapshot = await getDocs(
    query(col('profiles'), where('verification.status', '==', 'pending'), fsLimit(200)),
  );
  return docsToModels(snapshot).sort(
    (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0),
  );
};

/** Admin: suspend or restore an account. */
export const setSuspended = async (uid, suspended) => {
  try {
    await updateDoc(docRef('profiles', uid), {
      suspended,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw new Error(friendlyError(error, 'Could not update that account.'));
  }
  return suspended;
};

export default {
  getProfile,
  getMyProfile,
  createProfile,
  updateProfile,
  touchActivity,
  getDiscoverProfiles,
  getNearbyProfiles,
  getActiveProfiles,
  getLikedYouProfiles,
  blockUser,
  unblockUser,
  getBlockedUsers,
  isBlocked,
  countActiveAround,
  viewerHasBlockedMe,
  getPendingVerifications,
  setSuspended,
};
