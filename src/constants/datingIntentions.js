/** Dating intentions shown during registration and on profiles. */
export const DATING_INTENTIONS = [
  { id: 'serious', label: 'Serious relationship', emoji: '❤️' },
  { id: 'marriage', label: 'Looking for marriage', emoji: '💍' },
  { id: 'dating', label: 'Dating', emoji: '💕' },
  { id: 'friendship', label: 'Friendship first', emoji: '😊' },
  { id: 'open', label: 'Open to seeing where it goes', emoji: '🤝' },
];

export const getIntention = (id) =>
  DATING_INTENTIONS.find((i) => i.id === id) || DATING_INTENTIONS[4];

export const getIntentionLabel = (id) => {
  const i = getIntention(id);
  return `${i.emoji} ${i.label}`;
};
