import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing } from '../theme';

/** Encouraging empty state — never a blank screen. */
const EmptyState = ({
  emoji = '❤️',
  title = 'Nothing here yet',
  message = 'Your next connection could be nearby.',
  actionLabel,
  onAction,
}) => (
  <View style={styles.wrap}>
    <View style={styles.circle}>
      <Text style={styles.emoji}>{emoji}</Text>
    </View>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.message}>{message}</Text>
    {actionLabel && onAction ? (
      <TouchableOpacity style={styles.action} onPress={onAction} activeOpacity={0.85}>
        <Ionicons name="sparkles" size={16} color={colors.white} />
        <Text style={styles.actionText}>{actionLabel}</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingHorizontal: spacing.xxl, paddingVertical: spacing.xxxl },
  circle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emoji: { fontSize: 38 },
  title: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: spacing.sm, textAlign: 'center' },
  message: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 21 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.round,
    marginTop: spacing.xl,
  },
  actionText: { color: colors.white, fontWeight: '700', marginLeft: spacing.sm },
});

export default EmptyState;
