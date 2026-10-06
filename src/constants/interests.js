/** Interest chips — pick up to 8. */
export const INTERESTS = [
  { id: 'beach', label: 'Beach', emoji: '🏖️' },
  { id: 'music', label: 'Music', emoji: '🎵' },
  { id: 'food', label: 'Food', emoji: '🍽️' },
  { id: 'travel', label: 'Travel', emoji: '✈️' },
  { id: 'fitness', label: 'Fitness', emoji: '💪' },
  { id: 'dancing', label: 'Dancing', emoji: '💃' },
  { id: 'football', label: 'Football', emoji: '⚽' },
  { id: 'movies', label: 'Movies', emoji: '🎬' },
  { id: 'books', label: 'Books', emoji: '📚' },
  { id: 'art', label: 'Art', emoji: '🎨' },
  { id: 'fishing', label: 'Fishing', emoji: '🎣' },
  { id: 'sunset', label: 'Sunsets', emoji: '🌅' },
  { id: 'coffee', label: 'Coffee', emoji: '☕' },
  { id: 'fashion', label: 'Fashion', emoji: '👗' },
  { id: 'nature', label: 'Nature', emoji: '🌿' },
  { id: 'swimming', label: 'Swimming', emoji: '🏊' },
  { id: 'cooking', label: 'Cooking', emoji: '👨‍🍳' },
  { id: 'church', label: 'Faith', emoji: '🙏' },
  { id: 'business', label: 'Business', emoji: '💼' },
  { id: 'gaming', label: 'Gaming', emoji: '🎮' },
  { id: 'pets', label: 'Pets', emoji: '🐕' },
  { id: 'cycling', label: 'Cycling', emoji: '🚴' },
];

export const getInterestsByIds = (ids = []) =>
  INTERESTS.filter((i) => ids.includes(i.id));

export const getInterestChips = (ids = []) =>
  getInterestsByIds(ids)
    .map((i) => `${i.emoji} ${i.label}`)
    .join('  ');
