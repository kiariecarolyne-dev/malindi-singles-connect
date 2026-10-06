/**
 * Demo matchService — matches, compatibility and Quick Match.
 * Firebase implementation mirrors these signatures.
 */
import { getDb, initDb } from './db';
import { getProfile } from './profileService';
import * as premiumService from './premiumService';
import { compatibilityScore, sharedInterests } from '../../utils/compatibility';
import { haversineKm } from '../../utils/distance';
import { isActiveRecently } from '../../utils/time';

/** Matches for a user, newest first, enriched with the other profile. */
export const getMatches = async (uid) => {
  await initDb();
  const db = await getDb();
  const rows = db.matches
    .filter((m) => m.uids.includes(uid) && !m.blocked)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const result = [];
  for (const m of rows) {
    const otherUid = m.uids.find((x) => x !== uid);
    const other = await getProfile(otherUid);
    if (other && !other.suspended) {
      result.push({
        ...m,
        otherUid,
        otherProfile: other,
        compatibility: compatibilityScore(other, db.profiles.find((p) => p.uid === uid)),
      });
    }
  }
  return result;
};

export const getMatch = async (matchId) => {
  await initDb();
  const db = await getDb();
  return db.matches.find((m) => m.id === matchId) || null;
};

/** Match between two specific users, if any. */
export const findMatchBetween = async (uidA, uidB) => {
  await initDb();
  const db = await getDb();
  return (
    db.matches.find((m) => m.uids.includes(uidA) && m.uids.includes(uidB) && !m.blocked) || null
  );
};

export const getConversationForMatch = async (matchId) => {
  await initDb();
  const db = await getDb();
  return db.conversations.find((c) => c.matchId === matchId) || null;
};

/** Compatibility detail shown on profiles. */
export const getCompatibilityWith = async (myUid, otherUid) => {
  await initDb();
  const db = await getDb();
  const me = db.profiles.find((p) => p.uid === myUid);
  const other = db.profiles.find((p) => p.uid === otherUid);
  if (!me || !other) return { score: 0, shared: [] };
  return {
    score: compatibilityScore(other, me),
    shared: sharedInterests(me.interests, other.interests),
  };
};

/**
 * ⚡ Quick Match — best compatible, nearby, recently active profile.
 * Weighted: compatibility 55%, recent activity 20%, proximity 15%,
 * not-yet-seen bonus 10%.
 */
export const quickMatch = async (myUid) => {
  await initDb();
  const db = await getDb();
  const me = db.profiles.find((p) => p.uid === myUid);
  if (!me) return null;

  const seen = new Set(db.likes.filter((l) => l.fromUid === myUid).map((l) => l.toUid));
  const blocked = new Set(
    db.blocks.filter((b) => b.uid === myUid || b.blockedUid === myUid).flatMap((b) => [b.uid, b.blockedUid]),
  );
  // 🔒 a locked incoming like must never be revealed by Quick Match
  (await premiumService.getHiddenLikerUids(myUid)).forEach((uid) => blocked.add(uid));

  const distance = (p) => {
    if (!p.location || !me.location) return null;
    return haversineKm(me.location.lat, me.location.lng, p.location.lat, p.location.lng);
  };

  const candidates = db.profiles
    .filter((p) => p.uid !== myUid && !p.suspended && !blocked.has(p.uid))
    .filter((p) => (me.interestedIn || []).includes(p.gender))
    .filter((p) => (p.interestedIn || []).includes(me.gender))
    .map((p) => {
      const compat = compatibilityScore(p, me);
      const hours = p.lastActiveAt ? (Date.now() - new Date(p.lastActiveAt).getTime()) / 36e5 : 999;
      const activity = hours < 1 ? 100 : hours < 6 ? 85 : hours < 24 ? 65 : 35;
      const km = distance(p);
      const proximity = km == null ? 50 : km < 3 ? 100 : km < 10 ? 80 : km < 30 ? 55 : 30;
      const fresh = seen.has(p.uid) ? 40 : 100;
      const score = compat * 0.55 + activity * 0.2 + proximity * 0.15 + fresh * 0.1;
      return { profile: p, score: Math.round(score), distanceKm: km, compat };
    })
    .filter((c) => !seen.has(c.profile.uid))
    .sort((a, b) => b.score - a.score);

  if (!candidates.length) return null;
  return candidates[0];
};

export const isActiveAround = async (myUid) => {
  const db = await getDb();
  const me = db.profiles.find((p) => p.uid === myUid);
  if (!me) return [];
  return db.profiles.filter(
    (p) =>
      p.uid !== myUid &&
      !p.suspended &&
      (me.interestedIn || []).includes(p.gender) &&
      isActiveRecently(p.lastActiveAt),
  );
};

export default { getMatches, getMatch, findMatchBetween, getConversationForMatch, getCompatibilityWith, quickMatch, isActiveAround };
