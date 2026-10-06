/**
 * reportService (Firebase) — user safety reports.
 *
 * Anyone signed in may file a report about themselves/targets (rules check
 * `fromUid`), but only an admin can read the queue — reports are not
 * publicly listable.
 */
import { addDoc, getDocs, limit as fsLimit, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';

import { col, docRef, docsToModels, nowIso } from './helpers';

export const submitReport = async ({ fromUid, targetUid, reason, details }) => {
  const report = {
    id: null,
    fromUid,
    targetUid,
    reason,
    details: (details || '').trim(),
    status: 'open',
    createdAt: nowIso(),
  };

  try {
    const reference = await addDoc(col('reports'), {
      fromUid,
      targetUid,
      reason,
      details: report.details,
      status: 'open',
      createdAt: serverTimestamp(),
    });
    report.id = reference.id;
  } catch (error) {
    throw new Error(error?.message || 'Could not send that report.');
  }

  return report;
};

/** Admin only (enforced by rules). */
export const getReports = async () => {
  const snapshot = await getDocs(
    query(col('reports'), orderBy('createdAt', 'desc'), fsLimit(500)),
  );
  return docsToModels(snapshot);
};

/** Admin only (enforced by rules). */
export const resolveReport = async (reportId, status, adminUid) => {
  try {
    await updateDoc(docRef('reports', reportId), {
      status,
      resolvedAt: serverTimestamp(),
      resolvedBy: adminUid,
    });
  } catch (error) {
    throw new Error(error?.message || 'Could not update that report.');
  }
};

export default { submitReport, getReports, resolveReport };
