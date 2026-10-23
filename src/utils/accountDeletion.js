/**
 * Account-deletion state + retry flow.
 *
 * Kept free of React Native/Firebase imports so the retry rules can be tested
 * without an emulator or a device:
 *  - a partial failure becomes a durable `pending` state,
 *  - retrying resumes the failed step,
 *  - once the data is gone (`completed`) retrying only removes the sign-in,
 *  - a profile may never be saved while either state is active.
 */
export const DELETION_STATE = Object.freeze({
  NONE: 'none',
  PENDING: 'pending',
  COMPLETED: 'completed',
});

const isActiveState = (state) =>
  state === DELETION_STATE.PENDING || state === DELETION_STATE.COMPLETED;

export const normalizeDeletion = (state, failedSteps = []) => {
  const normalizedState = isActiveState(state) ? state : DELETION_STATE.NONE;
  return {
    state: normalizedState,
    failedSteps: normalizedState === DELETION_STATE.NONE || !Array.isArray(failedSteps)
      ? []
      : failedSteps,
  };
};

export const deletionStatusFromResponse = (data) =>
  normalizeDeletion(data?.state, data?.failedSteps);

export const isDeletionInProgress = (state) => isActiveState(state);

export const canSaveProfile = (state) => !isDeletionInProgress(state);

/** Turn a backend partial-deletion failure into the durable pending state. */
export const deletionStateFromError = (error) =>
  error?.code === 'PARTIAL_DELETION'
    ? normalizeDeletion(DELETION_STATE.PENDING, error?.failedSteps)
    : null;

/**
 * Re-authenticate, delete whatever is left, then remove the sign-in.
 *
 * When the backend already completed the data deletion (`completed`), the
 * data call is skipped so a failed final sign-in removal can still be retried
 * after signing out and back in. `onStateChange` is called before the auth
 * account is removed, so a failure there leaves the member on the resumable
 * deletion screen rather than the onboarding flow.
 */
export const resumeDeletion = async ({
  state,
  password,
  reauthenticate,
  deleteAccountData,
  deleteCurrentAccount,
  onStateChange,
}) => {
  await reauthenticate(password);

  if (state !== DELETION_STATE.COMPLETED) {
    try {
      await deleteAccountData();
    } catch (error) {
      const pending = deletionStateFromError(error);
      if (pending) onStateChange(pending);
      throw error;
    }
  }

  onStateChange(normalizeDeletion(DELETION_STATE.COMPLETED));
  await deleteCurrentAccount();
};
