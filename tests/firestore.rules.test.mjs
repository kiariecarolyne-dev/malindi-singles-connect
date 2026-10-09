/**
 * Firestore security-rules test suite.
 *
 * Run with:
 *   npx firebase emulators:exec --only firestore "node tests/firestore.rules.test.mjs"
 *
 * Every test mirrors a real call the app makes (same collection, same query
 * shape, same fields) so a green run means the deployed rules will not break
 * a screen.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { serverTimestamp } from 'firebase/firestore';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const ALICE = 'aliceuid0001';
const BOB = 'bobuid000002';
const CAROL = 'caroluid0003';
const ADMIN = 'adminuid0001';
const DAVE = 'daveuid00004'; // legacy Gold via profile.gold.isGold

const likeId = `like_${ALICE}_${BOB}`;
const matchId = `match_${ALICE}_${BOB}`;
const convId = `conv_${ALICE}_${BOB}`;
const blockA = `block_${ALICE}_${BOB}`;
const blockB = `block_${BOB}_${ALICE}`;

let passed = 0;
let failed = 0;

const pass = (label) => {
  passed += 1;
  console.log(`  ok   ${label}`);
};

const fail = (label, error) => {
  failed += 1;
  console.log(`  FAIL ${label}\n       ${String(error?.message || error).split('\n')[0]}`);
};

const allows = async (label, promise) => {
  try {
    await assertSucceeds(promise);
    pass(label);
  } catch (error) {
    fail(label, error);
  }
};

const denies = async (label, promise) => {
  try {
    await assertFails(promise);
    pass(label);
  } catch (error) {
    fail(label, new Error(`expected PERMISSION_DENIED but the call succeeded`));
  }
};

const env = await initializeTestEnvironment({
  projectId: 'malindi-singles-connect-rules',
  firestore: {
    rules: readFileSync(path.join(root, 'firestore.rules'), 'utf8'),
    host: '127.0.0.1',
    port: 8080,
  },
});

const seed = () =>
  env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const now = new Date().toISOString();

    await db.doc(`users/${ALICE}`).set({ uid: ALICE, email: 'alice@x.co', fullName: 'Alice', role: 'user' });
    await db.doc(`users/${BOB}`).set({ uid: BOB, email: 'bob@x.co', fullName: 'Bob', role: 'user' });
    await db.doc(`users/${CAROL}`).set({ uid: CAROL, email: 'carol@x.co', fullName: 'Carol', role: 'user' });
    await db.doc(`users/${ADMIN}`).set({ uid: ADMIN, email: 'admin@x.co', fullName: 'Admin', role: 'admin' });
    await db.doc(`users/${DAVE}`).set({ uid: DAVE, email: 'dave@x.co', fullName: 'Dave', role: 'user' });

    await db.doc(`profiles/${ALICE}`).set({
      uid: ALICE, fullName: 'Alice', photos: [], bio: 'Hi', gender: 'female',
      interestedIn: ['male'], area: 'malindi-town', verification: { status: 'unverified' },
      lastActiveAt: now, createdAt: now, updatedAt: now,
    });
    await db.doc(`profiles/${BOB}`).set({
      uid: BOB, fullName: 'Bob', photos: [], bio: 'Hey', gender: 'male',
      interestedIn: ['female'], area: 'malindi-town', verification: { status: 'pending' },
      lastActiveAt: now, createdAt: now, updatedAt: now,
    });
    await db.doc(`profiles/${CAROL}`).set({
      uid: CAROL, fullName: 'Carol', photos: [], bio: 'Hello', gender: 'female',
      interestedIn: ['male'], area: 'malindi-town', verification: { status: 'unverified' },
      lastActiveAt: now, createdAt: now, updatedAt: now,
    });
    // Legacy Gold: no entitlement doc, gold flag lives on the profile.
    await db.doc(`profiles/${DAVE}`).set({
      uid: DAVE, fullName: 'Dave', photos: [], bio: 'Legacy', gender: 'male',
      interestedIn: ['female'], area: 'malindi-town', verification: { status: 'unverified' },
      gold: { isGold: true, goldActivatedAt: now },
      lastActiveAt: now, createdAt: now, updatedAt: now,
    });

    await db.doc(`likes/${likeId}`).set({ id: likeId, fromUid: ALICE, toUid: BOB, type: 'like', createdAt: now });
    await db.doc(`matches/${matchId}`).set({
      id: matchId, conversationId: convId, uids: [ALICE, BOB].sort(), status: 'new', blocked: false, createdAt: now,
    });
    await db.doc(`conversations/${convId}`).set({
      id: convId, matchId, members: [ALICE, BOB].sort(), lastMessage: 'hi', lastFrom: ALICE,
      lastMessageAt: now, unread: { [ALICE]: 0, [BOB]: 1 }, messageCount: 1, createdAt: now, updatedAt: now,
    });
    await db.doc(`conversations/${convId}/messages/msg1`).set({
      id: 'msg1', conversationId: convId, senderUid: ALICE, text: 'hi', read: false, type: 'text', createdAt: now,
    });
    await db.doc(`conversations/${convId}/typing/${ALICE}`).set({ at: now });

    await db.collection('notifications').add({
      uid: BOB, type: 'like', title: 'Alice likes you', body: '', data: {}, read: false, createdAt: now,
    });
    await db.doc(`blocks/${blockA}`).set({ id: blockA, uid: ALICE, blockedUid: BOB, createdAt: now });
    await db.doc(`blocks/${blockB}`).set({ id: blockB, uid: BOB, blockedUid: ALICE, createdAt: now });
    await db.doc('meetups/meet1').set({
      fromUid: ALICE, toUid: BOB, activityId: 'coffee', placeId: 'square', timeLabel: '5:00 PM',
      status: 'pending', date: '2026-10-06', createdAt: now,
    });
    await db.doc('reports/rep1').set({
      fromUid: ALICE, targetUid: BOB, reason: 'Spam', details: '', status: 'open', createdAt: now,
    });
    await db.doc(`goldEntitlements/${ALICE}`).set({
      uid: ALICE, isGold: true, price: 100, currency: 'KES', billing: 'one_time',
    });

    /* 💛 Gold Circle fixtures — a Gold post (Alice) and a legacy-Gold post
       (Dave), plus one existing comment so counter deltas have a base. */
    await db.doc('goldCirclePosts/gpost1').set({
      authorUid: ALICE, authorName: 'Alice', authorAvatar: '',
      text: 'Hello Gold Circle!', category: 'discussion',
      imageUrl: null, imagePath: null, sharedWhatsApp: false, whatsapp: null,
      likedBy: [], likeCount: 0, commentCount: 1, createdAt: now, updatedAt: now,
    });
    await db.doc('goldCirclePosts/gpost2').set({
      authorUid: DAVE, authorName: 'Dave', authorAvatar: '',
      text: 'Second post', category: 'story',
      imageUrl: null, imagePath: null, sharedWhatsApp: false, whatsapp: null,
      likedBy: [], likeCount: 0, commentCount: 0, createdAt: now, updatedAt: now,
    });
    await db.doc('goldCirclePosts/gpost1/comments/gc1').set({
      authorUid: DAVE, authorName: 'Dave', authorAvatar: '', text: 'Welcome!', createdAt: now,
    });
  });

