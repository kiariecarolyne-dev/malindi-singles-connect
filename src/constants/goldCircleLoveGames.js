import { nairobiDayKey, nairobiDayNumber } from './goldCircleTopics';

/** Solo practice quiz: questions with a best answer for scoring. */
export const WHO_KNOWS_QUESTIONS = [
  {
    id: 'wk-1',
    question: 'What is your partner most likely to choose on a free Saturday?',
    options: ['Beach walk in Malindi', 'Quiet movie night', 'Trying a new restaurant', 'Visiting family'],
    answer: 1,
  },
  {
    id: 'wk-2',
    question: 'When your partner is stressed, what helps most?',
    options: ['Space and quiet', 'Talking it through', 'Physical affection', 'A practical solution'],
    answer: 1,
  },
  {
    id: 'wk-3',
    question: 'Which love language fits your partner best?',
    options: ['Words of affirmation', 'Quality time', 'Acts of service', 'Gifts or touch'],
    answer: 1,
  },
  {
    id: 'wk-4',
    question: 'What small gesture makes your partner feel most loved?',
    options: ['A good morning message', 'Helping with chores', 'Remembering details', 'Planning a date'],
    answer: 2,
  },
];

/** Daily two-sided relationship dilemma. */
export const SIDE_DILEMMAS = [
  { id: 'side-1', prompt: 'Would you rather know everything about your partner or keep some mystery?', options: ['Know everything', 'Keep some mystery'] },
  { id: 'side-2', prompt: 'Is it better to resolve a disagreement the same day or sleep on it?', options: ['Same day', 'Sleep on it'] },
  { id: 'side-3', prompt: 'Should couples share passwords or keep digital privacy?', options: ['Share passwords', 'Keep privacy'] },
  { id: 'side-4', prompt: 'Which matters more in love: consistency or passion?', options: ['Consistency', 'Passion'] },
];

export const getDailySideDilemma = (date = new Date()) => {
  const dayNumber = nairobiDayNumber(date);
  const index = ((dayNumber % SIDE_DILEMMAS.length) + SIDE_DILEMMAS.length) % SIDE_DILEMMAS.length;
  return { ...SIDE_DILEMMAS[index], dayKey: `side-${nairobiDayKey(date)}` };
};

/** Relationship polls with defined choices and expiry. */
export const RELATIONSHIP_POLLS = [
  {
    id: 'poll-1',
    question: 'How often should couples have a real check-in conversation?',
    options: ['Daily', 'Weekly', 'When needed', 'Monthly'],
    expiresDayKey: null,
  },
  {
    id: 'poll-2',
    question: 'What is the hardest part of modern dating?',
    options: ['Trust', 'Communication', 'Time', 'Expectations'],
    expiresDayKey: null,
  },
  {
    id: 'poll-3',
    question: 'Can a relationship survive without shared hobbies?',
    options: ['Yes', 'No', 'It depends'],
    expiresDayKey: null,
  },
];

export const getDailyRelationshipPoll = (date = new Date()) => {
  const dayNumber = nairobiDayNumber(date);
  const index = ((dayNumber % RELATIONSHIP_POLLS.length) + RELATIONSHIP_POLLS.length) % RELATIONSHIP_POLLS.length;
  const poll = RELATIONSHIP_POLLS[index];
  return { ...poll, dayKey: `poll-${nairobiDayKey(date)}` };
};

/** Activities couples can complete together and optionally share. */
export const COUPLE_CHALLENGES = [
  { id: 'cc-1', title: 'Sunset walk in Malindi', detail: 'Take a 20-minute walk together and share one thing you are grateful for.' },
  { id: 'cc-2', title: 'Cook one local dish together', detail: 'Make pilau, biryani, or mahamri and rate the result.' },
  { id: 'cc-3', title: 'No-phone evening', detail: 'Spend one evening together with phones in another room.' },
  { id: 'cc-4', title: 'Write a tiny love note', detail: 'Each of you writes one sentence and trades notes.' },
];
