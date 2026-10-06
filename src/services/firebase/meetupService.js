/**
 * meetupService (Firebase) — "Meet Today" plans over public places only.
 * Same flow as before: the plan is stored as a meetup and dropped into the
 * shared chat so both people see it in context.
 */
import { addDoc, getDoc, getDocs, limit as fsLimit, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';

import { MEET_ACTIVITIES, PUBLIC_PLACES } from '../../constants/meet';
import { createNotification } from './notificationService';
import { fetchProfileDoc } from './deck';
import { ensureConversation, sendMessage } from './messageService';
import { col, conversationDocId, docRef, docToModel, docsToModels, nowIso } from './helpers';

const todayISO = () => new Date().toISOString().split('T')[0];

export const buildPlanText = (activityId, placeId, timeLabel) => {
  const activity = MEET_ACTIVITIES.find((a) => a.id === activityId);
  const place = PUBLIC_PLACES.find((p) => p.id === placeId);
  return `${activity?.emoji || '📍'} ${activity?.label || 'Meet up'} today at ${timeLabel} — meet at ${place?.label || 'a public spot'}? Always meeting in public 🙌`;
};

/** Propose a plan: saved as a meetup + sent into the shared chat. */
export const createMeetup = async ({ fromUid, toUid, matchId, activityId, placeId, timeLabel }) => {
  const meetup = {
    id: null,
    fromUid,
    toUid,
    matchId: matchId || null,
    activityId,
    placeId,
    timeLabel,
    date: todayISO(),
    status: 'pending',
    createdAt: nowIso(),
  };

  try {
    const reference = await addDoc(col('meetups'), {
      fromUid,
      toUid,
      matchId: matchId || null,
      activityId,
      placeId,
      timeLabel,
      date: todayISO(),
      status: 'pending',
      createdAt: serverTimestamp(),
    });
    meetup.id = reference.id;
  } catch (error) {
    throw new Error(error?.message || 'Could not save that meet plan.');
  }

  const conversationId = conversationDocId(fromUid, toUid);
  await ensureConversation(conversationId, fromUid, toUid);
  await sendMessage(conversationId, fromUid, buildPlanText(activityId, placeId, timeLabel));

  const activity = MEET_ACTIVITIES.find((a) => a.id === activityId);
  const fromProfile = await fetchProfileDoc(fromUid);
  await createNotification({
    uid: toUid,
    type: 'meetup',
    title: `Meet plan: ${activity?.emoji || '📍'} ${activity?.label || 'Meet up'} today`,
    body: `${fromProfile?.fullName || 'Someone'} proposed ${timeLabel} in a public place. Respond from the Meet tab.`,
    data: { meetupId: meetup.id },
  });

  return meetup;
};

/** Meetups I sent or received, newest first. */
export const getMeetupsFor = async (uid) => {
  const [sent, received] = await Promise.all([
    getDocs(query(col('meetups'), where('fromUid', '==', uid), fsLimit(200))),
    getDocs(query(col('meetups'), where('toUid', '==', uid), fsLimit(200))),
  ]);
  const rows = [...docsToModels(sent), ...docsToModels(received)];
  const unique = new Map(rows.map((row) => [row.id, row]));
  return [...unique.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

export const respondMeetup = async (meetupId, status, responderUid) => {
  try {
    await updateDoc(docRef('meetups', meetupId), {
      status,
      respondedAt: serverTimestamp(),
      respondedBy: responderUid,
    });
  } catch (error) {
    throw new Error(error?.message || 'Could not update that plan.');
  }

  const snapshot = await getMeetupDoc(meetupId);
  if (!snapshot) return null;
  const meetup = docToModel(snapshot);

  const conversationId = conversationDocId(meetup.fromUid, meetup.toUid);
  await ensureConversation(conversationId, meetup.fromUid, meetup.toUid);
  await sendMessage(
    conversationId,
    responderUid,
    status === 'accepted' ? 'Perfect, see you there! 🙌' : 'No problem — maybe another day 🙏',
  );

  const activity = MEET_ACTIVITIES.find((a) => a.id === meetup.activityId);
  await createNotification({
    uid: meetup.fromUid,
    type: 'meetup',
    title: status === 'accepted' ? 'Meetup confirmed 🙌' : 'Meetup declined',
    body:
      status === 'accepted'
        ? `${activity?.label || 'Your plan'} for ${meetup.timeLabel} was accepted.`
        : `Your ${activity?.label || 'plan'} for ${meetup.timeLabel} was declined — try another day.`,
    data: { meetupId: meetup.id },
  });

  return meetup;
};

const getMeetupDoc = async (meetupId) => {
  try {
    const snapshot = await getDoc(docRef('meetups', meetupId));
    return snapshot.exists() ? snapshot : null;
  } catch {
    return null;
  }
};

export default { createMeetup, getMeetupsFor, respondMeetup, buildPlanText };
