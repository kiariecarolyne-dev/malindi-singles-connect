/**
 * adminService (Firebase) — moderation dashboard stats.
 *
 * Every query here is admin-only: `firestore.rules` checks
 * `users/{uid}.role == 'admin'`, so a hidden menu tab is never the only
 * protection. Message totals come from `conversations.messageCount`
 * (maintained by messageService) — no full message scan is needed.
 */
import { getCountFromServer, getDocs, limit as fsLimit, query, Timestamp, where } from 'firebase/firestore';

import { col, docsToModels } from './helpers';

const countOf = async (ref) => {
  try {
    const snapshot = await getCountFromServer(ref);
    return snapshot.data().count;
  } catch {
    return 0;
  }
};

export const getStats = async () => {
  const dayAgo = Timestamp.fromDate(new Date(Date.now() - 24 * 36e5));

  const [users, profiles, activeToday, matches, openReports] = await Promise.all([
    countOf(col('users')),
    countOf(col('profiles')),
    countOf(query(col('profiles'), where('lastActiveAt', '>', dayAgo))),
    countOf(query(col('matches'), where('blocked', '==', false))),
    countOf(query(col('reports'), where('status', '==', 'open'))),
  ]);

  let messages = 0;
  let pendingVerifications = 0;
  let suspended = 0;

  try {
    const [conversationSnap, profileSnap] = await Promise.all([
      getDocs(query(col('conversations'), fsLimit(5000))),
      getDocs(query(col('profiles'), where('suspended', '==', true), fsLimit(1000))),
    ]);
    messages = docsToModels(conversationSnap).reduce(
      (total, conversation) => total + (conversation.messageCount || 0),
      0,
    );
    suspended = profileSnap.size;
  } catch {
    // A partial dashboard still beats no dashboard.
  }

  try {
    const pending = await getDocs(
      query(col('profiles'), where('verification.status', '==', 'pending'), fsLimit(500)),
    );
    pendingVerifications = pending.size;
  } catch {
    pendingVerifications = 0;
  }

  return {
    users,
    profiles,
    activeToday,
    matches,
    messages,
    openReports,
    pendingVerifications,
    suspended,
  };
};

export default { getStats };
