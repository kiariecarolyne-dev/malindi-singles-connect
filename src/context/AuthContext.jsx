/**
 * AuthContext — session + profile state for the whole app.
 * Screens consume useAuth() instead of talking to services directly for
 * session concerns.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { accountService, authService, profileService } from '../services';
import { canSaveProfile, normalizeDeletion, resumeDeletion } from '../utils/accountDeletion';

const AuthContext = createContext(null);

/**
 * Startup reads (session restore + profile load) hit Firestore. When the
 * device has no usable connection, Firestore's getDoc waits for the backend
 * and can stay pending for a very long time. The root gate below treats those
 * flags as "keep showing the splash", so an unresolved read used to leave the
 * app on the loading logo forever. Race every startup await against this
 * timeout so the gate always settles, even when initialization fails.
 */
const STARTUP_TIMEOUT_MS = 10000;

const withTimeout = (promise, ms = STARTUP_TIMEOUT_MS) => {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('startup-timeout')), ms);
    }),
  ]).finally(() => clearTimeout(timer));
};

export const AuthProvider = ({ children }) => {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profileVersion, setProfileVersion] = useState(0);

  // Durable account-deletion state, owned by the backend. `none` for almost
  // every account; `pending` after an interrupted deletion; `completed` when
  // the data is gone but the Firebase Auth account still exists (the client
  // could not finish). Anything other than `none` must block onboarding,
  // because onboarding would recreate the deleted profile.
  const [deletion, setDeletion] = useState(normalizeDeletion('none'));

  const checkDeletionStatus = useCallback(async () => {
    try {
      // Shorter than the startup timeout: this is a small read, and a cold
      // backend must not keep the member on the splash for 10 seconds.
      return await withTimeout(accountService.getDeletionStatus(), 6000);
    } catch {
      // Backend unreachable: never block the app on this call. The Firestore
      // rules still refuse to recreate a profile for a pending deletion.
      return normalizeDeletion('none');
    }
  }, []);

  const loadProfile = useCallback(async (uid) => {
    if (!uid) {
      setProfile(null);
      setProfileLoaded(true);
      setDeletion(normalizeDeletion('none'));
      return;
    }
    // If the account is being deleted (or was deleted and the auth user still
    // lingers), do not load or recreate the profile. The root navigator will
    // show a pending/completed deletion screen instead of onboarding.
    const status = await checkDeletionStatus();
    setDeletion(status);
    if (status.state !== 'none') {
      setProfile(null);
      setProfileLoading(false);
      setProfileLoaded(true);
      return;
    }
    setProfileLoading(true);
    setProfileLoaded(false);
    try {
      // Never let a stalled Firestore read keep the root splash up.
      const p = await withTimeout(profileService.getProfile(uid));
      setProfile(p);
      setProfileLoaded(true);
    } catch {
      setProfile(null);
      setProfileLoaded(true);
    } finally {
      setProfileLoading(false);
    }
  }, [checkDeletionStatus]);

  const signUpInFlight = useRef(false);

  const applyAuthUser = useCallback(
    (nextUser) => {
      // Keep the root splash up until the deletion state is known. Rendering
      // onboarding for even a moment would let the member recreate a deleted
      // profile.
      setProfileLoaded(false);
      setUser(nextUser);
      return loadProfile(nextUser?.uid || null);
    },
    [loadProfile],
  );

  useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged((nextUser) => {
      // While signUp() runs it owns the session: Firebase emits the new user
      // before the account documents exist, and deleteUser() emits null when
      // they fail. Applying either would flip the root gate mid-signup
      // (onboarding -> auth stack) while the user is on PhotoSetup.
      if (signUpInFlight.current) return;
      applyAuthUser(nextUser);
    });
    // Bounded so `initializing` always clears and the splash can never stick.
    withTimeout(authService.restoreSession())
      .catch(() => {})
      .finally(() => setInitializing(false));
    return unsubscribe;
  }, [applyAuthUser]);

  const refreshProfile = useCallback(async () => {
    if (user?.uid) {
      await loadProfile(user.uid);
      setProfileVersion((v) => v + 1);
    }
  }, [user, loadProfile]);

  const updateProfileLocal = useCallback(
    (patch) => {
      setProfile((prev) => (prev ? { ...prev, ...patch } : prev));
      setProfileVersion((v) => v + 1);
    },
    [],
  );

  const signIn = useCallback(
    async (email, password) => {
      const u = await authService.signIn(email, password);
      // Same gate as a restored session: a pending deletion must be detected
      // before anything can recreate the profile.
      await applyAuthUser(u);
      return u;
    },
    [applyAuthUser],
  );

  const signUp = useCallback(
    async (data) => {
      signUpInFlight.current = true;
      try {
        const u = await authService.signUp(data);
        await applyAuthUser(u);
        return u;
      } catch (e) {
        // Signup failed (account documents could not be created): the session
        // is gone, so settle on null here instead of letting a mid-signup
        // emission bounce the root gate while RegisterScreen is mounted.
        applyAuthUser(null);
        throw e;
      } finally {
        signUpInFlight.current = false;
      }
    },
    [applyAuthUser],
  );

  const signOut = useCallback(async () => {
    await authService.signOut();
    setUser(null);
    setProfile(null);
    setDeletion(normalizeDeletion('none'));
  }, []);

  /**
   * Resume an interrupted account deletion — from the deletion screen, with
   * no profile and no Profile tab required. Re-authentication comes first
   * because removing the Firebase Auth account needs a recent sign-in.
   */
  const retryDeletion = useCallback(
    async (password) => {
      if (!user?.uid) throw new Error('Not signed in.');
      // Idempotent: resume exactly where the failed run stopped. When the
      // backend already finished the data deletion, only the sign-in removal
      // is left; skipping the data call lets that final step be retried even
      // after signing out and back in.
      await resumeDeletion({
        state: deletion.state,
        password,
        reauthenticate: authService.reauthenticate,
        deleteAccountData: accountService.deleteAccountData,
        deleteCurrentAccount: authService.deleteCurrentAccount,
        onStateChange: setDeletion,
      });
    },
    [user, deletion.state],
  );

  /** Persist profile changes through the service, then refresh state. */
  const saveProfile = useCallback(
    async (patch) => {
      if (!user?.uid) throw new Error('Not signed in.');
      // Hard stop: saving a profile recreates `profiles/{uid}` (setDoc with
      // merge), which would resurrect an account that is being deleted.
      if (!canSaveProfile(deletion.state)) {
        throw new Error('Your account is being deleted, so your profile cannot be saved.');
      }
      const updated = await profileService.updateProfile(user.uid, patch);
      setProfile(updated);
      setProfileVersion((v) => v + 1);
      return updated;
    },
    [user, deletion.state],
  );

  const profileComplete = useMemo(() => {
    if (!profile || !profileLoaded) return false;
    return Boolean(
      profile.bio?.trim() && profile.area && profile.datingIntention,
    );
  }, [profile, profileLoaded]);

  const value = useMemo(
    () => ({
      initializing,
      user,
      profile,
      profileVersion,
      profileComplete,
      profileLoaded,
      profileLoading,
      deletionState: deletion.state,
      deletionFailedSteps: deletion.failedSteps,
      signIn,
      signUp,
      signOut,
      retryDeletion,
      saveProfile,
      refreshProfile,
      updateProfileLocal,
      isAdmin: user?.role === 'admin',
    }),
    [
      initializing,
      user,
      profile,
      profileVersion,
      profileComplete,
      profileLoaded,
      profileLoading,
      deletion,
      refreshProfile,
      updateProfileLocal,
      retryDeletion,
      saveProfile,
      signIn,
      signUp,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};

export default AuthContext;
