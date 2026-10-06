/**
 * App-wide configuration.
 *
 * DEMO_MODE = true  -> the app runs fully offline with seeded Malindi data
 *                       stored on the device (AsyncStorage). Every service
 *                       call goes through src/services/index.js.
 *
 * DEMO_MODE = false -> the same service calls are executed against Firebase.
 *                       Requires src/services/firebase/firebaseConfig.js keys.
 */
export const DEMO_MODE = true;

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
};

export const STORAGE_KEYS = {
  session: 'msc_session',
  profile: 'msc_profile_cache',
  notifications: 'msc_notifications',
};
