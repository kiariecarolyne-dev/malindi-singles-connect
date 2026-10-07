/**
 * TEMPORARY — verifies that the photo URL write the app performs
 * (profileService.updateProfile -> setDoc merge with `photos`)
 * is permitted by firestore.rules, using the real photoPathFromValue()
 * from src/services/supabase/storage.js (byte-identical copy).
 *
 * Run: npx firebase emulators:exec --only firestore "node tests/tmp-profile-photos-write.test.mjs"
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UID = 'phototest000001';
const OTHER = 'otheruser00002';

// Real app module (verified SHA-256 identical to src/services/supabase/storage.js)
const { photoPathFromValue } = await import(
  'file:///C:/Users/TOSHIBA/AppData/Local/Temp/opencode/photo-verify/storage.mjs'
);

const env = await initializeTestEnvironment({
  projectId: 'malindi-singles-connect-rules',
  firestore: {
    rules: readFileSync(path.join(root, 'firestore.rules'), 'utf8'),
    host: '127.0.0.1',
    port: 8080,
  },
});

let passed = 0;
let failed = 0;
const allows = async (label, p) => {
  try {
    await assertSucceeds(p);
    passed += 1;
    console.log(`  ok   ${label}`);
  } catch (e) {
    failed += 1;
    console.log(`  FAIL ${label} — ${String(e.message || e).split('\n')[0]}`);
  }
};
const denies = async (label, p) => {
  try {
    await assertFails(p);
    passed += 1;
    console.log(`  ok   ${label}`);
  } catch (e) {
    failed += 1;
    console.log(`  FAIL ${label} — expected PERMISSION_DENIED, got success`);
  }
};

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  const now = new Date().toISOString();
  await db.doc(`profiles/${UID}`).set({
    uid: UID,
    fullName: 'Photo Verify',
    photos: [],
    bio: 'test',
    gender: 'female',
    interestedIn: ['male'],
    area: 'malindi-town',
    verification: { status: 'unverified' },
    lastActiveAt: now,
    createdAt: now,
    updatedAt: now,
  });
  await db.doc(`profiles/${OTHER}`).set({
    uid: OTHER,
    fullName: 'Other',
    photos: [],
    gender: 'male',
    interestedIn: ['female'],
    area: 'malindi-town',
    verification: { status: 'unverified' },
    lastActiveAt: now,
    createdAt: now,
    updatedAt: now,
  });
});

// Representative signed URL produced by storage.js signPhotoUrl().
const objectPath = `${UID}/photo_1770000000000_ab12cd.jpg`;
const signedUrl =
  `https://ihdelctfpnfjwjubfcww.supabase.co/storage/v1/object/sign/profile-photos/${objectPath}` +
  '?token=00000000-0000-0000-0000-000000000000';

const asUser = (uid) => env.authenticatedContext(uid).firestore();

console.log('\nprofiles/{uid}.photos write (same call profileService.updateProfile makes)');
await allows('owner writes photos array (setDoc merge)', () =>
  asUser(UID)
    .doc(`profiles/${UID}`)
    .set({ photos: [signedUrl], uid: UID, updatedAt: new Date().toISOString() }, { merge: true }),
);
await denies('another member cannot write my photos', () =>
  asUser(OTHER)
    .doc(`profiles/${UID}`)
    .set({ photos: ['https://evil.example/x.jpg'] }, { merge: true }),
);

const stored = await env.withSecurityRulesDisabled(async (ctx) => {
  const snap = await ctx.firestore().doc(`profiles/${UID}`).get();
  return snap.data();
});
const okStored = Array.isArray(stored.photos) && stored.photos.length === 1 && stored.photos[0] === signedUrl;
console.log(`${okStored ? '  ok  ' : '  FAIL'} persisted profiles/${UID}.photos === [signedUrl]`);
okStored ? (passed += 1) : (failed += 1);

const extracted = photoPathFromValue(stored.photos[0], UID);
const okExtract = extracted === objectPath;
console.log(`${okExtract ? '  ok  ' : '  FAIL'} photoPathFromValue(url, uid) === object path (got ${extracted})`);
okExtract ? (passed += 1) : (failed += 1);

console.log(`\n${passed} passed, ${failed} failed`);
await env.cleanup();
process.exit(failed ? 1 : 0);
