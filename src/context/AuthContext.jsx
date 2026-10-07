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

import { authService, profileService } from '../services';
import { runAuthMeTest } from '../utils/devAuthMeTest';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileVersion, setProfileVersion] = useState(0);
  const authMeTestRan = useRef(false);

  const loadProfile = useCallback(async (uid) => {
    if (!uid) {
      setProfile(null);
      return;
    }
    try {
      const p = await profileService.getProfile(uid);
      setProfile(p);
    } catch {
      setProfile(null);
    }
  }, []);

  const signUpInFlight = useRef(false);

  const applyAuthUser = useCallback(
    (nextUser) => {
      // TEMP dev-only diagnostic — safe to remove.
      if (nextUser && !authMeTestRan.current) {
        authMeTestRan.current = true;
        runAuthMeTest();
      }
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
    authService
      .restoreSession()
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
      await loadProfile(u.uid);
      return u;
    },
    [loadProfile],
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
  }, []);

  /** Persist profile changes through the service, then refresh state. */
  const saveProfile = useCallback(
    async (patch) => {
      if (!user?.uid) throw new Error('Not signed in.');
      const updated = await profileService.updateProfile(user.uid, patch);
      setProfile(updated);
      setProfileVersion((v) => v + 1);
      return updated;
    },
    [user],
  );

  const profileComplete = useMemo(() => {
    if (!profile) return false;
    return Boolean(
      profile.photos?.length > 0 && profile.bio?.trim() && profile.area && profile.datingIntention,
    );
  }, [profile]);

  const value = useMemo(
    () => ({
      initializing,
      user,
      profile,
      profileVersion,
      profileComplete,
      signIn,
      signUp,
      signOut,
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
      signIn,
      signUp,
      signOut,
      saveProfile,
      refreshProfile,
      updateProfileLocal,
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
