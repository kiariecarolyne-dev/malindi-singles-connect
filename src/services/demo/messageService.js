/**
 * Demo messageService — conversations, messages, read receipts, typing.
 * Firebase implementation mirrors these signatures; demo mode adds a
 * simulated reply from matched personas when DEMO_SIMULATE_REPLIES is on
 * (clearly documented — never used in production mode).
 */
import { generateId, getDb, initDb, insert, removeWhere, updateDoc } from './db';

/** Set to false to disable simulated persona replies in demo mode. */
export const DEMO_SIMULATE_REPLIES = true;

const messageListeners = new Map(); // conversationId -> Set<fn>
const typingState = new Map(); // conversationId -> { uid: timeoutId }

const notifyMessages = (conversationId) => {
  const set = messageListeners.get(conversationId);
  if (set) set.forEach((fn) => fn());
};

const notifyTyping = (conversationId) => {
  const set = messageListeners.get(`${conversationId}__typing`);
  if (set) set.forEach((fn) => fn());
};

export const subscribeMessages = (conversationId, fn) => {
  const key = conversationId;
  if (!messageListeners.has(key)) messageListeners.set(key, new Set());
  messageListeners.get(key).add(fn);
  fn();
  return () => {
    messageListeners.get(key)?.delete(fn);
  };
};

export const subscribeTyping = (conversationId, fn) => {
  const key = `${conversationId}__typing`;
  if (!messageListeners.has(key)) messageListeners.set(key, new Set());
  messageListeners.get(key).add(fn);
  fn();
  return () => {
    messageListeners.get(key)?.delete(fn);
  };
};

export const getTypingUsers = (conversationId) => {
  const entry = typingState.get(conversationId);
  if (!entry) return [];
  return Object.keys(entry);
};

