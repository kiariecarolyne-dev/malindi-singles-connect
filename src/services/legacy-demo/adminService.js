/**
 * Demo adminService — moderation dashboard stats.
 * Firebase implementation mirrors these signatures (reads via Admin SDK).
 */
import { getDb, initDb } from './db';

export const getStats = async () => {
  await initDb();
  const db = await getDb();
  const dayAgo = Date.now() - 24 * 36e5;
  return {
    users: db.users.length,
    profiles: db.profiles.length,
    activeToday: db.profiles.filter(
      (p) => p.lastActiveAt && new Date(p.lastActiveAt).getTime() > dayAgo,
    ).length,
    matches: db.matches.filter((m) => !m.blocked).length,
    messages: db.messages.length,
    openReports: db.reports.filter((r) => r.status === 'open').length,
    pendingVerifications: db.profiles.filter((p) => p.verification?.status === 'pending').length,
    suspended: db.profiles.filter((p) => p.suspended).length,
  };
};

export default { getStats };
