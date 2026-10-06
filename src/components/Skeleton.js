import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '../theme';

/** Pulsing skeleton placeholder — keeps layout steady while data loads. */
export const SkeletonBlock = ({ width = '100%', height = 16, style }) => {
  const [opacity] = useState(() => new Animated.Value(0.4));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[{ width, height, borderRadius: radius.sm, backgroundColor: colors.surfaceLight, opacity }, style]} />;
};

export const CardSkeleton = () => (
  <View style={styles.card}>
    <SkeletonBlock height={320} style={{ borderRadius: radius.xl }} />
    <SkeletonBlock width="55%" height={22} style={{ marginTop: spacing.lg }} />
    <SkeletonBlock width="35%" height={14} style={{ marginTop: spacing.sm }} />
    <View style={styles.chipRow}>
      <SkeletonBlock width={70} height={28} style={{ borderRadius: radius.round }} />
      <SkeletonBlock width={80} height={28} style={{ borderRadius: radius.round }} />
      <SkeletonBlock width={60} height={28} style={{ borderRadius: radius.round }} />
    </View>
  </View>
);

export const ListSkeleton = ({ rows = 4 }) => (
  <View>
    {Array.from({ length: rows }).map((_, i) => (
      <View key={i} style={styles.listRow}>
        <SkeletonBlock width={56} height={56} style={{ borderRadius: 28 }} />
        <View style={styles.listText}>
          <SkeletonBlock width="50%" height={16} />
          <SkeletonBlock width="30%" height={12} style={{ marginTop: spacing.sm }} />
        </View>
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  card: { paddingHorizontal: spacing.lg },
  chipRow: { flexDirection: 'row', marginTop: spacing.md, gap: spacing.sm },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  listText: { flex: 1, marginLeft: spacing.md },
});

export default SkeletonBlock;
