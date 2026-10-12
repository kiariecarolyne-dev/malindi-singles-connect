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
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

import { LIMITS } from '../../config/env';
import { isKnownArea, isSameAreaGroup } from '../../constants/areas';
import { calculateAge, profileAge } from '../../utils/age';
import { getDb, getFirebaseAuth } from './firebaseConfig';
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
  toIso,
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

/**
 * Owner-only profile data (full date of birth + verification selfie) lives in
 * `profiles/{uid}/private/data`. Rules expose it to the owner and admins only;
 * the public profile keeps just a derived, non-identifying `age`.
 */
const privateRef = (uid) => doc(getDb(), 'profiles', uid, 'private', 'data');

const readPrivateData = async (uid) => {
  try {
    const snapshot = await getDoc(privateRef(uid));
    return snapshot.exists() ? docToModel(snapshot) : null;
  } catch {
    return null;
  }
};

/**
 * Fold a legacy public `dateOfBirth` into the private doc so the full DOB
 * stops being world-readable. Best-effort: a failure never blocks loading.
 */
const migratePrivateFields = async (profile) => {
  const uid = profile.uid;
  if (!uid) return;
  const existing = await readPrivateData(uid);
  const rawDob = profile.dateOfBirth || (existing ? toIso(existing.dateOfBirth) : null);
  if (!rawDob) return;

  const age = calculateAge(rawDob);
  if (!age) return;

  const dobIso = new Date(rawDob).toISOString();
  const privateMissing = !existing || !existing.dateOfBirth ||
    toIso(existing.dateOfBirth) !== dobIso;
  const publicDirty = profile.dateOfBirth != null;

  if (privateMissing || publicDirty) {
    try {
      const batch = writeBatch(getDb());
      if (privateMissing) {
        batch.set(
          privateRef(uid),
          { uid, dateOfBirth: new Date(rawDob), updatedAt: serverTimestamp() },
          { merge: true },
        );
      }
      if (publicDirty) {
        batch.update(docRef('profiles', uid), { age, dateOfBirth: deleteField() });
      }
      await batch.commit();
    } catch {
      // Best effort only — discovery still works from the legacy field.
    }
  }

  profile.age = age;
  if (publicDirty) delete profile.dateOfBirth;
};

