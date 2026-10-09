/**
 * Shared Firestore reads used by more than one service (no service imports
 * another service's internals — both premium and discovery reuse these).
 *
 * Keep this file free of premium/visibility rules: callers pass the exact
 * filters they need so the locked-liker privacy rules stay in premiumService.
 */
import { getDoc, getDocs, limit, orderBy, query, startAfter, Timestamp, where } from 'firebase/firestore';

import { docsToModels, docToModel, col, docRef } from './helpers';

const CANDIDATE_BATCH = 100;

/** A single profile document (without any entitlement data). */
export const fetchProfileDoc = async (uid) => {
  if (!uid) return null;
  try {
    const snapshot = await getDoc(docRef('profiles', uid));
    return snapshot.exists() ? docToModel(snapshot) : null;
  } catch {
    return null;
  }
};

/**
 * Uids I blocked plus uids that blocked me — mirrored across both fields so
 * one query set covers both directions.
 */
export const fetchBlockedUids = async (uid) => {
  const [outgoing, incoming] = await Promise.all([
    getDocs(query(col('blocks'), where('uid', '==', uid), limit(500))),
    getDocs(query(col('blocks'), where('blockedUid', '==', uid), limit(500))),
  ]);
  const blocked = new Set();
  [...outgoing.docs, ...incoming.docs].forEach((snapshot) => {
    const row = docToModel(snapshot);
    blocked.add(row.uid);
    blocked.add(row.blockedUid);
  });
  blocked.delete(uid);
  return blocked;
};

/** Targets of every like/pass I already gave — they leave my deck. */
export const fetchOutgoingTargets = async (uid) => {
  const snapshot = await getDocs(query(col('likes'), where('fromUid', '==', uid), limit(2000)));
  return new Set(snapshot.docs.map((d) => docToModel(d).toUid));
};

/** Incoming likes (oldest first) — the raw input of "Likes You". */
export const fetchIncomingLikes = async (uid) => {
  const snapshot = await getDocs(
    query(col('likes'), where('toUid', '==', uid), orderBy('createdAt', 'asc'), limit(2000)),
  );
  return docsToModels(snapshot);
};

/** Matches I take part in (for locked-liker and compatibility context). */
export const fetchMatchesFor = async (uid) => {
  const snapshot = await getDocs(query(col('matches'), where('uids', 'array-contains', uid)));
  return docsToModels(snapshot);
};

/**
 * Profiles that could appear in my deck, read in small batches until `filter`
 * has produced `need` matches (bounded by `maxDocs`).
 *
 * Server side narrows to people interested in my gender; everything that
 * requires my own profile (gender reciprocity, age range, area group, blocks,
 * locked likers) is applied by the caller's filter.
 */
export const collectCandidates = async ({ interestedInGender, filter, need = 12, maxDocs = 900 }) => {
  if (!interestedInGender) return [];
  const results = [];
  let cursor = null;
  let scanned = 0;

  while (results.length < need && scanned < maxDocs) {
    // Firestore implicitly orders by document id when no orderBy is given, so
    // pagination via startAfter(cursor) still walks the deck in a stable order.
    // No explicit orderBy(documentId()) here: combined with `array-contains`
    // it can require a composite index and trips the emulator.
    const constraints = [
      where('interestedIn', 'array-contains', interestedInGender),
      limit(CANDIDATE_BATCH),
    ];
    const q = cursor
      ? query(col('profiles'), ...constraints, startAfter(cursor))
      : query(col('profiles'), ...constraints);
    const snapshot = await getDocs(q);
    if (snapshot.empty) break;

    scanned += snapshot.size;
    snapshot.docs.forEach((d) => {
      const profile = docToModel(d);
      if (filter(profile)) results.push(profile);
    });

    cursor = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < CANDIDATE_BATCH) break;
  }

  return results;
};

/** Recently active profiles (server-side time window). */
export const fetchRecentlyActive = async ({ sinceIso, limit: take = 60 }) => {
  const snapshot = await getDocs(
    query(
      col('profiles'),
      where('lastActiveAt', '>', Timestamp.fromDate(new Date(sinceIso))),
      orderBy('lastActiveAt', 'desc'),
      limit(take),
    ),
  );
  return docsToModels(snapshot);
};

export default {
  fetchProfileDoc,
  fetchBlockedUids,
  fetchOutgoingTargets,
  fetchIncomingLikes,
  fetchMatchesFor,
  collectCandidates,
  fetchRecentlyActive,
};
