/**
 * likeService (Firebase) — likes, passes and mutual-match detection.
 *
 * Ids are deterministic (`like_{a}__{b}`) so double-tapping can never create
 * duplicate documents, and a mutual like creates exactly one match and one
 * conversation inside a transaction.
 */
import { getDoc, getDocs, limit as fsLimit, query, runTransaction, serverTimestamp, setDoc, where } from 'firebase/firestore';

import { createNotification } from './notificationService';
import { fetchProfileDoc } from './deck';
import { isLikeLocked } from './premiumService';
import {
  col,
  conversationDocId,
  docRef,
  docToModel,
  docsToModels,
  friendlyError,
  likeDocId,
  matchDocId,
  sortedPair,
} from './helpers';
import { getDb } from './firebaseConfig';

/**
 * Record a like. If the other person already liked you → mutual match.
 * @returns {Promise<{matched: boolean, matchId?: string, conversationId?: string}>}
 */
export const likeProfile = async (fromUid, toUid) => {
  const likeId = likeDocId(fromUid, toUid);
  const reverseId = likeDocId(toUid, fromUid);
  const matchId = matchDocId(fromUid, toUid);
  const conversationId = conversationDocId(fromUid, toUid);
  const members = sortedPair(fromUid, toUid);

  try {
    const outcome = await runTransaction(getDb(), async (tx) => {
      const [likeSnap, reverseSnap, matchSnap] = await Promise.all([
        tx.get(docRef('likes', likeId)),
        tx.get(docRef('likes', reverseId)),
        tx.get(docRef('matches', matchId)),
      ]);

      if (!likeSnap.exists() || likeSnap.data().type !== 'like') {
        tx.set(docRef('likes', likeId), {
          id: likeId,
          fromUid,
          toUid,
          type: 'like',
          createdAt: serverTimestamp(),
        });
      }

      if (matchSnap.exists()) {
        return {
          matched: true,
          isNew: false,
          matchId,
          conversationId: matchSnap.data().conversationId || conversationId,
        };
      }

      if (reverseSnap.exists() && reverseSnap.data().type !== 'pass') {
        tx.set(docRef('matches', matchId), {
          id: matchId,
          conversationId,
          uids: members,
          status: 'new',
          blocked: false,
          createdAt: serverTimestamp(),
        });
        tx.set(docRef('conversations', conversationId), {
          id: conversationId,
          matchId,
          members,
          lastMessage: null,
          lastFrom: null,
          lastMessageAt: null,
          unread: {},
          messageCount: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return { matched: true, isNew: true, matchId, conversationId };
      }

      return { matched: false };
    });

    if (!outcome.matched) {
      const [fromProfile, locked] = await Promise.all([
        fetchProfileDoc(fromUid),
        // 🔒 never leak a locked liker's name in the notification
        isLikeLocked(toUid, fromUid),
      ]);
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

    if (outcome.isNew) {
      const [fromProfile, toProfile] = await Promise.all([
        fetchProfileDoc(fromUid),
        fetchProfileDoc(toUid),
      ]);
      await Promise.all([
        createNotification({
          uid: fromUid,
          type: 'match',
          title: `It's a match! ${toProfile?.fullName || 'Someone'} likes you too ❤️`,
          body: 'Say hello before the moment passes.',
          data: { matchId: outcome.matchId, conversationId: outcome.conversationId, otherUid: toUid },
        }),
        createNotification({
          uid: toUid,
          type: 'match',
          title: `It's a match! ${fromProfile?.fullName || 'Someone'} likes you too ❤️`,
          body: 'Say hello before the moment passes.',
          data: { matchId: outcome.matchId, conversationId: outcome.conversationId, otherUid: fromUid },
        }),
      ]);
    }

    return { matched: true, matchId: outcome.matchId, conversationId: outcome.conversationId };
  } catch (error) {
    throw new Error(friendlyError(error, 'Could not send that like. Please try again.'));
  }
};

/** Record a pass — removes the profile from future decks. */
export const passProfile = async (fromUid, toUid) => {
  const id = likeDocId(fromUid, toUid);
  try {
    const existing = await getDoc(docRef('likes', id));
    if (existing.exists()) return { matched: false };
    await setDoc(docRef('likes', id), {
      id,
      fromUid,
      toUid,
      type: 'pass',
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    throw new Error(friendlyError(error, 'Could not save that pass.'));
  }
  return { matched: false };
};

/** Has this user already liked/passed me? (used by "liked you" and detail view) */
export const getLikeFrom = async (fromUid, toUid) => {
  try {
    const snapshot = await getDoc(docRef('likes', likeDocId(fromUid, toUid)));
    return snapshot.exists() ? docToModel(snapshot) : null;
  } catch {
    return null;
  }
};

/** Likes I gave today (the free daily limit). */
export const countLikesUsedToday = async (uid) => {
  try {
    const snapshot = await getDocs(query(col('likes'), where('fromUid', '==', uid), fsLimit(2000)));
    const today = new Date().toDateString();
    return docsToModels(snapshot).filter(
      (like) => like.type === 'like' && new Date(like.createdAt).toDateString() === today,
    ).length;
  } catch {
    return 0;
  }
};

export default { likeProfile, passProfile, getLikeFrom, countLikesUsedToday };
