/**
 * Service layer switcher — the ONLY place screens import services from.
 *
 * DEMO_MODE = true  -> local AsyncStorage implementations (seeded Malindi data)
 * DEMO_MODE = false -> Firebase implementations (requires firebaseConfig keys)
 *
 * Every service exposes identical function signatures in both modes.
 */
import { DEMO_MODE } from '../config/env';

import * as demoAuthService from './demo/authService';
import * as demoProfileService from './demo/profileService';
import * as demoLikeService from './demo/likeService';
import * as demoMatchService from './demo/matchService';
import * as demoMessageService from './demo/messageService';
import * as demoMeetupService from './demo/meetupService';
import * as demoReportService from './demo/reportService';
import * as demoNotificationService from './demo/notificationService';
import * as demoAdminService from './demo/adminService';
import * as demoPremiumService from './demo/premiumService';

// Firebase implementations are enabled automatically when DEMO_MODE = false:
// import * as firebaseAuthService from './firebase/authService';
// import * as firebaseProfileService from './firebase/profileService';
// import * as firebaseLikeService from './firebase/likeService';
// import * as firebaseMatchService from './firebase/matchService';
// import * as firebaseMessageService from './firebase/messageService';
// import * as firebaseMeetupService from './firebase/meetupService';
// import * as firebaseReportService from './firebase/reportService';
// import * as firebaseNotificationService from './firebase/notificationService';
// import * as firebasePremiumService from './firebase/premiumService';

export const authService = demoAuthService;
export const profileService = demoProfileService;
export const likeService = demoLikeService;
export const matchService = demoMatchService;
export const messageService = demoMessageService;
export const meetupService = demoMeetupService;
export const reportService = demoReportService;
export const notificationService = demoNotificationService;
export const adminService = demoAdminService;
export const premiumService = demoPremiumService;

// export const authService = DEMO_MODE ? demoAuthService : firebaseAuthService;
// export const profileService = DEMO_MODE ? demoProfileService : firebaseProfileService;

export const IS_DEMO = DEMO_MODE;
