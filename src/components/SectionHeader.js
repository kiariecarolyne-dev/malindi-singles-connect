import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors, spacing } from '../theme';

const SectionHeader = ({ title, subtitle, actionLabel, onAction, emoji }) => (
  <View style={styles.row}>
    <View style={styles.titleWrap}>
      <Text style={styles.title}>
        {emoji ? `${emoji} ` : ''}
        {title}
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
    {actionLabel && onAction ? (
      <TouchableOpacity onPress={onAction} activeOpacity={0.7}>
        <Text style={styles.action}>{actionLabel}</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  titleWrap: { flex: 1, paddingRight: spacing.md },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  subtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  action: { color: colors.primary, fontSize: 13, fontWeight: '700' },
});

export default SectionHeader;
