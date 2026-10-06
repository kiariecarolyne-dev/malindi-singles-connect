/**
 * Demo-mode database: an in-memory store persisted to AsyncStorage.
 * Same collection names as the planned Firestore structure:
 * users, profiles, likes, matches, conversations, messages,
 * reports, meetups, notifications, blocks.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEMO_ACCOUNTS, SEED_PROFILES } from './seed';

const DB_KEY = 'msc_demo_db_v1';

const emptyDb = () => ({
  users: [],
  profiles: [],
  likes: [],
  matches: [],
  conversations: [],
  messages: [],
  reports: [],
  meetups: [],
  notifications: [],
  blocks: [],
  usage: {},
  seededAt: null,
});

let db = null;
let loadPromise = null;
let saveTimer = null;

const buildSeed = () => {
  const fresh = emptyDb();
  fresh.users = DEMO_ACCOUNTS.map((a) => ({
    uid: a.uid,
    email: a.email,
    password: a.password,
    role: a.role,
    createdAt: new Date().toISOString(),
  }));
  fresh.profiles = SEED_PROFILES.map((p) => ({ ...p }));
  fresh.seededAt = new Date().toISOString();
  return fresh;
};

/**
 * Older installs keep their data but pick up everything added later:
 * new demo personas, the demo accounts and any new collections.
 */
const migrate = (loaded) => {
  const out = loaded;
  Object.entries(emptyDb()).forEach(([key, value]) => {
    if (out[key] === undefined || out[key] === null) out[key] = value;
  });

  const profileUids = new Set(out.profiles.map((p) => p.uid));
  SEED_PROFILES.forEach((p) => {
    if (!profileUids.has(p.uid)) out.profiles.push({ ...p });
  });

  DEMO_ACCOUNTS.forEach((a) => {
    const exists = out.users.some((u) => u.uid === a.uid || u.email === a.email);
    if (!exists) {
      out.users.push({
        uid: a.uid,
        email: a.email,
        password: a.password,
        role: a.role,
        createdAt: new Date().toISOString(),
      });
    }
  });

  return out;
};

/** Load from disk (or seed). Safe to call many times. */
export const initDb = async () => {
  if (db) return db;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(DB_KEY);
      db = raw ? JSON.parse(raw) : buildSeed();
      if (!db.users) db = buildSeed();
      else db = migrate(db);
    } catch {
      db = buildSeed();
    }
    return db;
  })();
  return loadPromise;
};

const persist = () => {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    AsyncStorage.setItem(DB_KEY, JSON.stringify(db)).catch(() => {});
  }, 120);
};

export const getDb = async () => {
  await initDb();
  return db;
};

export const generateId = (prefix = 'id') =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const insert = async (collection, item) => {
  await initDb();
  db[collection] = [...(db[collection] || []), item];
  persist();
  return item;
};

export const updateDoc = async (collection, id, patch) => {
  await initDb();
  db[collection] = (db[collection] || []).map((doc) =>
    doc.id === id || doc.uid === id ? { ...doc, ...patch } : doc,
  );
  persist();
  return patch;
};

export const findById = async (collection, id) => {
  await initDb();
  return (db[collection] || []).find((d) => d.id === id || d.uid === id) || null;
};

export const query = async (collection, predicate = () => true) => {
  await initDb();
  return (db[collection] || []).filter(predicate);
};

export const removeWhere = async (collection, predicate) => {
  await initDb();
  db[collection] = (db[collection] || []).filter((d) => !predicate(d));
  persist();
};

export const setIn = async (collection, id, patch) => updateDoc(collection, id, patch);

/** Dev helper: wipe and reseed the demo database. */
export const resetDb = async () => {
  db = buildSeed();
  await AsyncStorage.setItem(DB_KEY, JSON.stringify(db));
  return db;
};

/** Pair id is stable regardless of which user is "a" and "b". */
export const pairId = (uidA, uidB) => [uidA, uidB].sort().join('__');
