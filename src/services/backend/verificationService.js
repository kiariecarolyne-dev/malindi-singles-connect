/**
 * Verification selfies via the trusted backend.
 *
 * The mobile app never talks to the private verification bucket directly and
 * never holds a Supabase service-role key. The backend:
 *   - verifies the Firebase ID token,
 *   - stores the selfie under `{uid}/verification/...` in a private bucket,
 *   - writes only the storage path to `profiles/{uid}/private/data`,
 *   - hands back short-lived signed URLs, and only after an authorization check.
 */
import { getFirebaseAuth } from '../firebase/firebaseConfig';
import { File } from 'expo-file-system';
import { fetch } from 'expo/fetch';

const DEFAULT_BACKEND_URL = 'https://malindi-singles-connect-backend.onrender.com/api';

const getBackendUrl = () =>
  (process.env.EXPO_PUBLIC_BACKEND_URL || DEFAULT_BACKEND_URL).replace(/\/+$/, '');

const getIdToken = async () => {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error('You must be signed in to verify your profile.');
  return user.getIdToken();
};

const readJson = async (res, fallback) => {
  try {
    return await res.json();
  } catch {
    throw new Error(fallback);
  }
};

/**
 * Upload the owner's verification selfie. Returns { path } — the private
 * storage path (the backend has already written it to the private doc).
 */
export const uploadVerificationSelfie = async (localUri, asset) => {
  const idToken = await getIdToken();

  const uri = localUri || asset?.uri;
  if (!uri) throw new Error('No selfie selected.');

  const form = new FormData();
  form.append('selfie', new File(uri));

  const res = await fetch(`${getBackendUrl()}/verification/selfie`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}` },
    body: form,
  });

  const data = await readJson(res, 'Verification upload failed. Please try again.');
  if (!res.ok) {
    const error = new Error(data?.error || 'Verification upload failed. Please try again.');
    error.status = res.status;
    throw error;
  }

  const result = data?.data || {};
  if (!result.path) throw new Error('Verification upload finished but no path was returned.');
  return { path: result.path };
};

/**
 * Fetch a short-lived signed URL for a selfie. Omit `uid` for your own; pass a
 * member uid only from an admin/reviewer screen (the backend re-checks the role).
 */
export const getVerificationSelfieUrl = async (uid) => {
  const idToken = await getIdToken();
  const path = uid ? `/verification/selfie/${encodeURIComponent(uid)}` : '/verification/selfie';

  const res = await fetch(`${getBackendUrl()}${path}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });

  const data = await readJson(res, 'Could not open that verification selfie.');
  if (!res.ok) {
    const error = new Error(data?.error || 'Could not open that verification selfie.');
    error.status = res.status;
    throw error;
  }

  const result = data?.data || {};
  if (!result.url) throw new Error('Could not open that verification selfie.');
  return { url: result.url, expiresIn: result.expiresIn || 0 };
};

export default { uploadVerificationSelfie, getVerificationSelfieUrl };
