/**
 * Shared helpers for the Firebase service layer:
 *  - deterministic document ids (like/match/conversation pairs)
 *  - Timestamp -> ISO string normalisation (screens keep using ISO strings)
 *  - friendly, human-readable auth error messages
 */
import { collection, doc } from 'firebase/firestore';

import { getDb } from './firebaseConfig';

/* ------------------------------------------------------------------ *
 * Deterministic ids — one document per relationship, no duplicates.   *
 * ------------------------------------------------------------------ */

/** Order-independent pair of uids (both sorted, used for ids and arrays). */
export const sortedPair = (uidA, uidB) => [uidA, uidB].sort();

/** Stable, order-independent id fragment for a pair of users. */
export const pairKey = (uidA, uidB) => sortedPair(uidA, uidB).join('__');

export const likeDocId = (fromUid, toUid) => `like_${pairKey(fromUid, toUid)}`;
export const matchDocId = (uidA, uidB) => `match_${pairKey(uidA, uidB)}`;
export const conversationDocId = (uidA, uidB) => `conv_${pairKey(uidA, uidB)}`;
export const blockDocId = (uidA, uidB) => `block_${pairKey(uidA, uidB)}`;

/** `col('likes')` / `docRef('likes', id)` — always bound to the live Firestore instance. */
export const col = (name) => collection(getDb(), name);

export const docRef = (name, id) => doc(getDb(), name, id);

/* ------------------------------------------------------------------ *
 * Timestamp normalisation                                             *
 * ------------------------------------------------------------------ */

/** Fields that are written with serverTimestamp() and read back as ISO strings. */
const TIMESTAMP_FIELDS = [
  'createdAt',
  'updatedAt',
  'lastActiveAt',
  'lastMessageAt',
  'respondedAt',
  'resolvedAt',
  'likedAt',
];

const isDateLike = (value) => value instanceof Date;

export const toIso = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (isDateLike(value)) return value.toISOString();
  if (typeof value === 'number') return new Date(value).toISOString();
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  return null;
};

/** Firestore sentinel/FieldTimestamp values fall back to the local clock. */
const normalise = (key, value) => {
  if (!TIMESTAMP_FIELDS.includes(key)) return value;
  const iso = toIso(value);
  return iso || new Date().toISOString();
};

/** Snapshot -> plain model object with ISO date strings. */
export const docToModel = (snapshot) => {
  if (!snapshot || !snapshot.exists) return null;
  const data = snapshot.data() || {};
  const out = { id: snapshot.id };
  Object.entries(data).forEach(([key, value]) => {
    out[key] = normalise(key, value);
  });
  return out;
};

/** QuerySnapshot -> array of plain model objects. */
export const docsToModels = (snapshot) =>
  snapshot.docs.map((d) => docToModel(d)).filter(Boolean);

export const nowIso = () => new Date().toISOString();

/* ------------------------------------------------------------------ *
 * Error messages                                                      *
 * ------------------------------------------------------------------ */

const AUTH_MESSAGES = {
  'auth/invalid-credential': 'Incorrect email or password. Please try again.',
  'auth/wrong-password': 'Incorrect email or password. Please try again.',
  'auth/user-not-found': 'Incorrect email or password. Please try again.',
  'auth/invalid-email': 'That email address does not look right.',
  'auth/email-already-in-use': 'An account with that email already exists.',
  'auth/weak-password': 'Password is too weak — use at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed': 'No internet connection. Please try again.',
  'auth/user-disabled': 'This account has been suspended. Contact support.',
  'auth/operation-not-allowed': 'Email/password sign-in is disabled for this project.',
  'permission-denied': 'You do not have permission to do that.',
  'failed-precondition': 'A required setup step is missing (Firestore index or rules).',
};

/** Translate an SDK error into a message the UI can show verbatim. */
export const friendlyError = (error, fallback = 'Something went wrong. Please try again.') => {
  const code = error?.code || '';
  if (AUTH_MESSAGES[code]) return AUTH_MESSAGES[code];
  const message = error?.message || '';
  // Surface our own configuration errors untouched.
  if (message.startsWith('Missing Firebase configuration')) return message;
  if (code.startsWith('firestore/')) {
    if (code === 'firestore/permission-denied') return AUTH_MESSAGES['permission-denied'];
    if (code === 'firestore/unavailable') return 'Cannot reach the server. Please try again.';
    return fallback;
  }
  return message || fallback;
};

export default {
  sortedPair,
  pairKey,
  likeDocId,
  matchDocId,
  conversationDocId,
  blockDocId,
  toIso,
  docToModel,
  docsToModels,
  nowIso,
  friendlyError,
};
