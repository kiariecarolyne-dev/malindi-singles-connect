import React, { useCallback, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';

import Avatar from '../../components/Avatar';
import BlurredPhoto from '../../components/BlurredPhoto';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import SectionHeader from '../../components/SectionHeader';
import { ListSkeleton } from '../../components/Skeleton';
import Screen from '../../components/Screen';
import { getAreaLabel } from '../../constants/areas';
import { useAuth } from '../../context/AuthContext';
import { matchService, profileService } from '../../services';
import { shortDistance } from '../../utils/distance';
import { isActiveRecently } from '../../utils/time';
import { colors, gradients, radius, shadows, spacing } from '../../theme';

/**
 * 🔥 Active tab — the lively dashboard:
 * Active Now, Singles Near You, Quick Match, matches/likes/messages teasers.
 */
const ActiveScreen = ({ navigation }) => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [active, setActive] = useState([]);
  const [nearby, setNearby] = useState([]);
  const [matches, setMatches] = useState([]);
  const [likedYou, setLikedYou] = useState([]);

  const load = useCallback(async () => {
    if (!user?.uid) return;
    setError(null);
    try {
      const [activeList, nearbyList, matchList, likeList] = await Promise.all([
        profileService.getActiveProfiles(user.uid, 12),
        profileService.getNearbyProfiles(user.uid, 8),
        matchService.getMatches(user.uid),
        profileService.getLikedYouProfiles(user.uid),
      ]);
      setActive(activeList);
      setNearby(nearbyList);
      setMatches(matchList);
      setLikedYou(likeList);
    } catch (e) {
      setError(e.message || 'Could not load nearby singles.');
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

  const areaLabel = getAreaLabel(profile?.area);
  const activeCount = active.length;
  const likedFaces = likedYou.filter((p) => !p.locked).slice(0, 3);
  const lockedRows = likedYou.filter((p) => p.locked);
  const lockedLikes = lockedRows.length;

  if (error && !loading) {
    return (
      <Screen edges={['top']}>
        <View style={styles.headerWrap}>
          <Text style={styles.title}>Active</Text>
        </View>
        <ErrorState message={error} onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xxxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.headerWrap}>
          <Text style={styles.title}>Active</Text>
          <Text style={styles.subtitle}>
            {"What's happening around "}
            {areaLabel}
            {' right now'}
          </Text>
        </View>

        {/* 🟢 Active Now */}
        <View style={styles.activeCard}>
          <LinearGradient colors={['rgba(46,213,115,0.18)', 'rgba(77,163,255,0.10)']} style={styles.activeGradient}>
            <View style={styles.activeTopRow}>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
              <Text style={styles.activeCount}>
                {loading ? '…' : activeCount} {activeCount === 1 ? 'single is' : 'singles are'} active around {areaLabel}
              </Text>
            </View>

            {loading ? (
              <ListSkeleton rows={2} />
            ) : active.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.avatarRow}>
                {active.map((p) => (
                  <TouchableOpacity
                    key={p.uid}
                    style={styles.avatarItem}
                    onPress={() => navigation.navigate('ProfileDetail', { uid: p.uid })}
                    activeOpacity={0.8}
                  >
                    <Avatar uri={p.photos?.[0]} name={p.fullName} size={62} ringColor={colors.success} />
                    <Text style={styles.avatarName} numberOfLines={1}>
                      {p.fullName}
                    </Text>
                    <Text style={styles.avatarMeta}>
                      {isActiveRecently(p.lastActiveAt) ? 'now' : 'today'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.quietText}>Not many active singles right now. Check again soon 🔥</Text>
            )}

            <TouchableOpacity
              style={styles.viewAll}
              onPress={() => navigation.navigate('Discover')}
              activeOpacity={0.8}
            >
              <Text style={styles.viewAllText}>View active singles</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.success} />
            </TouchableOpacity>
          </LinearGradient>
        </View>

        {/* ⚡ Quick Match */}
        <View style={styles.quickCard}>
          <LinearGradient colors={gradients.premium} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.quickGradient}>
            <Text style={styles.quickEmoji}>⚡</Text>
            <Text style={styles.quickTitle}>Quick Match</Text>
            <Text style={styles.quickSub}>
              Compatible, nearby and recently active — we pick someone great for you right now.
            </Text>
            <TouchableOpacity
              style={styles.quickBtn}
              activeOpacity={0.85}
              onPress={() => runQuickMatch(navigation, user.uid)}
            >
              <Ionicons name="flash" size={18} color={colors.black} />
              <Text style={styles.quickBtnText}>FIND ME SOMEONE NOW</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>

        {/* 📍 Singles Near You */}
        <SectionHeader
          title="Singles Near You"
          emoji="📍"
          subtitle="Approximate distance only — nobody sees exact locations"
        />
        {loading ? (
          <ListSkeleton rows={3} />
        ) : nearby.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nearbyRow}>
            {nearby.map((p) => (
              <TouchableOpacity
                key={p.uid}
                style={styles.nearbyCard}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('ProfileDetail', { uid: p.uid })}
              >
                <Avatar uri={p.photos?.[0]} name={p.fullName} size={74} />
                <Text style={styles.nearbyName} numberOfLines={1}>
                  {p.fullName}
                </Text>
                <View style={styles.nearbyDistance}>
                  <Ionicons name="navigate" size={10} color={colors.primary} />
                  <Text style={styles.nearbyDistanceText}>
                    {p.distanceKm != null ? shortDistance(p.distanceKm) : 'Nearby'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <EmptyState emoji="📍" title="No one nearby yet" message="Try widening your age range in Edit Profile." />
        )}

        {/* ❤️ Your Matches */}
        <SectionHeader
          title="Your Matches"
          emoji="❤️"
          actionLabel={matches.length ? 'Open' : undefined}
          onAction={matches.length ? () => navigation.navigate('Matches') : undefined}
        />
        {loading ? (
          <ListSkeleton rows={1} />
        ) : matches.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nearbyRow}>
            {matches.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={styles.nearbyCard}
                activeOpacity={0.85}
                onPress={() =>
                  navigation.navigate('Chat', {
                    matchId: m.id,
                    conversationId: m.conversationId || m.otherProfile.uid,
                  })
                }
              >
                <Avatar uri={m.otherProfile.photos?.[0]} name={m.otherProfile.fullName} size={74} ringColor={colors.primary} />
                <Text style={styles.nearbyName} numberOfLines={1}>
                  {m.otherProfile.fullName}
                </Text>
                <Text style={styles.matchPct}>{m.compatibility}% match</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <EmptyState
            emoji="🌅"
            title="No new matches yet ❤️"
            message="Your next connection could be nearby — keep discovering."
            actionLabel="Go to Discover"
            onAction={() => navigation.navigate('Discover')}
          />
        )}

        {/* 👀 People who liked you */}
        <SectionHeader title="People Who Liked You" emoji="👀" />
        <TouchableOpacity style={styles.likedCard} activeOpacity={0.85} onPress={() => navigation.navigate('LikedYou')}>
          <View style={styles.likedFaces}>
            {likedFaces.map((p, i) => (
              <View key={p.uid} style={[styles.likedFace, { marginLeft: i === 0 ? 0 : -14 }]}>
                <Avatar uri={p.photos?.[0]} name={p.fullName} size={44} ringColor={colors.background} />
              </View>
            ))}
            {lockedLikes > 0 ? (
              <View style={[styles.likedFace, { marginLeft: likedFaces.length ? -14 : 0 }]}>
                <BlurredPhoto uri={lockedRows[0]?.blurredPhoto} width={44} height={44} borderRadius={22} />
              </View>
            ) : null}
          </View>
          <View style={styles.likedTextWrap}>
            <Text style={styles.likedTitle}>
              {likedYou.length ? `${likedYou.length} ${likedYou.length === 1 ? 'person likes' : 'people like'} you` : 'No likes yet'}
            </Text>
            <Text style={styles.likedSub}>
              {!likedYou.length
                ? 'Someone new could appear any moment'
                : lockedLikes > 0
                  ? `${lockedLikes} locked — unlock them with Malindi Gold`
                  : 'Like them back to match instantly'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {/* 💬 New messages teaser */}
        <SectionHeader title="New Messages" emoji="💬" />
        <TouchableOpacity style={styles.likedCard} activeOpacity={0.85} onPress={() => navigation.navigate('Matches')}>
          <View style={styles.msgIcon}>
            <Ionicons name="chatbubbles" size={22} color={colors.primary} />
          </View>
          <View style={styles.likedTextWrap}>
            <Text style={styles.likedTitle}>
              {matches.length ? `${matches.length} conversation${matches.length === 1 ? '' : 's'} going` : 'Start your first conversation'}
            </Text>
            <Text style={styles.likedSub}>
              {matches.length ? 'Open a match and send an icebreaker' : 'Match with someone to start chatting'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </ScrollView>
    </Screen>
  );
};

/** Helper: run ⚡ Quick Match and open the winning profile. */
const runQuickMatch = async (navigation, uid) => {
  try {
    const result = await matchService.quickMatch(uid);
    if (result) {
      navigation.navigate('ProfileDetail', { uid: result.profile.uid, quickMatch: true });
    } else {
      navigation.navigate('Discover');
    }
  } catch {
    navigation.navigate('Discover');
  }
};

const styles = StyleSheet.create({
  headerWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xs },
  title: { color: colors.text, fontSize: 26, fontWeight: '900' },
  subtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  activeCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadows.soft,
  },
  activeGradient: { padding: spacing.lg, borderRadius: radius.xl, borderWidth: 1, borderColor: 'rgba(46,213,115,0.25)' },
  activeTopRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(46,213,115,0.2)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.round,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success, marginRight: 5 },
  liveText: { color: colors.success, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  activeCount: { color: colors.text, fontSize: 14, fontWeight: '700', flex: 1 },
  avatarRow: { paddingVertical: spacing.md, gap: spacing.lg },
  avatarItem: { alignItems: 'center', width: 70 },
  avatarName: { color: colors.text, fontSize: 12, fontWeight: '700', marginTop: 6 },
  avatarMeta: { color: colors.success, fontSize: 10, fontWeight: '600' },
  quietText: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', paddingVertical: spacing.lg },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: spacing.xs },
  viewAllText: { color: colors.success, fontSize: 13, fontWeight: '800' },
  quickCard: { marginHorizontal: spacing.lg, marginTop: spacing.lg, borderRadius: radius.xl, overflow: 'hidden', ...shadows.card },
  quickGradient: { padding: spacing.xl, alignItems: 'center' },
  quickEmoji: { fontSize: 34 },
  quickTitle: { color: colors.white, fontSize: 22, fontWeight: '900', marginTop: spacing.xs },
  quickSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, textAlign: 'center', marginTop: spacing.sm, lineHeight: 19 },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.round,
    marginTop: spacing.lg,
  },
  quickBtnText: { color: colors.black, fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  nearbyRow: { paddingHorizontal: spacing.lg, gap: spacing.md },
  nearbyCard: {
    width: 96,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
  },
  nearbyName: { color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 8, maxWidth: 86 },
  nearbyDistance: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  nearbyDistanceText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  matchPct: { color: colors.gold, fontSize: 11, fontWeight: '800', marginTop: 3 },
  likedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  likedFaces: { flexDirection: 'row', marginRight: spacing.md },
  likedFace: { borderRadius: 24, borderWidth: 2, borderColor: colors.surface },
  likedTextWrap: { flex: 1, marginRight: spacing.sm },
  likedTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  likedSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  msgIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
});

export default ActiveScreen;