const asUser = (uid) => env.authenticatedContext(uid).firestore();
const asAnon = () => env.unauthenticatedContext().firestore();

await seed();

console.log('\nprofiles');
await allows('owner reads own profile', () => asUser(ALICE).doc(`profiles/${ALICE}`).get());
await allows('other member reads a profile', () => asUser(BOB).doc(`profiles/${ALICE}`).get());
await denies('anonymous profile read', () => asAnon().doc(`profiles/${ALICE}`).get());
await allows('owner updates own bio', () =>
  asUser(ALICE).doc(`profiles/${ALICE}`).update({ bio: 'New bio' }),
);
await allows('owner touchActivity (lastActiveAt)', () =>
  asUser(ALICE).doc(`profiles/${ALICE}`).update({ lastActiveAt: new Date().toISOString() }),
);
await denies('owner cannot write gold', () =>
  asUser(ALICE).doc(`profiles/${ALICE}`).update({ gold: { isGold: true } }),
);
await denies('owner cannot write plan', () =>
  asUser(ALICE).doc(`profiles/${ALICE}`).update({ plan: 'gold' }),
);
await denies('owner cannot change role', () =>
  asUser(ALICE).doc(`profiles/${ALICE}`).update({ role: 'admin' }),
);
await denies('member cannot edit someone else profile', () =>
  asUser(BOB).doc(`profiles/${ALICE}`).update({ bio: 'hacked' }),
);
await allows('admin sets verification on another profile', () =>
  asUser(ADMIN).doc(`profiles/${BOB}`).update({ verification: { status: 'approved', phone: true, email: true, selfie: true } }),
);
await allows('admin suspends a profile', () =>
  asUser(ADMIN).doc(`profiles/${BOB}`).update({ suspended: true }),
);
await allows('admin pending-verification query', () =>
  asUser(ADMIN).collection('profiles').where('verification.status', '==', 'pending').limit(50).get(),
);
await allows('discover query (array-contains interestedIn)', () =>
  asUser(ALICE).collection('profiles').where('interestedIn', 'array-contains', 'female').limit(20).get(),
);

