import React from 'react';
import { Image, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '../../components/Button';
import Logo from '../../components/Logo';
import { APP } from '../../config/env';
import { colors, radius, spacing } from '../../theme';

const DATING_HERO = require('../../../assets/malindi-singles3.jpeg');

const HIGHLIGHTS = [
  { emoji: '🔥', text: 'Singles active around Malindi now' },
  { emoji: '⚡', text: 'Quick Match — someone in seconds' },
  { emoji: '💎', text: 'KSh 100 Gold — see everyone who likes you' },
  { emoji: '🛡️', text: 'Safety first: meet in public, always' },
];

const WelcomeScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const heroWidth = Math.min(width - spacing.xl * 2, 520);
  const heroHeight = (heroWidth * 9) / 16;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#1B1030', '#131A35', colors.background]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.glow, styles.glowTop]} />
      <View style={[styles.glow, styles.glowBottom]} />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xxxl, paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={[styles.heroImageWrap, { width: heroWidth, height: heroHeight }]}>
            <Image source={DATING_HERO} style={styles.heroImage} resizeMode="cover" />
            <LinearGradient
              colors={['rgba(10, 15, 30, 0)', 'rgba(10, 15, 30, 0.15)', 'rgba(10, 15, 30, 0.7)']}
              locations={[0, 0.65, 1]}
              style={StyleSheet.absoluteFill}
            />
          </View>

          <View style={styles.logoWrap}>
            <Logo size={96} />
          </View>
          <Text style={styles.title}>
            <Text style={{ color: colors.primary }}>❤️ </Text>
            {APP.name}
          </Text>
          <Text style={styles.tagline}>
            Meet. Match. <Text style={styles.taglineAccent}>Connect. Today.</Text>
          </Text>
          <Text style={styles.supporting}>{APP.supportingText}</Text>
        </View>

        <View style={styles.highlights}>
          {HIGHLIGHTS.map((h) => (
            <View key={h.text} style={styles.highlightRow}>
              <Text style={styles.highlightEmoji}>{h.emoji}</Text>
              <Text style={styles.highlightText}>{h.text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <Button
            title="Create Account"
            icon="heart"
            onPress={() => navigation.navigate('AgeVerification')}
          />
          <Button
            title="Log In"
            variant="secondary"
            onPress={() => navigation.navigate('Login')}
            style={styles.loginBtn}
          />
        </View>

        <Text style={styles.footer}>18+ only  ·  Singles around Malindi, Watamu & Kilifi</Text>
        <Text style={styles.footerTagline}>{APP.tagline}</Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  glow: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    opacity: 0.18,
  },
  glowTop: { top: -110, right: -90, backgroundColor: colors.primary },
  glowBottom: { bottom: -130, left: -110, backgroundColor: colors.secondary },
  content: { paddingHorizontal: spacing.xl, flexGrow: 1, justifyContent: 'center' },
  hero: { alignItems: 'center' },
  heroImageWrap: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  heroImage: { width: '100%', height: '100%' },
  logoWrap: { marginTop: spacing.xl },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: spacing.xl,
    letterSpacing: 0.3,
  },
  tagline: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: spacing.sm,
    letterSpacing: 1.2,
  },
  taglineAccent: { color: colors.primary },
  supporting: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
    marginTop: spacing.lg,
    maxWidth: 330,
  },
  highlights: {
    marginTop: spacing.xxl,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  highlightRow: { flexDirection: 'row', alignItems: 'center' },
  highlightEmoji: { fontSize: 18, marginRight: spacing.md, width: 26 },
  highlightText: { color: colors.textSecondary, fontSize: 14, flex: 1 },
  actions: { marginTop: spacing.xxl },
  loginBtn: { marginTop: spacing.md },
  footer: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  footerTagline: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: spacing.xs,
    letterSpacing: 1,
  },
});

export default WelcomeScreen;
