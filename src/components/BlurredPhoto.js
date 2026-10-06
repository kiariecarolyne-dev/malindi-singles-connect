import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, radius, spacing } from '../theme';

/**
 * A photo that stays private: the image is blurred with RN's native
 * `blurRadius` (works on iOS and Android without extra dependencies),
 * covered with a gradient and a 🔒 badge.
 *
 * Used for locked incoming likes — the free tier sees that *someone*
 * liked them, never who, until 💎 Malindi Gold.
 */
const BlurredPhoto = ({
  uri,
  width = 120,
  height = 160,
  borderRadius = radius.lg,
  label,
  style,
}) => (
  <View style={[styles.wrap, { width, height, borderRadius }, style]}>
    {uri ? (
      <Image source={{ uri }} style={StyleSheet.absoluteFillObject} blurRadius={24} resizeMode="cover" />
    ) : (
      <View style={[StyleSheet.absoluteFillObject, styles.placeholder]}>
        <Ionicons name="person" size={28} color={colors.textMuted} />
      </View>
    )}
    <LinearGradient
      colors={['rgba(10, 15, 30, 0.15)', 'rgba(10, 15, 30, 0.85)']}
      style={StyleSheet.absoluteFillObject}
    />
    <View style={styles.lock}>
      <Ionicons name="lock-closed" size={13} color={colors.black} />
    </View>
    {label ? (
      <View style={styles.labelWrap}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      </View>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  lock: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelWrap: { position: 'absolute', bottom: spacing.sm, left: 0, right: 0, alignItems: 'center' },
  label: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});

export default BlurredPhoto;