console.log('\nlikes');
await allows('like create from self (sorted pair id)', () =>
  asUser(CAROL).doc(`like_${ALICE}_${CAROL}`).set({
    id: `like_${ALICE}_${CAROL}`, fromUid: CAROL, toUid: ALICE, type: 'like', createdAt: new Date().toISOString(),
  }),
);
await denies('like create spoofed as someone else', () =>
  asUser(BOB).doc('likes/like_x_caroluid0003').set({
    id: 'like_x_caroluid0003', fromUid: ALICE, toUid: CAROL, type: 'like', createdAt: new Date().toISOString(),
  }),
);
await allows('sender lists own outgoing likes', () =>
  asUser(ALICE).collection('likes').where('fromUid', '==', ALICE).limit(10).get(),
);
await allows('recipient lists incoming likes', () =>
  asUser(BOB).collection('likes').where('toUid', '==', BOB).limit(10).get(),
);
await allows('get on a like that does not exist yet (match transaction)', () =>
  asUser(ALICE).doc('likes/like_aliceuid0001_nobody0000').get(),
);
await denies('unscoped list of every like', () => asUser(ALICE).collection('likes').limit(10).get());
await denies('anonymous like list', () => asAnon().collection('likes').where('toUid', '==', BOB).get());
await allows('like can be flipped to a pass by its sender', () =>
  asUser(ALICE).doc(`likes/${likeId}`).update({ type: 'pass' }),
);
await denies('recipient cannot rewrite the like', () =>
  asUser(BOB).doc(`likes/${likeId}`).update({ type: 'pass' }),
);

