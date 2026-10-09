export const TOPIC_FORMATS = [
  { id: 'hot_take', label: 'Hot Take', emoji: '🔥', hint: 'Agree or disagree, then tell us why.' },
  { id: 'thisorthat', label: 'Choose a Side', emoji: '⚖️', hint: 'Pick a side and defend it.' },
  { id: 'real_talk', label: 'Real Talk', emoji: '💬', hint: 'Speak from the heart.' },
  { id: 'scenario', label: 'Relationship Scenario', emoji: '🎬', hint: 'What would you do?' },
  { id: 'unpopular', label: 'Unpopular Opinion', emoji: '🙃', hint: 'Say what others are afraid to say.' },
  { id: 'confession', label: 'Confession', emoji: '🎤', hint: 'Be honest. Your Gold name is shown with it.' },
  { id: 'bedroom', label: 'Bedroom Real Talk', emoji: '❤️‍🔥', hint: 'Keep it respectful and grown.' },
];

export const TOPIC_FORMAT_MAP = TOPIC_FORMATS.reduce((map, format) => {
  map[format.id] = format;
  return map;
}, {});

export const GOLD_CIRCLE_TOPICS = [
  { id: 'hot-1', format: 'hot_take', prompt: 'Long-distance relationships can work if both people are serious.' },
  { id: 'side-1', format: 'thisorthat', prompt: 'Beach dates or dinner dates?', options: ['Beach dates', 'Dinner dates'] },
  { id: 'real-1', format: 'real_talk', prompt: 'What does emotional safety look like to you in a relationship?' },
  { id: 'scene-1', format: 'scenario', prompt: 'Your partner is always on their phone when you are together. What do you do?' },
  { id: 'unpop-1', format: 'unpopular', prompt: 'Some people are happier single, and that is completely okay.' },
  { id: 'conf-1', format: 'confession', prompt: 'Confess something about love you learned the hard way.' },
  { id: 'bed-1', format: 'bedroom', prompt: 'How do you keep closeness alive when life gets busy?' },
  { id: 'hot-2', format: 'hot_take', prompt: 'A partner should never have to ask for basic respect.' },
  { id: 'side-2', format: 'thisorthat', prompt: 'Text all day or one long call?', options: ['Text all day', 'One long call'] },
  { id: 'real-2', format: 'real_talk', prompt: 'How do you know when a connection is worth fighting for?' },
  { id: 'scene-2', format: 'scenario', prompt: 'You find out your partner still talks to an ex every day. How do you handle it?' },
  { id: 'unpop-2', format: 'unpopular', prompt: 'Not every disagreement needs to be resolved the same day.' },
  { id: 'conf-2', format: 'confession', prompt: 'Confess the moment you knew you had truly moved on.' },
  { id: 'bed-2', format: 'bedroom', prompt: 'What helps you feel safe enough to be vulnerable with a partner?' },
  { id: 'hot-3', format: 'hot_take', prompt: 'Money problems end more relationships than cheating does.' },
  { id: 'side-3', format: 'thisorthat', prompt: 'Spontaneous plans or planned dates?', options: ['Spontaneous', 'Planned'] },
  { id: 'real-3', format: 'real_talk', prompt: 'What is the kindest thing a partner has ever done for you?' },
  { id: 'scene-3', format: 'scenario', prompt: 'Your partner forgets your anniversary for the second year. What do you say?' },
  { id: 'unpop-3', format: 'unpopular', prompt: 'It is fine to keep some parts of your life private from your partner.' },
  { id: 'conf-3', format: 'confession', prompt: 'Confess a small thing you do that you never admit out loud.' },
  { id: 'bed-3', format: 'bedroom', prompt: 'How do you talk about what you need without it turning into a fight?' },
  { id: 'hot-4', format: 'hot_take', prompt: 'If they wanted to, they would.' },
  { id: 'side-4', format: 'thisorthat', prompt: 'Big romantic gesture or small daily effort?', options: ['Big gesture', 'Small daily effort'] },
  { id: 'real-4', format: 'real_talk', prompt: 'What makes you feel truly respected by someone you love?' },
  { id: 'scene-4', format: 'scenario', prompt: 'Someone flirts with your partner in front of you. How do you react?' },
  { id: 'unpop-4', format: 'unpopular', prompt: 'Being alone can be healthier than being in a lukewarm relationship.' },
  { id: 'conf-4', format: 'confession', prompt: 'Confess the kindest thing you have done for love.' },
  { id: 'bed-4', format: 'bedroom', prompt: 'What role does affection play in feeling wanted?' },
  { id: 'hot-5', format: 'hot_take', prompt: 'Loyalty is a choice you make every day, not a feeling.' },
  { id: 'side-5', format: 'thisorthat', prompt: 'Partner who is funny or partner who is deep?', options: ['Funny', 'Deep'] },
  { id: 'real-5', format: 'real_talk', prompt: 'How do you handle it when the person you love needs space?' },
  { id: 'scene-5', format: 'scenario', prompt: 'Your partner wants to check your phone. What is your response?' },
  { id: 'unpop-5', format: 'unpopular', prompt: 'Love is not always enough to make a relationship work.' },
  { id: 'conf-5', format: 'confession', prompt: 'Confess a fear you carry into every relationship.' },
  { id: 'bed-5', format: 'bedroom', prompt: 'How do you rebuild intimacy after a hard season together?' },
  { id: 'hot-6', format: 'hot_take', prompt: 'People who post their relationship constantly are often the least secure.' },
  { id: 'side-6', format: 'thisorthat', prompt: 'Long-distance love or local love?', options: ['Long distance', 'Local'] },
  { id: 'real-6', format: 'real_talk', prompt: 'What is one lesson every relationship has taught you?' },
  { id: 'scene-6', format: 'scenario', prompt: 'You disagree about money and it keeps coming up. How do you solve it?' },
  { id: 'unpop-6', format: 'unpopular', prompt: 'A partner is not responsible for your happiness.' },
  { id: 'conf-6', format: 'confession', prompt: 'Confess something you are secretly proud of in your love life.' },
  { id: 'bed-6', format: 'bedroom', prompt: 'What does feeling desired mean to you?' },
  { id: 'hot-7', format: 'hot_take', prompt: 'A good partner is a teammate, not a project.' },
  { id: 'side-7', format: 'thisorthat', prompt: 'Public affection or private affection?', options: ['Public', 'Private'] },
  { id: 'real-7', format: 'real_talk', prompt: 'How do you rebuild trust after it has been broken?' },
  { id: 'scene-7', format: 'scenario', prompt: "Your partner's family does not approve of you. How do you cope?" },
  { id: 'unpop-7', format: 'unpopular', prompt: 'Some breakups are the best thing that can happen to you.' },
  { id: 'conf-7', format: 'confession', prompt: 'Confess the advice you gave a friend but never followed yourself.' },
  { id: 'bed-7', format: 'bedroom', prompt: 'How do you handle it when you and your partner want different things?' },
  { id: 'hot-8', format: 'hot_take', prompt: 'Shared values matter more than shared interests.' },
  { id: 'side-8', format: 'thisorthat', prompt: 'Shared hobbies or separate hobbies?', options: ['Shared hobbies', 'Separate hobbies'] },
  { id: 'real-8', format: 'real_talk', prompt: 'What does loyalty mean to you in your own words?' },
  { id: 'scene-8', format: 'scenario', prompt: 'You feel like you are giving more than you receive. What do you do?' },
  { id: 'unpop-8', format: 'unpopular', prompt: 'It is okay to outgrow someone you once loved.' },
  { id: 'conf-8', format: 'confession', prompt: "Confess how you really felt the last time you said you were fine." },
  { id: 'bed-8', format: 'bedroom', prompt: 'What small gesture makes you feel closest to your partner?' },
  { id: 'hot-9', format: 'hot_take', prompt: 'You can love someone and still outgrow them.' },
  { id: 'side-9', format: 'thisorthat', prompt: 'Partner who cooks or partner who cleans?', options: ['Cooks', 'Cleans'] },
  { id: 'real-9', format: 'real_talk', prompt: 'What is the difference between love and attachment to you?' },
  { id: 'scene-9', format: 'scenario', prompt: 'Your partner shares your private business with friends. How do you respond?' },
  { id: 'unpop-9', format: 'unpopular', prompt: 'Jealousy is often insecurity wearing the mask of love.' },
  { id: 'conf-9', format: 'confession', prompt: 'Confess a habit you picked up from a past relationship.' },
  { id: 'bed-9', format: 'bedroom', prompt: 'How do you stay connected when you are both exhausted?' },
  { id: 'hot-10', format: 'hot_take', prompt: 'Trust is built in small moments, not big promises.' },
  { id: 'side-10', format: 'thisorthat', prompt: 'Morning person or night owl?', options: ['Morning person', 'Night owl'] },
  { id: 'real-10', format: 'real_talk', prompt: 'How do you show love in ways words cannot?' },
  { id: 'scene-10', format: 'scenario', prompt: 'An old flame reaches out while you are in a relationship. What do you do?' },
  { id: 'unpop-10', format: 'unpopular', prompt: 'You do not owe anyone another chance.' },
  { id: 'conf-10', format: 'confession', prompt: 'Confess the moment you realized you deserve more.' },
  { id: 'bed-10', format: 'bedroom', prompt: 'What helps you feel confident in a relationship?' },
  { id: 'hot-11', format: 'hot_take', prompt: 'Being single is better than being in the wrong relationship.' },
  { id: 'side-11', format: 'thisorthat', prompt: 'Love that starts as friendship or love at first sight?', options: ['Friends first', 'Love at first sight'] },
  { id: 'real-11', format: 'real_talk', prompt: 'What do you wish more people understood about commitment?' },
  { id: 'scene-11', format: 'scenario', prompt: 'Your partner is stressed and pushing you away. How do you stay close?' },
  { id: 'unpop-11', format: 'unpopular', prompt: 'Marriage is not the ultimate goal for everyone.' },
  { id: 'conf-11', format: 'confession', prompt: 'Confess something you miss about a past version of yourself.' },
  { id: 'bed-11', format: 'bedroom', prompt: 'How do you bring up something new without pressure or fear?' },
  { id: 'hot-12', format: 'hot_take', prompt: 'A relationship without friendship will not survive.' },
  { id: 'side-12', format: 'thisorthat', prompt: 'A partner who is calm or a partner who is ambitious?', options: ['Calm', 'Ambitious'] },
  { id: 'real-12', format: 'real_talk', prompt: 'How do you forgive without forgetting your own worth?' },
  { id: 'scene-12', format: 'scenario', prompt: 'You and your partner want to live in different cities. How do you decide?' },
  { id: 'unpop-12', format: 'unpopular', prompt: 'Staying for the children is not always the right choice.' },
  { id: 'conf-12', format: 'confession', prompt: 'Confess a truth you have never told your partner.' },
  { id: 'bed-12', format: 'bedroom', prompt: 'What does a healthy balance of closeness and space look like?' },
  { id: 'hot-13', format: 'hot_take', prompt: 'Actions will always tell you more than words.' },
  { id: 'side-13', format: 'thisorthat', prompt: 'Talk about the future early or let it unfold?', options: ['Talk early', 'Let it unfold'] },
  { id: 'real-13', format: 'real_talk', prompt: 'What does a healthy argument look like to you?' },
  { id: 'scene-13', format: 'scenario', prompt: 'Your partner forgets to defend you when others joke about you. How do you handle it?' },
  { id: 'unpop-13', format: 'unpopular', prompt: 'Communication matters more than chemistry in the long run.' },
  { id: 'conf-13', format: 'confession', prompt: 'Confess what loyalty really means to you, honestly.' },
  { id: 'bed-13', format: 'bedroom', prompt: 'How do you reassure a partner who feels insecure?' },
  { id: 'hot-14', format: 'hot_take', prompt: 'Jealousy is not proof of love.' },
  { id: 'side-14', format: 'thisorthat', prompt: 'A partner who is private or a partner who is social?', options: ['Private', 'Social'] },
  { id: 'real-14', format: 'real_talk', prompt: 'How do you stay kind when you are hurt?' },
  { id: 'scene-14', format: 'scenario', prompt: 'You feel a spark fading and do not know why. What is your next step?' },
  { id: 'unpop-14', format: 'unpopular', prompt: 'It is possible to love someone and still choose to leave.' },
  { id: 'conf-14', format: 'confession', prompt: 'Confess the day you decided to stop settling.' },
  { id: 'bed-14', format: 'bedroom', prompt: 'What makes a relationship feel safe and warm over time?' },
  { id: 'hot-15', format: 'hot_take', prompt: 'The person who cares less usually controls the pace.' },
  { id: 'side-15', format: 'thisorthat', prompt: 'Forgive and rebuild or walk away for good?', options: ['Forgive', 'Walk away'] },
  { id: 'real-15', format: 'real_talk', prompt: 'What small habit keeps a relationship warm?' },
  { id: 'scene-15', format: 'scenario', prompt: 'Your partner says they need a break. How do you respond?' },
  { id: 'unpop-15', format: 'unpopular', prompt: 'Not everyone deserves access to your softest self.' },
  { id: 'conf-15', format: 'confession', prompt: 'Confess one thing you would change about how you love.' },
  { id: 'bed-15', format: 'bedroom', prompt: 'How do you protect the spark without forcing it?' },
  { id: 'hot-16', format: 'hot_take', prompt: 'Marriage does not fix a broken relationship.' },
  { id: 'side-16', format: 'thisorthat', prompt: 'A partner who matches your energy or balances it?', options: ['Matches my energy', 'Balances me'] },
  { id: 'real-16', format: 'real_talk', prompt: 'What is one thing you have learned to stop tolerating?' },
  { id: 'scene-16', format: 'scenario', prompt: 'You catch your partner in a small lie about where they were. What do you do?' },
  { id: 'unpop-16', format: 'unpopular', prompt: 'Distance can protect a relationship instead of harming it.' },
  { id: 'hot-17', format: 'hot_take', prompt: 'A partner who listens is more attractive than a partner who spends.' },
  { id: 'side-17', format: 'thisorthat', prompt: 'Chase your dream or stay close to family?', options: ['Chase the dream', 'Stay close'] },
  { id: 'real-17', format: 'real_talk', prompt: 'How do you know you are ready to love someone well?' },
  { id: 'scene-17', format: 'scenario', prompt: 'Your long-time friend admits feelings for you. How do you handle it?' },
  { id: 'unpop-17', format: 'unpopular', prompt: 'Wants and needs are not the same, and confusing them hurts love.' },
  { id: 'hot-18', format: 'hot_take', prompt: 'If you have to beg for attention, it is not love.' },
  { id: 'side-18', format: 'thisorthat', prompt: 'Love loudly or love quietly?', options: ['Loudly', 'Quietly'] },
  { id: 'real-18', format: 'real_talk', prompt: 'What makes you feel safe enough to be fully honest?' },
  { id: 'scene-18', format: 'scenario', prompt: 'Your partner wants to share locations all day, every day. What do you think?' },
  { id: 'unpop-18', format: 'unpopular', prompt: 'A calm relationship can feel boring if you have only known chaos.' },
  { id: 'hot-19', format: 'hot_take', prompt: 'Choosing peace over being right can save a relationship.' },
  { id: 'hot-20', format: 'hot_take', prompt: 'Honesty should never cost you your dignity.' },
];

