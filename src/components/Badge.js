import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing } from '../theme';

/** Verified badge — only shown when the service actually reports verified. */
export const VerifiedBadge = ({ size = 'md' }) => {
  const small = size === 'sm';
  return (
    <View style={[styles.verified, small && styles.verifiedSm]}>
      <Ionicons name="checkmark-circle" size={small ? 13 : 15} color={colors.info} />
      <Text style={[styles.verifiedText, small && styles.verifiedTextSm]}>Verified</Text>
    </View>
  );
};

export const StatusPill = ({ label, emoji, tone = 'default' }) => (
  <View style={[styles.pill, tone === 'success' && styles.pillSuccess, tone === 'danger' && styles.pillDanger]}>
    {emoji ? <Text style={styles.pillEmoji}>{emoji}</Text> : null}
    <Text style={[styles.pillText, tone === 'success' && styles.pillTextSuccess, tone === 'danger' && styles.pillTextDanger]}>
      {label}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  verified: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(77, 163, 255, 0.14)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.round,
  },
  verifiedSm: { paddingHorizontal: 6, paddingVertical: 1 },
  verifiedText: { color: colors.info, fontSize: 11, fontWeight: '700', marginLeft: 4 },
  verifiedTextSm: { fontSize: 10 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillSuccess: { backgroundColor: colors.successSoft, borderColor: 'transparent' },
  pillDanger: { backgroundColor: colors.dangerSoft, borderColor: 'transparent' },
  pillEmoji: { fontSize: 12, marginRight: 6 },
  pillText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  pillTextSuccess: { color: colors.success },
  pillTextDanger: { color: colors.danger },
});

export default VerifiedBadge;
