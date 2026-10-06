/**
 * matchService (Firebase) — matches, compatibility and Quick Match.
 * Same scoring and Malindi-focused behaviour as before; the candidate deck is
 * shared with profileService through `deck.js`.
 */
import { getDoc } from 'firebase/firestore';

import { compatibilityScore, sharedInterests } from '../../utils/compatibility';
import { haversineKm } from '../../utils/distance';
import { isActiveRecently } from '../../utils/time';
import {
  collectCandidates,
  fetchBlockedUids,
  fetchMatchesFor,
  fetchOutgoingTargets,
  fetchProfileDoc,
  fetchRecentlyActive,
} from './deck';
import * as premiumService from './premiumService';
import { docRef, docToModel, matchDocId } from './helpers';

const sortNewestFirst = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);

/** Matches for a user, newest first, enriched with the other profile. */
export const getMatches = async (uid) => {
  const rows = (await fetchMatchesFor(uid)).filter((m) => !m.blocked).sort(sortNewestFirst);
  const me = await fetchProfileDoc(uid);

  const enriched = await Promise.all(
    rows.map(async (match) => {
      const otherUid = match.uids.find((x) => x !== uid);
      const other = await fetchProfileDoc(otherUid);
      if (!other || other.suspended) return null;
      return {
        ...match,
        otherUid,
        otherProfile: other,
        compatibility: compatibilityScore(other, me),
      };
    }),
  );

  return enriched.filter(Boolean);
};

export const getMatch = async (matchId) => {
  if (!matchId) return null;
  try {
    const snapshot = await getDoc(docRef('matches', matchId));
    return snapshot.exists() ? docToModel(snapshot) : null;
  } catch {
    return null;
  }
};

/** Match between two specific users, if any (blocked pairs return null). */
export const findMatchBetween = async (uidA, uidB) => {
  try {
    const snapshot = await getDoc(docRef('matches', matchDocId(uidA, uidB)));
    if (!snapshot.exists()) return null;
    const match = docToModel(snapshot);
    return match.blocked ? null : match;
  } catch {
    return null;
  }
};

export const getConversationForMatch = async (matchId) => {
  const match = await getMatch(matchId);
  if (!match?.conversationId) return null;
  try {
    const snapshot = await getDoc(docRef('conversations', match.conversationId));
    return snapshot.exists() ? docToModel(snapshot) : null;
  } catch {
    return null;
  }
};

/** Compatibility detail shown on profiles. */
export const getCompatibilityWith = async (myUid, otherUid) => {
  const [me, other] = await Promise.all([fetchProfileDoc(myUid), fetchProfileDoc(otherUid)]);
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
  const me = await fetchProfileDoc(myUid);
  if (!me) return null;

  const [seen, blocked, hiddenLikers] = await Promise.all([
    fetchOutgoingTargets(myUid),
    fetchBlockedUids(myUid),
    // 🔒 a locked incoming like must never be revealed by Quick Match
    premiumService.getHiddenLikerUids(myUid),
  ]);
  const excluded = new Set([myUid, ...blocked, ...hiddenLikers]);

  const candidates = await collectCandidates({
    interestedInGender: me.gender,
    need: 200,
    maxDocs: 900,
    filter: (profile) =>
      !excluded.has(profile.uid) &&
      !profile.suspended &&
      (me.interestedIn || []).includes(profile.gender) &&
      (profile.interestedIn || []).includes(me.gender),
  });

  const distance = (profile) => {
    if (!profile.location || !me.location) return null;
    return haversineKm(me.location.lat, me.location.lng, profile.location.lat, profile.location.lng);
  };

  const scored = candidates
    .map((profile) => {
      const compat = compatibilityScore(profile, me);
      const hours = profile.lastActiveAt
        ? (Date.now() - new Date(profile.lastActiveAt).getTime()) / 36e5
        : 999;
      const activity = hours < 1 ? 100 : hours < 6 ? 85 : hours < 24 ? 65 : 35;
      const km = distance(profile);
      const proximity = km == null ? 50 : km < 3 ? 100 : km < 10 ? 80 : km < 30 ? 55 : 30;
      const fresh = seen.has(profile.uid) ? 40 : 100;
      const score = compat * 0.55 + activity * 0.2 + proximity * 0.15 + fresh * 0.1;
      return { profile, score: Math.round(score), distanceKm: km, compat };
    })
    .filter((candidate) => !seen.has(candidate.profile.uid))
    .sort((a, b) => b.score - a.score);

  return scored.length ? scored[0] : null;
};

/** People who were active in the last few minutes (Meet tab). */
export const isActiveAround = async (myUid) => {
  const [me, recent] = await Promise.all([
    fetchProfileDoc(myUid),
    fetchRecentlyActive({ sinceIso: new Date(Date.now() - 5 * 60 * 1000).toISOString(), limit: 60 }),
  ]);
  if (!me) return [];
  return recent.filter(
    (profile) =>
      profile.uid !== myUid &&
      !profile.suspended &&
      (me.interestedIn || []).includes(profile.gender) &&
      isActiveRecently(profile.lastActiveAt),
  );
};

export default {
  getMatches,
  getMatch,
  findMatchBetween,
  getConversationForMatch,
  getCompatibilityWith,
  quickMatch,
  isActiveAround,
};
