import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';

const LOGO_SOURCE = require('../../assets/logo.png');

/**
 * App logo mark using the official Malindi Single Logo image.
 */
const Logo = ({ size = 84, showWordmark = true, wordmarkStyle }) => (
  <View style={styles.container}>
    <Image
      source={LOGO_SOURCE}
      style={{ width: size, height: size, borderRadius: size / 4, resizeMode: 'contain' }}
    />
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
  pin: {},
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
