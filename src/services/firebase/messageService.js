/**
 * messageService (Firebase) — conversations, messages, read state, typing.
 *
 * Layout:  conversations/{id}  (members, last message, unread counters)
 *          conversations/{id}/messages/{id}  (subcollection)
 *
 * Unread badges are counted from `conversations/{id}.unread[uid]`, which the
 * sender increments and the reader resets — one document read instead of a
 * scan over every message.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

import { getDb } from './firebaseConfig';
import { col, docRef, docToModel, docsToModels, nowIso } from './helpers';

const MESSAGES_PAGE = 300;
const CONVERSATION_LIMIT = 200;

const messagesRef = (conversationId) => collection(docRef('conversations', conversationId), 'messages');

const messagesQuery = (conversationId) =>
  query(messagesRef(conversationId), orderBy('createdAt', 'desc'), fsLimit(MESSAGES_PAGE));

/* ------------------------------------------------------------------ *
 * Subscriptions                                                       *
 * ------------------------------------------------------------------ */

export const subscribeMessages = (conversationId, fn) => {
  if (!conversationId) {
    fn();
    return () => {};
  }
  const unsubscribe = onSnapshot(
    messagesQuery(conversationId),
    () => fn(),
    () => fn(),
  );
  return unsubscribe;
};

/** convId -> { uid: lastTypingIso } (kept in memory for the sync getter). */
const typingCache = new Map();

export const subscribeTyping = (conversationId, fn) => {
  if (!conversationId) {
    fn();
    return () => {};
  }
  if (!typingCache.has(conversationId)) typingCache.set(conversationId, {});

  const unsubscribe = onSnapshot(
    collection(docRef('conversations', conversationId), 'typing'),
    (snapshot) => {
      const state = {};
      const cutoff = Date.now() - 8000;
      snapshot.docs.forEach((d) => {
        const data = d.data() || {};
        const at = data.at?.toMillis ? data.at.toMillis() : new Date(data.at || 0).getTime();
        if (at >= cutoff) state[d.id] = new Date(at).toISOString();
      });
      typingCache.set(conversationId, state);
      fn();
    },
    () => fn(),
  );
  return unsubscribe;
};

export const getTypingUsers = (conversationId) =>
  Object.keys(typingCache.get(conversationId) || {});

/* ------------------------------------------------------------------ *
 * Reads                                                               *
 * ------------------------------------------------------------------ */

export const getMessages = async (conversationId) => {
  const snapshot = await getDocs(messagesQuery(conversationId));
  return docsToModels(snapshot);
};

export const getConversation = async (conversationId) => {
  if (!conversationId) return null;
  try {
    const snapshot = await getDoc(docRef('conversations', conversationId));
    return snapshot.exists() ? docToModel(snapshot) : null;
  } catch {
    return null;
  }
};

/** Conversations with last message, newest first. */
export const getMyConversations = async (myUid) => {
  const snapshot = await getDocs(
    query(
      col('conversations'),
      where('members', 'array-contains', myUid),
      orderBy('updatedAt', 'desc'),
      fsLimit(CONVERSATION_LIMIT),
    ),
  );
  return docsToModels(snapshot).map((conversation) => ({
    ...conversation,
    unread: conversation.unread?.[myUid] || 0,
    otherUid: conversation.members.find((m) => m !== myUid),
  }));
};

/** Total unread messages across all of my conversations. */
export const getUnreadCount = async (myUid) => {
  const snapshot = await getDocs(
    query(col('conversations'), where('members', 'array-contains', myUid), fsLimit(CONVERSATION_LIMIT)),
  );
  return docsToModels(snapshot).reduce(
    (total, conversation) => total + (conversation.unread?.[myUid] || 0),
    0,
  );
};

/* ------------------------------------------------------------------ *
 * Writes                                                              *
 * ------------------------------------------------------------------ */

