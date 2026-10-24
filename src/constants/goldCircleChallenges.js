import { nairobiDayKey, nairobiDayNumber } from './goldCircleTopics';

export const GOLD_CIRCLE_CHALLENGES = [
  { id: 'challenge-1', prompt: 'Send your partner a voice note saying one thing you appreciate about them.' },
  { id: 'challenge-2', prompt: 'Plan a low-budget date in Malindi or Watamu and share it with someone you love.' },
  { id: 'challenge-3', prompt: 'Write down three green flags you look for in a relationship.' },
  { id: 'challenge-4', prompt: 'Ask someone how their day really was — and listen without fixing.' },
  { id: 'challenge-5', prompt: 'Share a photo that captures a quiet moment of joy.' },
  { id: 'challenge-6', prompt: 'Compliment a stranger or a friend today, sincerely.' },
  { id: 'challenge-7', prompt: 'Take five minutes to reflect on what love taught you this week.' },
];

export const getDailyChallenge = (date = new Date()) => {
  const dayNumber = nairobiDayNumber(date);
  const index = ((dayNumber % GOLD_CIRCLE_CHALLENGES.length) + GOLD_CIRCLE_CHALLENGES.length) % GOLD_CIRCLE_CHALLENGES.length;
  return { ...GOLD_CIRCLE_CHALLENGES[index], dayKey: nairobiDayKey(date) };
};