console.log('\nmatches + conversations');
await allows('member lists own matches', () =>
  asUser(ALICE).collection('matches').where('uids', 'array-contains', ALICE).get(),
);
await denies('stranger lists someone elses matches', () =>
  asUser(CAROL).collection('matches').where('uids', 'array-contains', ALICE).get(),
);
await allows('get on a match that does not exist yet', () => asUser(ALICE).doc(`matches/match_nope`).get());
await allows('member lists own conversations', () =>
  asUser(ALICE).collection('conversations').where('members', 'array-contains', ALICE).get(),
);
await denies('stranger lists every conversation (unscoped)', () =>
  asUser(CAROL).collection('conversations').limit(10).get(),
);
await allows('member opens a missing conversation (get)', () =>
  asUser(ALICE).doc('conversations/conv_missing00').get(),
);
await allows('member lists messages', () =>
  asUser(BOB).doc(`conversations/${convId}`).collection('messages').orderBy('createdAt', 'desc').limit(30).get(),
);
await denies('stranger lists messages', () =>
  asUser(CAROL).doc(`conversations/${convId}`).collection('messages').get(),
);
await allows('member sends a message as self', () =>
  asUser(BOB).doc(`conversations/${convId}/messages/msg2`).set({
    id: 'msg2', conversationId: convId, senderUid: BOB, text: 'hello', read: false, type: 'text', createdAt: new Date().toISOString(),
  }),
);
await denies('member cannot send as someone else', () =>
  asUser(BOB).doc(`conversations/${convId}/messages/msg3`).set({
    id: 'msg3', conversationId: convId, senderUid: ALICE, text: 'forged', read: false, type: 'text', createdAt: new Date().toISOString(),
  }),
);
await allows('member marks a message read', () =>
  asUser(BOB).doc(`conversations/${convId}/messages/msg1`).update({ read: true }),
);
await denies('member cannot rewrite message text', () =>
  asUser(BOB).doc(`conversations/${convId}/messages/msg1`).update({ text: 'edited' }),
);
await allows('member updates conversation summary (unread counters)', () =>
  asUser(BOB).doc(`conversations/${convId}`).update({ unread: { [ALICE]: 1, [BOB]: 0 }, messageCount: 2 }),
);
await denies('member cannot rewrite the conversation roster', () =>
  asUser(BOB).doc(`conversations/${convId}`).update({ members: [BOB, CAROL] }),
);
await allows('member reads typing state', () =>
  asUser(BOB).doc(`conversations/${convId}`).collection('typing').get(),
);
await allows('member writes own typing doc', () =>
  asUser(BOB).doc(`conversations/${convId}/typing/${BOB}`).set({ at: new Date().toISOString() }),
);
await denies('member cannot write someone elses typing doc', () =>
  asUser(BOB).doc(`conversations/${convId}/typing/${ALICE}`).set({ at: new Date().toISOString() }),
);
await allows('member clears the chat (message delete)', () =>
  asUser(BOB).doc(`conversations/${convId}/messages/msg2`).delete(),
);

console.log('\nnotifications');
await allows('owner lists own inbox', () =>
  asUser(BOB).collection('notifications').where('uid', '==', BOB).orderBy('createdAt', 'desc').limit(20).get(),
);
await denies('someone else lists my inbox', () =>
  asUser(CAROL).collection('notifications').where('uid', '==', BOB).orderBy('createdAt', 'desc').get(),
);
await allows('self notification (welcome/boost)', () =>
  asUser(CAROL).collection('notifications').add({
    uid: CAROL, type: 'welcome', title: 'Welcome', body: '', data: {}, read: false, createdAt: new Date().toISOString(),
  }),
);
await allows('like notification once the like exists', () =>
  asUser(CAROL).collection('notifications').add({
    uid: ALICE, type: 'like', title: 'Someone likes you', body: '', data: {}, read: false, createdAt: new Date().toISOString(),
  }),
);
await denies('like notification without a real like', () =>
  asUser(BOB).collection('notifications').add({
    uid: CAROL, type: 'like', title: 'Fake like', body: '', data: {}, read: false, createdAt: new Date().toISOString(),
  }),
);
await allows('match notification once the match exists', () =>
  asUser(ALICE).collection('notifications').add({
    uid: BOB, type: 'match', title: 'New match', body: '', data: {}, read: false, createdAt: new Date().toISOString(),
  }),
);
await denies('verification notification from a non-admin', () =>
  asUser(ALICE).collection('notifications').add({
    uid: BOB, type: 'verification', title: 'Verified', body: '', data: {}, read: false, createdAt: new Date().toISOString(),
  }),
);
await allows('admin sends verification result', () =>
  asUser(ADMIN).collection('notifications').add({
    uid: BOB, type: 'verification', title: 'Verified', body: '', data: {}, read: false, createdAt: new Date().toISOString(),
  }),
);
await allows('owner marks a notification read', async () => {
  const snapshot = await asUser(BOB).collection('notifications').where('uid', '==', BOB).limit(1).get();
  const first = snapshot.docs[0];
  await first.ref.update({ read: true });
});
await denies('owner cannot rewrite notification content', async () => {
  const snapshot = await asUser(BOB).collection('notifications').where('uid', '==', BOB).limit(1).get();
  await snapshot.docs[0].ref.update({ title: 'changed' });
});

