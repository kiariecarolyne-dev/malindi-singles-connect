import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import Button from '../../components/Button';
import Screen from '../../components/Screen';
import ScreenHeader from '../../components/ScreenHeader';
import { DEMO_MODE } from '../../config/env';
import { GOLD, PLANS, FREE_VISIBLE_LIKES } from '../../constants/plans';
import { useAuth } from '../../context/AuthContext';
import { premiumService } from '../../services';
import { colors, gradients, radius, spacing } from '../../theme';

/**
 * 💎 Malindi Gold paywall.
 *
 * Gold is a ONE-TIME KSh 100 purchase: no monthly fee, no renewal, no
 * expiry. Payments are not connected yet, so the buy button opens a clearly
 * labelled Demo Mode checkout instead of pretending a payment succeeded.
 */
const PremiumScreen = ({ navigation }) => {
  const { user, profile, refreshProfile } = useAuth();
  const gold = premiumService.isGold(profile);
  const entitlement = profile?.gold?.isGold ? profile.gold : profile?.premium;

  const [checkout, setCheckout] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const startCheckout = () =>
    run(async () => {
      const result = await premiumService.createGoldCheckout(user.uid);
      if (result.status === 'already_gold') {
        await refreshProfile();
      } else {
        setCheckout(result);
      }
    });

  const confirmDemo = () =>
    run(async () => {
      await premiumService.activateDemoGold(user.uid);
      await refreshProfile();
      setCheckout(null);
    });

  const removeDemoGold = () =>
    run(async () => {
      await premiumService.deactivateDemoGold(user.uid);
      await refreshProfile();
    });

  const { free, premium } = PLANS;
  const activatedOn = entitlement?.goldActivatedAt || entitlement?.since;

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title="Malindi Gold"
        onBack={navigation.canGoBack() ? () => navigation.goBack() : null}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 💎 Hero */}
        <LinearGradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.heroBadge}>
            <Ionicons name="diamond" size={30} color={colors.black} />
          </View>
          <Text style={styles.heroTitle}>{GOLD.tagline}</Text>
          <Text style={styles.heroPrice}>{GOLD.priceLabel}</Text>
          <Text style={styles.heroBilling}>{GOLD.billingLabel} · LIFETIME ACCESS</Text>
          <Text style={styles.heroSub}>{GOLD.noFees}</Text>
          {gold ? (
            <View style={styles.activePill}>
              <Ionicons name="checkmark-circle" size={15} color={colors.black} />
              <Text style={styles.activePillText}>Gold active — every like unlocked</Text>
            </View>
          ) : null}
        </LinearGradient>

        {/* ✅ What you get */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your Gold membership includes</Text>
          {GOLD.benefits.map((b) => (
            <View key={b} style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={16} color={colors.gold} />
              <Text style={styles.featureText}>{b}</Text>
            </View>
          ))}
        </View>

        {/* ⚖️ Free vs Gold */}
        <View style={styles.compareRow}>
          <View style={[styles.planCard, !gold && styles.planCardCurrent]}>
            <Text style={styles.planName}>{free.name}</Text>
            <Text style={styles.planPrice}>{free.price}</Text>
            <View style={styles.featureRow}>
              <Ionicons name="checkmark" size={15} color={colors.success} />
              <Text style={styles.featureText}>First {FREE_VISIBLE_LIKES} likes you can see clearly</Text>
            </View>
            <View style={styles.featureRow}>
              <Ionicons name="close" size={15} color={colors.textMuted} />
              <Text style={[styles.featureText, styles.missing]}>Everyone who likes you</Text>
            </View>
            <View style={styles.featureRow}>
              <Ionicons name="close" size={15} color={colors.textMuted} />
              <Text style={[styles.featureText, styles.missing]}>Unblurred like photos</Text>
            </View>
          </View>

          <View style={[styles.planCard, gold && styles.planCardCurrent, styles.goldCard]}>
            <Text style={[styles.planName, styles.goldName]}>{premium.name}</Text>
            <Text style={styles.planPrice}>{GOLD.priceLabel} one-time</Text>
            {premium.features.map((f) => (
              <View key={f} style={styles.featureRow}>
                <Ionicons name="checkmark" size={15} color={colors.gold} />
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* 🛒 Checkout */}
        {gold ? (
          <View style={styles.owned}>
            <Ionicons name="shield-checkmark" size={20} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={styles.ownedTitle}>You own Malindi Gold</Text>
              <Text style={styles.ownedSub}>
                {activatedOn
                  ? `Activated ${new Date(activatedOn).toLocaleDateString()} · never expires`
                  : 'Lifetime access · never expires'}
              </Text>
            </View>
          </View>
        ) : checkout ? (
          <View style={styles.demoBox}>
            <View style={styles.demoHead}>
              <Ionicons name="flask" size={16} color={colors.black} />
              <Text style={styles.demoHeadText}>DEMO MODE — PAYMENTS ARE NOT CONNECTED YET</Text>
            </View>
            <Text style={styles.demoLine}>
              {GOLD.name}: {GOLD.priceLabel} ({GOLD.billingLabel.toLowerCase()})
            </Text>
            <Text style={styles.demoLine}>Reference: {checkout.reference}</Text>
            <Text style={styles.demoNote}>
              No M-Pesa or card is charged here. In production this step starts the KSh 100 STK
              push and the entitlement is granted by the payment provider.
            </Text>
            <Button
              title="Activate Gold (demo)"
              variant="gold"
              icon="diamond"
              onPress={confirmDemo}
              loading={busy}
              style={styles.cta}
            />
            <Button
              title="Cancel"
              variant="ghost"
              onPress={() => setCheckout(null)}
              disabled={busy}
              style={styles.back}
            />
          </View>
        ) : (
          <>
            <Button
              title={GOLD.unlockCta}
              variant="gold"
              icon="diamond"
              onPress={startCheckout}
              loading={busy}
              style={styles.cta}
            />
            <Text style={styles.honest}>
              {GOLD.closing} Payments are not connected yet — the button opens a clearly labelled
              demo checkout so nothing is charged by mistake.
            </Text>
          </>
        )}

        {DEMO_MODE ? (
          <Button
            title={gold ? 'Remove demo Gold' : 'Back'}
            variant="ghost"
            onPress={gold ? removeDemoGold : () => navigation.goBack()}
            disabled={busy}
            style={styles.back}
          />
        ) : (
          <Button title="Back" variant="ghost" onPress={() => navigation.goBack()} style={styles.back} />
        )}
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },

  hero: { borderRadius: radius.xl, padding: spacing.xl, alignItems: 'center' },
  heroBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: colors.black,
    fontSize: 19,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: spacing.md,
  },
  heroPrice: { color: colors.black, fontSize: 40, fontWeight: '900', marginTop: spacing.xs },
  heroBilling: {
    color: 'rgba(0,0,0,0.75)',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 2,
  },
  heroSub: {
    color: 'rgba(0,0,0,0.7)',
    fontSize: 14,
    fontWeight: '800',
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.65)',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.round,
    marginTop: spacing.md,
  },
  activePillText: { color: colors.black, fontWeight: '800', fontSize: 12 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.lg,
  },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '800', marginBottom: spacing.sm },

  compareRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  planCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  planCardCurrent: { borderColor: colors.primary },
  goldCard: { borderColor: colors.gold },
  planName: { color: colors.text, fontSize: 16, fontWeight: '900' },
  goldName: { color: colors.gold },
  planPrice: { color: colors.textSecondary, fontSize: 13, marginTop: 2, marginBottom: spacing.sm },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 5 },
  featureText: { color: colors.textSecondary, fontSize: 12, lineHeight: 17, flex: 1 },
  missing: { color: colors.textMuted, textDecorationLine: 'line-through' },

  demoBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.warning,
    marginTop: spacing.xl,
  },
  demoHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.warning,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  demoHeadText: { color: colors.black, fontSize: 10, fontWeight: '900', letterSpacing: 0.5, flex: 1 },
  demoLine: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: spacing.md },
  demoNote: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: spacing.sm },

  owned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.successSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: colors.success,
  },
  ownedTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  ownedSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },

  cta: { marginTop: spacing.xl },
  honest: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.md, textAlign: 'center' },
  back: { marginTop: spacing.sm },
});

export default PremiumScreen;
