/**
 * Demo authService — same interface as the Firebase implementation.
 * Session persists in AsyncStorage so the app stays signed in.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from '../../config/env';
import { generateId, getDb, initDb, insert, updateDoc } from './db';
import { ensureWelcome } from './notificationService';
import { SEED_LIKES_FEMALE, SEED_LIKES_MALE, buildDemoUserProfile } from './seed';

let listeners = [];
let currentUser = null;

const emit = () => listeners.forEach((cb) => cb(currentUser));

const saveSession = async (uid) => {
  if (uid) await AsyncStorage.setItem(STORAGE_KEYS.session, uid);
  else await AsyncStorage.removeItem(STORAGE_KEYS.session);
};

export const onAuthStateChanged = (cb) => {
  listeners.push(cb);
  cb(currentUser);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
};

export const getCurrentUser = () => currentUser;

export const restoreSession = async () => {
  await initDb();
  const uid = await AsyncStorage.getItem(STORAGE_KEYS.session);
  if (!uid) return null;
  const db = await getDb();
  const account = db.users.find((u) => u.uid === uid);
  if (!account) {
    await AsyncStorage.removeItem(STORAGE_KEYS.session);
    return null;
  }
  currentUser = {
    uid: account.uid,
    email: account.email,
    role: account.role,
    fullName: account.fullName || account.email,
  };
  emit();
  return currentUser;
};

/**
 * Pick the demo personas that already liked this member.
 * Interested-in decides the list: 8 female, 8 male, or 4+4 for both —
 * so every new member immediately has the 3 clear + 5 blurred likes
 * that demonstrate the 💎 Malindi Gold unlock.
 */
const pickSeedLikers = (profile, profiles) => {
  const wants = new Set(profile?.interestedIn || []);
  const memberGender = profile?.gender;
  const pool = (list) =>
    list.filter((uid) => {
      const p = profiles.find((x) => x.uid === uid);
      return p && !p.suspended && wants.has(p.gender) && (p.interestedIn || []).includes(memberGender);
    });

  const female = pool(SEED_LIKES_FEMALE);
  const male = pool(SEED_LIKES_MALE);
  if (wants.has('female') && wants.has('male')) return [...female.slice(0, 4), ...male.slice(0, 4)];
  if (wants.has('female')) return female.slice(0, 8);
  return male.slice(0, 8);
};

/** Seeded likes are spaced day-by-day, oldest first → deterministic order. */
const seedLikeTime = (index, total) =>
  new Date(Date.now() - (total - index) * 24 * 36e5).toISOString();

/**
 * Incoming demo likes: created when missing (top-up for older installs) and
 * re-stamped so the pick order above matches premiumService's
 * "oldest first" visibility rule.
 */
const seedIncomingLikes = async (uid, profile) => {
  const db = await getDb();
  const desired = pickSeedLikers(profile, db.profiles);
  if (!desired.length) return;

  for (const fromUid of desired) {
    const row = db.likes.find((l) => l.toUid === uid && l.fromUid === fromUid);
    const createdAt = seedLikeTime(desired.indexOf(fromUid), desired.length);
    if (row) {
      // re-stamp demo likes so "oldest first" matches the pick order
      if (row.createdAt !== createdAt) await updateDoc('likes', row.id, { createdAt });
    } else {
      await insert('likes', {
        id: generateId('like'),
        fromUid,
        toUid: uid,
        type: 'like',
        createdAt,
      });
    }
  }
};

const ensureProfile = async (uid, fullName, overrides = {}) => {
  const db = await getDb();
  const found = db.profiles.find((p) => p.uid === uid);
  if (found) return found;
  const profile = buildDemoUserProfile(uid, {
    fullName: fullName || 'Member',
    ...overrides,
  });
  await insert('profiles', profile);
  return profile;
};

export const signIn = async (email, password) => {
  await initDb();
  const db = await getDb();
  const normalized = email.trim().toLowerCase();
  const account = db.users.find((u) => u.email === normalized);
  if (!account) throw new Error('No account found for that email or phone.');
  if (account.password !== password) throw new Error('Incorrect password. Please try again.');
  if (account.suspended) throw new Error('This account has been suspended. Contact support.');

  currentUser = {
    uid: account.uid,
    email: account.email,
    role: account.role,
    fullName: account.fullName || account.email,
  };
  if (account.role !== 'admin') {
    const profile = await ensureProfile(account.uid, account.fullName);
    await updateDoc('profiles', account.uid, { lastActiveAt: new Date().toISOString() });
    await seedIncomingLikes(account.uid, profile);
    await ensureWelcome(account.uid);
  }
  await saveSession(account.uid);
  emit();
  return currentUser;
};

export const signUp = async ({
  fullName,
  email,
  password,
  gender,
  interestedIn,
  area,
  dateOfBirth,
  datingIntention,
}) => {
  await initDb();
  const db = await getDb();
  const normalized = email.trim().toLowerCase();
  if (db.users.some((u) => u.email === normalized)) {
    throw new Error('An account with that email or phone already exists.');
  }
  const uid = generateId('user');
  const account = {
    uid,
    email: normalized,
    password,
    role: 'user',
    fullName,
    createdAt: new Date().toISOString(),
  };
  await insert('users', account);
  const profile = buildDemoUserProfile(uid, {
    fullName,
    gender: gender || 'male',
    interestedIn: interestedIn || ['female'],
    area: area || 'malindi_town',
    dateOfBirth: dateOfBirth || '2000-01-01',
    datingIntention: datingIntention || 'open',
    // photo, bio and interests are collected during onboarding
    photos: [],
    bio: '',
    interests: [],
    verification: { status: 'unverified', phone: false, email: false, selfie: false },
  });
  await insert('profiles', profile);
  await seedIncomingLikes(uid, profile);
  await ensureWelcome(uid);

  currentUser = { uid, email: normalized, role: 'user', fullName };
  await saveSession(uid);
  emit();
  return currentUser;
};

export const signOut = async () => {
  currentUser = null;
  await saveSession(null);
  emit();
};

export const sendPasswordReset = async (email) => {
  await initDb();
  const db = await getDb();
  const normalized = email.trim().toLowerCase();
  if (!db.users.some((u) => u.email === normalized)) {
    throw new Error('No account found for that email.');
  }
  // Demo mode cannot send real emails — the UI states this honestly.
  return { sent: true, demo: true };
};

export default {
  onAuthStateChanged,
  getCurrentUser,
  restoreSession,
  signIn,
  signUp,
  signOut,
  sendPasswordReset,
};