console.log('\ngold entitlements (read-only for the owner)');
await allows('owner reads own entitlement', () => asUser(ALICE).doc(`goldEntitlements/${ALICE}`).get());
await allows('owner get on a missing entitlement (not Gold yet)', () => asUser(BOB).doc(`goldEntitlements/${BOB}`).get());
await denies('another member reads my entitlement', () => asUser(BOB).doc(`goldEntitlements/${ALICE}`).get());
await denies('owner cannot grant themselves Gold', () =>
  asUser(ALICE).doc(`goldEntitlements/${ALICE}`).set({ uid: ALICE, isGold: true }, { merge: true }),
);
await denies('owner cannot update the entitlement', () =>
  asUser(ALICE).doc(`goldEntitlements/${ALICE}`).update({ isGold: true }),
);
await denies('no listing entitlements', () => asUser(ALICE).collection('goldEntitlements').limit(5).get());

console.log('\nblocks');
await allows('block create from self', () =>
  asUser(CAROL).doc('blocks/block_carol_alice').set({ id: 'block_carol_alice', uid: CAROL, blockedUid: ALICE, createdAt: new Date().toISOString() }),
);
await denies('block spoofed onto someone else', () =>
  asUser(BOB).doc('blocks/block_fake').set({ id: 'block_fake', uid: ALICE, blockedUid: CAROL, createdAt: new Date().toISOString() }),
);
await allows('list blocks I created', () =>
  asUser(ALICE).collection('blocks').where('uid', '==', ALICE).limit(10).get(),
);
await allows('list people who blocked me', () =>
  asUser(ALICE).collection('blocks').where('blockedUid', '==', ALICE).limit(10).get(),
);
await denies('stranger lists blocks involving someone else', () =>
  asUser(CAROL).collection('blocks').where('uid', '==', ALICE).limit(10).get(),
);
await allows('unblock (delete own block)', () => asUser(ALICE).doc(`blocks/${blockA}`).delete());
await denies('delete someone elses block', () => asUser(CAROL).doc(`blocks/${blockB}`).delete());

console.log('\nmeetups');
await allows('propose a plan as the sender', () =>
  asUser(CAROL).doc('meetups/meet2').set({
    fromUid: CAROL, toUid: ALICE, activityId: 'walk', placeId: 'beach', timeLabel: '6:00 PM',
    status: 'pending', date: '2026-10-06', createdAt: new Date().toISOString(),
  }),
);
await denies('propose a plan impersonating someone', () =>
  asUser(BOB).doc('meetups/meet3').set({
    fromUid: ALICE, toUid: CAROL, activityId: 'walk', placeId: 'beach', timeLabel: '6:00 PM',
    status: 'pending', date: '2026-10-06', createdAt: new Date().toISOString(),
  }),
);
await allows('list plans I sent', () =>
  asUser(ALICE).collection('meetups').where('fromUid', '==', ALICE).limit(10).get(),
);
await allows('list plans sent to me', () =>
  asUser(BOB).collection('meetups').where('toUid', '==', BOB).limit(10).get(),
);
await allows('receiver accepts the plan', () =>
  asUser(BOB).doc('meetups/meet1').update({
    status: 'accepted', respondedAt: new Date().toISOString(), respondedBy: BOB,
  }),
);
await denies('sender cannot answer their own plan', () =>
  asUser(ALICE).doc('meetups/meet2').update({
    status: 'accepted', respondedAt: new Date().toISOString(), respondedBy: ALICE,
  }),
);
await denies('receiver cannot rewrite plan details', () =>
  asUser(BOB).doc('meetups/meet1').update({ placeId: 'private-home' }),
);

console.log('\nreports');
await allows('file a report about someone (from self)', () =>
  asUser(CAROL).collection('reports').add({
    fromUid: CAROL, targetUid: ALICE, reason: 'Spam', details: '', status: 'open', createdAt: new Date().toISOString(),
  }),
);
await denies('file a report impersonating someone', () =>
  asUser(BOB).collection('reports').add({
    fromUid: ALICE, targetUid: CAROL, reason: 'Spam', details: '', status: 'open', createdAt: new Date().toISOString(),
  }),
);
await denies('member reads the report queue', () => asUser(ALICE).collection('reports').get());
await allows('admin reads the report queue', () => asUser(ADMIN).collection('reports').orderBy('createdAt', 'desc').limit(50).get());
await allows('admin resolves a report', () => asUser(ADMIN).doc('reports/rep1').update({ status: 'dismissed' }));
await denies('member resolves a report', () => asUser(ALICE).doc('reports/rep1').update({ status: 'dismissed' }));

