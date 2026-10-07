import { getFirebaseAuth } from '../firebase/firebaseConfig';

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

  const uriLower = (uri || '').toLowerCase();
  const fileNameFromAsset = asset?.fileName || null;
  const fileNameLower = fileNameFromAsset ? fileNameFromAsset.toLowerCase() : uriLower;

  let ext = 'jpg';
  if (fileNameLower.endsWith('.png') || uriLower.endsWith('.png')) {
    ext = 'png';
  } else if (fileNameLower.endsWith('.webp') || uriLower.endsWith('.webp')) {
    ext = 'webp';
  } else if (fileNameLower.endsWith('.heic') || uriLower.endsWith('.heic')) {
    ext = 'heic';
  } else if (fileNameLower.endsWith('.heif') || uriLower.endsWith('.heif')) {
    ext = 'heif';
  } else if (fileNameLower.endsWith('.jpeg') || uriLower.endsWith('.jpeg') || uriLower.endsWith('.jpg')) {
    ext = 'jpg';
  }

  let filename = fileNameFromAsset;
  if (!filename || !String(filename).includes('.')) {
    filename = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  }
  filename = String(filename);

  const form = new FormData();
  form.append('photo', {
    uri,
    name: filename,
    type: 'application/octet-stream',
  });

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
