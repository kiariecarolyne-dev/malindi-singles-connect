/**
 * 💛 goldCircleService (Firebase) — Gold Circle, the Gold-only community.
 *
 * Gold Circle is EXCLUSIVE to Malindi Gold members. Access is enforced twice:
 *
 *  1. This service asserts the authoritative entitlement
 *     (`goldEntitlements/{uid}` via premiumService) before every read/write.
 *  2. `firestore.rules` re-checks the entitlement server-side, so a normal
 *     Firebase client can never read, create, edit or delete Gold Circle
 *     content — and can NEVER write `goldEntitlements/{uid}` to self-grant.
 *
 * Data model (Firestore):
 *   goldCirclePosts/{postId}
 *     authorUid, authorName, authorAvatar, text, category,
 *     imageUrl, imagePath, sharedWhatsApp, whatsapp,
 *     likedBy[], likeCount, commentCount, createdAt, updatedAt
 *   goldCirclePosts/{postId}/comments/{commentId}
 *     authorUid, authorName, authorAvatar, text, createdAt
 *
 * Photos reuse the existing secure pipeline:
 *   Firebase Auth (ID token) -> backend -> private Supabase storage.
 * The app never holds a Supabase service-role key and Firebase Storage is
 * not used.
 */
import {
  collection,
  deleteDoc,
  setDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit as fsLimit,
  orderBy,
  query,
  where,
  runTransaction,
  serverTimestamp,
  startAfter,
  writeBatch,
} from 'firebase/firestore';

import { LIMITS } from '../../config/env';
import { profileAge } from '../../utils/age';
import { uploadProfilePhotoViaBackend } from '../backend/photoService';
import { deleteProfilePhoto } from '../supabase/storage';
import { getDb } from './firebaseConfig';
import { blockDocId, col, docRef, docToModel, docsToModels, friendlyError } from './helpers';
import { fetchBlockedUids, fetchProfileDoc } from './deck';
import * as premiumService from './premiumService';

const POSTS = 'goldCirclePosts';
const POST_AUTHORS = 'goldCirclePostAuthors';
const DAILY = 'goldCircleDailyTopics';
const SAVES = 'goldCircleSaves';
const CHALLENGES = 'goldCircleChallengeCompletions';
const GAMES = 'goldCircleGameTallies';

/** Post categories shown in the composer and on every post. */
export const CATEGORIES = [
  { id: 'for_you', label: 'For You', emoji: '✨' },
  { id: 'love_story', label: 'Love Stories', emoji: '💌' },
  { id: 'date_idea', label: 'Date Ideas', emoji: '🌹' },
  { id: 'relationship', label: 'Relationships', emoji: '💞' },
  { id: 'style_beauty', label: 'Style & Beauty', emoji: '💄' },
  { id: 'couple_moment', label: 'Couple Moments', emoji: '👩‍❤️‍👨' },
  { id: 'confession', label: 'Confessions', emoji: '🤫' },
  { id: 'love_game', label: 'Love Games', emoji: '🎮' },
  { id: 'community', label: 'Community & Lifestyle', emoji: '🏝️' },
  // Legacy ids kept for backward compatibility with existing posts.
  { id: 'discussion', label: 'Discussion', emoji: '💬' },
  { id: 'question', label: 'Question', emoji: '❓' },
  { id: 'experience', label: 'Dating experience', emoji: '💘' },
  { id: 'story', label: 'Success Story', emoji: '🏆' },
  { id: 'photo', label: 'Photo', emoji: '📷' },
];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

/* ------------------------------------------------------------------ *
 * Gold gate                                                           *
 * ------------------------------------------------------------------ */

/**
 * Throws unless the uid holds the authoritative Malindi Gold entitlement.
 * Mirrors the client-side checks so screens never reach a collection the
 * rules would reject (the rules still deny independently).
 */
export const assertGoldMember = async (uid) => {
  if (!uid) throw new Error('You must be signed in to use Gold Circle.');
  const entitlement = await premiumService.getEntitlement(uid);
  if (!entitlement.isGold) {
    const error = new Error('Gold Circle is exclusive to Malindi Gold members.');
    error.code = 'gold-required';
    throw error;
  }
  return entitlement;
};