export const TOPIC_COUNT = GOLD_CIRCLE_TOPICS.length;

const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));

const pickStride = () => {
  for (let stride = Math.floor(TOPIC_COUNT / 2) + 1; stride < TOPIC_COUNT; stride += 1) {
    if (gcd(stride, TOPIC_COUNT) === 1) return stride;
  }
  return 1;
};

const STRIDE = pickStride();

const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const nairobiDate = (date = new Date()) => new Date(date.getTime() + NAIROBI_OFFSET_MS);

export const nairobiDayKey = (date = new Date()) => {
  const d = nairobiDate(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const nairobiDayNumber = (date = new Date()) =>
  Math.floor((date.getTime() + NAIROBI_OFFSET_MS) / MS_PER_DAY);

export const selectDailyTopic = (dayNumber) => {
  const index = (((dayNumber % TOPIC_COUNT) * STRIDE) % TOPIC_COUNT + TOPIC_COUNT) % TOPIC_COUNT;
  return GOLD_CIRCLE_TOPICS[index];
};

export const getDailyTopic = (date = new Date()) => {
  const dayNumber = nairobiDayNumber(date);
  const topic = selectDailyTopic(dayNumber);
  return { ...topic, dayKey: nairobiDayKey(date), dayNumber };
};

export const getFormat = (id) => TOPIC_FORMAT_MAP[id] || TOPIC_FORMATS[0];
