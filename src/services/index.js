/**
 * Service layer switcher - the ONLY place screens import services from.
 *
 * Production runs the Firebase implementations exclusively: Auth, Firestore
 * and Storage. The old seeded local implementations live in `./legacy-demo`
 * and are kept only as a reference while the Firebase rules are being
 * verified - nothing here imports them.
 */
import * as firebaseAuthService from './firebase/authService';
import * as firebaseProfileService from './firebase/profileService';
import * as firebaseLikeService from './firebase/likeService';
import * as firebaseMatchService from './firebase/matchService';
import * as firebaseMessageService from './firebase/messageService';
import * as firebaseMeetupService from './firebase/meetupService';
import * as firebaseReportService from './firebase/reportService';
import * as firebaseNotificationService from './firebase/notificationService';
import * as firebaseAdminService from './firebase/adminService';
import * as firebasePremiumService from './firebase/premiumService';

export const authService = firebaseAuthService;
export const profileService = firebaseProfileService;
export const likeService = firebaseLikeService;
export const matchService = firebaseMatchService;
export const messageService = firebaseMessageService;
export const meetupService = firebaseMeetupService;
export const reportService = firebaseReportService;
export const notificationService = firebaseNotificationService;
export const adminService = firebaseAdminService;
export const premiumService = firebasePremiumService;

export const IS_DEMO = false;
