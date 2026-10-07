/**
 * Supabase Storage — profile photos (direct REST, no SDK dependency).
 *
 * Security model:
 *  - The mobile app holds ONLY the anon/public key (EXPO_PUBLIC_SUPABASE_ANON_KEY).
 *    The service-role key lives exclusively on the backend and must never ship here.
 *  - Files live in the existing private bucket `profile-photos` (Supabase project
 *    ihdelctfpnfjwjubfcww) — that bucket is the single source of truth for image files.
 *  - Firestore stores only the signed photo URL plus profile metadata, never binaries.
 *  - Uploads are multipart/form-data with the picker's local uri, so no fetch/blob
 *    round-trip of the image is needed (avoids the React Native Response.blob() warning).
 */

const BUCKET = 'profile-photos';
// Signed links must outlive the account: ~10 years keeps profiles viewable without re-signing.
const SIGNED_URL_EXPIRES_SECONDS = 60 * 60 * 24 * 365 * 10;

const supabaseUrl = () =>
  (process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim().replace(/\/+$/, '');

const anonKey = () => (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = () => Boolean(supabaseUrl() && anonKey());

const ensureConfigured = () => {
  if (isSupabaseConfigured()) return;
  throw new Error(
    'Photo upload is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env (see .env.example), then restart with npx expo start -c.',
  );
};

const headers = (extra = {}) => {
  const key = anonKey();
  return { apikey: key, Authorization: `Bearer ${key}`, ...extra };
};

const encodePath = (path) => path.split('/').map(encodeURIComponent).join('/');

/** Read Supabase's { message | error } error body into a surfaced Error. */
const errorFromResponse = async (res, fallback) => {
  let detail = '';
  try {
    const body = await res.json();
    detail = body?.message || body?.error || '';
  } catch {
    // Non-JSON body — fall through to the generic message.
  }
  const error = new Error(detail || fallback);
  error.status = res.status;
  return error;
};

/** Create a long-lived signed URL for a private-bucket object. */
const signPhotoUrl = async (path) => {
  const res = await fetch(`${supabaseUrl()}/storage/v1/object/sign/${BUCKET}/${encodePath(path)}`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ expiresIn: SIGNED_URL_EXPIRES_SECONDS }),
  });
  if (!res.ok) {
    const error = await errorFromResponse(res, 'Could not create a link for your photo.');
    if (__DEV__) console.warn('[photos] supabase sign failed:', res.status, error.message);
    throw error;
  }
  const data = await res.json();
  const signedPath = data?.signedURL;
  if (!signedPath) throw new Error('Photo upload finished but no link was returned.');
  if (/^https?:\/\//.test(signedPath)) return signedPath;
  // The API returns "/object/sign/..." — the /storage/v1 prefix must be added.
  return `${supabaseUrl()}/storage/v1${signedPath}`;
};

/**
 * Upload one device-local image under a path unique to the Firebase user
 * (`{uid}/photo_<ts>_<rand>.jpg`) and return { path, url }.
 * Throws an Error whose message is safe to show to the user.
 */
export const uploadProfilePhoto = async (uid, localUri) => {
  ensureConfigured();
  if (!uid) throw new Error('You must be signed in to upload a photo.');

  const filename = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
  const path = `${uid}/${filename}`;

  const form = new FormData();
  // React Native/Expo FormData requires a Blob for file parts (uri/name/type objects
  // can trigger "Unsupported FormDataPart implementation" on some versions).
  const fileResponse = await fetch(localUri);
  const fileBlob = await fileResponse.blob();
  form.append('file', fileBlob, filename);

  const res = await fetch(`${supabaseUrl()}/storage/v1/object/${BUCKET}/${encodePath(path)}`, {
    method: 'POST',
    headers: headers(),
    body: form,
  });
  if (!res.ok) {
    const error = await errorFromResponse(res, 'Photo upload failed. Please try again.');
    if (__DEV__) console.warn('[photos] supabase upload failed:', res.status, error.message);
    throw error;
  }

  const url = await signPhotoUrl(path);
  if (__DEV__) console.warn('[photos] uploaded to supabase path:', path);
  return { path, url };
};

/** Best-effort removal of an object the user deleted from their profile. */
export const deleteProfilePhoto = async (path) => {
  if (!isSupabaseConfigured() || !path) return;
  try {
    const res = await fetch(`${supabaseUrl()}/storage/v1/object/${BUCKET}/${encodePath(path)}`, {
      method: 'DELETE',
      headers: headers(),
    });
    if (!res.ok && res.status !== 404) {
      if (__DEV__) console.warn('[photos] supabase delete failed:', res.status);
    }
  } catch {
    // A leftover file must never block saving the profile.
  }
};

/**
 * Extract `{uid}/...` object path from a stored photo value
 * (signed URL, public URL, or bare path). Returns null when the value is
 * not ours — external avatars and other users' files are never touched.
 */
export const photoPathFromValue = (value, uid) => {
  if (typeof value !== 'string' || !value.includes(`/${BUCKET}/`)) return null;
  try {
    const after = value.split(`/${BUCKET}/`)[1] || '';
    const path = decodeURIComponent(after.split('?')[0]);
    return path.startsWith(`${uid}/`) ? path : null;
  } catch {
    return null;
  }
};
