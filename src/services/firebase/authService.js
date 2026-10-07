/**
 * authService (Firebase) - email/password accounts with the 18+ gate.
 *
 * Passwords live only in Firebase Auth and are never written to Firestore.
 * The role used by the admin screen comes from `users/{uid}.role`, which a
 * client can read but never write (see `firestore.rules`).
 */
import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword as firebaseSignIn,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { deleteDoc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';

import { calculateAge } from '../../utils/age';
import { assertConfigured, getFirebaseAuth } from './firebaseConfig';
import { docRef, docToModel, friendlyError } from './helpers';
import { ensureWelcome } from './notificationService';
import { touchActivity } from './profileService';

let listeners = [];
let currentUser = null;
let boundToAuth = false;
let unsubscribeUserDoc = null;
let authEpoch = 0;

const emit = () => listeners.forEach((cb) => cb(currentUser));

/** Firestore rejects `undefined`, so drop empty optional sign-up fields. */
const compact = (data) =>
  Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined && value !== null && value !== ''));

const buildUser = (authUser, userDoc) => ({
  uid: authUser.uid,
  email: authUser.email || userDoc?.email || '',
  role: userDoc?.role || 'user',
  fullName: userDoc?.fullName || authUser.displayName || authUser.email || 'Member',
  suspended: Boolean(userDoc?.suspended),
});

const readUserDoc = async (authUser) => {
  try {
    const snapshot = await getDoc(docRef('users', authUser.uid));
    return snapshot.exists() ? docToModel(snapshot) : null;
  } catch {
    return null;
  }
};

/** Keep `role` live so an admin grant appears without signing in again. */
const watchUserDoc = (uid) => {
  if (unsubscribeUserDoc) {
    unsubscribeUserDoc();
    unsubscribeUserDoc = null;
  }
  if (!uid) return;
  try {
    unsubscribeUserDoc = onSnapshot(
      docRef('users', uid),
      (snapshot) => {
        if (!currentUser || snapshot.id !== currentUser.uid) return;
        const data = snapshot.exists() ? docToModel(snapshot) : {};
        currentUser = {
          ...currentUser,
          role: data.role || 'user',
          fullName: data.fullName || currentUser.fullName,
          suspended: Boolean(data.suspended),
        };
        emit();
      },
      () => {},
    );
  } catch {
    // Role watching is optional; sign-in still works without it.
  }
};

const bindToAuth = () => {
  if (boundToAuth) return;
  boundToAuth = true;
  const auth = getFirebaseAuth();
  firebaseOnAuthStateChanged(auth, async (authUser) => {
    const epoch = ++authEpoch;
    if (!authUser) {
      currentUser = null;
      watchUserDoc(null);
      emit();
      return;
    }
    const userDoc = await readUserDoc(authUser);
    // A newer auth state superseded this read (e.g. deleteUser during a
    // failed signup) — never publish the stale user.
    if (epoch !== authEpoch) return;
    currentUser = buildUser(authUser, userDoc);
    watchUserDoc(authUser.uid);
    emit();
  });
};

export const onAuthStateChanged = (cb) => {
  listeners.push(cb);
  try {
    bindToAuth();
  } catch {
    // Not configured yet - the callback simply stays on `null`.
  }
  cb(currentUser);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
};

export const getCurrentUser = () => currentUser;

/** Resolves once Firebase has restored any persisted session (or timed out). */
export const restoreSession = async () => {
  assertConfigured();
  const auth = getFirebaseAuth();
  bindToAuth();

  if (!auth.currentUser) {
    await new Promise((resolve) => {
      let done = false;
      let unsubscribe = () => {};
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        unsubscribe();
        resolve();
      };
      const timer = setTimeout(finish, 5000);
      unsubscribe = firebaseOnAuthStateChanged(auth, finish);
      if (done) unsubscribe(); // initial callback can fire synchronously
    });
  }

  // Give the user document one chance to load so `role` is ready.
  if (auth.currentUser && !currentUser) {
    const userDoc = await readUserDoc(auth.currentUser);
    currentUser = buildUser(auth.currentUser, userDoc);
    emit();
    watchUserDoc(auth.currentUser.uid);
  }

  return currentUser;
};

