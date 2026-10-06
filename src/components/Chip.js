import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { colors, radius, spacing } from '../theme';

/** Selectable chip used for interests, filters and options. */
const Chip = ({ label, emoji, selected = false, onPress, small = false, style }) => (
  <TouchableOpacity
    activeOpacity={onPress ? 0.75 : 1}
    onPress={onPress}
    style={[
      styles.chip,
      small && styles.chipSmall,
      selected && styles.chipSelected,
      !onPress && styles.static,
      style,
    ]}
  >
    <Text style={[styles.label, small && styles.labelSmall, selected && styles.labelSelected]}>
      {emoji ? `${emoji} ` : ''}
      {label}
    </Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.round,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  chipSmall: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2 },
  chipSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  static: { opacity: 0.95 },
  label: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  labelSmall: { fontSize: 12 },
  labelSelected: { color: colors.primary },
});

export default Chip;
