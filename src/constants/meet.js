/** "Meet Today" activity options. */
export const MEET_ACTIVITIES = [
  { id: 'coffee', label: 'Coffee', emoji: '☕' },
  { id: 'dinner', label: 'Dinner', emoji: '🍽️' },
  { id: 'beach_walk', label: 'Beach walk', emoji: '🏖️' },
  { id: 'music', label: 'Music / event', emoji: '🎵' },
  { id: 'casual_walk', label: 'Casual walk', emoji: '🚶' },
  { id: 'chat_first', label: 'Just chat first', emoji: '💬' },
];

export const getMeetActivity = (id) =>
  MEET_ACTIVITIES.find((a) => a.id === id) || MEET_ACTIVITIES[5];

/** Public, safe places around Malindi to suggest — never private addresses. */
export const PUBLIC_PLACES = [
  { id: 'malindi_beach', label: 'Malindi Beach front', area: 'Malindi' },
  { id: 'malindi_promenade', label: 'Malindi Promenade', area: 'Malindi' },
  { id: 'diamond_casino_cafe', label: 'Seafront café, Malindi', area: 'Malindi' },
  { id: 'kilifi_creek_bridge', label: 'Kilifi Creek viewpoint', area: 'Kilifi' },
  { id: 'watamu_beach', label: 'Watamu Beach', area: 'Watamu' },
  { id: 'marine_park', label: 'Marine Park entrance', area: 'Watamu' },
  { id: 'shella_beach', label: 'Shella Beach', area: 'Shella' },
  { id: 'town_park', label: 'Malindi Town park', area: 'Malindi' },
  { id: 'mambrui_beach', label: 'Mambrui Beach', area: 'Mambrui' },
  { id: 'malls', label: 'Shopping mall food court', area: 'Malindi' },
];

export const MEET_SAFETY_RULES = [
  { id: 'public', text: 'Meet in a public place.' },
  { id: 'tell', text: "Tell someone you trust where you're going." },
  { id: 'transport', text: 'Arrange your own transport.' },
  { id: 'money', text: "Don't send money to someone you just met." },
  { id: 'sensitive', text: "Don't share passwords or sensitive documents." },
  { id: 'leave', text: 'Leave if you feel uncomfortable.' },
];
