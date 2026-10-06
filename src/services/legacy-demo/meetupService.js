/**
 * Demo meetupService — "Meet Today" plans over public places only.
 * Firebase implementation mirrors these signatures.
 */
import { MEET_ACTIVITIES, PUBLIC_PLACES } from '../../constants/meet';
import { generateId, getDb, initDb, insert, updateDoc } from './db';
import { createNotification } from './notificationService';
import { ensureConversation, sendMessage } from './messageService';

const todayISO = () => new Date().toISOString().split('T')[0];

export const buildPlanText = (activityId, placeId, timeLabel) => {
  const activity = MEET_ACTIVITIES.find((a) => a.id === activityId);
  const place = PUBLIC_PLACES.find((p) => p.id === placeId);
  return `${activity?.emoji || '📍'} ${activity?.label || 'Meet up'} today at ${timeLabel} — meet at ${place?.label || 'a public spot'}? Always meeting in public 🙌`;
};

/** Propose a plan: saved as a meetup + sent into the shared chat. */
export const createMeetup = async ({ fromUid, toUid, matchId, activityId, placeId, timeLabel }) => {
  await initDb();
  const db = await getDb();

  const meetup = {
    id: generateId('meet'),
    fromUid,
    toUid,
    matchId: matchId || null,
    activityId,
    placeId,
    timeLabel,
    date: todayISO(),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  await insert('meetups', meetup);

  let conv = db.conversations.find(
    (c) => c.members.includes(fromUid) && c.members.includes(toUid),
  );
  if (!conv) {
    conv = await ensureConversation(generateId('conv'), fromUid, toUid);
  }
  await sendMessage(conv.id, fromUid, buildPlanText(activityId, placeId, timeLabel));

  const activity = MEET_ACTIVITIES.find((a) => a.id === activityId);
  const fromProfile = db.profiles.find((p) => p.uid === fromUid);
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
  await initDb();
  const db = await getDb();
  return db.meetups
    .filter((m) => m.fromUid === uid || m.toUid === uid)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

export const respondMeetup = async (meetupId, status, responderUid) => {
  await updateDoc('meetups', meetupId, {
    status,
    respondedAt: new Date().toISOString(),
    respondedBy: responderUid,
  });
  const db = await getDb();
  const meetup = db.meetups.find((m) => m.id === meetupId);
  if (meetup) {
    let conv = db.conversations.find(
      (c) => c.members.includes(meetup.fromUid) && c.members.includes(meetup.toUid),
    );
    if (!conv) conv = await ensureConversation(generateId('conv'), meetup.fromUid, meetup.toUid);
    const text =
      status === 'accepted'
        ? 'Perfect, see you there! 🙌'
        : 'No problem — maybe another day 🙏';
    await sendMessage(conv.id, responderUid, text);
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
  }
  return meetup;
};

export default { createMeetup, getMeetupsFor, respondMeetup, buildPlanText };
