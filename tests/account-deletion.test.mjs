/**
 * Focused account-deletion tests (no emulator/device needed).
 *
 * Run with:
 *   node --test tests/account-deletion.test.mjs
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canSaveProfile,
  deletionStateFromError,
  deletionStatusFromResponse,
  normalizeDeletion,
  resumeDeletion,
} from '../src/utils/accountDeletion.js';

const partialError = () => {
  const error = new Error('partial deletion');
  error.code = 'PARTIAL_DELETION';
  error.failedSteps = ['profilePhotos'];
  return error;
};

test('a partial failure becomes a resumable pending state', async () => {
  const calls = [];
  const states = [];

  await assert.rejects(
    resumeDeletion({
      state: 'none',
      password: 'secret',
      reauthenticate: async () => calls.push('reauth'),
      deleteAccountData: async () => {
        calls.push('data');
        throw partialError();
      },
      deleteCurrentAccount: async () => calls.push('auth'),
      onStateChange: (state) => states.push(state),
    }),
    /partial deletion/,
  );

  assert.deepEqual(calls, ['reauth', 'data']);
  assert.deepEqual(states, [{ state: 'pending', failedSteps: ['profilePhotos'] }]);
});

test('retrying a pending deletion runs the data cleanup again', async () => {
  const calls = [];
  const states = [];

  await resumeDeletion({
    state: 'pending',
    password: 'secret',
    reauthenticate: async () => calls.push('reauth'),
    deleteAccountData: async () => calls.push('data'),
    deleteCurrentAccount: async () => calls.push('auth'),
    onStateChange: (state) => states.push(state),
  });

  assert.deepEqual(calls, ['reauth', 'data', 'auth']);
  assert.deepEqual(states, [{ state: 'completed', failedSteps: [] }]);
});

test('a completed data deletion only retries removing the sign-in after sign-out', async () => {
  const calls = [];
  const states = [];

  await resumeDeletion({
    state: 'completed',
    password: 'secret',
    reauthenticate: async () => calls.push('reauth'),
    deleteAccountData: async () => calls.push('data'),
    deleteCurrentAccount: async () => calls.push('auth'),
    onStateChange: (state) => states.push(state),
  });

  assert.deepEqual(calls, ['reauth', 'auth']);
  assert.deepEqual(states, [{ state: 'completed', failedSteps: [] }]);
});

test('a failed sign-in removal stays on the completed retry screen', async () => {
  const states = [];

  await assert.rejects(
    resumeDeletion({
      state: 'pending',
      password: 'secret',
      reauthenticate: async () => {},
      deleteAccountData: async () => {},
      deleteCurrentAccount: async () => {
        throw new Error('auth unavailable');
      },
      onStateChange: (state) => states.push(state),
    }),
    /auth unavailable/,
  );

  assert.deepEqual(states, [{ state: 'completed', failedSteps: [] }]);
});

test('a failed re-authentication changes nothing', async () => {
  const calls = [];
  const states = [];

  await assert.rejects(
    resumeDeletion({
      state: 'pending',
      password: 'wrong',
      reauthenticate: async () => {
        calls.push('reauth');
        throw new Error('wrong password');
      },
      deleteAccountData: async () => calls.push('data'),
      deleteCurrentAccount: async () => calls.push('auth'),
      onStateChange: (state) => states.push(state),
    }),
    /wrong password/,
  );

  assert.deepEqual(calls, ['reauth']);
  assert.deepEqual(states, []);
});

test('profiles cannot be saved while deletion is pending or completed', () => {
  assert.equal(canSaveProfile('none'), true);
  assert.equal(canSaveProfile('pending'), false);
  assert.equal(canSaveProfile('completed'), false);
});

test('backend deletion states are normalized, unknown states stay none', () => {
  assert.deepEqual(deletionStatusFromResponse({ state: 'pending', failedSteps: ['matches'] }), {
    state: 'pending',
    failedSteps: ['matches'],
  });
  assert.deepEqual(deletionStatusFromResponse({ state: 'completed' }), {
    state: 'completed',
    failedSteps: [],
  });
  assert.deepEqual(deletionStatusFromResponse({ state: 'surprise', failedSteps: ['x'] }), {
    state: 'none',
    failedSteps: [],
  });
  assert.deepEqual(normalizeDeletion('none', ['ignored']), { state: 'none', failedSteps: [] });
});

test('only partial-deletion errors are turned into the pending state', () => {
  assert.deepEqual(deletionStateFromError(partialError()), {
    state: 'pending',
    failedSteps: ['profilePhotos'],
  });
  assert.equal(deletionStateFromError(Object.assign(new Error('nope'), { code: 'OTHER' })), null);
});
