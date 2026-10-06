/**
 * Demo reportService — user safety reports for the admin review queue.
 * Firebase implementation mirrors these signatures.
 */
import { generateId, getDb, initDb, insert, updateDoc } from './db';

export const submitReport = async ({ fromUid, targetUid, reason, details }) => {
  await initDb();
  const report = {
    id: generateId('rep'),
    fromUid,
    targetUid,
    reason,
    details: (details || '').trim(),
    status: 'open',
    createdAt: new Date().toISOString(),
  };
  await insert('reports', report);
  return report;
};

export const getReports = async () => {
  await initDb();
  const db = await getDb();
  return [...db.reports].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

export const resolveReport = async (reportId, status, adminUid) => {
  await updateDoc('reports', reportId, {
    status,
    resolvedAt: new Date().toISOString(),
    resolvedBy: adminUid,
  });
};

export default { submitReport, getReports, resolveReport };
