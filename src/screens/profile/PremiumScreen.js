import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import Button from '../../components/Button';
import Screen from '../../components/Screen';
import ScreenHeader from '../../components/ScreenHeader';
import { GOLD, PLANS } from '../../constants/plans';
import { useAuth } from '../../context/AuthContext';
import { premiumService } from '../../services';
import { colors, gradients, radius, spacing } from '../../theme';

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 75000;

/**
 * 💎 Malindi Gold paywall.
 *
 * Gold is a ONE-TIME KSh 100 M-Pesa purchase: no monthly fee, no renewal,
 * no expiry. The backend (Daraja) owns the amount and activates Gold only
 * after a verified successful payment. This screen just collects the phone
 * number and polls for the result — it can never grant Gold.
 */
const PremiumScreen = ({ navigation }) => {
  const { profile, refreshProfile } = useAuth();
  const gold = premiumService.isGold(profile);
  const entitlement = profile?.gold?.isGold ? profile.gold : profile?.premium;

  const [stage, setStage] = useState('idle'); // idle | phone | pending | success | failed | timeout
  const [phone, setPhone] = useState('');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  const pollRef = useRef(null);
  const mountedRef = useRef(true);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      mountedRef.current = false;
      stopPolling();
    },
    [stopPolling],
  );

  const beginPolling = useCallback(
    (paymentId) => {
      stopPolling();
      const startedAt = Date.now();

      pollRef.current = setInterval(async () => {
        if (!mountedRef.current) return;

        if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          stopPolling();
          setStage('timeout');
          setMessage(
            "We couldn't confirm the payment yet. Please check your M-Pesa messages or try again.",
          );
          return;
        }

        try {
          const payment = await premiumService.getGoldPaymentStatus(paymentId);
          if (!payment || !mountedRef.current) return;

          if (payment.gold || payment.status === 'success') {
            stopPolling();
            await refreshProfile();
            if (!mountedRef.current) return;
            setStage('success');
            setMessage('Malindi Gold is active — every like is now unlocked.');
          } else if (payment.status === 'failed') {
            stopPolling();
            setStage('failed');
            setError(
              payment.resultDescription ||
                'The M-Pesa payment did not go through. Gold stays locked and you were not charged for Gold.',
            );
          }
          // status 'pending' -> keep polling
        } catch (_e) {
          // Transient network error — keep polling until the timeout.
        }
      }, POLL_INTERVAL_MS);
    },
    [refreshProfile, stopPolling],
  );

  const startPayment = async () => {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const result = await premiumService.createGoldCheckout(phone.trim());

      if (result.status === 'already_gold') {
        await refreshProfile();
        setStage('success');
        setMessage('Malindi Gold is already active on your account.');
        return;
      }

      setStage('pending');
      setMessage(
        'An M-Pesa payment request has been sent to your phone. Enter your M-Pesa PIN to complete the payment.',
      );
      beginPolling(result.paymentId);
    } catch (e) {
      setStage('failed');
      setError(e.message || 'Could not start the M-Pesa payment. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    stopPolling();
    setStage('idle');
    setPhone('');
    setError(null);
    setMessage(null);
  };

  const { free, premium } = PLANS;
  const activatedOn = entitlement?.goldActivatedAt || entitlement?.since;
  const isGoldActive = gold || stage === 'success';

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
          {isGoldActive ? (
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
          <View style={[styles.planCard, !isGoldActive && styles.planCardCurrent]}>
            <Text style={styles.planName}>{free.name}</Text>
            <Text style={styles.planPrice}>{free.price}</Text>
            <View style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={16} color={colors.gold} />
              <Text style={styles.featureText}>{free.features[0]}</Text>
            </View>
            {free.missing.map((m) => (
              <View key={m} style={styles.featureRow}>
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                <Text style={[styles.featureText, styles.missingText]}>{m}</Text>
              </View>
            ))}
          </View>
          <View style={[styles.planCard, isGoldActive && styles.planCardCurrent]}>
            <Text style={[styles.planName, styles.planNameGold]}>{premium.name}</Text>
            <Text style={styles.planPrice}>{GOLD.priceLabel}</Text>
            {GOLD.benefits.slice(0, 3).map((b) => (
              <View key={b} style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={16} color={colors.gold} />
                <Text style={styles.featureText}>{b}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 💳 Checkout / status */}
        {isGoldActive ? (
          <View style={styles.owned}>
            <Ionicons name="checkmark-circle" size={22} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={styles.ownedTitle}>Malindi Gold is active</Text>
              <Text style={styles.ownedSub}>
                Lifetime access — it never expires.
                {activatedOn ? ` Activated ${new Date(activatedOn).toLocaleDateString()}.` : ''}
              </Text>
            </View>
          </View>
        ) : stage === 'pending' ? (
          <View style={styles.statusCard}>
            <ActivityIndicator color={colors.gold} size="large" />
            <Text style={styles.statusTitle}>Check your phone</Text>
            <Text style={styles.statusText}>{message}</Text>
            <Text style={styles.statusHint}>
              Keep this screen open while we confirm your payment. This can take up to a minute.
            </Text>
            <Button title="Cancel" variant="ghost" onPress={reset} style={styles.statusBtn} />
          </View>
        ) : stage === 'failed' || stage === 'timeout' ? (
          <View style={styles.statusCard}>
            <Ionicons
              name={stage === 'timeout' ? 'time-outline' : 'alert-circle-outline'}
              size={34}
              color={colors.gold}
            />
            <Text style={styles.statusTitle}>
              {stage === 'timeout' ? 'Payment not confirmed yet' : 'Payment not completed'}
            </Text>
            <Text style={styles.statusText}>{error || message}</Text>
            <Button title="Try again" variant="gold" onPress={reset} style={styles.statusBtn} />
          </View>
        ) : stage === 'phone' ? (
          <View style={styles.phoneCard}>
            <Text style={styles.phoneLabel}>M-Pesa phone number</Text>
            <TextInput
              style={styles.phoneInput}
              value={phone}
              onChangeText={setPhone}
              placeholder="07XXXXXXXX"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              maxLength={13}
              editable={!busy}
              autoFocus
            />
            <Text style={styles.phoneHint}>
              {GOLD.name}: {GOLD.priceLabel} ({GOLD.billingLabel.toLowerCase()}). You will receive
              an M-Pesa prompt on this number.
            </Text>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Button
              title="Pay KSh 100"
              variant="gold"
              icon="phone-portrait-outline"
              onPress={startPayment}
              loading={busy}
              disabled={phone.trim().length < 9 || busy}
              style={styles.payBtn}
            />
            <Button title="Cancel" variant="ghost" onPress={reset} disabled={busy} />
          </View>
        ) : (
          <>
            <Button
              title={GOLD.unlockCta}
              variant="gold"
              icon="diamond"
              onPress={() => setStage('phone')}
              style={styles.cta}
            />
            <Text style={styles.honest}>
              {GOLD.closing} You pay KSh 100 once via M-Pesa — Gold is unlocked only after the
              payment is confirmed.
            </Text>
          </>
        )}

        <Button title="Back" variant="ghost" onPress={() => navigation.goBack()} style={styles.back} />
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
  planCardCurrent: { borderColor: colors.gold },
  planName: { color: colors.text, fontSize: 15, fontWeight: '800' },
  planNameGold: { color: colors.gold },
  planPrice: { color: colors.textSecondary, fontSize: 13, marginTop: 2, marginBottom: spacing.sm },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  featureText: { color: colors.textSecondary, fontSize: 13, flex: 1, lineHeight: 18 },
  missingText: { color: colors.textMuted, textDecorationLine: 'line-through' },

  owned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.success,
    marginTop: spacing.lg,
  },
  ownedTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  ownedSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2, lineHeight: 17 },

  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.gold,
    marginTop: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusTitle: { color: colors.text, fontSize: 17, fontWeight: '900', textAlign: 'center' },
  statusText: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  statusHint: { color: colors.textMuted, fontSize: 11, textAlign: 'center', lineHeight: 16 },
  statusBtn: { alignSelf: 'stretch', marginTop: spacing.sm },

  phoneCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.gold,
    marginTop: spacing.lg,
  },
  phoneLabel: { color: colors.text, fontSize: 14, fontWeight: '800', marginBottom: spacing.sm },
  phoneInput: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  phoneHint: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: spacing.sm },
  errorText: { color: colors.danger, fontSize: 13, marginTop: spacing.sm },
  payBtn: { marginTop: spacing.md },

  cta: { marginTop: spacing.xl },
  honest: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  back: { marginTop: spacing.xl },
});

export default PremiumScreen;