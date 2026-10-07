import { getFirebaseAuth } from '../firebase/firebaseConfig';
import { File } from 'expo-file-system';
import { fetch } from 'expo/fetch';

const DEFAULT_BACKEND_URL = 'https://malindi-singles-connect-backend.onrender.com/api';

const getBackendUrl = () =>
  (process.env.EXPO_PUBLIC_BACKEND_URL || DEFAULT_BACKEND_URL).replace(/\/+$/, '');

export const uploadProfilePhotoViaBackend = async (localUri, asset) => {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in to upload a photo.');
  }

  const idToken = await user.getIdToken();

  const uri = localUri || asset?.uri;
  if (!uri) {
    throw new Error('No photo selected.');
  }

  const form = new FormData();
  const file = new File(uri);
  form.append('photo', file);

  const res = await fetch(`${getBackendUrl()}/profile-photos/photos`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
    body: form,
  });

  let data;
  try {
    data = await res.json();
  } catch (_e) {
    throw new Error('Photo upload failed. Please try again.');
  }

  if (!res.ok) {
    const message = data?.error || 'Photo upload failed. Please try again.';
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }

  const result = data?.data || {};
  if (!result.path) {
    throw new Error('Photo upload finished but no path was returned.');
  }

  return { path: result.path, url: result.url || result.path };
};
