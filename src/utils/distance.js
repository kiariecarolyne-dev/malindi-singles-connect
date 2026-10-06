/**
 * Approximate distance between two coordinates, in kilometres.
 * Used only for "2 km away"-style labels — exact locations are never shown.
 */
const R = 6371;

const toRad = (deg) => (deg * Math.PI) / 180;

export const haversineKm = (lat1, lon1, lat2, lon2) => {
  if ([lat1, lon1, lat2, lon2].some((v) => typeof v !== 'number')) return null;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Privacy-safe distance label: rounds to 1 km under 10 km,
 * then to 5 km steps — never pinpointing anyone.
 */
export const formatDistance = (km) => {
  if (km == null) return null;
  if (km < 1) return 'Less than 1 km away';
  if (km < 10) return `${Math.round(km)} km away`;
  if (km < 50) return `${Math.round(km / 5) * 5} km away`;
  return `${Math.floor(km / 10) * 10}+ km away`;
};

export const shortDistance = (km) => {
  if (km == null) return null;
  if (km < 1) return '<1 km';
  if (km < 10) return `${Math.round(km)} km`;
  if (km < 50) return `${Math.round(km / 5) * 5} km`;
  return `${Math.floor(km / 10) * 10}+ km`;
};
