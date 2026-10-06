/**
 * notificationService (Firebase) — in-app notification inbox.
 *
 * Notifications are created by the client for likes/matches/meetups (there is
 * no backend yet); `firestore.rules` limits which types a client may write to
 * somebody else's inbox and every document is still owned by its `uid`.
 * Remote push (FCM / Expo push) is a later phase — today the badge is in-app.
 */
import {
  addDoc,
  getDocs,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

import { getDb } from './firebaseConfig';
import { col, docRef, docsToModels, nowIso } from './helpers';

const INBOX_LIMIT = 100;

/** uid -> latest snapshot (kept so subscribers and reads share one query). */
const cache = new Map();

const inboxQuery = (uid) =>
  query(col('notifications'), where('uid', '==', uid), orderBy('createdAt', 'desc'), fsLimit(INBOX_LIMIT));

export const subscribe = (uid, fn) => {
  if (!uid) {
    fn();
    return () => {};
  }
  const unsubscribe = onSnapshot(
    inboxQuery(uid),
    (snapshot) => {
      cache.set(uid, docsToModels(snapshot));
      fn();
    },
    () => fn(),
  );
  return unsubscribe;
};

export const getMyNotifications = async (uid) => {
  if (!uid) return [];
  const cached = cache.get(uid);
  if (cached) return cached;
  const snapshot = await getDocs(inboxQuery(uid));
  const rows = docsToModels(snapshot);
  cache.set(uid, rows);
  return rows;
};

export const getUnreadCount = async (uid) =>
  (await getMyNotifications(uid)).filter((n) => !n.read).length;

export const createNotification = async ({ uid, type, title, body, data }) => {
  const item = {
    uid,
    type,
    title,
    body: body || '',
    data: data || {},
    read: false,
    createdAt: nowIso(),
  };
  try {
    const reference = await addDoc(col('notifications'), {
      uid,
      type,
      title,
      body: body || '',
      data: data || {},
      read: false,
      createdAt: serverTimestamp(),
    });
    return { ...item, id: reference.id };
  } catch (error) {
    throw new Error(error?.message || 'Could not save that notification.');
  }
};

export const markRead = async (notificationId) => {
  if (!notificationId) return;
  try {
    await updateDoc(docRef('notifications', notificationId), { read: true });
  } catch {
    // Already read or deleted elsewhere.
  }
  cache.forEach((rows, uid) => {
    cache.set(
      uid,
      rows.map((row) => (row.id === notificationId ? { ...row, read: true } : row)),
    );
  });
};

export const markAllRead = async (uid) => {
  const rows = await getMyNotifications(uid);
  const unread = rows.filter((n) => !n.read);
  if (!unread.length) return;

  const batch = writeBatch(getDb());
  unread.forEach((row) => batch.update(docRef('notifications', row.id), { read: true }));
  await batch.commit();

  cache.set(uid, rows.map((row) => ({ ...row, read: true })));
};

/** Idempotent: called on sign-in / sign-up, never duplicates. */
export const ensureWelcome = async (uid) => {
  const rows = await getMyNotifications(uid);
  if (rows.some((row) => row.type === 'welcome')) return;

  await createNotification({
    uid,
    type: 'welcome',
    title: 'Welcome to Malindi Singles Connect 👋',
    body: 'You are all set. Finish your photos, then start swiping — real people around Malindi are active now.',
  });
  await createNotification({
    uid,
    type: 'system',
    title: 'Safety first 🛡️',
    body: 'Always meet in public places, tell a friend where you are going, and never send money to anyone you just met.',
  });
};

export default {
  subscribe,
  createNotification,
  getMyNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  ensureWelcome,
};