export const getMessages = async (conversationId) => {
  await initDb();
  const db = await getDb();
  return db.messages
    .filter((m) => m.conversationId === conversationId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

export const getConversation = async (conversationId) => {
  await initDb();
  const db = await getDb();
  return db.conversations.find((c) => c.id === conversationId) || null;
};

/** Create the conversation if a match somehow has none yet. */
export const ensureConversation = async (conversationId, uidA, uidB) => {
  await initDb();
  const existing = await getConversation(conversationId);
  if (existing) return existing;
  const conv = {
    id: conversationId,
    matchId: null,
    members: [uidA, uidB],
    lastMessage: null,
    lastMessageAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await insert('conversations', conv);
  return conv;
};

export const sendMessage = async (conversationId, senderUid, text) => {
  await initDb();
  const clean = (text || '').trim();
  if (!clean) return null;

  const message = {
    id: generateId('msg'),
    conversationId,
    senderUid,
    text: clean,
    createdAt: new Date().toISOString(),
    read: false,
    type: 'text',
  };
  await insert('messages', message);
  await updateDoc('conversations', conversationId, {
    lastMessage: clean,
    lastFrom: senderUid,
    lastMessageAt: message.createdAt,
    updatedAt: message.createdAt,
  });
  notifyMessages(conversationId);
  maybeScheduleReply(conversationId, senderUid);
  return message;
};

export const markRead = async (conversationId, myUid) => {
  await initDb();
  const db = await getDb();
  const unread = db.messages.filter(
    (m) => m.conversationId === conversationId && m.senderUid !== myUid && !m.read,
  );
  for (const m of unread) {
    await updateDoc('messages', m.id, { read: true });
  }
  if (unread.length) notifyMessages(conversationId);
};

export const clearMessages = async (conversationId) => {
  await removeWhere('messages', (m) => m.conversationId === conversationId);
  await updateDoc('conversations', conversationId, {
    lastMessage: null,
    lastFrom: null,
    lastMessageAt: null,
    updatedAt: new Date().toISOString(),
  });
  notifyMessages(conversationId);
};

export const deleteConversation = clearMessages;

/** Total unread messages across all of my conversations. */
export const getUnreadCount = async (myUid) => {
  await initDb();
  const db = await getDb();
  const myConvs = db.conversations.filter((c) => c.members.includes(myUid));
  let count = 0;
  for (const c of myConvs) {
    count += db.messages.filter(
      (m) => m.conversationId === c.id && m.senderUid !== myUid && !m.read,
    ).length;
  }
  return count;
};

/** Conversations with last message, newest first. */
export const getMyConversations = async (myUid) => {
  await initDb();
  const db = await getDb();
  return db.conversations
    .filter((c) => c.members.includes(myUid))
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
    .map((c) => ({
      ...c,
      otherUid: c.members.find((m) => m !== myUid),
      unread: db.messages.filter(
        (m) => m.conversationId === c.id && m.senderUid !== myUid && !m.read,
      ).length,
    }));
};

/* ---------------- demo simulation helpers ---------------- */

const REPLIES = [
  'Habari! 😊 How is your day going?',
  'Hapo sawa… tell me more about yourself',
  'Haha nice one 😄 What do you usually do on weekends?',
  'The beach here has been amazing lately 🌊 Have you been?',
  'That sounds good to me 😌 Are you free this weekend?',
  'Uko wapi? I am around Malindi town today',
  'You seem interesting… what are you looking for on here? ❤️',
  'I love that! 😍 Mine is coffee and long walks at sunset ☕🌅',
  'Sawa! Let us continue this over a drink sometime 👀',
];

const setTyping = (conversationId, uid, ms) => {
  if (!typingState.has(conversationId)) typingState.set(conversationId, {});
  const entry = typingState.get(conversationId);
  if (entry[uid]) clearTimeout(entry[uid]);
  entry[uid] = setTimeout(() => {
    delete entry[uid];
    notifyTyping(conversationId);
  }, ms);
  notifyTyping(conversationId);
};

const clearTyping = (conversationId, uid) => {
  const entry = typingState.get(conversationId);
  if (entry && entry[uid]) {
    clearTimeout(entry[uid]);
    delete entry[uid];
    notifyTyping(conversationId);
  }
};

const maybeScheduleReply = async (conversationId, senderUid) => {
  if (!DEMO_SIMULATE_REPLIES) return;
  const db = await getDb();
  const conv = db.conversations.find((c) => c.id === conversationId);
  if (!conv) return;
  const otherUid = conv.members.find((m) => m !== senderUid);
  const other = db.profiles.find((p) => p.uid === otherUid);
  // only seeded personas reply (never other real accounts)
  if (!other || !other.uid.startsWith('p_')) return;

  const thinkMs = 900 + Math.random() * 1600;
  const replyDelay = 1200 + Math.random() * 2200;

  setTimeout(() => setTyping(conversationId, otherUid, replyDelay + 1500), thinkMs);

  setTimeout(async () => {
    clearTyping(conversationId, otherUid);
    try {
      const fresh = await getDb();
      const reply = REPLIES[Math.floor(Math.random() * REPLIES.length)];
      const message = {
        id: generateId('msg'),
        conversationId,
        senderUid: otherUid,
        text: reply,
        createdAt: new Date().toISOString(),
        read: false,
        type: 'text',
      };
      await insert('messages', message);
      await updateDoc('conversations', conversationId, {
        lastMessage: reply,
        lastFrom: otherUid,
        lastMessageAt: message.createdAt,
        updatedAt: message.createdAt,
      });
      // persona has read everything I sent
      const mine = fresh.messages.filter(
        (m) => m.conversationId === conversationId && m.senderUid === senderUid && !m.read,
      );
      for (const m of mine) {
        await updateDoc('messages', m.id, { read: true });
      }
      notifyMessages(conversationId);
    } catch {
      // simulation failure must never crash the app
    }
  }, thinkMs + replyDelay);
};

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
