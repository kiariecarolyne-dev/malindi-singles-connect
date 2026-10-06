import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';

/** Small green "active now" indicator. */
const ActiveDot = ({ label, size = 'md', style }) => (
  <View style={[styles.row, style]}>
    <View style={[styles.dot, size === 'sm' && styles.dotSm]} />
    {label ? <Text style={[styles.label, size === 'sm' && styles.labelSm]}>{label}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: 6,
  },
  dotSm: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  label: { color: colors.success, fontSize: 12, fontWeight: '700' },
  labelSm: { fontSize: 11 },
});

export default ActiveDot;