/**
 * Throw when a block exists in either direction between the viewer and the
 * other member. Enforced again in `firestore.rules`; this pre-flight check
 * keeps the UI from firing a write the server would reject.
 */
const assertNotBlocked = async (uid, otherUid) => {
  if (!uid || !otherUid || uid === otherUid) return;
  const snapshot = await getDoc(docRef('blocks', blockDocId(uid, otherUid)));
  if (snapshot.exists()) {
    const error = new Error('You can no longer interact with this member.');
    error.code = 'blocked';
    throw error;
  }
};

/* ------------------------------------------------------------------ *
 * Validation                                                          *
 * ------------------------------------------------------------------ */

const cleanText = (value, max, label) => {
  const text = (value || '').trim();
  if (!text) throw new Error(`Your ${label} cannot be empty.`);
  if (text.length > max) {
    throw new Error(`${label[0].toUpperCase()}${label.slice(1)} is limited to ${max} characters.`);
  }
  return text;
};

/** Kenyan or international numbers only: spaces/dashes stripped, 7–15 digits. */
export const normalizeWhatsApp = (value) => {
  const cleaned = String(value || '').replace(/[\s()-]/g, '');
  if (!/^\+?[0-9]{7,15}$/.test(cleaned)) {
    throw new Error('Enter a valid WhatsApp number, e.g. 0712345678.');
  }
  return cleaned;
};

const validateImage = (image) => {
  if (!image?.uri) return;
  if (typeof image.fileSize === 'number' && image.fileSize > LIMITS.goldCircleImageMaxBytes) {
    throw new Error('That photo is too large. Please choose one under 5 MB.');
  }
};

/* ------------------------------------------------------------------ *
 * Feed reads                                                          *
 * ------------------------------------------------------------------ */

const fetchPage = async (cursor, category = null) => {
  const constraints = [];
  if (category && category !== 'for_you') constraints.push(where('category', '==', category));
  constraints.push(orderBy('createdAt', 'desc'), fsLimit(LIMITS.goldCirclePageSize));
  if (cursor) constraints.unshift(startAfter(cursor));
  const snapshot = await getDocs(query(col(POSTS), ...constraints));
  const nextCursor =
    snapshot.docs.length >= LIMITS.goldCirclePageSize
      ? snapshot.docs[snapshot.docs.length - 1]
      : null;
  return { rows: docsToModels(snapshot), nextCursor };
};

/**
 * Enrich a page with fresh author profiles and drop anything the viewer
 * should not see (blocked or suspended authors).
 * Keeps fetching further pages (max 3) so filtering never shows a
 * misleading empty feed when the first page is entirely filtered out.
 */
const hydratePage = async (rows, viewerUid) => {
  const anonymousRows = rows.filter((row) => row.isAnonymous);
  const privateAuthorSnaps = await Promise.all(
    anonymousRows.map(async (row) => {
      try {
        return await getDoc(doc(getDb(), POST_AUTHORS, row.id));
      } catch {
        // Identity-protected: non-authors (and the rules) deny this read.
        return null;
      }
    }),
  );
  const privateAuthorByPost = new Map(
    anonymousRows.map((row, index) => {
      const snap = privateAuthorSnaps[index];
      return [row.id, snap && snap.exists() ? snap.data()?.uid : null];
    }),
  );
  const resolvedUids = rows.map((row) =>
    row.isAnonymous ? privateAuthorByPost.get(row.id) || row.authorUid : row.authorUid,
  );
  const allAuthorUids = [...new Set(resolvedUids.filter(Boolean))];
  const [blocked, profiles] = await Promise.all([
    fetchBlockedUids(viewerUid),
    Promise.all(allAuthorUids.map((uid) => fetchProfileDoc(uid))),
  ]);
  const byUid = new Map(allAuthorUids.map((uid, i) => [uid, profiles[i]]));

  const visible = [];
  rows.forEach((row, index) => {
    const resolvedAuthorUid = resolvedUids[index];
    if (blocked.has(resolvedAuthorUid)) return;
    const author = byUid.get(resolvedAuthorUid);
    if (author?.suspended) return;
    const age = author ? profileAge(author) : 0;
    const anonymous = Boolean(row.isAnonymous);
    const mask = anonymous && resolvedAuthorUid !== viewerUid;
    visible.push({
      ...row,
      authorUid: mask ? null : resolvedAuthorUid,
      authorName: mask ? 'Anonymous' : (author?.fullName || row.authorName),
      authorAvatar: mask ? null : (author?.photos?.[0] || row.authorAvatar || null),
      authorAge: mask ? null : (age > 0 ? age : null),
      authorArea: mask ? null : (author?.area || null),
      isAnonymous: anonymous,
    });
  });
  return visible;
};

