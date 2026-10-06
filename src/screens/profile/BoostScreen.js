import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import Button from '../../components/Button';
import Screen from '../../components/Screen';
import ScreenHeader from '../../components/ScreenHeader';
import { LIMITS } from '../../config/env';
import { useAuth } from '../../context/AuthContext';
import { notificationService } from '../../services';
import { colors, gradients, radius, spacing } from '../../theme';

const minutesLeft = (iso) => {
  if (!iso) return 0;
  const diff = new Date(iso).getTime() - Date.now();
  return diff > 0 ? Math.ceil(diff / 60000) : 0;
};

const BoostScreen = ({ navigation }) => {
  const { profile, user, saveProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [, setTick] = useState(0);

  const left = minutesLeft(profile?.boostedUntil);

  useFocusEffect(
    useCallback(() => {
      const t = setInterval(() => setTick((v) => v + 1), 15000);
      return () => clearInterval(t);
    }, []),
  );

  const activate = async () => {
    if (busy || left > 0) return;
    setBusy(true);
    try {
      const until = new Date(Date.now() + LIMITS.boostMinutes * 60000).toISOString();
      await saveProfile({ boostedUntil: until });
      await notificationService.createNotification({
        uid: user.uid,
        type: 'boost',
        title: 'Boost activated 🚀',
        body: `You are now first in line for ${LIMITS.boostMinutes} minutes. Watch your profile views climb.`,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title="Boost Me"
        onBack={navigation.canGoBack() ? () => navigation.goBack() : null}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={gradients.premium} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Ionicons name="rocket" size={38} color={colors.white} />
          <Text style={styles.heroTitle}>Boost</Text>
          <Text style={styles.heroSub}>
            Jump to the front of Discover around Malindi for {LIMITS.boostMinutes} minutes — up to 10x
            more profile views.
          </Text>
        </LinearGradient>

        <View style={styles.statusCard}>
          {left > 0 ? (
            <>
              <View style={styles.liveRow}>
                <View style={styles.pulse} />
                <Text style={styles.liveText}>Boost active</Text>
              </View>
              <Text style={styles.countdown}>{left} min left</Text>
              <Text style={styles.statusSub}>
                You are prioritised in decks for everyone you match with right now.
              </Text>
            </>
          ) : (
            <>
              <Ionicons name="flash-outline" size={30} color={colors.textMuted} />
              <Text style={styles.statusTitle}>No boost running</Text>
              <Text style={styles.statusSub}>
                Active boosts lift your profile to the top of nearby decks.
              </Text>
            </>
          )}
        </View>

        <View style={styles.bullets}>
          {[
            { icon: 'eye', text: 'Seen first by singles in your area' },
            { icon: 'trending-up', text: 'More likes and matches while active' },
            { icon: 'timer', text: `Runs for ${LIMITS.boostMinutes} minutes, no auto-renew` },
          ].map((b) => (
            <View key={b.icon} style={styles.bulletRow}>
              <Ionicons name={b.icon} size={18} color={colors.primary} />
              <Text style={styles.bulletText}>{b.text}</Text>
            </View>
          ))}
        </View>

        <Button
          title={left > 0 ? `Boost active · ${left}m left` : 'Activate free demo boost'}
          icon="rocket"
          variant="primary"
          onPress={activate}
          loading={busy}
          disabled={left > 0}
          style={styles.cta}
        />
        <Text style={styles.honest}>
          Honest demo mode: activating is free and no payment is taken. In production a boost is a
          paid one-off purchase.
        </Text>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },

  hero: { borderRadius: radius.xl, padding: spacing.xl, alignItems: 'center' },
  heroTitle: { color: colors.white, fontSize: 26, fontWeight: '900', marginTop: spacing.sm },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 14, textAlign: 'center', marginTop: 6, lineHeight: 20 },

  statusCard: {
    marginTop: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pulse: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.success },
  liveText: { color: colors.success, fontWeight: '800', fontSize: 14 },
  countdown: { color: colors.text, fontSize: 34, fontWeight: '900', marginTop: 4 },
  statusTitle: { color: colors.text, fontSize: 17, fontWeight: '800', marginTop: spacing.sm },
  statusSub: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 19 },

  bullets: { marginTop: spacing.xl, gap: spacing.md },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  bulletText: { color: colors.textSecondary, fontSize: 14, flex: 1 },

  cta: { marginTop: spacing.xl },
  honest: { color: colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: spacing.md },
});

export default BoostScreen;
