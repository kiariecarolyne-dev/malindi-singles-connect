/** Suggested opening messages so nobody is stuck with "Hi." */
export const ICEBREAKERS = [
  'What is your perfect weekend in Malindi? 🏖️',
  'Beach or dinner? 🍽️',
  "What's one place in Malindi you love?",
  'What kind of music are you into? 🎵',
  "What's something that always makes you smile?",
  'Sunrise walks or sunset views? 🌅',
  'What are you looking for on here? ❤️',
  "What's the best meal you've had around here? 🍛",
];

export const getRandomIcebreaker = () =>
  ICEBREAKERS[Math.floor(Math.random() * ICEBREAKERS.length)];