/**
 * One page of the community feed for `viewerUid`.
 * Returns { posts, nextCursor } — pass nextCursor back for pagination.
 */
export const getFeed = async (viewerUid, cursor = null, category = null) => {
  await assertGoldMember(viewerUid);
  try {
    const posts = [];
    let pageCursor = cursor;
    for (let attempt = 0; attempt < 3 && posts.length < LIMITS.goldCirclePageSize; attempt += 1) {
      const page = await fetchPage(pageCursor, category);
      posts.push(...(await hydratePage(page.rows, viewerUid)));
      pageCursor = page.nextCursor;
      if (!pageCursor) break;
    }
    return { posts, nextCursor: pageCursor };
  } catch (error) {
    if (error?.code === 'gold-required') throw error;
    throw new Error(friendlyError(error, 'Could not load Gold Circle right now.'));
  }
};

/** Flat comment thread for one post (oldest first). */
export const getComments = async (viewerUid, postId) => {
  await assertGoldMember(viewerUid);
  try {
    const snapshot = await getDocs(
      query(collection(getDb(), POSTS, postId, 'comments'), orderBy('createdAt', 'asc'), fsLimit(100)),
    );
    const rows = docsToModels(snapshot);

    // Fresh author identity + the same block/suspension filtering as the feed.
    const authorUids = [...new Set(rows.map((row) => row.authorUid).filter(Boolean))];
    const [blocked, profiles] = await Promise.all([
      fetchBlockedUids(viewerUid),
      Promise.all(authorUids.map((uid) => fetchProfileDoc(uid))),
    ]);
    const byUid = new Map(authorUids.map((uid, i) => [uid, profiles[i]]));

    return rows
      .filter((row) => !blocked.has(row.authorUid))
      .filter((row) => !byUid.get(row.authorUid)?.suspended)
      .map((row) => {
        const author = byUid.get(row.authorUid);
        const age = author ? profileAge(author) : 0;
        const anonymous = Boolean(row.isAnonymous);
        const mask = anonymous && row.authorUid !== viewerUid;
        return {
          ...row,
          authorUid: mask ? null : row.authorUid,
          authorName: mask ? "Anonymous" : (author?.fullName || row.authorName),
          authorAvatar: mask ? null : (author?.photos?.[0] || row.authorAvatar || null),
          authorAge: mask ? null : (age > 0 ? age : null),
          authorArea: mask ? null : (author?.area || null),
          isAnonymous: anonymous,
        };
      });
  } catch (error) {
    if (error?.code === 'gold-required') throw error;
    throw new Error(friendlyError(error, 'Could not load comments.'));
  }
};

/* ------------------------------------------------------------------ *
 * Creating                                                            *
 * ------------------------------------------------------------------ */

/**
 * Publish a post (optionally with a photo uploaded through the backend
 * -> private Supabase pipeline) and returns the new post model.
 */
