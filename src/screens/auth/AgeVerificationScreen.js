import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '../../components/Button';
import Logo from '../../components/Logo';
import { APP } from '../../config/env';
import { colors, radius, spacing } from '../../theme';

/**
 * The 18+ gate. Registration is only reachable after confirming adulthood;
 * date of birth is validated again during registration.
 */
const AgeVerificationScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [declined, setDeclined] = useState(false);

  if (declined) {
    return (
      <View style={styles.root}>
        <LinearGradient colors={['#1B1030', colors.background]} style={StyleSheet.absoluteFill} />
        <View style={[styles.center, { paddingTop: insets.top + spacing.xxxl, paddingBottom: insets.bottom + spacing.xxl }]}>
          <View style={styles.blockedCircle}>
            <Ionicons name="lock-closed" size={44} color={colors.danger} />
          </View>
          <Text style={styles.title}>Sorry — not this time</Text>
          <Text style={styles.body}>
            Malindi Singles Connect is a dating platform for adults aged {APP.minAge}+ only. You are
            welcome back when you turn {APP.minAge}.
          </Text>
          <Button title="Go back" variant="secondary" onPress={() => setDeclined(false)} style={styles.blockedBtn} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#1B1030', '#131A35', colors.background]} style={StyleSheet.absoluteFill} />
      <View style={[styles.glow, styles.glowTop]} />
      <View style={[styles.content, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]}>
        <Logo size={76} showWordmark={false} />

        <View style={styles.shield}>
          <Ionicons name="shield-checkmark" size={30} color={colors.primary} />
        </View>

        <Text style={styles.title}>Are you {APP.minAge} years or older?</Text>
        <Text style={styles.body}>
          Malindi Singles Connect is strictly for adults. We ask everyone to confirm their age before
          joining — this keeps our community safe.
        </Text>

        <View style={styles.points}>
          {[
            'You must be 18 or older to create a profile',
            'Your date of birth is checked during sign-up',
            'Underage accounts are removed immediately',
          ].map((p) => (
            <View key={p} style={styles.pointRow}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={styles.pointText}>{p}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <Button
            title={`Yes, I'm ${APP.minAge}+`}
            icon="heart"
            onPress={() => navigation.navigate('Register', { confirmedAge: true })}
          />
          <Button title="No, I'm younger" variant="ghost" onPress={() => setDeclined(true)} style={styles.noBtn} />
        </View>

        <Text style={styles.footer}>By continuing you also agree to meet safely and treat others with respect.</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  glow: { position: 'absolute', width: 300, height: 300, borderRadius: 150, opacity: 0.16 },
  glowTop: { top: -100, right: -80, backgroundColor: colors.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.xl },
  shield: {
    marginTop: spacing.xxl,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockedCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  body: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
    marginTop: spacing.md,
    maxWidth: 340,
  },
  points: {
    marginTop: spacing.xxl,
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  pointRow: { flexDirection: 'row', alignItems: 'center' },
  pointText: { color: colors.textSecondary, fontSize: 13, marginLeft: spacing.md, flex: 1 },
  actions: { marginTop: 'auto', alignSelf: 'stretch' },
  noBtn: { marginTop: spacing.sm },
  blockedBtn: { marginTop: spacing.xl, minWidth: 200 },
  footer: { color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: spacing.lg, lineHeight: 16 },
});

export default AgeVerificationScreen;
