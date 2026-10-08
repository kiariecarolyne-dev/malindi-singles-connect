import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import Avatar from '../../components/Avatar';
import BlurredPhoto from '../../components/BlurredPhoto';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import Screen from '../../components/Screen';
import ScreenHeader from '../../components/ScreenHeader';
import Skeleton from '../../components/Skeleton';
import { useAuth } from '../../context/AuthContext';
import { FREE_VISIBLE_LIKES } from '../../constants/plans';
import { getAreaLabel } from '../../constants/areas';
import { likeService, premiumService, profileService } from '../../services';
import { colors, gradients, radius, spacing } from '../../theme';
import { timeAgo } from '../../utils/time';

/**
 * Likes You.
 *
 * Free members see the first five incoming likes clearly and every later
 * like as a blurred card (name, age, area, compatibility only).
 * 💎 Malindi Gold unblurs every card instantly — hidden likes are never
 * deleted, just locked, so unlocking shows them right away.
 */
const LikedYouScreen = ({ navigation }) => {
  const { user, profile } = useAuth();
  const gold = premiumService.isGold(profile);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [likers, setLikers] = useState([]);
  const [busyUid, setBusyUid] = useState(null);

  const load = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const list = await profileService.getLikedYouProfiles(user.uid);
      setLikers(list);
      setError(null);
    } catch (e) {
      setError(e.message || 'Could not load your likes.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const likeBack = async (p) => {
    setBusyUid(p.uid);
    try {
      const result = await likeService.likeProfile(user.uid, p.uid);
      if (result.matched) {
        navigation.navigate('MatchCelebration', {
          matchId: result.matchId,
          conversationId: result.conversationId,
          otherUid: p.uid,
        });
      } else {
        setLikers((prev) =>
          prev.map((x) => (x.uid === p.uid ? { ...x, likedBack: true } : x)),
        );
      }
    } finally {
      setBusyUid(null);
    }
  };

  const openPaywall = () => navigation.navigate('Premium');

  const openProfile = (p) => {
    // 🔒 a locked like always opens the Gold paywall, never the profile
    if (p.locked) return openPaywall();
    navigation.navigate('ProfileDetail', { uid: p.uid });
  };

  const lockedCount = likers.filter((p) => p.locked).length;

  const renderVisible = (p) => (
    <View key={p.uid} style={styles.row}>
      <TouchableOpacity onPress={() => openProfile(p)}>
        <Avatar uri={p.photos?.[0]} name={p.fullName} size={56} ringColor={colors.primary} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.body} onPress={() => openProfile(p)}>
        <Text style={styles.name}>
          {p.fullName}
          {p.age ? `, ${p.age}` : ''}
        </Text>
        <Text style={styles.sub}>
          {getAreaLabel(p.area)} · liked you {timeAgo(p.likedAt)}
        </Text>
        {p.compatibility ? (
          <Text style={styles.compat}>{p.compatibility}% match with you</Text>
        ) : null}
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.likeBack, p.likedBack && styles.likeBackDone]}
        onPress={() => likeBack(p)}
        disabled={busyUid === p.uid || p.likedBack}
      >
        <Ionicons name="heart" size={15} color={colors.white} />
        <Text style={styles.likeBackText}>
          {p.likedBack ? 'Sent' : busyUid === p.uid ? '…' : 'Like'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderLocked = (p) => (
    <TouchableOpacity key={p.uid} style={styles.row} activeOpacity={0.9} onPress={openPaywall}>
      <BlurredPhoto uri={p.blurredPhoto} width={56} height={56} borderRadius={28} />
      <View style={styles.body}>
        <Text style={styles.lockedName}>
          {p.fullName}, {p.age}
        </Text>
        <Text style={styles.sub}>{getAreaLabel(p.area)} · liked you {timeAgo(p.likedAt)}</Text>
        <Text style={styles.lockedHint}>
          {p.compatibility ? `${p.compatibility}% match · ` : ''}🔒 Locked — Gold reveals this like
        </Text>
      </View>
      <View style={styles.goldPill}>
        <Ionicons name="lock-closed" size={13} color={colors.black} />
        <Text style={styles.goldPillText}>Unlock</Text>
      </View>
    </TouchableOpacity>
  );

  const goldBanner = (
    <LinearGradient
      colors={gradients.gold}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.goldCard}
    >
      <View style={styles.goldIcon}>
        <Ionicons name="diamond" size={18} color={colors.black} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.goldTitle}>{"You've seen your first 5 likes. More people are waiting to connect with you."}</Text>
        <Text style={styles.goldSub}>Unlock Malindi Gold to see everyone who likes you.</Text>
        <Text style={styles.goldMeta}>KSh 100 • One-time payment</Text>
      </View>
      <TouchableOpacity onPress={openPaywall} style={styles.goldBtn} activeOpacity={0.85}>
        <Text style={styles.goldBtnText}>Unlock Malindi Gold</Text>
      </TouchableOpacity>
    </LinearGradient>
  );

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title="Likes You"
        onBack={navigation.canGoBack() ? () => navigation.goBack() : null}
      />
      {loading ? (
        <View style={styles.loading}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={76} style={styles.skel} />
          ))}
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !likers.length ? (
        <EmptyState
          emoji="💘"
          title="No likes waiting"
          message="When someone likes you they show up here — often before they appear in Discover."
          actionLabel="Back to Discover"
          onAction={() => navigation.navigate('MainTabs', { screen: 'Discover' })}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.count}>
            {likers.length} {likers.length === 1 ? 'person likes' : 'people like'} you 💘
          </Text>

          {!gold ? (
            <Text style={styles.limit}>
              Your first {FREE_VISIBLE_LIKES} likes are always free.
              {lockedCount > 0 ? ` ${lockedCount} more ${lockedCount === 1 ? 'is' : 'are'} waiting behind Gold.` : ''}
            </Text>
          ) : (
            <View style={styles.goldBadge}>
              <Ionicons name="diamond" size={13} color={colors.black} />
              <Text style={styles.goldBadgeText}>Malindi Gold — every like unlocked</Text>
            </View>
          )}

          {likers.map((p) => (p.locked ? renderLocked(p) : renderVisible(p)))}

          {!gold && lockedCount > 0 ? goldBanner : null}
        </ScrollView>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  loading: { paddingHorizontal: spacing.lg, gap: spacing.md, marginTop: spacing.md },
  skel: { borderRadius: radius.md },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },

  count: { color: colors.text, fontSize: 16, fontWeight: '800' },
  limit: { color: colors.textMuted, fontSize: 13, marginTop: spacing.xs, marginBottom: spacing.md },
  goldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.gold,
    borderRadius: radius.round,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  goldBadgeText: { color: colors.black, fontWeight: '900', fontSize: 12 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  body: { flex: 1 },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  compat: { color: colors.success, fontSize: 12, marginTop: 3, fontWeight: '700' },

  lockedName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  lockedHint: { color: colors.gold, fontSize: 12, marginTop: 3, fontWeight: '700' },

  goldPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.round,
  },
  goldPillText: { color: colors.black, fontWeight: '900', fontSize: 13 },

  likeBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: radius.round,
  },
  likeBackDone: { backgroundColor: colors.success },
  likeBackText: { color: colors.white, fontWeight: '800', fontSize: 13 },

  goldCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  goldIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goldTitle: { color: colors.black, fontSize: 13, fontWeight: '900', lineHeight: 18 },
  goldSub: { color: 'rgba(0,0,0,0.7)', fontSize: 12, fontWeight: '700', marginTop: 2 },
  goldMeta: { color: 'rgba(0,0,0,0.7)', fontSize: 11, fontWeight: '700', marginTop: 2 },
  goldBtn: {
    backgroundColor: colors.black,
    borderRadius: radius.round,
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
  },
  goldBtnText: { color: colors.gold, fontWeight: '900', fontSize: 13 },
});

export default LikedYouScreen;