export const createPost = async ({ uid, profile, text, category, image, whatsapp, isAnonymous, location, budget }) => {
  await assertGoldMember(uid);

  const hasImage = Boolean(image?.uri);
  const trimmed = (text || '').trim();
  if (!trimmed && !hasImage) {
    throw new Error('Write something or add a photo before you share.');
  }
  if (trimmed.length > LIMITS.goldCirclePostMaxLength) {
    throw new Error(`Post is limited to ${LIMITS.goldCirclePostMaxLength} characters.`);
  }
  const clean = trimmed;
  const safeCategory = CATEGORY_IDS.includes(category) ? category : 'discussion';
  validateImage(image);

  let sharedWhatsApp = false;
  let whatsappNumber = null;
  if (whatsapp) {
    whatsappNumber = normalizeWhatsApp(whatsapp);
    sharedWhatsApp = true;
  }

  let uploaded = null;
  if (image?.uri) {
    uploaded = await uploadProfilePhotoViaBackend(image.uri, image);
  }

  const anonymous = Boolean(isAnonymous);
  const payload = {
    authorUid: anonymous ? null : uid,
    authorName: (profile?.fullName || 'Gold member').slice(0, 60),
    authorAvatar: typeof profile?.photos?.[0] === 'string' ? profile.photos[0] : '',
    text: clean,
    category: safeCategory,
    isAnonymous: anonymous,
    location: location || null,
    budget: budget ? String(budget).slice(0, 40) : null,
    imageUrl: uploaded?.url || null,
    imagePath: uploaded?.path || null,
    sharedWhatsApp,
    whatsapp: whatsappNumber,
    likedBy: [],
    likeCount: 0,
    commentCount: 0,
  };

  const postRef = doc(collection(getDb(), POSTS));
  try {
    const batch = writeBatch(getDb());
    batch.set(postRef, {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    if (anonymous) {
      batch.set(doc(getDb(), POST_AUTHORS, postRef.id), {
        uid,
        createdAt: serverTimestamp(),
      });
    }
    await batch.commit();
    const now = new Date().toISOString();
    return { id: postRef.id, ...payload, authorUid: uid, createdAt: now, updatedAt: now };
  } catch (error) {
    if (uploaded?.path) deleteProfilePhoto(uploaded.path);
    throw new Error(friendlyError(error, 'Could not share your post. Please try again.'));
  }
};

/* ------------------------------------------------------------------ *
 * Likes                                                               *
 * ------------------------------------------------------------------ */

/**
 * Like / unlike a post. The whole decision runs inside a transaction so
 * `likedBy` and `likeCount` always stay consistent — which is exactly
 * what `firestore.rules` validates for a self-only toggle.
 * Returns the new { likedBy, likeCount }.
 */
export const toggleLike = async (uid, postId) => {
  await assertGoldMember(uid);
  const ref = docRef(POSTS, postId);
  try {
    let result = null;
    await runTransaction(getDb(), async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists()) throw new Error('This post is no longer available.');
      const data = snapshot.data() || {};
      const authorUid = data.authorUid || null;
      if (authorUid && authorUid !== uid) {
        const blockSnap = await transaction.get(docRef('blocks', blockDocId(uid, authorUid)));
        if (blockSnap.exists()) throw new Error('You can no longer interact with this member.');
      }
      const likedBy = Array.isArray(data.likedBy) ? data.likedBy : [];
      const liked = likedBy.includes(uid);
      const next = liked ? likedBy.filter((x) => x !== uid) : [...likedBy, uid];
      transaction.update(ref, { likedBy: next, likeCount: next.length });
      result = { likedBy: next, likeCount: next.length };
    });
    return result;
  } catch (error) {
    throw new Error(friendlyError(error, 'Could not update your like.'));
  }
};

/* ------------------------------------------------------------------ *
 * Comments                                                            *
 * ------------------------------------------------------------------ */

/** Add a comment and bump the post counter atomically. */
export const addComment = async ({ uid, profile, postId, text }) => {
  await assertGoldMember(uid);
  const clean = cleanText(text, LIMITS.goldCircleCommentMaxLength, 'comment');
  const postRef = docRef(POSTS, postId);
  const commentRef = doc(collection(getDb(), POSTS, postId, 'comments'));

  try {
    const postSnap = await getDoc(postRef);
    if (!postSnap.exists()) throw new Error('This post is no longer available.');
    let postAuthorUid = postSnap.data()?.authorUid || null;
    await assertNotBlocked(uid, postAuthorUid);

    const batch = writeBatch(getDb());
    batch.set(commentRef, {
      authorUid: uid,
      authorName: (profile?.fullName || 'Gold member').slice(0, 60),
      authorAvatar: typeof profile?.photos?.[0] === 'string' ? profile.photos[0] : '',
      text: clean,
      createdAt: serverTimestamp(),
    });
    batch.update(postRef, { commentCount: increment(1) });
    await batch.commit();
    return { id: commentRef.id };
  } catch (error) {
    throw new Error(friendlyError(error, 'Could not send your comment.'));
  }
};

