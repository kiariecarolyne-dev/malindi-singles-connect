import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import Button from '../../components/Button';
import Screen from '../../components/Screen';
import { GOLD } from '../../constants/plans';
import { colors, gradients, radius, spacing } from '../../theme';

const HIGHLIGHTS = [
  { icon: 'heart', text: 'See who likes you.' },
  { icon: 'diamond', text: 'Join Gold Circle.' },
  { icon: 'people', text: 'Connect. Share. Meet. Belong.' },
];

/**
 * 💛 Free members never see Gold Circle content — this paywall replaces the
 * screen entirely. The button opens the existing PremiumScreen / M-Pesa
 * flow; Gold is still granted only by the backend.
 */
const GoldCircleUpgrade = ({ navigation }) => (
  <Screen edges={['top']}>
    <View style={styles.header}>
      {navigation.canGoBack() ? (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.back}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
      ) : (
        <View style={styles.back} />
      )}
      <View style={styles.headerCenter} />
      <View style={styles.back} />
    </View>

    <View style={styles.wrap}>
      <LinearGradient
        colors={gradients.gold}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroBadge}>
          <Text style={styles.heroEmoji}>💛</Text>
        </View>
        <Text style={styles.heroTitle}>GOLD CIRCLE</Text>
        <Text style={styles.heroSub}>An exclusive community for Malindi Gold members.</Text>
      </LinearGradient>

      <Text style={styles.body}>
        Connect with other Gold members, share experiences, discuss relationships and celebrate
        connections.
      </Text>

      <View style={styles.highlights}>
        {HIGHLIGHTS.map((h) => (
          <View key={h.text} style={styles.highlightRow}>
            <View style={styles.highlightIcon}>
              <Ionicons name={h.icon} size={15} color={colors.gold} />
            </View>
            <Text style={styles.highlightText}>{h.text}</Text>
          </View>
        ))}
      </View>

      <View style={styles.priceCard}>
        <Text style={styles.priceTitle}>Unlock Malindi Gold</Text>
        <Text style={styles.price}>
          {GOLD.priceLabel} • {GOLD.billing === 'one_time' ? 'One-time payment' : GOLD.billingLabel}
        </Text>
      </View>

      <Button
        title="Unlock Malindi Gold"
        variant="gold"
        icon="diamond"
        onPress={() => navigation.navigate('Premium')}
        style={styles.cta}
      />
      <Text style={styles.note}>
        Gold Circle is reserved for Malindi Gold members. Your Gold membership is activated only
        after the M-Pesa payment is confirmed.
      </Text>
    </View>
  </Screen>
);

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerCenter: { flex: 1 },
  back: { width: 32 },

  wrap: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },

  hero: { borderRadius: radius.xl, padding: spacing.xl, alignItems: 'center' },
  heroBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEmoji: { fontSize: 30 },
  heroTitle: {
    color: colors.black,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginTop: spacing.md,
  },
  heroSub: {
    color: 'rgba(0,0,0,0.75)',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: spacing.xs,
  },

  body: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: spacing.xl,
  },

  highlights: { marginTop: spacing.xl, gap: spacing.md },
  highlightRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  highlightIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightText: { color: colors.text, fontSize: 15, fontWeight: '700' },

  priceCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gold,
    paddingVertical: spacing.lg,
    marginTop: spacing.xl,
  },
  priceTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  price: { color: colors.gold, fontSize: 14, fontWeight: '800', marginTop: spacing.xs },

  cta: { marginTop: spacing.lg },
  note: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});

export default GoldCircleUpgrade;
