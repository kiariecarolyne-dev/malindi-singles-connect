/**
 * 💎 premiumService — Malindi Gold entitlements + the Likes You visibility rules.
 *
 * ALL monetisation business logic lives here (never inside screens):
 *
 *   FREE member  -> visibleLikeLimit = 3   (first three incoming likes are clear)
 *   GOLD member  -> visibleLikeLimit = ∞   (every incoming like is unblurred)
 *
 * Hidden likes are NEVER deleted — they stay stored and become visible the
 * moment the account turns Gold. Screens only read what this service returns.
 *
 * DEMO MODE: no payment provider is connected. createGoldCheckout() returns a
 * clearly labelled demo checkout instead of pretending a payment succeeded.
 * When M-Pesa is wired up later, the STK push for KSh 100 (one-time) is
 * started there and the provider callback calls completeGold() with the
 * M-Pesa receipt — the entitlement shape below stays exactly the same:
 *
 *   { isGold: true, goldActivatedAt, goldPaymentId, expiresAt: null }
 *
 * There is intentionally NO subscriptionEndDate and NO renewal logic.
 */
import { DEMO_MODE } from '../../config/env';
import { FREE_VISIBLE_LIKES, GOLD } from '../../constants/plans';
import { calculateAge } from '../../utils/age';
import { compatibilityScore } from '../../utils/compatibility';
import { generateId, getDb, initDb, updateDoc } from './db';
import { createNotification } from './notificationService';

/**
 * Normalised entitlement for a profile row.
 * Supports the legacy `premium.active` demo flag written by older builds.
 */
const readEntitlement = (profile) => {
  if (!profile) return { isGold: false };
  if (profile.gold?.isGold) {
    return {
      isGold: true,
      goldActivatedAt: profile.gold.goldActivatedAt || null,
      goldPaymentId: profile.gold.goldPaymentId || null,
      source: profile.gold.source || 'unknown',
    };
  }
  if (profile.premium?.active) {
    return {
      isGold: true,
      goldActivatedAt: profile.premium.since || null,
      goldPaymentId: profile.premium.paymentId || null,
      source: profile.premium.plan || 'legacy_demo',
    };
  }
  return { isGold: false };
};

/** Sync check for screens that already hold the profile from useAuth(). */
export const isGold = (profile) => readEntitlement(profile).isGold;

