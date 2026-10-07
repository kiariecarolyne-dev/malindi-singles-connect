/**
 * TEMPORARY development-only diagnostic — safe to delete at any time.
 *
 * Verifies the current Firebase session against the backend's /api/auth/me
 * endpoint. The ID token is used in memory only: it is never logged, never
 * persisted, and never sent anywhere except the project's own backend.
 */
import { getFirebaseAuth } from '../services/firebase/firebaseConfig';

const BACKEND_AUTH_ME = 'https://malindi-singles-connect-backend.onrender.com/api/auth/me';

/** Fetch /api/auth/me with the signed-in user's ID token. Logs status + body only. */
export const runAuthMeTest = async () => {
  if (!__DEV__) {
    console.warn('[authMeTest] Skipped — development-only diagnostic.');
    return null;
  }

  const user = getFirebaseAuth().currentUser;
  if (!user) {
    console.warn('[authMeTest] No signed-in Firebase user.');
    return null;
  }

  try {
    const idToken = await user.getIdToken();

    const response = await fetch(BACKEND_AUTH_ME, {
      method: 'GET',
      headers: { Authorization: `Bearer ${idToken}` },
    });

    const raw = await response.text();
    let body = raw;
    try {
      body = JSON.stringify(JSON.parse(raw));
    } catch {
      // Non-JSON response — keep the raw text.
    }

    console.log(`[authMeTest] Status: ${response.status}`);
    console.log(`[authMeTest] Body: ${body.slice(0, 1000)}`);

    return { status: response.status, body };
  } catch (error) {
    console.warn(`[authMeTest] Request failed: ${error?.message ?? String(error)}`);
    return null;
  }
};

export default runAuthMeTest;
