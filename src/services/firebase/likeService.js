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
  passDocId,
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
      const [likeSnap, reverseSnap, matchSnap, passSnap] = await Promise.all([
        tx.get(docRef('likes', likeId)),
        tx.get(docRef('likes', reverseId)),
        tx.get(docRef('matches', matchId)),
        tx.get(docRef('passes', passDocId(fromUid, toUid))),
      ]);

      // A pass is a permanent decision: it can never be turned into a like or
      // a match, even if a stale UI fires this call again.
      if (passSnap.exists() && passSnap.data().fromUid === fromUid) {
        return { matched: false };
      }

      // Only ever (re)write the shared like doc when it is empty or already
      // this user's own record — never clobber the other person's like/pass.
      const likeOwnedByMe = likeSnap.exists() && likeSnap.data().fromUid === fromUid;
      if (!likeSnap.exists() || (likeOwnedByMe && likeSnap.data().type !== 'like')) {
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

      // The pair shares one like document, so an existing doc is not proof of a
      // reciprocal like by itself — it may be the caller's own like, or a pass.
      // Only a *like* whose stored direction is the other person → the caller
      // makes this mutual.
      if (
        reverseSnap.exists() &&
        reverseSnap.data().type === 'like' &&
        reverseSnap.data().fromUid === toUid &&
        reverseSnap.data().toUid === fromUid
      ) {
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

/**
 * Record a permanent, directional pass.
 *
 * A pass lives in its OWN document (`passes/pass_{from}__{to}`, direction
 * explicit) so it can coexist with the other person's like in the shared
 * `likes/{pair}` document — the one-doc-per-pair model could not hold both,
 * which is why a pass silently vanished before. A pass never creates a match.
 */
export const passProfile = async (fromUid, toUid) => {
  const passId = passDocId(fromUid, toUid);
  try {
    const [existingPass, existingLike] = await Promise.all([
      getDoc(docRef('passes', passId)),
      getDoc(docRef('likes', likeDocId(fromUid, toUid))),
    ]);
    // Decisions are permanent: never replace my own earlier pass, and never
    // overwrite a like I already sent. (An incoming like from the other person
    // is in the shared doc with the opposite direction and is left untouched.)
    if (existingPass.exists()) return { matched: false };
    if (existingLike.exists() && existingLike.data().fromUid === fromUid) {
      return { matched: false };
    }

    await setDoc(docRef('passes', passId), {
      id: passId,
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

/**
 * The like/pass `fromUid` sent to `toUid`, or null.
 *
 * Likes use ONE order-independent document per pair, so the doc id alone does
 * not carry direction — the stored `fromUid`/`toUid` do. A like the other
 * person sent must therefore never be returned as if the caller sent it,
 * otherwise opening their profile would read as a mutual match. Passes live in
 * their own directional collection (see `passProfile`).
 */
export const getLikeFrom = async (fromUid, toUid) => {
  try {
    const snapshot = await getDoc(docRef('likes', likeDocId(fromUid, toUid)));
    if (snapshot.exists()) {
      const like = docToModel(snapshot);
      if (like.fromUid === fromUid && like.toUid === toUid) return like;
    }
  } catch {
    // Fall through to the directional pass lookup.
  }
  try {
    const snapshot = await getDoc(docRef('passes', passDocId(fromUid, toUid)));
    if (snapshot.exists()) {
      const pass = docToModel(snapshot);
      if (pass.fromUid === fromUid && pass.toUid === toUid) return pass;
    }
  } catch {
    return null;
  }
  return null;
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
