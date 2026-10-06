import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import Button from './Button';
import { colors, spacing } from '../theme';

/**
 * Error state with retry — every network operation in the app uses this
 * instead of crashing or showing nothing.
 */
const ErrorState = ({ message = 'Something went wrong.', onRetry, compact = false }) => (
  <View style={[styles.wrap, compact && styles.compact]}>
    <View style={styles.iconWrap}>
      <Ionicons name="cloud-offline-outline" size={30} color={colors.primary} />
    </View>
    <Text style={styles.title}>Connection hiccup</Text>
    <Text style={styles.message}>{message}</Text>
    {onRetry ? <Button title="Try again" icon="refresh" onPress={onRetry} small style={styles.btn} /> : null}
  </View>
);

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl },
  compact: { paddingVertical: spacing.xl },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { color: colors.text, fontWeight: '800', fontSize: 16 },
  message: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', marginTop: spacing.xs },
  btn: { marginTop: spacing.lg, minWidth: 160 },
});

export default ErrorState;
