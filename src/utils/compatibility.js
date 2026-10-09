/**
 * Compatibility score — a fun indicator, NOT a scientific guarantee.
 * Weights: intention 30, interests 25, age preference 15,
 *          location 15, activity 15.
 */
import { profileAge } from './age';

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const intentionScore = (a, b) => {
  if (a === b) return 100;
  const harmony = {
    serious: ['marriage', 'dating', 'open'],
    marriage: ['serious', 'open'],
    dating: ['serious', 'open', 'friendship'],
    friendship: ['dating', 'open'],
    open: ['serious', 'marriage', 'dating', 'friendship'],
  };
  return (harmony[a] || []).includes(b) ? 70 : 35;
};

const interestScore = (a = [], b = []) => {
  if (!a.length || !b.length) return 40;
  const shared = a.filter((i) => b.includes(i)).length;
  const union = new Set([...a, ...b]).size;
  return clamp(Math.round((shared / union) * 100), 0, 100);
};

const ageScore = (profile, viewer) => {
  const pAge = profileAge(profile);
  const vAge = profileAge(viewer);
  if (!pAge || !vAge) return 60;
  const pPref = profile.preferences || {};
  const vPref = viewer.preferences || {};
  const vInRange = pAge >= (vPref.minAge || 18) && pAge <= (vPref.maxAge || 99);
  const pInRange = vAge >= (pPref.minAge || 18) && vAge <= (pPref.maxAge || 99);
  if (vInRange && pInRange) return 100;
  if (vInRange || pInRange) return 65;
  return 25;
};

const locationScore = (a, b) => {
  if (a == null || b == null) return 60;
  if (a === b) return 100;
  return 55;
};

const activityScore = (lastActiveAt) => {
  if (!lastActiveAt) return 40;
  const hours = (Date.now() - new Date(lastActiveAt).getTime()) / 36e5;
  if (hours < 1) return 100;
  if (hours < 24) return 80;
  if (hours < 72) return 60;
  return 40;
};

/**
 * @returns {number} 0-100 compatibility percentage.
 */
export const compatibilityScore = (profile, viewer) => {
  if (!profile || !viewer) return 0;

  const score =
    intentionScore(profile.datingIntention, viewer.datingIntention) * 0.3 +
    interestScore(profile.interests, viewer.interests) * 0.25 +
    ageScore(profile, viewer) * 0.15 +
    locationScore(profile.area, viewer.area) * 0.15 +
    activityScore(profile.lastActiveAt) * 0.15;

  return clamp(Math.round(score), 5, 99);
};

export const sharedInterests = (a = [], b = []) => a.filter((i) => b.includes(i));