/** Writes `users/{uid}` + a bare profile so onboarding can finish it. */
const createAccountDocuments = async (authUser, { fullName, seedProfile = {} }) => {
  let writeStep = 'users';
  try {
    await setDoc(docRef('users', authUser.uid), {
      uid: authUser.uid,
      email: (authUser.email || '').toLowerCase(),
      fullName: fullName || authUser.email || 'Member',
      role: 'user',
      createdAt: serverTimestamp(),
    });
    writeStep = 'profiles';
    await setDoc(docRef('profiles', authUser.uid), {
      uid: authUser.uid,
      fullName: fullName || authUser.email || 'Member',
      photos: [],
      bio: '',
      interests: [],
      verification: { status: 'unverified', phone: false, email: false, selfie: false },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastActiveAt: serverTimestamp(),
      ...compact(seedProfile),
    });
  } catch (error) {
    if (__DEV__) {
      console.warn(
        `[auth] createAccountDocuments failed at "${writeStep}" for uid ${authUser.uid}:`,
        error?.code || error?.name || 'unknown',
        error?.message || '',
      );
    }
    // Best effort cleanup so the same email can be retried.
    try {
      await deleteDoc(docRef('profiles', authUser.uid));
    } catch {}
    try {
      await deleteDoc(docRef('users', authUser.uid));
    } catch {}
    return false;
  }
  return true;
};

const assertAdult = (dateOfBirth) => {
  if (!dateOfBirth) return;
  if (calculateAge(dateOfBirth) < 18) {
    throw new Error('You must be 18 or older to use Malindi Singles Connect.');
  }
};

const assertSuspended = async (uid) => {
  const userDoc = await readUserDoc({ uid });
  if (userDoc?.suspended) return 'This account has been suspended. Contact support.';
  try {
    const profileSnapshot = await getDoc(docRef('profiles', uid));
    if (profileSnapshot.exists() && docToModel(profileSnapshot).suspended) {
      return 'This account has been suspended. Contact support.';
    }
  } catch {
    // No readable profile is not a suspension.
  }
  return null;
};

export const signIn = async (email, password) => {
  assertConfigured();
  const auth = getFirebaseAuth();
  const normalized = (email || '').trim().toLowerCase();

  let credential;
  try {
    credential = await firebaseSignIn(auth, normalized, password);
  } catch (error) {
    throw new Error(friendlyError(error, 'Could not log in. Please try again.'));
  }

  const suspendedMessage = await assertSuspended(credential.user.uid);
  if (suspendedMessage) {
    await firebaseSignOut(auth);
    throw new Error(suspendedMessage);
  }

  try {
    await touchActivity(credential.user.uid);
    await ensureWelcome(credential.user.uid);
  } catch {
    // Activity/welcome must never block a successful login.
  }

  const user = buildUser(credential.user, await readUserDoc(credential.user));
  currentUser = user;
  emit();
  return user;
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
  assertConfigured();
  assertAdult(dateOfBirth);

  const auth = getFirebaseAuth();
  const normalized = (email || '').trim().toLowerCase();

  let credential;
  try {
    credential = await createUserWithEmailAndPassword(auth, normalized, password);
  } catch (error) {
    throw new Error(friendlyError(error, 'Could not create your account.'));
  }

  const created = await createAccountDocuments(credential.user, {
    fullName,
    seedProfile: { gender, interestedIn, area, dateOfBirth, datingIntention },
  });

  if (!created) {
    try {
      await deleteUser(credential.user);
    } catch {
      // Best effort.
    }
    throw new Error('Could not set up your account. Please try again.');
  }

  try {
    await ensureWelcome(credential.user.uid);
  } catch {
    // Welcome inbox is optional.
  }

  const user = buildUser(credential.user, { fullName: fullName || credential.user.email });
  currentUser = user;
  emit();
  watchUserDoc(credential.user.uid);
  return user;
};

export const signOut = async () => {
  assertConfigured();
  try {
    await firebaseSignOut(getFirebaseAuth());
  } catch {
    // Nothing to clean up locally.
  }
  currentUser = null;
  watchUserDoc(null);
  emit();
};

export const sendPasswordReset = async (email) => {
  assertConfigured();
  const auth = getFirebaseAuth();
  const normalized = (email || '').trim().toLowerCase();
  try {
    await sendPasswordResetEmail(auth, normalized);
  } catch (error) {
    throw new Error(friendlyError(error, 'Could not send that reset link.'));
  }
  // Firebase does not reveal whether the address exists.
  return { sent: true, demo: false };
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
