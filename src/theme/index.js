/**
 * Malindi Singles Connect — design tokens.
 * Deep navy background, pink/red accents, white type.
 */

export const colors = {
  background: '#0A0F1E',
  backgroundAlt: '#0E1426',
  surface: '#151C30',
  surfaceLight: '#1D2540',
  surfaceHigh: '#242E4E',

  primary: '#FF3B6B',
  primaryDark: '#E02454',
  primarySoft: 'rgba(255, 59, 107, 0.14)',

  secondary: '#7C5CFF',
  secondarySoft: 'rgba(124, 92, 255, 0.16)',

  gold: '#FFC542',
  goldSoft: 'rgba(255, 197, 66, 0.16)',

  text: '#FFFFFF',
  textSecondary: '#A7B0C5',
  textMuted: '#6C7793',

  success: '#2ED573',
  successSoft: 'rgba(46, 213, 115, 0.15)',
  warning: '#FFA502',
  danger: '#FF4757',
  dangerSoft: 'rgba(255, 71, 87, 0.15)',
  info: '#4DA3FF',

  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.16)',
  overlay: 'rgba(5, 8, 18, 0.75)',
  white: '#FFFFFF',
  black: '#000000',
};

export const gradients = {
  primary: ['#FF3B6B', '#FF6B4A'],
  card: ['rgba(10, 15, 30, 0)', 'rgba(10, 15, 30, 0.55)', 'rgba(10, 15, 30, 0.95)'],
  header: ['#131A30', '#0A0F1E'],
  gold: ['#FFC542', '#FF8A3D'],
  premium: ['#7C5CFF', '#FF3B6B'],
  active: ['#2ED573', '#4DA3FF'],
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  xxl: 32,
  round: 999,
};

export const typography = {
  hero: { fontSize: 32, fontWeight: '800', color: colors.text },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  heading: { fontSize: 19, fontWeight: '700', color: colors.text },
  subheading: { fontSize: 16, fontWeight: '600', color: colors.text },
  body: { fontSize: 15, fontWeight: '400', color: colors.text },
  secondary: { fontSize: 14, fontWeight: '400', color: colors.textSecondary },
  caption: { fontSize: 12, fontWeight: '500', color: colors.textMuted },
  badge: { fontSize: 12, fontWeight: '700', color: colors.text },
};

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
};

export default { colors, gradients, spacing, radius, typography, shadows };
