import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, gradients, shadows } from '../theme';

/**
 * App mark: a gradient heart with a subtle location pin —
 * "connections around Malindi".
 */
const Logo = ({ size = 84, showWordmark = true, wordmarkStyle }) => (
  <View style={styles.container}>
    <LinearGradient
      colors={gradients.primary}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.mark,
        { width: size, height: size, borderRadius: size / 3 },
        shadows.card,
      ]}
    >
      <Ionicons name="heart" size={size * 0.5} color={colors.white} />
      <View style={[styles.pin, { width: size * 0.34, height: size * 0.34, borderRadius: size * 0.17 }]}>
        <Ionicons name="location" size={size * 0.2} color={colors.primary} />
      </View>
    </LinearGradient>
    {showWordmark ? (
      <View style={styles.wordmarkWrap}>
        <Text style={[styles.wordmark, wordmarkStyle]}>Malindi Singles Connect</Text>
      </View>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  mark: { alignItems: 'center', justifyContent: 'center' },
  pin: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  wordmarkWrap: { marginTop: 14, alignItems: 'center' },
  wordmark: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});

export default Logo;
