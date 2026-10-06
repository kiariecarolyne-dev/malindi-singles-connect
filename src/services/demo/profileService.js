/**
 * Demo profileService — profile CRUD, discovery queries, blocking.
 * Firebase implementation mirrors these signatures.
 */
import { LIMITS } from '../../config/env';
import { isKnownArea, isSameAreaGroup } from '../../constants/areas';
import { generateId, getDb, initDb, insert, query, removeWhere, updateDoc } from './db';
import { getCurrentUser } from './authService';
import * as premiumService from './premiumService';

export const getProfile = async (uid) => {
  await initDb();
  const db = await getDb();
  return db.profiles.find((p) => p.uid === uid) || null;
};

export const getMyProfile = async () => {
  const user = getCurrentUser();
  if (!user) return null;
  return getProfile(user.uid);
};

export const createProfile = async (uid, data) => {
  await initDb();
  const existing = await getProfile(uid);
  if (existing) return updateProfile(uid, data);
  const profile = { uid, ...data, createdAt: new Date().toISOString() };
  await insert('profiles', profile);
  return profile;
};

export const updateProfile = async (uid, patch) => {
  await initDb();
  await updateDoc('profiles', uid, { ...patch, updatedAt: new Date().toISOString() });
  return getProfile(uid);
};

export const touchActivity = async (uid) => {
  await updateDoc('profiles', uid, { lastActiveAt: new Date().toISOString() });
};

const isVisible = (p, me) => {
  if (!p || p.uid === me.uid) return false;
  if (p.suspended) return false;
  if ((me.blockedUids || []).includes(p.uid)) return false;
  return true;
};

const viewerBlockedMe = async (myUid) => {
  const blocks = await query('blocks', (b) => b.blockedUid === myUid);
  return blocks.map((b) => b.uid);
};

/** Discover deck — paginated, respects gender interest + age preferences. */
export const getDiscoverProfiles = async (myUid, { page = 0 } = {}) => {
  await initDb();
  const db = await getDb();
  const me = db.profiles.find((p) => p.uid === myUid);
  if (!me) return [];

  const excluded = new Set([
    myUid,
    ...(await query('likes', (l) => l.fromUid === myUid)).map((l) => l.toUid),
    ...(await query('blocks', (b) => b.uid === myUid || b.blockedUid === myUid)).flatMap(
      (b) => [b.uid, b.blockedUid],
    ),
    // 🔒 locked incoming likes are hidden from the free deck entirely —
    // a locked liker must never be discoverable until Gold or a match.
    ...(await premiumService.getHiddenLikerUids(myUid)),
  ]);

  const ageOf = (p) => {
    const d = new Date(p.dateOfBirth);
    let a = new Date().getFullYear() - d.getFullYear();
    const m = new Date().getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && new Date().getDate() < d.getDate())) a -= 1;
    return a;
  };

  const candidates = db.profiles
    .filter((p) => !excluded.has(p.uid) && !p.suspended)
    .filter((p) => (me.interestedIn || []).includes(p.gender))
    .filter((p) => (p.interestedIn || []).includes(me.gender))
    .filter((p) => {
      const age = ageOf(p);
      const min = me.preferences?.minAge || 18;
      const max = me.preferences?.maxAge || 99;
      return age >= min && age <= max;
    })
    .filter((p) => isVisible(p, me))
    // Malindi-focused ordering: people from your own Malindi / Watamu /
    // surrounding group come up before anyone further out.
    .sort(
      (a, b) =>
        (isSameAreaGroup(me.area, b.area) ? 1 : 0) - (isSameAreaGroup(me.area, a.area) ? 1 : 0) ||
        (b.boostedUntil ? 1 : 0) - (a.boostedUntil ? 1 : 0),
    );

  const start = page * LIMITS.discoverPageSize;
  return candidates.slice(start, start + LIMITS.discoverPageSize);
};

