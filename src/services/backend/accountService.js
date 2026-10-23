/**
 * accountService (backend) — self-service account deletion.
 *
 * The app never deletes Firestore documents itself: the Firestore rules only
 * allow admins to delete a profile, so the cleanup runs on the backend with
 * the Admin SDK. The client only tells the backend *which* account to delete,
 * and the backend always uses the uid from the verified ID token.
 *
 * The Firebase Authentication account is removed separately by
 * `authService.deleteCurrentAccount()` — only after the backend confirms the
 * data deletion succeeded. That way a failed data deletion leaves the member
 * signed in and able to retry.
 */
import { fetch } from 'expo/fetch';

import { deletionStatusFromResponse } from '../../utils/accountDeletion';
import { getFirebaseAuth } from '../firebase/firebaseConfig';

const DEFAULT_BACKEND_URL = 'https://malindi-singles-connect-backend.onrender.com/api';

const getBackendUrl = () =>
  (process.env.EXPO_PUBLIC_BACKEND_URL || DEFAULT_BACKEND_URL).replace(/\/+$/, '');

/** Public, linkable account-deletion instructions page (no sign-in needed). */
export const getDeletionInstructionsUrl = () =>
  `${getBackendUrl().replace(/\/api$/, '')}/account-deletion`;

/**
 * Delete the signed-in member's account data on the backend.
 *
 * A fresh ID token is requested so the backend can verify the caller. Throws
 * an Error with `status` and `code` when the deletion could not be completed.
 */
export const deleteAccountData = async () => {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in to delete your account.');
  }

  // `true` forces a refreshed token, so the request is never rejected for
  // being "too old" right after a re-authentication.
  const idToken = await user.getIdToken(true);

  const response = await fetch(`${getBackendUrl()}/account`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
  });

  let data = null;
  try {
    data = await response.json();
  } catch (_e) {
    throw new Error('The server returned an unexpected response. Please try again.');
  }

  if (!response.ok || data?.success === false) {
    const failedSteps = Array.isArray(data?.details?.failedSteps)
      ? data.details.failedSteps
      : [];
    const error = new Error(
      data?.error ||
        'Your account deletion is not finished yet. Some of your data has already been deleted, so you must retry the deletion to finish removing your account.',
    );
    error.status = response.status;
    error.code = data?.details?.code || (failedSteps.length ? 'PARTIAL_DELETION' : null);
    error.failedSteps = failedSteps;
    throw error;
  }

  return data?.data || {};
};

/**
 * Read the durable deletion state for the signed-in member.
 *
 * The backend keeps this after a partial failure, so it is still there after
 * signing out, closing the app and signing back in — that is what lets the app
 * resume a half-finished deletion instead of sending the member to onboarding
 * (which would recreate the profile).
 *
 * Returns `{ state: 'none' | 'pending' | 'completed', failedSteps: string[] }`.
 * Never throws: when the backend cannot be reached the caller falls back to
 * `none`, and the Firestore rules still refuse to recreate a pending profile.
 */
export const getDeletionStatus = async () => {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) return { state: 'none', failedSteps: [] };

  try {
    const idToken = await user.getIdToken();
    const response = await fetch(`${getBackendUrl()}/account/deletion-status`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${idToken}` },
    });
    const data = await response.json();
    if (!response.ok || data?.success === false) {
      return { state: 'none', failedSteps: [] };
    }
    return deletionStatusFromResponse(data?.data);
  } catch (_e) {
    return { state: 'none', failedSteps: [] };
  }
};

export default { deleteAccountData, getDeletionStatus, getDeletionInstructionsUrl };
