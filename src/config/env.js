/**
 * App-wide configuration.
 *
 * Firebase is the only backend. Its connection settings come from the
 * EXPO_PUBLIC_FIREBASE_* values in `.env` (see `.env.example`).
 */
export const APP = {
  name: 'Malindi Singles Connect',
  shortName: 'MSC',
  tagline: 'Meet. Match. Connect. Today.',
  supportingText:
    'Discover genuine singles around Malindi, Watamu and the surrounding coast, and start meaningful conversations without waiting forever.',
  minAge: 18,
  version: '1.0.0',
};

export const LIMITS = {
  dailyFreeLikes: 20,
  photosPerProfile: 5,
  interestsPerProfile: 8,
  discoverPageSize: 10,
  chatPageSize: 30,
  bioMaxLength: 200,
  boostMinutes: 30,

  /* 💛 Gold Circle community */
  goldCirclePageSize: 12,
  goldCirclePostMaxLength: 2000,
  goldCircleCommentMaxLength: 1000,
  goldCircleImageMaxBytes: 5 * 1024 * 1024,
};

export const STORAGE_KEYS = {
  session: 'msc_session',
  profile: 'msc_profile_cache',
  notifications: 'msc_notifications',
};
