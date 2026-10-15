import React, { useCallback, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import { ListSkeleton } from '../../components/Skeleton';
import Screen from '../../components/Screen';
import { getAreaLabel } from '../../constants/areas';
import { useAuth } from '../../context/AuthContext';
import { matchService, profileService } from '../../services';
import { profileAge } from '../../utils/age';
import { isActiveRecently } from '../../utils/time';
import { colors, radius, shadows, spacing } from '../../theme';

const REASON = profileService.DISCOVER_REASON || {};

const MISSING_LABELS = {
  gender: 'your gender',
  interestedIn: 'who you want to meet',
  profile: 'a completed profile',
};

/**
 * 🔥 Active Singles — a plain, scrollable browse list.
 *
 * Replaces the old swipe deck. Every eligible single (gender + age
 * preferences, adult-only, not blocked/suspended) is listed, newest-active
 * first. Tapping a row opens the full profile where the Like lives.
 */
const ActiveScreen = ({ navigation }) => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [singles, setSingles] = useState([]);
  const [reason, setReason] = useState(REASON.ok || 'ok');
  const [missing, setMissing] = useState([]);
  const [quickBusy, setQuickBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    if (!user?.uid) return;
    setError(null);
    try {
      const result = await profileService.getActiveSingles(user.uid, { take: 60 });
      setSingles(result?.profiles || []);
      setReason(result?.reason || REASON.ok || 'ok');
      setMissing(result?.missing || []);
    } catch (e) {
      setError(e.message || 'Could not load singles right now.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const showToast = (text) => {
    setToast(text);
    setTimeout(() => setToast(null), 2400);
  };

  const openProfile = (uid) => navigation.navigate('ProfileDetail', { uid });

  const runQuickMatch = async () => {
    if (quickBusy || !user?.uid) return;
    setQuickBusy(true);
    try {
      const result = await matchService.quickMatch(user.uid);
      if (result?.profile?.uid) {
        navigation.navigate('ProfileDetail', { uid: result.profile.uid, quickMatch: true });
      } else {
        showToast('No quick match right now — try again in a moment.');
      }
    } catch {
      showToast('Could not run Quick Match. Check your connection.');
    } finally {
      setQuickBusy(false);
    }
  };

  const areaLabel = getAreaLabel(profile?.area);

  const renderItem = ({ item }) => {
    const active = isActiveRecently(item.lastActiveAt);
    const age = profileAge(item);
    const firstName = (item.fullName || 'Member').trim().split(/\s+/)[0];
    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.85}
        onPress={() => openProfile(item.uid)}
        accessibilityRole="button"
        accessibilityLabel={`View ${firstName}'s profile`}
      >
        <Avatar
          uri={item.photos?.[0]}
          name={item.fullName}
          size={64}
          ringColor={active ? colors.success : undefined}
        />
        <View style={styles.rowBody}>
          <Text style={styles.rowName} numberOfLines={1}>
            {firstName}
            {age > 0 ? `, ${age}` : ''}
          </Text>
          <View style={styles.rowMeta}>
            <Ionicons name="location" size={12} color={colors.primary} />
            <Text style={styles.rowArea} numberOfLines={1}>
              {getAreaLabel(item.area)}
            </Text>
          </View>
          {active ? (
            <View style={styles.activeRow}>
              <View style={styles.activeDot} />
              <Text style={styles.activeText}>Active now</Text>
            </View>
          ) : (
            <Text style={styles.rowMuted}>Active recently</Text>
          )}
        </View>
        <View style={styles.viewBtn}>
          <Text style={styles.viewBtnText}>View</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.white} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (reason === REASON.incompleteProfile) {
      const labels = missing.map((field) => MISSING_LABELS[field] || field);
      return (
        <EmptyState
          emoji="🪪"
          title="Finish your profile to see singles"
          message={`We can only show you people once we know ${labels.join(
            ' and ',
          )}. Add it to your profile and they will appear here.`}
          actionLabel="Go to my profile"
          onAction={() => navigation.navigate('Profile')}
        />
      );
    }
    return (
      <EmptyState
        emoji="🌅"
        title="No singles to show yet"
        message="New singles join every day — pull down to refresh, or check back soon."
      />
    );
  };

  return (
    <Screen edges={['top']}>
      <View style={styles.headerWrap}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Active Singles</Text>
          <Text style={styles.subtitle}>Eligible singles around {areaLabel}</Text>
        </View>
        <TouchableOpacity
          style={[styles.quickBtn, quickBusy && styles.quickBtnBusy]}
          activeOpacity={0.85}
          onPress={runQuickMatch}
          disabled={quickBusy}
          accessibilityRole="button"
          accessibilityLabel="Quick match"
        >
          <Ionicons name="flash" size={15} color={colors.black} />
          <Text style={styles.quickBtnText}>{quickBusy ? '…' : 'Quick Match'}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ListSkeleton rows={5} />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <FlatList
          data={singles}
          keyExtractor={(item) => item.uid}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={singles.length ? styles.listContent : styles.emptyContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        />
      )}

      {toast ? (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </Screen>
  );
};

const styles = StyleSheet.create({
  headerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerText: { flex: 1, paddingRight: spacing.sm },
  title: { color: colors.text, fontSize: 26, fontWeight: '900' },
  subtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.round,
  },
  quickBtnBusy: { opacity: 0.6 },
  quickBtnText: { color: colors.black, fontSize: 13, fontWeight: '900' },

  loadingWrap: { paddingTop: spacing.sm },
  listContent: { paddingBottom: spacing.xxl },
  emptyContent: { flexGrow: 1, justifyContent: 'center' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.soft,
  },
  rowBody: { flex: 1 },
  rowName: { color: colors.text, fontSize: 17, fontWeight: '800' },
  rowMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  rowArea: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  rowMuted: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  activeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
    marginRight: 5,
  },
  activeText: { color: colors.success, fontSize: 12, fontWeight: '700' },

  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.round,
  },
  viewBtnText: { color: colors.white, fontSize: 13, fontWeight: '800' },
  separator: { height: spacing.sm },

  toast: {
    position: 'absolute',
    bottom: spacing.xl,
    alignSelf: 'center',
    backgroundColor: colors.surfaceHigh,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  toastText: { color: colors.text, fontSize: 13, fontWeight: '700' },
});

export default ActiveScreen;
