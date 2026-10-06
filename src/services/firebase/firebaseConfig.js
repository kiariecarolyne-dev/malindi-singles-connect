/**
 * Firebase bootstrap — the ONLY place the SDK is initialised.
 *
 * Settings are read from EXPO_PUBLIC_* environment variables (`.env`, see
 * `.env.example`). Those values are public by nature (they ship inside the
 * app bundle); real protection comes from `firestore.rules`, `storage.rules`
 * and App Check — never from hiding the config.
 *
 * Screens never import this file: they go through `src/services/index.js`.
 */
import { getApps, initializeApp } from 'firebase/app';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as authModule from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const REQUIRED_KEYS = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
];

// Literal keys only (EXPO_PUBLIC_* are inlined by Expo at bundle time).
const ENV = {
  EXPO_PUBLIC_FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  EXPO_PUBLIC_FIREBASE_APP_ID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const env = (key) => {
  const value = ENV[key];
  return typeof value === 'string' && value.trim() ? value.trim() : '';
};

export const missingFirebaseKeys = () => REQUIRED_KEYS.filter((key) => !env(key));

export const isFirebaseConfigured = () => missingFirebaseKeys().length === 0;

export const CONFIG_HELP =
  'Firebase is not configured yet. Copy .env.example to .env, fill in the EXPO_PUBLIC_FIREBASE_* values for the malindi-singles-connect project, then restart Expo with `npx expo start -c`.';

const missingMessage = () =>
  `Missing Firebase configuration: ${missingFirebaseKeys().join(', ')}. ${CONFIG_HELP}`;

const firebaseConfig = () => ({
  apiKey: env('EXPO_PUBLIC_FIREBASE_API_KEY'),
  authDomain: env('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'),
  projectId: env('EXPO_PUBLIC_FIREBASE_PROJECT_ID'),
  storageBucket: env('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: env('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
  appId: env('EXPO_PUBLIC_FIREBASE_APP_ID'),
  ...(env('EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID')
    ? { measurementId: env('EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID') }
    : {}),
});

let app = null;
let auth = null;
let db = null;
let storage = null;

/** Lazily create the Firebase app + service handles. Throws a clear error when `.env` is missing. */
const ensure = () => {
  if (app) return;
  if (!isFirebaseConfigured()) throw new Error(missingMessage());

  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig());

  // Present in the React Native build of @firebase/auth, absent in the web
  // build the linter resolves — so read it defensively and fall back.
  // eslint-disable-next-line import/namespace
  const rnPersistence = authModule.getReactNativePersistence;

  try {
    auth = rnPersistence
      ? authModule.initializeAuth(app, {
          persistence: rnPersistence(AsyncStorage),
        })
      : authModule.getAuth(app);
  } catch {
    // Already initialised (hot reload) — reuse it.
    auth = authModule.getAuth(app);
  }

  db = getFirestore(app);
  storage = getStorage(app);
};

export const getFirebaseApp = () => {
  ensure();
  return app;
};

export const getFirebaseAuth = () => {
  ensure();
  return auth;
};

export const getDb = () => {
  ensure();
  return db;
};

export const getFirebaseStorage = () => {
  ensure();
  return storage;
};

/**
 * Guard used by services so a missing `.env` produces one readable message
 * instead of an SDK crash deep inside a screen.
 */
export const assertConfigured = () => {
  if (!isFirebaseConfigured()) throw new Error(missingMessage());
};

export default { isFirebaseConfigured, missingFirebaseKeys, CONFIG_HELP };