/** Delete your own comment (or a moderator's removal) and fix the counter. */
export const deleteComment = async (uid, postId, commentId) => {
  await assertGoldMember(uid);
  try {
    const batch = writeBatch(getDb());
    batch.delete(doc(collection(getDb(), POSTS, postId, 'comments'), commentId));
    batch.update(docRef(POSTS, postId), { commentCount: increment(-1) });
    await batch.commit();
  } catch (error) {
    throw new Error(friendlyError(error, 'Could not delete that comment.'));
  }
};

/* ------------------------------------------------------------------ *
 * Daily topic voting (one topic per Nairobi day)                      *
 * ------------------------------------------------------------------ */

/** Public tally for the day's topic (counts only — never who voted). */
export const getDailyTally = async (dayKey) => {
  try {
    const snapshot = await getDoc(docRef(DAILY, dayKey));
    const counts = snapshot.exists() ? snapshot.data().counts : null;
    return Array.isArray(counts) ? counts : null;
  } catch (error) {
    throw new Error(friendlyError(error, "Could not load today's poll."));
  }
};

/** The viewer's own private vote for the day (null when they have not voted). */
export const getMyDailyVote = async (uid, dayKey) => {
  try {
    const snapshot = await getDoc(doc(getDb(), DAILY, dayKey, 'votes', uid));
    return snapshot.exists() ? snapshot.data().option : null;
  } catch (error) {
    throw new Error(friendlyError(error, 'Could not load your vote.'));
  }
};

/**
 * Cast the once-per-day vote. The tally and the private vote are written in
 * one transaction so `counts` always moves by exactly one and a member can
 * never vote twice (the rules enforce the same guarantee server-side).
 */