console.log('\nusers + admin gating');
await allows('owner reads own user doc', () => asUser(ALICE).doc(`users/${ALICE}`).get());
await denies('member reads another user doc', () => asUser(ALICE).doc(`users/${BOB}`).get());
await denies('member lists users', () => asUser(ALICE).collection('users').limit(10).get());
await allows('admin lists users', () => asUser(ADMIN).collection('users').limit(10).get());
await allows('owner updates own display name', () =>
  asUser(ALICE).doc(`users/${ALICE}`).update({ fullName: 'Alice M' }),
);
await denies('owner cannot promote themselves', () =>
  asUser(ALICE).doc(`users/${ALICE}`).update({ role: 'admin' }),
);
await allows('admin promotes a member', () =>
  asUser(ADMIN).doc(`users/${CAROL}`).update({ role: 'admin' }),
);
await denies('new account with role admin', () =>
  asUser(CAROL).doc('users/newadmin0001').set({ uid: 'newadmin0001', email: 'n@x.co', fullName: 'New', role: 'admin' }),
);
await allows('new account with role user', () =>
  asUser(CAROL).doc('users/newuser00001').set({ uid: 'newuser00001', email: 'n2@x.co', fullName: 'New', role: 'user' }),
);

console.log('💛 gold circle (Gold-only community)');

// One instance per actor so refs/batches stay on the same Firestore handle.
const goldAlice = asUser(ALICE);
const goldCarol = asUser(CAROL);
const goldDave = asUser(DAVE);
const goldAdmin = asUser(ADMIN);

