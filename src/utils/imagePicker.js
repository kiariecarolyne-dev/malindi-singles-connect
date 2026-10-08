import * as ImagePicker from 'expo-image-picker';

/**
 * Pick a profile photo from the library.
 * Returns { uri, width, height } or null if cancelled.
 * expo-image-picker compresses on device (quality 0.6) so uploads stay
 * small for Kenyan mobile networks.
 */
export const pickImage = async () => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Photo library permission is required to add photos.');

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [3, 4],
    quality: 0.6,
  });

  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
    mimeType: asset.mimeType,
    fileName: asset.fileName,
    type: asset.type,
  };
};

/**
 * Pick a photo for a community post (Gold Circle).
 * No crop: post photos keep their own framing. quality 0.6 keeps uploads
 * small for Kenyan mobile networks and well under the size limit.
 * Returns { uri, width, height, mimeType, fileName, fileSize } or null.
 */
export const pickPostImage = async () => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Photo library permission is required to share a photo.');

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.6,
  });

  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
    mimeType: asset.mimeType,
    fileName: asset.fileName,
    fileSize: asset.fileSize,
  };
};

/** Suggested fallback avatar (used when the user prefers not to upload). */
export const suggestedAvatar = (gender, seed = 3) => {
  const folder = gender === 'female' ? 'women' : 'men';
  const n = 10 + (seed % 70);
  return `https://randomuser.me/api/portraits/${folder}/${n}.jpg`;
};
