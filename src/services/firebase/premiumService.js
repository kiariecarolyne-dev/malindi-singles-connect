/**
 * 💎 premiumService (Firebase) — Malindi Gold entitlements + Likes You rules.
 *
 * The visibility business logic is identical to the original demo version:
 *
 *   FREE member -> first 3 incoming likes are visible (oldest first)
 *   GOLD member -> every incoming like is visible
 *
 * Locked likes are NEVER deleted — they stay in Firestore and unlock the
 * moment `goldEntitlements/{uid}` says isGold.
 *
 * Gold is granted ONLY by the backend (today: manually from the Firebase
 * console; later: the Daraja/M-Pesa callback after a verified KSh 100
 * payment). The client has no code path that can create or modify an
 * entitlement — `firestore.rules` denies it.
 */
import { getDoc, getDocs, limit, query, where } from 'firebase/firestore';

import { FREE_VISIBLE_LIKES, GOLD } from '../../constants/plans';
import { calculateAge } from '../../utils/age';
import { compatibilityScore } from '../../utils/compatibility';
import { startGoldPayment, getPaymentStatus } from '../backend/paymentService';
import { getFirebaseAuth } from './firebaseConfig';
import { col, docRef, docToModel, docsToModels } from './helpers';
import {
  fetchBlockedUids,
  fetchIncomingLikes,
  fetchMatchesFor,
  fetchProfileDoc,
} from './deck';

/** Normalised entitlement document: `goldEntitlements/{uid}`. */
const normaliseEntitlement = (row) => {
  if (!row || !row.isGold) return { isGold: false };
  return {
    isGold: true,
    goldActivatedAt: row.goldActivatedAt || null,
    goldPaymentId: row.goldPaymentId || null,
    price: row.price ?? GOLD.price,
    currency: row.currency || GOLD.currency,
    billing: row.billing || 'one_time',
    expiresAt: row.expiresAt || null,
    source: row.source || 'backend',
  };
};

/**
 * Async entitlement lookup by uid (read-only for clients).
 * Supports a legacy `gold` object on the profile document as well, so an
 * account granted Gold by an earlier build still reads correctly.
 */
export const getEntitlement = async (uid) => {
  if (!uid) return { isGold: false };
  try {
    const snapshot = await getDoc(docRef('goldEntitlements', uid));
    if (snapshot.exists()) return normaliseEntitlement(docToModel(snapshot));
    const profile = await getDoc(docRef('profiles', uid));
    if (profile.exists()) {
      const legacy = docToModel(profile);
      if (legacy.gold?.isGold) return normaliseEntitlement(legacy.gold);
      if (legacy.premium?.active) {
        return normaliseEntitlement({
          isGold: true,
          goldActivatedAt: legacy.premium.since || null,
          goldPaymentId: legacy.premium.paymentId || null,
          source: legacy.premium.plan || 'legacy',
        });
      }
    }
  } catch {
    // Not configured / offline: treat as free so the app stays usable.
  }
  return { isGold: false };
};

/** Sync check for screens that already hold the profile from useAuth(). */
export const isGold = (profile) =>
  Boolean(profile?.gold?.isGold || profile?.premium?.active);

/**
 * The core visibility rule.
 * FREE -> first 3 likes visible, GOLD -> unlimited (hidden likes are kept).
 */
export const getVisibleLikeLimit = (goldMember) =>
  goldMember ? Number.POSITIVE_INFINITY : FREE_VISIBLE_LIKES;

/* ------------------------------------------------------------------ *
 * Likes You — ordering, visibility and privacy                        *
 * ------------------------------------------------------------------ */

/**
 * Every incoming like, oldest first ("the first three people who liked you"),
 * with blocked / suspended / already-matched context attached.
 */
const buildLikeRows = async (viewerUid) => {
  if (!viewerUid) return [];

  const [viewer, incoming, blocked, matches, outgoing, entitlement] = await Promise.all([
    fetchProfileDoc(viewerUid),
    fetchIncomingLikes(viewerUid),
    fetchBlockedUids(viewerUid),
    fetchMatchesFor(viewerUid),
    getDocs(query(col('likes'), where('fromUid', '==', viewerUid), limit(2000))),
    getEntitlement(viewerUid),
  ]);

  const goldMember = entitlement.isGold || isGold(viewer);
  const visibleLimit = getVisibleLikeLimit(goldMember);

  const myPasses = new Set(
    docsToModels(outgoing)
      .filter((l) => l.type === 'pass')
      .map((l) => l.toUid),
  );
  const matchByOther = new Map();
  matches
    .filter((m) => !m.blocked)
    .forEach((m) => matchByOther.set(m.uids.find((x) => x !== viewerUid), m));

  const likerProfiles = await Promise.all(incoming.map((like) => fetchProfileDoc(like.fromUid)));
  const rows = incoming
    .map((like, i) => ({ like, profile: likerProfiles[i] }))
    .filter(
      (row) =>
        row.profile &&
        row.like.type !== 'pass' &&
        !row.profile.suspended &&
        !blocked.has(row.profile.uid),
    );

  return rows.map((row, index) => {
    const match = matchByOther.get(row.profile.uid) || null;
    // Gold or an existing mutual match always wins over the free limit.
    const locked = !goldMember && !match && index >= visibleLimit;
    return {
      profile: row.profile,
      likedAt: row.like.createdAt,
      index,
      locked,
      matched: Boolean(match),
      matchId: match?.id || null,
      conversationId: match?.conversationId || null,
      passed: myPasses.has(row.profile.uid),
    };
  });
};

