import React, { useCallback, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import Screen from '../../components/Screen';
import ScreenHeader from '../../components/ScreenHeader';
import Skeleton from '../../components/Skeleton';
import { REPORT_REASONS } from '../../constants/reportReasons';
import { useAuth } from '../../context/AuthContext';
import { adminService, notificationService, profileService, reportService } from '../../services';
import { getVerificationSelfieUrl } from '../../services/backend/verificationService';
import { colors, radius, spacing } from '../../theme';
import { timeAgo } from '../../utils/time';

const TABS = ['Overview', 'Reports', 'Verifications'];

const AdminScreen = () => {
  const { isAdmin, user } = useAuth();
  const [tab, setTab] = useState('Overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [reports, setReports] = useState([]);
  const [pending, setPending] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    try {
      const [s, r, v] = await Promise.all([
        adminService.getStats(),
        reportService.getReports(),
        profileService.getPendingVerifications(),
      ]);
      const withNames = await Promise.all(
        r.map(async (rep) => ({
          ...rep,
          target: await profileService.getProfile(rep.targetUid),
          reporter: await profileService.getProfile(rep.fromUid),
        })),
      );
      // Selfies live in a private bucket: fetch a short-lived signed URL per
      // pending member. The backend re-checks the reviewer role on every call.
      const pendingWithSelfies = await Promise.all(
        v.map(async (p) => {
          try {
            const { url } = await getVerificationSelfieUrl(p.uid);
            return { ...p, selfieUrl: url };
          } catch {
            return p;
          }
        }),
      );
      setStats(s);
      setReports(withNames);
      setPending(pendingWithSelfies);
      setError(null);
    } catch (e) {
      setError(e.message || 'Could not load moderation data.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const resolve = async (rep, status) => {
    setBusy(true);
    try {
      await reportService.resolveReport(rep.id, status, user.uid);
      setReports((prev) => prev.filter((x) => x.id !== rep.id));
      setStats((s) => (s ? { ...s, openReports: Math.max(0, s.openReports - 1) } : s));
    } finally {
      setBusy(false);
    }
  };

  const suspendTarget = (rep) => {
    Alert.alert(
      'Suspend this profile?',
      `${rep.target?.fullName || 'This user'} will be signed out and hidden from everyone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Suspend',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await profileService.setSuspended(rep.targetUid, true);
              await reportService.resolveReport(rep.id, 'actioned', user.uid);
              setReports((prev) => prev.filter((x) => x.id !== rep.id));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const decideVerification = async (p, approved) => {
    setBusy(true);
    try {
      await profileService.updateProfile(p.uid, {
        verification: { ...(p.verification || {}), status: approved ? 'verified' : 'rejected' },
      });
      await notificationService.createNotification({
        uid: p.uid,
        type: 'verification',
        title: approved ? 'You are verified ✓' : 'Verification needs another try',
        body: approved
          ? 'Your selfie matched your photos. The blue badge is now on your profile.'
          : 'We could not match your selfie clearly enough — please resubmit in better light.',
      });
      setPending((prev) => prev.filter((x) => x.uid !== p.uid));
      setStats((s) =>
        s ? { ...s, pendingVerifications: Math.max(0, s.pendingVerifications - 1) } : s,
      );
    } finally {
      setBusy(false);
    }
  };

  if (!isAdmin) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Admin" />
        <EmptyState
          emoji="🔒"
          title="Admins only"
          message="Sign in with the demo admin account to open moderation tools."
        />
      </Screen>
    );
  }

  const statCards = stats
    ? [
        { label: 'Members', value: stats.users, icon: 'people' },
        { label: 'Active today', value: stats.activeToday, icon: 'pulse' },
        { label: 'Open reports', value: stats.openReports, icon: 'flag', alert: stats.openReports > 0 },
        { label: 'Pending reviews', value: stats.pendingVerifications, icon: 'time', alert: stats.pendingVerifications > 0 },
        { label: 'Matches', value: stats.matches, icon: 'heart' },
        { label: 'Messages', value: stats.messages, icon: 'chatbubbles' },
        { label: 'Suspended', value: stats.suspended, icon: 'ban' },
      ]
    : [];

  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Admin Moderation" subtitle="Demo admin console" />

      <View style={styles.tabs}>
        {TABS.map((t) => {
          const on = tab === t;
          const count = t === 'Reports' ? reports.filter((r) => r.status === 'open').length : t === 'Verifications' ? pending.length : null;
          return (
            <TouchableOpacity key={t} style={[styles.tab, on && styles.tabOn]} onPress={() => setTab(t)}>
              <Text style={[styles.tabText, on && styles.tabTextOn]}>
                {t}
                {count != null && count > 0 ? ` (${count})` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.loading}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={92} style={styles.skel} />
          ))}
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {tab === 'Overview' ? (
            <View style={styles.grid}>
              {statCards.map((s) => (
                <View key={s.label} style={styles.statCard}>
                  <Ionicons name={s.icon} size={18} color={s.alert ? colors.danger : colors.primary} />
                  <Text style={styles.statValue}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {tab === 'Reports' ? (
            !reports.filter((r) => r.status === 'open').length ? (
              <EmptyState
                emoji="✅"
                title="Queue is clear"
                message="No open reports. New user reports appear here instantly."
              />
            ) : (
              reports
                .filter((r) => r.status === 'open')
                .map((r) => {
                  const reason = REPORT_REASONS.find((x) => x.id === r.reason);
                  return (
                    <View key={r.id} style={styles.card}>
                      <View style={styles.cardHead}>
                        <Text style={styles.reason}>
                          {reason?.emoji} {reason?.label || r.reason}
                        </Text>
                        <Text style={styles.time}>{timeAgo(r.createdAt)}</Text>
                      </View>
                      <View style={styles.personRow}>
                        <Avatar uri={r.target?.photos?.[0]} name={r.target?.fullName} size={38} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.personName}>{r.target?.fullName || 'Unknown user'}</Text>
                          <Text style={styles.personSub}>
                            reported by {r.reporter?.fullName || 'a member'}
                          </Text>
                        </View>
                      </View>
                      {r.details ? <Text style={styles.details}>{r.details}</Text> : null}
                      <View style={styles.actions}>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.dismissBtn]}
                          onPress={() => resolve(r, 'dismissed')}
                          disabled={busy}
                        >
                          <Text style={styles.dismissText}>Dismiss</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.suspendBtn]}
                          onPress={() => suspendTarget(r)}
                          disabled={busy}
                        >
                          <Ionicons name="ban" size={14} color={colors.white} />
                          <Text style={styles.suspendText}>Suspend user</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
            )
          ) : null}

          {tab === 'Verifications' ? (
            !pending.length ? (
              <EmptyState
                emoji="🪪"
                title="No selfies waiting"
                message="When members submit photo verification, they appear here for approval."
              />
            ) : (
              pending.map((p) => (
                <View key={p.uid} style={styles.card}>
                  <View style={styles.personRow}>
                    <Avatar uri={p.photos?.[0]} name={p.fullName} size={54} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.personName}>{p.fullName}</Text>
                      <Text style={styles.personSub}>selfie submitted · {timeAgo(p.createdAt)}</Text>
                    </View>
                  </View>
                  {p.selfieUrl ? (
                    <Image source={{ uri: p.selfieUrl }} style={styles.selfie} resizeMode="cover" />
                  ) : (
                    <View style={styles.selfieEmpty}>
                      <Ionicons name="image-outline" size={22} color={colors.textMuted} />
                      <Text style={styles.selfieEmptyText}>
                        {p.verificationSelfiePath ? 'Selfie could not be loaded' : 'No selfie on file'}
                      </Text>
                    </View>
                  )}
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.approveBtn]}
                      onPress={() => decideVerification(p, true)}
                      disabled={busy}
                    >
                      <Ionicons name="checkmark" size={15} color={colors.black} />
                      <Text style={styles.approveText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.dismissBtn]}
                      onPress={() => decideVerification(p, false)}
                      disabled={busy}
                    >
                      <Text style={styles.dismissText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.round,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  tabText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
  tabTextOn: { color: colors.primary },

  loading: { paddingHorizontal: spacing.lg, gap: spacing.md },
  skel: { borderRadius: radius.md },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  statValue: { color: colors.text, fontSize: 26, fontWeight: '900' },
  statLabel: { color: colors.textMuted, fontSize: 12 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reason: { color: colors.text, fontSize: 15, fontWeight: '800' },
  time: { color: colors.textMuted, fontSize: 11 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  personName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  personSub: { color: colors.textMuted, fontSize: 12, marginTop: 1, textTransform: 'capitalize' },

  selfie: {
    width: '100%',
    height: 220,
    borderRadius: radius.lg,
    marginTop: spacing.md,
    backgroundColor: colors.backgroundAlt,
  },
  selfieEmpty: {
    width: '100%',
    height: 96,
    borderRadius: radius.lg,
    marginTop: spacing.md,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  selfieEmptyText: { color: colors.textMuted, fontSize: 12 },
  details: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.md,
    backgroundColor: colors.backgroundAlt,
    borderRadius: radius.md,
    padding: spacing.sm,
  },

  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 42,
    borderRadius: radius.md,
  },
  dismissBtn: { borderWidth: 1, borderColor: colors.borderStrong },
  dismissText: { color: colors.textSecondary, fontWeight: '700', fontSize: 14 },
  suspendBtn: { backgroundColor: colors.danger },
  suspendText: { color: colors.white, fontWeight: '800', fontSize: 14 },
  approveBtn: { backgroundColor: colors.gold },
  approveText: { color: colors.black, fontWeight: '800', fontSize: 14 },
});

export default AdminScreen;