/** Async entitlement lookup by uid. */
export const getEntitlement = async (uid) => {
  await initDb();
  const db = await getDb();
  return readEntitlement(db.profiles.find((p) => p.uid === uid));
};

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
  await initDb();
  const db = await getDb();

  const viewer = db.profiles.find((p) => p.uid === viewerUid);
  const goldMember = isGold(viewer);
  const limit = getVisibleLikeLimit(goldMember);

  const blocked = new Set(
    db.blocks
      .filter((b) => b.uid === viewerUid || b.blockedUid === viewerUid)
      .flatMap((b) => [b.uid, b.blockedUid]),
  );
  const myPasses = new Set(
    db.likes.filter((l) => l.fromUid === viewerUid && l.type === 'pass').map((l) => l.toUid),
  );
  const matchByOther = new Map();
  db.matches
    .filter((m) => !m.blocked && m.uids.includes(viewerUid))
    .forEach((m) => matchByOther.set(m.uids.find((x) => x !== viewerUid), m));

  const incoming = db.likes
    .filter((l) => l.toUid === viewerUid && l.type !== 'pass')
    .map((like) => ({ like, profile: db.profiles.find((p) => p.uid === like.fromUid) }))
    .filter((row) => row.profile && !row.profile.suspended && !blocked.has(row.profile.uid))
    .sort((a, b) => new Date(a.like.createdAt) - new Date(b.like.createdAt));

  return incoming.map((row, index) => {
    const match = matchByOther.get(row.profile.uid) || null;
    // Gold or an existing mutual match always wins over the free limit.
    const locked = !goldMember && !match && index >= limit;
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
 * Locked rows are REDACTED in the service: no photo, no bio, no interests —
 * only the details the free tier is allowed to tease (name, age, area,
 * compatibility) plus a blurredPhoto uri the UI always renders behind a blur.
 */
export const getLikesYou = async (viewerUid) => {
  const rows = await buildLikeRows(viewerUid);
  if (!rows.length) return [];

  await initDb();
  const db = await getDb();
  const viewer = db.profiles.find((p) => p.uid === viewerUid);

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
 * 💎 Malindi Gold — demo checkout (no fake payments)                  *
 * ------------------------------------------------------------------ */

/**
 * Starts a Gold purchase. Demo mode returns a labelled demo checkout;
 * nothing is charged and no success is faked.
 *
 * Future M-Pesa integration point: replace the demo payload with an STK push
 * for KSh 100 (amount: GOLD.price, billing: 'one_time') and resolve this
 * promise from the provider callback via completeGold().
 */
export const createGoldCheckout = async (uid) => {
  await initDb();
  const db = await getDb();
  const profile = db.profiles.find((p) => p.uid === uid);

  if (isGold(profile)) {
    return { status: 'already_gold', demo: true, entitlement: readEntitlement(profile) };
  }

  return {
    status: 'demo',
    demo: true,
    paymentsConnected: false,
    amount: GOLD.price,
    amountLabel: GOLD.priceLabel,
    currency: GOLD.currency,
    billing: 'one_time',
    reference: `MSC-GOLD-${Date.now().toString(36).toUpperCase()}`,
    message: 'Demo Mode — payments are not connected yet.',
  };
};

/**
 * Grants the permanent entitlement. This is the ONLY place Gold is written.
 * Called by the labelled demo flow today, and later by the M-Pesa callback
 * with the real transaction reference (source: 'mpesa').
 */
export const completeGold = async (uid, { paymentId = null, source = 'demo' } = {}) => {
  if (!uid) throw new Error('Missing account for Gold activation.');

  const activatedAt = new Date().toISOString();
  const entitlement = {
    isGold: true,
    goldActivatedAt: activatedAt,
    goldPaymentId: paymentId || `${source}_${generateId('gold')}`,
    price: GOLD.price,
    currency: GOLD.currency,
    billing: 'one_time',
    expiresAt: null, // lifetime — no renewal, no expiry
    source,
  };

  await initDb();
  await updateDoc('profiles', uid, {
    gold: entitlement,
    // legacy mirror kept so older readers of `premium.active` stay correct
    premium: {
      active: true,
      plan: 'gold_one_time',
      since: activatedAt,
      paymentId: entitlement.goldPaymentId,
    },
    plan: 'gold',
  });

  await createNotification({
    uid,
    type: 'premium',
    title: '💎 Malindi Gold activated',
    body: 'Lifetime access is yours — every like is now unlocked. You paid once and keep it forever.',
  });

  return entitlement;
};

/** Clearly-labelled DEMO activation. No payment provider, no fake receipt. */
export const activateDemoGold = async (uid) => {
  const checkout = await createGoldCheckout(uid);
  if (checkout.status === 'already_gold') return checkout.entitlement;
  return completeGold(uid, { paymentId: checkout.reference, source: 'demo' });
};

/** Demo-only escape hatch so free vs Gold can both be tested. */
export const deactivateDemoGold = async (uid) => {
  if (!DEMO_MODE) throw new Error('Gold cannot be removed — it is a one-time purchase.');
  await initDb();
  await updateDoc('profiles', uid, {
    gold: null,
    premium: { active: false },
    plan: 'free',
  });
  return { isGold: false };
};

export default {
  isGold,
  getEntitlement,
  getVisibleLikeLimit,
  getLikesYou,
  getHiddenLikerUids,
  isLikeLocked,
  canViewFullProfile,
  createGoldCheckout,
  completeGold,
  activateDemoGold,
  deactivateDemoGold,
};
