import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import Avatar from '../../components/Avatar';
import { StatusPill } from '../../components/Badge';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import Screen from '../../components/Screen';
import Skeleton from '../../components/Skeleton';
import { getMeetActivity, MEET_SAFETY_RULES, PUBLIC_PLACES } from '../../constants/meet';
import { useAuth } from '../../context/AuthContext';
import { matchService, meetupService } from '../../services';
import { colors, gradients, radius, spacing } from '../../theme';

const STATUS_LABELS = {
  pending: { label: 'Waiting', tone: 'default' },
  accepted: { label: 'Confirmed', tone: 'success' },
  declined: { label: 'Declined', tone: 'danger' },
};

const MeetScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [matches, setMatches] = useState([]);
  const [plans, setPlans] = useState([]);

  const load = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const [ms, meets] = await Promise.all([
        matchService.getMatches(user.uid),
        meetupService.getMeetupsFor(user.uid),
      ]);
      setMatches(ms);
      setPlans(meets);
      setError(null);
    } catch (e) {
      setError(e.message || 'Could not load meet plans.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const respond = async (plan, status) => {
    await meetupService.respondMeetup(plan.id, status, user.uid);
    load();
  };

  const planOf = (plan) => {
    const activity = getMeetActivity(plan.activityId);
    const place = PUBLIC_PLACES.find((p) => p.id === plan.placeId);
    const incoming = plan.toUid === user.uid;
    const otherUid = incoming ? plan.fromUid : plan.toUid;
    return { activity, place, incoming, otherUid };
  };

  const renderPlan = (plan) => {
    const { activity, place, incoming } = planOf(plan);
    const status = STATUS_LABELS[plan.status] || STATUS_LABELS.pending;
    const canRespond = incoming && plan.status === 'pending';
    const otherMatch = matches.find((m) => m.otherUid === planOf(plan).otherUid);
    const other = otherMatch?.otherProfile;

    return (
      <View key={plan.id} style={styles.planCard}>
        <View style={styles.planTop}>
          <Text style={styles.planEmoji}>{activity.emoji}</Text>
          <View style={styles.planBody}>
            <Text style={styles.planTitle}>
              {activity.label} · {plan.timeLabel}
            </Text>
            <Text style={styles.planPlace}>📍 {place?.label || 'Public place'}</Text>
            <Text style={styles.planWho}>
              {incoming ? `From ${other?.fullName || 'someone'}` : `To ${other?.fullName || 'them'}`}
            </Text>
          </View>
          <StatusPill label={status.label} tone={status.tone} />
        </View>

        {canRespond ? (
          <View style={styles.planActions}>
            <TouchableOpacity style={styles.declineBtn} onPress={() => respond(plan, 'declined')}>
              <Text style={styles.declineText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.acceptBtn} onPress={() => respond(plan, 'accepted')}>
              <LinearGradient colors={gradients.primary} style={styles.acceptGradient}>
                <Ionicons name="checkmark" size={16} color={colors.white} />
                <Text style={styles.acceptText}>Accept</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <Screen edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#2A0F2B', colors.background]} style={styles.hero}>
          <Text style={styles.heroTitle}>Meet Today ☀️</Text>
          <Text style={styles.heroSub}>
            Coffee, a beach walk, dinner — pick a match and meet in a safe public place today.
          </Text>
        </LinearGradient>

        {loading ? (
          <View style={styles.loading}>
            {[0, 1].map((i) => (
              <Skeleton key={i} height={96} style={styles.skelCard} />
            ))}
          </View>
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <>
            {plans.length ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Your plans</Text>
                {plans.map(renderPlan)}
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Matches open to meet</Text>
              {matches.length ? (
                matches.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    style={styles.matchRow}
                    onPress={() =>
                      navigation.navigate('MeetPlan', {
                        otherUid: m.otherUid,
                        matchId: m.id,
                        otherName: m.otherProfile?.fullName,
                      })
                    }
                  >
                    <Avatar uri={m.otherProfile?.photos?.[0]} name={m.otherProfile?.fullName} size={52} />
                    <View style={styles.matchBody}>
                      <Text style={styles.matchName}>{m.otherProfile?.fullName}</Text>
                      <Text style={styles.matchSub}>Tap to plan a meetup →</Text>
                    </View>
                    <View style={styles.planPill}>
                      <Text style={styles.planPillText}>Plan</Text>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <EmptyState
                  emoji="🗓️"
                  title="No matches to meet yet"
                  message="When you match with someone, plan a public meetup right here."
                  actionLabel="Go to Discover"
                  onAction={() => navigation.navigate('Discover')}
                />
              )}
            </View>

            <View style={styles.safetyCard}>
              <View style={styles.safetyHead}>
                <Ionicons name="shield-checkmark" size={18} color={colors.success} />
                <Text style={styles.safetyTitle}>Safety first — every time</Text>
              </View>
              {MEET_SAFETY_RULES.map((rule) => (
                <View key={rule.id} style={styles.ruleRow}>
                  <Text style={styles.ruleBullet}>•</Text>
                  <Text style={styles.ruleText}>{rule.text}</Text>
                </View>
              ))}
              <Text style={styles.safetyNote}>
                Only public places from this app are suggested — never share your home address.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl },

  hero: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xl },
  heroTitle: { color: colors.text, fontSize: 26, fontWeight: '900' },
  heroSub: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginTop: spacing.sm },

  loading: { paddingHorizontal: spacing.lg, gap: spacing.md, marginTop: spacing.md },
  skelCard: { borderRadius: radius.lg },

  section: { marginTop: spacing.xl, paddingHorizontal: spacing.lg },
  sectionTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },

  planCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  planTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  planEmoji: { fontSize: 30 },
  planBody: { flex: 1 },
  planTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  planPlace: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  planWho: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  planActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  declineBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  declineText: { color: colors.textSecondary, fontWeight: '700', fontSize: 14 },
  acceptBtn: { flex: 1, borderRadius: radius.md, overflow: 'hidden' },
  acceptGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 42,
  },
  acceptText: { color: colors.white, fontWeight: '800', fontSize: 14 },

  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  matchBody: { flex: 1 },
  matchName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  matchSub: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  planPill: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.round,
  },
  planPillText: { color: colors.primary, fontWeight: '800', fontSize: 13 },

  safetyCard: {
    margin: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.successSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(46, 213, 115, 0.35)',
  },
  safetyHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  safetyTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  ruleRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 4 },
  ruleBullet: { color: colors.success, fontSize: 14, fontWeight: '800' },
  ruleText: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, flex: 1 },
  safetyNote: { color: colors.textMuted, fontSize: 12, marginTop: spacing.md, fontStyle: 'italic' },
});

export default MeetScreen;