/** Singles near you — approximate distance only, respects location toggle. */
export const getNearbyProfiles = async (myUid, limit = 8) => {
  await initDb();
  const db = await getDb();
  const me = db.profiles.find((p) => p.uid === myUid);
  if (!me) return [];
  const blocked = new Set(
    (await query('blocks', (b) => b.uid === myUid || b.blockedUid === myUid)).flatMap(
      (b) => [b.uid, b.blockedUid],
    ),
  );
  // 🔒 locked incoming likes stay hidden from nearby too
  (await premiumService.getHiddenLikerUids(myUid)).forEach((uid) => blocked.add(uid));
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

  return db.profiles
    .filter((p) => p.uid !== myUid && !p.suspended && !blocked.has(p.uid))
    .filter((p) => isKnownArea(p.area))
    .filter((p) => (me.interestedIn || []).includes(p.gender))
    .map((p) => ({
      ...p,
      distanceKm: p.showLocation === false ? null : km(me, p),
    }))
    .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999))
    .slice(0, limit);
};

/** Active now — recently active profiles around your area. */
export const getActiveProfiles = async (myUid, limit = 12) => {
  await initDb();
  const db = await getDb();
  const me = db.profiles.find((p) => p.uid === myUid);
  if (!me) return [];
  const blocked = new Set(
    (await query('blocks', (b) => b.uid === myUid || b.blockedUid === myUid)).flatMap(
      (b) => [b.uid, b.blockedUid],
    ),
  );
  // 🔒 locked incoming likes stay hidden from Active too
  (await premiumService.getHiddenLikerUids(myUid)).forEach((uid) => blocked.add(uid));
  const cutoff = Date.now() - 24 * 36e5;
  return db.profiles
    .filter((p) => p.uid !== myUid && !p.suspended && !blocked.has(p.uid))
    .filter((p) => isKnownArea(p.area))
    .filter((p) => (me.interestedIn || []).includes(p.gender))
    .filter((p) => p.lastActiveAt && new Date(p.lastActiveAt).getTime() > cutoff)
    .sort((a, b) => new Date(b.lastActiveAt) - new Date(a.lastActiveAt))
    .slice(0, limit);
};

/**
 * People who liked you — delegates ALL visibility/privacy rules to
 * premiumService (3 free + Gold unlock, redacted locked rows).
 */
export const getLikedYouProfiles = async (myUid) => premiumService.getLikesYou(myUid);

/** Blocking */
export const blockUser = async (myUid, otherUid) => {
  const existing = await query('blocks', (b) => b.uid === myUid && b.blockedUid === otherUid);
  if (existing.length) return existing[0];
  const block = {
    id: generateId('block'),
    uid: myUid,
    blockedUid: otherUid,
    createdAt: new Date().toISOString(),
  };
  await insert('blocks', block);
  // a block also removes matches between the pair
  const matches = await query('matches', (m) => m.uids.includes(myUid) && m.uids.includes(otherUid));
  for (const m of matches) {
    await updateDoc('matches', m.id, { blocked: true });
  }
  return block;
};

export const unblockUser = async (myUid, otherUid) => {
  await removeWhere('blocks', (b) => b.uid === myUid && b.blockedUid === otherUid);
};

export const getBlockedUsers = async (myUid) => {
  const blocks = await query('blocks', (b) => b.uid === myUid);
  const profiles = [];
  for (const b of blocks) {
    const p = await getProfile(b.blockedUid);
    if (p) profiles.push(p);
  }
  return profiles;
};

export const isBlocked = async (myUid, otherUid) => {
  const blocks = await query(
    'blocks',
    (b) => (b.uid === myUid && b.blockedUid === otherUid) || (b.uid === otherUid && b.blockedUid === myUid),
  );
  return blocks.length > 0;
};

export const countActiveAround = async (myUid) => {
  const list = await getActiveProfiles(myUid, 100);
  return list.length;
};

/** Admin: profiles waiting for selfie review. */
export const getPendingVerifications = async () => {
  await initDb();
  const db = await getDb();
  return db.profiles
    .filter((p) => p.verification?.status === 'pending')
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
};

/** Admin: suspend or restore an account. */
export const setSuspended = async (uid, suspended) => {
  await updateDoc('profiles', uid, { suspended });
  return suspended;
};

export const viewerHasBlockedMe = viewerBlockedMe;

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
  getPendingVerifications,
  setSuspended,
};
