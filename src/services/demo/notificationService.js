/**
 * Demo notificationService — in-app notification inbox.
 * Production (Firebase) mirrors these signatures and adds FCM push.
 */
import { generateId, getDb, initDb, insert, updateDoc } from './db';

const listeners = new Map(); // uid -> Set<fn>

const notify = (uid) => {
  const set = listeners.get(uid);
  if (set) set.forEach((fn) => fn());
};

export const subscribe = (uid, fn) => {
  if (!listeners.has(uid)) listeners.set(uid, new Set());
  listeners.get(uid).add(fn);
  fn();
  return () => {
    listeners.get(uid)?.delete(fn);
  };
};

export const createNotification = async ({ uid, type, title, body, data }) => {
  await initDb();
  const item = {
    id: generateId('ntf'),
    uid,
    type,
    title,
    body: body || '',
    data: data || {},
    read: false,
    createdAt: new Date().toISOString(),
  };
  await insert('notifications', item);
  notify(uid);
  return item;
};

export const getMyNotifications = async (uid) => {
  await initDb();
  const db = await getDb();
  return db.notifications
    .filter((n) => n.uid === uid)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

export const getUnreadCount = async (uid) => {
  await initDb();
  const db = await getDb();
  return db.notifications.filter((n) => n.uid === uid && !n.read).length;
};

export const markRead = async (notificationId) => {
  await updateDoc('notifications', notificationId, { read: true });
};

export const markAllRead = async (uid) => {
  await initDb();
  const db = await getDb();
  const unread = db.notifications.filter((n) => n.uid === uid && !n.read);
  for (const n of unread) {
    await updateDoc('notifications', n.id, { read: true });
  }
  if (unread.length) notify(uid);
};

/** Idempotent: called on sign-in / sign-up, never duplicates. */
export const ensureWelcome = async (uid) => {
  await initDb();
  const db = await getDb();
  const existing = db.notifications.find((n) => n.uid === uid && n.type === 'welcome');
  if (existing) return;
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
