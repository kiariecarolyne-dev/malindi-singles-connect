import { nairobiDayKey, nairobiDayNumber } from './goldCircleTopics';

export const GREEN_RED_STATEMENTS = [
  'Your partner keeps in touch with an ex "just as friends."',
  'They remember small details you mention in passing.',
  'They post your relationship online without asking you first.',
  'They make time for you even on their busiest days.',
  'They cancel plans at the last minute more than once.',
  'They introduce you proudly to their friends and family.',
  'They expect you to change your dress or habits for them.',
  'They listen without interrupting when you are upset.',
];

export const getDailyGreenRed = (date = new Date()) => {
  const dayNumber = nairobiDayNumber(date);
  const index = ((dayNumber % GREEN_RED_STATEMENTS.length) + GREEN_RED_STATEMENTS.length) % GREEN_RED_STATEMENTS.length;
  return { statement: GREEN_RED_STATEMENTS[index], dayKey: nairobiDayKey(date) };
};