export const voteDailyTopic = async ({ uid, dayKey, optionIndex }) => {
  await assertGoldMember(uid);
  if (!Number.isInteger(optionIndex) || optionIndex < 0) {
    throw new Error('Choose one of the options first.');
  }
  const tallyRef = docRef(DAILY, dayKey);
  const voteRef = doc(getDb(), DAILY, dayKey, 'votes', uid);
  try {
    await runTransaction(getDb(), async (transaction) => {
      const mine = await transaction.get(voteRef);
      if (mine.exists()) throw new Error('You have already voted today.');
      const tally = await transaction.get(tallyRef);
      const data = tally.exists() ? tally.data() : {};
      const counts = Array.isArray(data.counts) ? [...data.counts] : [];
      while (counts.length <= optionIndex) counts.push(0);
      counts[optionIndex] += 1;
      transaction.set(voteRef, { option: optionIndex, createdAt: serverTimestamp() });
      transaction.set(tallyRef, {
        counts,
        sum: (Number(data.sum) || 0) + 1,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    throw new Error(friendlyError(error, 'Could not save your vote.'));
  }
};

/** Saved posts live in a per-user collection keyed by postId. */
export const isPostSaved = async (uid, postId) => {
  await assertGoldMember(uid);
  try {
    const snapshot = await getDoc(doc(getDb(), SAVES, `${uid}__${postId}`));
    return snapshot.exists();
  } catch (error) {
    throw new Error(friendlyError(error, 'Could not check saved status.'));
  }
};

export const toggleSave = async (uid, postId) => {
  await assertGoldMember(uid);
  const saveRef = doc(getDb(), SAVES, `${uid}__${postId}`);
  try {
    const snapshot = await getDoc(saveRef);
    if (snapshot.exists()) {
      await deleteDoc(saveRef);
      return false;
    }
    await setDoc(saveRef, {
      uid,
      postId,
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    throw new Error(friendlyError(error, 'Could not update saved post.'));
  }
};

export const getSavedPostIds = async (uid) => {
  await assertGoldMember(uid);
  try {
    const snapshot = await getDocs(
      query(col(SAVES), where('uid', '==', uid), orderBy('createdAt', 'desc'), fsLimit(200)),
    );
    return docsToModels(snapshot).map((row) => row.postId).filter(Boolean);
  } catch (error) {
    throw new Error(friendlyError(error, 'Could not load saved posts.'));
  }
};

export const getSavedPosts = async (viewerUid) => {
  await assertGoldMember(viewerUid);
  try {
    const ids = await getSavedPostIds(viewerUid);
    if (!ids.length) return [];
    const snaps = await Promise.all(ids.map((id) => getDoc(docRef(POSTS, id))));
    const rows = snaps.filter((s) => s.exists()).map((s) => docToModel(s));
    // Reuse hydratePage for author masking / block filtering.
    return await hydratePage(rows, viewerUid);
  } catch (error) {
    if (error?.code === 'gold-required') throw error;
    throw new Error(friendlyError(error, 'Could not load saved posts.'));
  }
};

/** Daily Love Challenge participation/completion. */
export const getDailyChallengeCompletion = async (uid, dayKey) => {
  await assertGoldMember(uid);
  try {
    const snapshot = await getDoc(doc(getDb(), CHALLENGES, `${uid}__${dayKey}`));
    return snapshot.exists();
  } catch (error) {
    throw new Error(friendlyError(error, 'Could not load today\'s challenge.'));
  }
};

export const completeDailyChallenge = async (uid, dayKey) => {
  await assertGoldMember(uid);
  const ref = doc(getDb(), CHALLENGES, `${uid}__${dayKey}`);
  try {
    const snapshot = await getDoc(ref);
    if (snapshot.exists()) return true;
    await setDoc(ref, {
      uid,
      dayKey,
      completedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    throw new Error(friendlyError(error, 'Could not complete today\'s challenge.'));
  }
};

/** Green Flag vs Red Flag daily game. */
export const getGameTally = async (dayKey) => {
  try {
    const snapshot = await getDoc(docRef(GAMES, dayKey));
    const counts = snapshot.exists() ? snapshot.data().counts : null;
    return Array.isArray(counts) ? counts : null;
  } catch (error) {
    throw new Error(friendlyError(error, 'Could not load today\'s game.'));
  }
};

export const getMyGameVote = async (uid, dayKey) => {
  await assertGoldMember(uid);
  try {
    const snapshot = await getDoc(doc(getDb(), GAMES, dayKey, 'votes', uid));
    return snapshot.exists() ? snapshot.data().option : null;
  } catch (error) {
    throw new Error(friendlyError(error, 'Could not load your game vote.'));
  }
};

export const voteGame = async ({ uid, dayKey, optionIndex }) => {
  await assertGoldMember(uid);
  if (optionIndex !== 0 && optionIndex !== 1) {
    throw new Error('Choose green or red first.');
  }
  const tallyRef = docRef(GAMES, dayKey);
  const voteRef = doc(getDb(), GAMES, dayKey, 'votes', uid);
  try {
    await runTransaction(getDb(), async (transaction) => {
      const mine = await transaction.get(voteRef);
      if (mine.exists()) throw new Error('You have already voted today.');
      const tally = await transaction.get(tallyRef);
      const data = tally.exists() ? tally.data() : {};
      const counts = Array.isArray(data.counts) ? [...data.counts] : [0, 0];
      while (counts.length < 2) counts.push(0);
      counts[optionIndex] += 1;
      transaction.set(voteRef, { option: optionIndex, createdAt: serverTimestamp() });
      transaction.set(tallyRef, {
        counts,
        sum: (Number(data.sum) || 0) + 1,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    throw new Error(friendlyError(error, 'Could not save your vote.'));
  }
};
const SIDES = 'goldCircleSideChoices';
const POLLS = 'goldCirclePollTallies';

/** Choose a Side: aggregate tally (counts only). */
export const getSideTally = async (dayKey) => {
  try {
    const snapshot = await getDoc(docRef(SIDES, dayKey));
    const counts = snapshot.exists() ? snapshot.data().counts : null;
    return Array.isArray(counts) ? counts : null;
  } catch (error) {
    throw new Error(friendlyError(error, 'Could not load this dilemma.'));
  }
};

export const getMySideVote = async (uid, dayKey) => {
  await assertGoldMember(uid);
  try {
    const snapshot = await getDoc(doc(getDb(), SIDES, dayKey, 'votes', uid));
    return snapshot.exists() ? snapshot.data().option : null;
  } catch (error) {
    throw new Error(friendlyError(error, 'Could not load your choice.'));
  }
};

export const voteSide = async ({ uid, dayKey, optionIndex }) => {
  await assertGoldMember(uid);
  if (optionIndex !== 0 && optionIndex !== 1) {
    throw new Error('Choose one side first.');
  }
  const tallyRef = docRef(SIDES, dayKey);
  const voteRef = doc(getDb(), SIDES, dayKey, 'votes', uid);
  try {
    await runTransaction(getDb(), async (transaction) => {
      const mine = await transaction.get(voteRef);
      if (mine.exists()) throw new Error('You have already chosen a side.');
      const tally = await transaction.get(tallyRef);
      const data = tally.exists() ? tally.data() : {};
      const counts = Array.isArray(data.counts) ? [...data.counts] : [0, 0];
      while (counts.length < 2) counts.push(0);
      counts[optionIndex] += 1;
      transaction.set(voteRef, { option: optionIndex, createdAt: serverTimestamp() });
      transaction.set(tallyRef, {
        counts,
        sum: (Number(data.sum) || 0) + 1,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    throw new Error(friendlyError(error, 'Could not save your choice.'));
  }
};

/** Relationship Polls: aggregate tally (counts only). */
export const getPollTally = async (pollKey) => {
  try {
    const snapshot = await getDoc(docRef(POLLS, pollKey));
    const counts = snapshot.exists() ? snapshot.data().counts : null;
    return Array.isArray(counts) ? counts : null;
  } catch (error) {
    throw new Error(friendlyError(error, 'Could not load this poll.'));
  }
};

export const getMyPollVote = async (uid, pollKey) => {
  await assertGoldMember(uid);
  try {
    const snapshot = await getDoc(doc(getDb(), POLLS, pollKey, 'votes', uid));
    return snapshot.exists() ? snapshot.data().option : null;
  } catch (error) {
    throw new Error(friendlyError(error, 'Could not load your vote.'));
  }
};

export const votePoll = async ({ uid, pollKey, optionIndex, optionCount }) => {
  await assertGoldMember(uid);
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= optionCount) {
    throw new Error('Choose one of the options first.');
  }
  const tallyRef = docRef(POLLS, pollKey);
  const voteRef = doc(getDb(), POLLS, pollKey, 'votes', uid);
  try {
    await runTransaction(getDb(), async (transaction) => {
      const mine = await transaction.get(voteRef);
      if (mine.exists()) throw new Error('You have already voted in this poll.');
      const tally = await transaction.get(tallyRef);
      const data = tally.exists() ? tally.data() : {};
      const counts = Array.isArray(data.counts) ? [...data.counts] : [];
      while (counts.length < optionCount) counts.push(0);
      counts[optionIndex] += 1;
      transaction.set(voteRef, { option: optionIndex, createdAt: serverTimestamp() });
      transaction.set(tallyRef, {
        counts,
        sum: (Number(data.sum) || 0) + 1,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    throw new Error(friendlyError(error, 'Could not save your vote.'));
  }
};

/* ------------------------------------------------------------------ *
 * Moderation helpers (reporting/blocking reuse existing services)     *
 * ------------------------------------------------------------------ */

/** Remove your own post from Gold Circle (photo is cleaned up too). */
export const deletePost = async (uid, post) => {
  await assertGoldMember(uid);
  try {
    await deleteDoc(docRef(POSTS, post.id));
    // Clean up the private author map for anonymous posts (best effort).
    try { await deleteDoc(doc(getDb(), POST_AUTHORS, post.id)); } catch { /* ignore */ }
    if (post.imagePath) deleteProfilePhoto(post.imagePath);
  } catch (error) {
    throw new Error(friendlyError(error, 'Could not delete that post.'));
  }
};

export default {
  CATEGORIES,
  CATEGORY_IDS,
  assertGoldMember,
  normalizeWhatsApp,
  getFeed,
  getComments,
  createPost,
  toggleLike,
  addComment,
  deleteComment,
  deletePost,
  isPostSaved,
  toggleSave,
  getSavedPostIds,
  getSavedPosts,
  getDailyChallengeCompletion,
  completeDailyChallenge,
  getGameTally,
  getMyGameVote,
  getSideTally,
  getMySideVote,
  voteSide,
  getPollTally,
  getMyPollVote,
  votePoll,
  voteGame,
  getDailyTally,
  getMyDailyVote,
  voteDailyTopic,
};