const validPost = (authorUid) => ({
  authorUid,
  authorName: 'Alice',
  authorAvatar: '',
  text: 'A fresh post from the tests',
  category: 'discussion',
  imageUrl: null,
  imagePath: null,
  sharedWhatsApp: false,
  whatsapp: null,
  likedBy: [],
  likeCount: 0,
  commentCount: 0,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

const validComment = (authorUid) => ({
  authorUid,
  authorName: 'Alice',
  authorAvatar: '',
  text: 'Nice one!',
  createdAt: serverTimestamp(),
});

// --- reads: Gold-only -----------------------------------------------------
await allows('gold member lists the feed', () =>
  goldAlice.collection('goldCirclePosts').orderBy('createdAt', 'desc').limit(12).get(),
);
await allows('gold member reads a post', () => goldAlice.doc('goldCirclePosts/gpost1').get());
await allows('legacy gold member reads the feed', () =>
  goldDave.collection('goldCirclePosts').orderBy('createdAt', 'desc').limit(12).get(),
);
await allows('admin can read the feed', () => goldAdmin.collection('goldCirclePosts').limit(12).get());
await denies('free member is denied the feed', () =>
  goldCarol.collection('goldCirclePosts').orderBy('createdAt', 'desc').limit(12).get(),
);
await denies('free member denied a single post', () => goldCarol.doc('goldCirclePosts/gpost1').get());
await denies('anonymous denied the feed', () => asAnon().collection('goldCirclePosts').limit(12).get());
await allows('gold member lists comments', () =>
  goldAlice.doc('goldCirclePosts/gpost1').collection('comments').orderBy('createdAt', 'asc').limit(100).get(),
);
await denies('free member denied the comment thread', () =>
  goldCarol.doc('goldCirclePosts/gpost1').collection('comments').get(),
);

// --- post creation --------------------------------------------------------
await allows('gold member creates a post', () =>
  goldAlice.collection('goldCirclePosts').add(validPost(ALICE)),
);
await denies('free member cannot create a post', () =>
  goldCarol.collection('goldCirclePosts').add(validPost(CAROL)),
);
await denies('gold member cannot spoof the author', () =>
  goldAlice.collection('goldCirclePosts').add(validPost(CAROL)),
);
await denies('post with extra fields is rejected', () =>
  goldAlice.collection('goldCirclePosts').add({ ...validPost(ALICE), isGold: true }),
);
await denies('post born already liked is rejected', () =>
  goldAlice.collection('goldCirclePosts').add({
    ...validPost(ALICE), likedBy: [ALICE], likeCount: 1,
  }),
);
await denies('post with a forged timestamp is rejected', () =>
  goldAlice.collection('goldCirclePosts').add({
    ...validPost(ALICE), createdAt: new Date('2020-01-01T00:00:00Z'),
  }),
);
await denies('free member cannot create a comment', () =>
  goldCarol.doc('goldCirclePosts/gpost1/comments/cfree').set(validComment(CAROL)),
);

// --- likes: self-only toggle, count mirrors the array ---------------------
await allows('gold member likes a post', () =>
  goldAlice.doc('goldCirclePosts/gpost2').update({ likedBy: [ALICE], likeCount: 1 }),
);
await allows('gold member unlikes a post', () =>
  goldAlice.doc('goldCirclePosts/gpost2').update({ likedBy: [], likeCount: 0 }),
);
await denies('free member cannot like', () =>
  goldCarol.doc('goldCirclePosts/gpost2').update({ likedBy: [CAROL], likeCount: 1 }),
);
await denies('cannot smuggle another uid into likedBy', () =>
  goldAlice.doc('goldCirclePosts/gpost2').update({ likedBy: [ALICE, BOB], likeCount: 2 }),
);
await allows('author likes their own post', () =>
  goldDave.doc('goldCirclePosts/gpost2').update({ likedBy: [DAVE], likeCount: 1 }),
);
await denies('cannot wipe someone elses like', () =>
  goldAlice.doc('goldCirclePosts/gpost2').update({ likedBy: [], likeCount: 0 }),
);
await allows('a second member can like alongside', () =>
  goldAlice.doc('goldCirclePosts/gpost2').update({ likedBy: [DAVE, ALICE], likeCount: 2 }),
);
await denies('likeCount cannot drift from likedBy.size()', () =>
  goldAlice.doc('goldCirclePosts/gpost2').update({ likedBy: [DAVE, ALICE], likeCount: 7 }),
);
await allows('member unlikes leaving the other like intact', () =>
  goldAlice.doc('goldCirclePosts/gpost2').update({ likedBy: [DAVE], likeCount: 1 }),
);
await denies('post content cannot be rewritten', () =>
  goldAlice.doc('goldCirclePosts/gpost2').update({ text: 'edited by someone else' }),
);
await denies('post authorship cannot be reassigned', () =>
  goldAlice.doc('goldCirclePosts/gpost2').update({ authorUid: ALICE }),
);

// --- comments: immutable, parent must exist, counter ±1 -------------------
await allows('gold member comments + bumps the counter (batch)', () => {
  const batch = goldAlice.batch();
  batch.set(goldAlice.doc('goldCirclePosts/gpost1/comments/gc2'), validComment(ALICE));
  batch.update(goldAlice.doc('goldCirclePosts/gpost1'), { commentCount: 2 });
  return batch.commit();
});
await denies('comment cannot target a missing post', () =>
  goldAlice.doc('goldCirclePosts/missing00/comments/cx').set(validComment(ALICE)),
);
await denies('comment author cannot be spoofed', () =>
  goldAlice.doc('goldCirclePosts/gpost1/comments/cspoof').set(validComment(BOB)),
);
await denies('comment text is immutable', () =>
  goldAlice.doc('goldCirclePosts/gpost1/comments/gc2').update({ text: 'edited' }),
);
await denies('free member cannot bump the counter', () =>
  goldCarol.doc('goldCirclePosts/gpost1').update({ commentCount: 99 }),
);
await denies('counter cannot jump more than one', () =>
  goldAlice.doc('goldCirclePosts/gpost1').update({ commentCount: 5 }),
);
await allows('counter decrements by one', () =>
  goldAlice.doc('goldCirclePosts/gpost1').update({ commentCount: 1 }),
);
await allows('counter increments back by one', () =>
  goldAlice.doc('goldCirclePosts/gpost1').update({ commentCount: 2 }),
);
await denies('gold member cannot delete someone elses comment', () =>
  goldAlice.doc('goldCirclePosts/gpost1/comments/gc1').delete(),
);
await allows('comment author deletes own comment + counter (batch)', () => {
  const batch = goldDave.batch();
  batch.delete(goldDave.doc('goldCirclePosts/gpost1/comments/gc1'));
  batch.update(goldDave.doc('goldCirclePosts/gpost1'), { commentCount: 1 });
  return batch.commit();
});

// --- deletions: own post or admin ----------------------------------------
await denies('gold member cannot delete someone elses post', () =>
  goldAlice.doc('goldCirclePosts/gpost2').delete(),
);
await denies('free member cannot delete a post', () =>
  goldCarol.doc('goldCirclePosts/gpost1').delete(),
);
await allows('author deletes their own post', () =>
  goldDave.doc('goldCirclePosts/gpost2').delete(),
);
await allows('admin removes a post', () => goldAdmin.doc('goldCirclePosts/gpost1').delete());

// --- one hot topic a day: private vote + Gold-only tally ------------------
console.log('\n💛 gold circle daily topic (one hot topic a day)');
const DAY = '2026-01-01';

await allows('gold member reads the day tally (missing is fine)', () =>
  goldAlice.doc(`goldCircleDailyTopics/${DAY}`).get(),
);
await denies('free member cannot read the day tally', () =>
  goldCarol.doc(`goldCircleDailyTopics/${DAY}`).get(),
);
await denies('anonymous cannot read the day tally', () =>
  asAnon().doc(`goldCircleDailyTopics/${DAY}`).get(),
);

await allows('first vote creates the tally + own private vote', () => {
  const batch = goldAlice.batch();
  batch.set(goldAlice.doc(`goldCircleDailyTopics/${DAY}`), {
    counts: [1, 0], sum: 1, updatedAt: serverTimestamp(),
  });
  batch.set(goldAlice.doc(`goldCircleDailyTopics/${DAY}/votes/${ALICE}`), {
    option: 0, createdAt: serverTimestamp(),
  });
  return batch.commit();
});
await denies('tally cannot be created without a private vote', () => {
  const batch = goldDave.batch();
  batch.set(goldDave.doc('goldCircleDailyTopics/2026-02-02'), {
    counts: [1, 0], sum: 1, updatedAt: serverTimestamp(),
  });
  return batch.commit();
});
await denies('tally sum must be exactly 1 on creation', () => {
  const batch = goldDave.batch();
  batch.set(goldDave.doc('goldCircleDailyTopics/2026-03-03'), {
    counts: [5, 0], sum: 5, updatedAt: serverTimestamp(),
  });
  batch.set(goldDave.doc('goldCircleDailyTopics/2026-03-03/votes/' + DAVE), {
    option: 0, createdAt: serverTimestamp(),
  });
  return batch.commit();
});
await allows('second member votes and the tally grows by one', () => {
  const batch = goldDave.batch();
  batch.set(goldDave.doc(`goldCircleDailyTopics/${DAY}`), {
    counts: [1, 1], sum: 2, updatedAt: serverTimestamp(),
  });
  batch.set(goldDave.doc(`goldCircleDailyTopics/${DAY}/votes/${DAVE}`), {
    option: 1, createdAt: serverTimestamp(),
  });
  return batch.commit();
});
await denies('a member cannot vote twice', () => {
  const batch = goldAlice.batch();
  batch.set(goldAlice.doc(`goldCircleDailyTopics/${DAY}`), {
    counts: [2, 1], sum: 3, updatedAt: serverTimestamp(),
  });
  return batch.commit();
});
await denies('a member cannot write someone elses vote', () =>
  goldAlice.doc(`goldCircleDailyTopics/${DAY}/votes/${DAVE}`).set({
    option: 0, createdAt: serverTimestamp(),
  }),
);
await denies('a vote cannot be changed', () =>
  goldAlice.doc(`goldCircleDailyTopics/${DAY}/votes/${ALICE}`).update({ option: 1 }),
);
await denies('a vote cannot be deleted', () =>
  goldAlice.doc(`goldCircleDailyTopics/${DAY}/votes/${ALICE}`).delete(),
);

console.log(`\n${passed} passed, ${failed} failed`);
await env.cleanup();
process.exit(failed ? 1 : 0);