/** Profile by uid. Own profile also carries the (read-only) Gold entitlement. */
export const getProfile = async (uid) => {
  if (!uid) return null;
  try {
    const snapshot = await getDoc(docRef('profiles', uid));
    if (!snapshot.exists()) return null;
    const profile = docToModel(snapshot);
    const isOwner = profile.uid === getFirebaseAuth().currentUser?.uid;

    if (isOwner) {
      await migratePrivateFields(profile);
      const privateData = await readPrivateData(uid);
      if (privateData) {
        const dob = toIso(privateData.dateOfBirth);
        if (dob) profile.dateOfBirth = dob;
        // Owner-only: the private storage path of the verification selfie. The
        // image itself never reaches Firestore; the backend signs short-lived
        // URLs on demand. It is never copied onto the public profile.
        if (privateData.verificationSelfiePath) {
          profile.verificationSelfiePath = privateData.verificationSelfiePath;
        }
      }
      const entitlement = await premiumService.getEntitlement(uid);
      profile.gold = entitlement.isGold ? entitlement : null;
      profile.plan = entitlement.isGold ? 'gold' : profile.plan || 'free';
    } else if (profile.dateOfBirth && !profile.age) {
      // Legacy public profile viewed by someone else: derive in memory only.
      profile.age = profileAge(profile);
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

  const privateData = await readPrivateData(uid);
  const rawDob = data?.dateOfBirth || (privateData ? toIso(privateData.dateOfBirth) : null);
  if (!rawDob) {
    throw new Error('A date of birth is required to create a profile.');
  }
  const age = calculateAge(rawDob);
  try {
    await setDoc(
      privateRef(uid),
      { uid, dateOfBirth: new Date(rawDob), updatedAt: serverTimestamp() },
      { merge: true },
    );
    const { dateOfBirth, ...rest } = data || {};
    await setDoc(docRef('profiles', uid), {
      ...strip(rest),
      age,
      uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw new Error(friendlyError(error, 'Could not create your profile.'));
  }
  return getProfile(uid);
};

/** Keys the client may never write on a public profile document. */
const FORBIDDEN_PROFILE_KEYS = [
  'uid',
  'gold',
  'premium',
  'plan',
  'role',
  'dateOfBirth',
  'verificationSelfie',
  'verificationSelfiePath',
  'verificationSelfieBucket',
  'verificationSelfieMime',
  'verificationSelfieBytes',
  'verificationSelfieUpdatedAt',
];

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
  const { dateOfBirth, ...publicPatch } = patch || {};
  const withPhotos = await persistPhotos(uid, publicPatch, existing?.photos || []);

  // The public profile only stores the derived age; keep it in sync with the
  // owner-only date of birth (rules reject an inconsistent derived age). Only
  // the owner refreshes it — admins change verification/suspension, not age.
  const merged = { ...strip(withPhotos), uid, updatedAt: serverTimestamp() };
  if (uid === getFirebaseAuth().currentUser?.uid) {
    const privateData = await readPrivateData(uid);
    if (privateData?.dateOfBirth) {
      merged.age = calculateAge(toIso(privateData.dateOfBirth));
    }
  }

  try {
    await setDoc(docRef('profiles', uid), merged, { merge: true });
    // The verification selfie path is written by the trusted backend only; the
    // owner's client is limited to the (non-sensitive) date of birth here.
    if (dateOfBirth !== undefined) {
      await setDoc(
        privateRef(uid),
        { uid, dateOfBirth: new Date(dateOfBirth), updatedAt: serverTimestamp() },
        { merge: true },
      );
    }
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

const isVisible = (profile, me) => {
  if (!profile || profile.uid === me.uid) return false;
  if (profile.suspended) return false;
  if ((me.blockedUids || []).includes(profile.uid)) return false;
  return true;
};

/** Why the discovery deck came back the way it did. */
export const DISCOVER_REASON = {
  ok: 'ok',
  empty: 'empty',
  incompleteProfile: 'incomplete-profile',
  noProfile: 'no-profile',
};

/**
 * Discover deck — paginated, respects gender interest + age preferences.
 * Malindi / Watamu / surrounding members from your own area group come first.
 *
 * Returns the deck **and** the reason it is empty. Before this, a viewer whose
 * own profile was missing `gender` / `interestedIn` — or who simply had no
 * eligible candidates — both produced an identical empty array, so the screen
 * always claimed "you have seen everyone" with no way to tell the two apart.
 * `getDiscoverDeck` makes the failure mode explicit (see `DISCOVER_REASON`).
 */
export const getDiscoverDeck = async (myUid, { page = 0 } = {}) => {
  const me = await fetchProfileDoc(myUid);
  if (!me) {
    return {
      profiles: [],
      reason: DISCOVER_REASON.noProfile,
      missing: ['profile'],
      diagnostics: { reason: DISCOVER_REASON.noProfile, myUid: myUid || null },
    };
  }

  const missing = [];
  if (!me.gender) missing.push('gender');
  if (!Array.isArray(me.interestedIn) || me.interestedIn.length === 0) missing.push('interestedIn');
  if (missing.length) {
    // The server query is `interestedIn array-contains me.gender`; without either
    // field every possible candidate is filtered out before the deck is built.
    return {
      profiles: [],
      reason: DISCOVER_REASON.incompleteProfile,
      missing,
      diagnostics: {
        reason: DISCOVER_REASON.incompleteProfile,
        missing,
        myGender: me.gender || null,
        myInterestedIn: me.interestedIn || [],
      },
    };
  }

  const [excludedTargets, blocked, hiddenLikers] = await Promise.all([
    fetchOutgoingTargets(myUid),
    fetchBlockedUids(myUid),
    // 🔒 a locked incoming like must never be discoverable until Gold or a match
    premiumService.getHiddenLikerUids(myUid),
  ]);

  const pageSize = LIMITS.discoverPageSize;
  const needed = page * pageSize + pageSize;
  const minAge = me.preferences?.minAge || 18;
  const maxAge = me.preferences?.maxAge || 99;

  const dropped = {
    alreadySeen: 0,
    blockedOrHidden: 0,
    suspended: 0,
    notMyType: 0,
    notReciprocal: 0,
    missingAge: 0,
    outOfAgeRange: 0,
  };
  const stats = { scanned: 0, matched: 0 };

  const candidates = await collectCandidates({
    interestedInGender: me.gender,
    need: needed,
    onStats: (s) => Object.assign(stats, s),
    filter: (profile) => {
      if (profile.uid === myUid || excludedTargets.has(profile.uid)) {
        dropped.alreadySeen += 1;
        return false;
      }
      if (blocked.has(profile.uid) || hiddenLikers.has(profile.uid)) {
        dropped.blockedOrHidden += 1;
        return false;
      }
      if (profile.suspended) {
        dropped.suspended += 1;
        return false;
      }
      if (!(me.interestedIn || []).includes(profile.gender)) {
        dropped.notMyType += 1;
        return false;
      }
      if (!(profile.interestedIn || []).includes(me.gender)) {
        dropped.notReciprocal += 1;
        return false;
      }
      const age = profileAge(profile);
      if (age <= 0) {
        dropped.missingAge += 1;
        return false;
      }
      if (age < minAge || age > maxAge) {
        dropped.outOfAgeRange += 1;
        return false;
      }
      if (!isVisible(profile, me)) {
        dropped.blockedOrHidden += 1;
        return false;
      }
      return true;
    },
  });

  // Malindi-focused ordering: own Malindi / Watamu / surrounding group first.
  candidates.sort(
    (a, b) =>
      (isSameAreaGroup(me.area, b.area) ? 1 : 0) - (isSameAreaGroup(me.area, a.area) ? 1 : 0) ||
      (b.boostedUntil ? 1 : 0) - (a.boostedUntil ? 1 : 0),
  );

  const start = page * pageSize;
  const profiles = candidates.slice(start, start + pageSize);

  return {
    profiles,
    reason: candidates.length ? DISCOVER_REASON.ok : DISCOVER_REASON.empty,
    missing: [],
    diagnostics: {
      reason: candidates.length ? DISCOVER_REASON.ok : DISCOVER_REASON.empty,
      myGender: me.gender,
      myInterestedIn: me.interestedIn || [],
      myAgeRange: [minAge, maxAge],
      scanned: stats.scanned,
      matched: stats.matched,
      dropped,
    },
  };
};

/** Array-only wrapper — kept for callers that don't need the empty reason. */
export const getDiscoverProfiles = async (myUid, options) =>
  (await getDiscoverDeck(myUid, options)).profiles;

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

/** Admin: profiles waiting for selfie review (selfie comes from the private doc). */
export const getPendingVerifications = async () => {
  const snapshot = await getDocs(
    query(col('profiles'), where('verification.status', '==', 'pending'), fsLimit(200)),
  );
  const rows = await Promise.all(
    docsToModels(snapshot).map(async (profile) => {
      const privateData = await readPrivateData(profile.uid);
      return privateData?.verificationSelfiePath
        ? { ...profile, verificationSelfiePath: privateData.verificationSelfiePath }
        : profile;
    }),
  );
  return rows.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
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
  getDiscoverDeck,
  DISCOVER_REASON,
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