/** Create the conversation if a match somehow has none yet. */
export const ensureConversation = async (conversationId, uidA, uidB) => {
  const existing = await getConversation(conversationId);
  if (existing) return existing;

  const members = [uidA, uidB].sort();
  try {
    await setDoc(docRef('conversations', conversationId), {
      id: conversationId,
      matchId: null,
      members,
      lastMessage: null,
      lastFrom: null,
      lastMessageAt: null,
      unread: {},
      messageCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw new Error(error?.message || 'Could not open that conversation.');
  }
  return {
    id: conversationId,
    matchId: null,
    members,
    lastMessage: null,
    lastFrom: null,
    lastMessageAt: null,
    unread: {},
    messageCount: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
};

export const sendMessage = async (conversationId, senderUid, text) => {
  const clean = (text || '').trim();
  if (!clean) return null;

  try {
    const message = await runTransaction(getDb(), async (tx) => {
      const conversationRef = docRef('conversations', conversationId);
      const conversationSnap = await tx.get(conversationRef);
      const conversation = conversationSnap.exists() ? conversationSnap.data() : null;
      const members = conversation?.members || [senderUid];

      const messageRef = doc(messagesRef(conversationId));
      const payload = {
        id: messageRef.id,
        conversationId,
        senderUid,
        text: clean,
        read: false,
        type: 'text',
        createdAt: serverTimestamp(),
      };
      tx.set(messageRef, payload);

      const unread = { ...(conversation?.unread || {}) };
      members
        .filter((uid) => uid !== senderUid)
        .forEach((uid) => {
          unread[uid] = (unread[uid] || 0) + 1;
        });

      if (conversationSnap.exists()) {
        tx.update(conversationRef, {
          lastMessage: clean,
          lastFrom: senderUid,
          lastMessageAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          unread,
          messageCount: (conversation.messageCount || 0) + 1,
        });
      } else {
        tx.set(conversationRef, {
          id: conversationId,
          matchId: null,
          members,
          lastMessage: clean,
          lastFrom: senderUid,
          lastMessageAt: serverTimestamp(),
          unread,
          messageCount: 1,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      return { ...payload, createdAt: nowIso() };
    });

    return message;
  } catch (error) {
    throw new Error(error?.message || 'Message could not be sent. Please try again.');
  }
};

export const markRead = async (conversationId, myUid) => {
  try {
    const snapshot = await getDocs(
      query(messagesRef(conversationId), where('read', '==', false), fsLimit(500)),
    );
    const unread = docsToModels(snapshot).filter((m) => m.senderUid !== myUid);

    const batch = writeBatch(getDb());
    unread.forEach((m) => batch.update(doc(messagesRef(conversationId), m.id), { read: true }));

    const conversationRef = docRef('conversations', conversationId);
    const conversationSnap = await getDoc(conversationRef);
    if (conversationSnap.exists()) {
      batch.update(conversationRef, {
        unread: { ...(conversationSnap.data().unread || {}), [myUid]: 0 },
      });
    }
    if (unread.length || conversationSnap.exists()) await batch.commit();
  } catch {
    // Read receipts are best effort; the chat stays usable offline.
  }
};

/** Clear a chat: every message is deleted, the conversation summary resets. */
export const deleteConversation = async (conversationId) => {
  try {
    for (let round = 0; round < 10; round += 1) {
      const snapshot = await getDocs(query(messagesRef(conversationId), fsLimit(400)));
      if (snapshot.empty) break;
      const batch = writeBatch(getDb());
      snapshot.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      if (snapshot.size < 400) break;
    }

    const conversationRef = docRef('conversations', conversationId);
    const conversationSnap = await getDoc(conversationRef);
    if (conversationSnap.exists()) {
      await updateDoc(conversationRef, {
        lastMessage: null,
        lastFrom: null,
        lastMessageAt: null,
        updatedAt: serverTimestamp(),
        unread: {},
        messageCount: 0,
      });
    }
  } catch {
    // Best effort — mirrors the old "clear chat" behaviour.
  }
  typingCache.delete(conversationId);
};

export const clearMessages = deleteConversation;

export default {
  subscribeMessages,
  subscribeTyping,
  getTypingUsers,
  getMessages,
  getConversation,
  ensureConversation,
  sendMessage,
  markRead,
  clearMessages,
  deleteConversation,
  getUnreadCount,
  getMyConversations,
};
