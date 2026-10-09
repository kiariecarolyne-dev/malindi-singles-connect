import { APP } from '../config/env';

/** Calculate age from an ISO date string (yyyy-mm-dd). */
export const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return 0;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
};

/**
 * Age to display for a profile. Public profiles carry only a derived `age`
 * (the full date of birth lives in the owner-only private document), but a
 * not-yet-migrated profile may still expose `dateOfBirth`, so fall back to it.
 */
export const profileAge = (profile) => {
  if (!profile) return 0;
  if (Number.isInteger(profile.age) && profile.age > 0) return profile.age;
  return calculateAge(profile.dateOfBirth);
};

/** The 18+ gate — registration must fail when this is false. */
export const isAdult = (dateOfBirth) => calculateAge(dateOfBirth) >= APP.minAge;

/** Latest allowed birthday for an 18+ user. */
export const getMinBirthday = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - APP.minAge);
  return d.toISOString().split('T')[0];
};

export const formatDateOfBirth = (dateOfBirth) => {
  if (!dateOfBirth) return '';
  const d = new Date(dateOfBirth);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};
