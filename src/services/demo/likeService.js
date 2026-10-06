/**
 * Demo likeService — likes, passes and mutual-match detection.
 * Firebase implementation mirrors these signatures.
 */
import { generateId, getDb, initDb, insert } from './db';
import { createNotification } from './notificationService';
import { isLikeLocked } from './premiumService';

/**
 * Record a like. If the other person already liked you → mutual match.
 * @returns {Promise<{matched: boolean, matchId?: string, conversationId?: string}>}
 */
export const likeProfile = async (fromUid, toUid) => {
  await initDb();
  const db = await getDb();

  const already = db.likes.find((l) => l.fromUid === fromUid && l.toUid === toUid);
  if (already && already.type === 'like') {
    const existingMatch = db.matches.find((m) => m.uids.includes(fromUid) && m.uids.includes(toUid));
    return { matched: Boolean(existingMatch), matchId: existingMatch?.id };
  }

  await insert('likes', {
    id: generateId('like'),
    fromUid,
    toUid,
    type: 'like',
    createdAt: new Date().toISOString(),
  });

  const reverse = db.likes.find((l) => l.fromUid === toUid && l.toUid === fromUid && l.type !== 'pass');
  const fromProfile = db.profiles.find((p) => p.uid === fromUid);
  const toProfile = db.profiles.find((p) => p.uid === toUid);

  if (!reverse) {
    // 🔒 never leak a locked liker's name in the notification
    const locked = await isLikeLocked(toUid, fromUid);
    await createNotification({
      uid: toUid,
      type: 'like',
      title: locked
        ? 'Someone new liked you 💛'
        : `${fromProfile?.fullName || 'Someone new'} liked you 💛`,
      body: locked
        ? 'Open Likes You — the first three likes are always free to see.'
        : 'Open Likes You to see who it is.',
      data: { otherUid: fromUid },
    });
    return { matched: false };
  }

  const existingMatch = db.matches.find((m) => m.uids.includes(fromUid) && m.uids.includes(toUid));
  if (existingMatch) return { matched: true, matchId: existingMatch.id };

  const matchId = generateId('match');
  const conversationId = generateId('conv');
  await insert('matches', {
    id: matchId,
    conversationId,
    uids: [fromUid, toUid],
    status: 'new',
    createdAt: new Date().toISOString(),
  });
  await insert('conversations', {
    id: conversationId,
    matchId,
    members: [fromUid, toUid],
    lastMessage: null,
    lastMessageAt: null,
    updatedAt: new Date().toISOString(),
  });

  await Promise.all([
    createNotification({
      uid: fromUid,
      type: 'match',
      title: `It's a match! ${toProfile?.fullName || 'Someone'} likes you too ❤️`,
      body: 'Say hello before the moment passes.',
      data: { matchId, conversationId, otherUid: toUid },
    }),
    createNotification({
      uid: toUid,
      type: 'match',
      title: `It's a match! ${fromProfile?.fullName || 'Someone'} likes you too ❤️`,
      body: 'Say hello before the moment passes.',
      data: { matchId, conversationId, otherUid: fromUid },
    }),
  ]);

  return { matched: true, matchId, conversationId };
};

/** Record a pass — removes the profile from future decks. */
export const passProfile = async (fromUid, toUid) => {
  await initDb();
  const db = await getDb();
  const existing = db.likes.find((l) => l.fromUid === fromUid && l.toUid === toUid);
  if (existing) return { matched: false };
  await insert('likes', {
    id: generateId('like'),
    fromUid,
    toUid,
    type: 'pass',
    createdAt: new Date().toISOString(),
  });
  return { matched: false };
};

/** Has this user already liked/passed me? (used by "liked you" and detail view) */
export const getLikeFrom = async (fromUid, toUid) => {
  await initDb();
  const db = await getDb();
  return db.likes.find((l) => l.fromUid === fromUid && l.toUid === toUid) || null;
};

export const countLikesUsedToday = async (uid) => {
  await initDb();
  const db = await getDb();
  const today = new Date().toDateString();
  return db.likes.filter(
    (l) => l.fromUid === uid && l.type === 'like' && new Date(l.createdAt).toDateString() === today,
  ).length;
};

export default { likeProfile, passProfile, getLikeFrom, countLikesUsedToday };
