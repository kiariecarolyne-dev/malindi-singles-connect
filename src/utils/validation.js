/** Form validation used by registration, login and profile editing. */

export const validateName = (name) => {
  if (!name || !name.trim()) return 'Please enter your full name.';
  if (name.trim().length < 2) return 'Name is too short.';
  if (name.trim().length > 50) return 'Name is too long.';
  return null;
};

export const validateEmail = (value) => {
  if (!value || !value.trim()) return 'Please enter your email address.';
  const v = value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Enter a valid email address.';
  return null;
};

export const validateEmailOrPhone = (value) => {
  if (!value || !value.trim()) return 'Please enter your email or phone number.';
  const v = value.trim();
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const isPhone = /^(\+?254|0)[17]\d{8}$/.test(v.replace(/[\s-]/g, ''));
  if (!isEmail && !isPhone) return 'Enter a valid email or Kenyan phone number.';
  return null;
};

export const validatePassword = (password) => {
  if (!password) return 'Please choose a password.';
  if (password.length < 6) return 'Password must be at least 6 characters.';
  return null;
};

export const validateDob = (dob) => {
  if (!dob) return 'Please enter your date of birth.';
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return 'Invalid date of birth.';
  if (d > new Date()) return 'Date of birth cannot be in the future.';
  return null;
};

export const validateBio = (bio, max = 200) => {
  if (!bio || !bio.trim()) return 'Please write a short bio.';
  if (bio.trim().length > max) return `Keep it under ${max} characters.`;
  return null;
};

export const normalizeContact = (value) => (value ? value.trim().toLowerCase() : '');