/**
 * "Likes You" rows for the screen.
 * Locked rows are REDACTED here in the service: no photo, no bio, no
 * interests — only what the free tier may tease (name, age, area,
 * compatibility) plus a blurredPhoto uri the UI renders behind a blur.
 */
export const getLikesYou = async (viewerUid) => {
  const rows = await buildLikeRows(viewerUid);
  if (!rows.length) return [];

  const viewer = await fetchProfileDoc(viewerUid);

  return rows.map((row) => {
    const age = calculateAge(row.profile.dateOfBirth);
    const base = {
      uid: row.profile.uid,
      fullName: row.profile.fullName,
      age: age > 0 ? age : null,
      area: row.profile.area,
      gender: row.profile.gender,
      likedAt: row.likedAt,
      locked: row.locked,
      matched: row.matched,
      passed: row.passed,
      matchId: row.matchId,
      conversationId: row.conversationId,
      compatibility: compatibilityScore(row.profile, viewer),
    };

    if (row.locked) {
      return {
        ...base,
        photos: [],
        blurredPhoto: row.profile.photos?.[0] || null,
        interests: [],
        datingIntention: null,
        bio: null,
      };
    }

    return {
      ...base,
      ...row.profile,
      age: base.age,
      likedAt: row.likedAt,
      locked: false,
      matched: row.matched,
      passed: row.passed,
      matchId: row.matchId,
      conversationId: row.conversationId,
      compatibility: base.compatibility,
      blurredPhoto: null,
    };
  });
};

/**
 * Uids whose photo must NOT appear anywhere for this (free) viewer —
 * used to keep locked likers out of Discover, Nearby, Active and Quick Match.
 * Gold members get an empty set: nothing is hidden from them.
 */
export const getHiddenLikerUids = async (viewerUid) => {
  const rows = await buildLikeRows(viewerUid);
  const hidden = new Set();
  rows.forEach((row) => {
    if (row.locked) hidden.add(row.profile.uid);
  });
  return hidden;
};

/**
 * Is this incoming like still locked for the viewer?
 * Used by notifications so a locked liker's name is never leaked there.
 */
export const isLikeLocked = async (viewerUid, likerUid) => {
  const rows = await buildLikeRows(viewerUid);
  const row = rows.find((r) => r.profile.uid === likerUid);
  return Boolean(row?.locked);
};

/**
 * Privacy gate: may this viewer see this person's real photos?
 *  · Gold member          -> yes
 *  · mutual match         -> yes
 *  · inside the free window (or not a liker at all) -> yes
 *  · a locked incoming like -> no
 */
export const canViewFullProfile = async (viewerUid, targetUid) => {
  if (!viewerUid || !targetUid || viewerUid === targetUid) return true;
  const rows = await buildLikeRows(viewerUid);
  const row = rows.find((r) => r.profile.uid === targetUid);
  if (!row) return true;
  return !row.locked;
};

/* ------------------------------------------------------------------ *
 * 💎 Malindi Gold — M-Pesa checkout (via the backend / Daraja)         *
 * ------------------------------------------------------------------ */

/**
 * Starts a Gold purchase by asking the backend to send an M-Pesa (STK) push
 * for the fixed KSh 100 price. The backend owns the amount and the UID; this
 * function only forwards the customer's phone number and returns the
 * paymentId used to poll status. Gold can NEVER be written from here.
 */
export const createGoldCheckout = async (phoneNumber) => {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) throw new Error('You must be signed in to buy Malindi Gold.');

  const entitlement = await getEntitlement(uid);
  if (entitlement.isGold) {
    return { status: 'already_gold', paymentsConnected: true, entitlement };
  }

  const result = await startGoldPayment(phoneNumber);
  return {
    status: 'pending',
    paymentsConnected: true,
    paymentId: result.paymentId,
    checkoutRequestId: result.checkoutRequestId,
    amount: GOLD.price,
    amountLabel: GOLD.priceLabel,
    currency: GOLD.currency,
    billing: 'one_time',
  };
};

/** Poll the backend for a payment's status. */
export const getGoldPaymentStatus = (paymentId) => getPaymentStatus(paymentId);

export default {
  isGold,
  getEntitlement,
  getVisibleLikeLimit,
  getLikesYou,
  getHiddenLikerUids,
  isLikeLocked,
  canViewFullProfile,
  createGoldCheckout,
  getGoldPaymentStatus,
};
