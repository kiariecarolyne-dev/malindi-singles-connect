/**
 * paymentService (backend) — Malindi Gold M-Pesa (Daraja) via the Render API.
 *
 * The mobile app NEVER talks to Safaricom and NEVER holds Daraja secrets.
 * It only asks our backend to start an STK push (authenticated with a fresh
 * Firebase ID token) and then polls the backend for the result.
 *
 * The backend enforces the KSh 100 price and owns Gold activation — this
 * service cannot grant Gold.
 */
import { fetch } from 'expo/fetch';

import { getFirebaseAuth } from '../firebase/firebaseConfig';

const DEFAULT_BACKEND_URL = 'https://malindi-singles-connect-backend.onrender.com/api';

const getBackendUrl = () =>
  (process.env.EXPO_PUBLIC_BACKEND_URL || DEFAULT_BACKEND_URL).replace(/\/+$/, '');

/** Signed-in authed JSON request helper. Never logs tokens. */
const authedRequest = async (path, { method = 'GET', body } = {}) => {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in to continue.');
  }

  const idToken = await user.getIdToken();

  const response = await fetch(`${getBackendUrl()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await response.json();
  } catch (_e) {
    throw new Error('Payment service returned an unexpected response.');
  }

  if (!response.ok || data?.success === false) {
    const message =
      response.status === 403
        ? 'You are not allowed to view that payment.'
        : data?.error || 'Payment request failed. Please try again.';
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return data;
};

/**
 * Start an STK push for Malindi Gold. Only the phone number is sent — the
 * backend derives the UID from the ID token and fixes the price at KSh 100.
 */
export const startGoldPayment = async (phoneNumber) => {
  const data = await authedRequest('/payments/mpesa/stk-push', {
    method: 'POST',
    body: { phoneNumber },
  });

  if (!data?.paymentId) {
    throw new Error('M-Pesa did not return a payment reference. Please try again.');
  }

  return {
    paymentId: data.paymentId,
    checkoutRequestId: data.checkoutRequestId || null,
    status: data.status || 'pending',
  };
};

/** Poll a payment's status. Returns { status, gold, receipt, ... }. */
export const getPaymentStatus = async (paymentId) => {
  if (!paymentId) throw new Error('Missing payment reference.');
  const data = await authedRequest(`/payments/${encodeURIComponent(paymentId)}/status`);
  return data?.payment || null;
};

export default { startGoldPayment, getPaymentStatus };