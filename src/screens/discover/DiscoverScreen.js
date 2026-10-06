import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import { CardSkeleton } from '../../components/Skeleton';
import ProfileCard from '../../components/ProfileCard';
import Screen from '../../components/Screen';
import SwipeDeck from '../../components/SwipeDeck';
import { LIMITS } from '../../config/env';
import { getAreaLabel } from '../../constants/areas';
import { useAuth } from '../../context/AuthContext';
import { likeService, profileService } from '../../services';
import { compatibilityScore } from '../../utils/compatibility';
import { haversineKm } from '../../utils/distance';
import { colors, radius, spacing } from '../../theme';

/**
 * The heart of the app: swipe/pass/like deck of nearby compatible singles.
 */
const DiscoverScreen = ({ navigation }) => {
  const { user, profile } = useAuth();
  const [deck, setDeck] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [exhausted, setExhausted] = useState(false);
  const [toast, setToast] = useState(null);
  const [deckKey, setDeckKey] = useState(0);
  const deckRef = useRef([]);

  const loadPage = useCallback(
    async (nextPage, append = false) => {
      if (!user?.uid) return;
      try {
        const batch = await profileService.getDiscoverProfiles(user.uid, { page: nextPage });
        setDeck((prev) => {
          const next = append ? [...prev, ...batch] : batch;
          deckRef.current = next;
          return next;
        });
        setPage(nextPage);
        setExhausted(batch.length < LIMITS.discoverPageSize);
        setError(null);
        if (!append) setDeckKey((k) => k + 1);
      } catch (e) {
        setError(e.message || 'Could not load profiles right now.');
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  useEffect(() => {
    loadPage(0);
  }, [loadPage]);

  const showToast = (text, tone = 'default') => {
    setToast({ text, tone });
    setTimeout(() => setToast(null), 2200);
  };

  const handleIndexChange = useCallback(
    (index) => {
      const remaining = deckRef.current.length - index;
      if (!exhausted && remaining > 0 && remaining <= 3) {
        loadPage(page + 1, true);
      }
    },
    [exhausted, loadPage, page],
  );

  const handlePass = async (passedProfile) => {
    try {
      await likeService.passProfile(user.uid, passedProfile.uid);
    } catch {
      showToast('Could not save your pass — check connection.', 'error');
    }
  };

  const handleLike = async (likedProfile) => {
    try {
      const result = await likeService.likeProfile(user.uid, likedProfile.uid);
      if (result.matched) {
        navigation.navigate('MatchCelebration', {
          matchId: result.matchId,
          otherUid: likedProfile.uid,
        });
      } else {
        showToast(`❤️ You liked ${likedProfile.fullName}!`);
      }
    } catch {
      showToast('Could not save your like — check connection.', 'error');
    }
  };

  const distanceFor = (p) => {
    if (p.showLocation === false || !p.location || !profile?.location) return null;
    return haversineKm(profile.location.lat, profile.location.lng, p.location.lat, p.location.lng);
  };

  const renderCard = (cardProfile, direction) => (
    <View style={styles.cardHost}>
      <ProfileCard
        profile={cardProfile}
        distanceKm={distanceFor(cardProfile)}
        compatibility={compatibilityScore(cardProfile, profile)}
      />
      <TouchableOpacity
        style={styles.cardTouch}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('ProfileDetail', { uid: cardProfile.uid })}
      />
      {direction === 'right' ? (
        <View style={[styles.stamp, styles.stampLike]}>
          <Text style={[styles.stampText, { color: colors.primary }]}>LIKE</Text>
        </View>
      ) : null}
      {direction === 'left' ? (
        <View style={[styles.stamp, styles.stampPass]}>
          <Text style={[styles.stampText, { color: colors.textSecondary }]}>PASS</Text>
        </View>
      ) : null}
    </View>
  );

  const renderActions = ({ swipe, currentProfile, disabled }) => (
    <View style={styles.actionRow}>
      <TouchableOpacity
        style={[styles.actionBtn, styles.passBtn, disabled && styles.actionDisabled]}
        onPress={() => swipe('left')}
        disabled={disabled}
        activeOpacity={0.8}
      >
        <Ionicons name="close" size={30} color={colors.textSecondary} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.infoBtn, disabled && styles.actionDisabled]}
        onPress={() => currentProfile && navigation.navigate('ProfileDetail', { uid: currentProfile.uid })}
        disabled={disabled}
        activeOpacity={0.8}
      >
        <Ionicons name="information" size={22} color={colors.info} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionBtn, styles.likeBtn, disabled && styles.actionDisabled]}
        onPress={() => swipe('right')}
        disabled={disabled}
        activeOpacity={0.8}
      >
        <Ionicons name="heart" size={30} color={colors.white} />
      </TouchableOpacity>
    </View>
  );

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Discover</Text>
          <Text style={styles.subtitle}>
            ❤️ Singles around {getAreaLabel(profile?.area)} · tap a card for full profile
          </Text>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => {
            setLoading(true);
            loadPage(0);
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="refresh" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <CardSkeleton />
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.loadingText}>Finding singles around Malindi…</Text>
            </View>
          </View>
        ) : error ? (
          <ErrorState
            message={error}
            onRetry={() => {
              setLoading(true);
              loadPage(0);
            }}
          />
        ) : deck.length === 0 ? (
          <EmptyState
            emoji="🌅"
            title="You have seen everyone for now"
            message="New singles join every day. Meanwhile, try Quick Match or see who is active right now around Malindi."
            actionLabel="⚡ Try Quick Match"
            onAction={() => navigation.navigate('Active')}
          />
        ) : (
          <SwipeDeck
            key={deckKey}
            profiles={deck}
            onLike={handleLike}
            onPass={handlePass}
            onIndexChange={handleIndexChange}
            renderCard={renderCard}
            actions={renderActions}
          />
        )}
      </View>

      {toast ? (
        <View style={[styles.toast, toast.tone === 'error' && styles.toastError]}>
          <Text style={styles.toastText}>{toast.text}</Text>
        </View>
      ) : null}
    </Screen>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerText: { flex: 1, paddingRight: spacing.md },
  title: { color: colors.text, fontSize: 26, fontWeight: '900' },
  subtitle: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  cardHost: { flex: 1 },
  cardTouch: { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent' },
  stamp: {
    position: 'absolute',
    top: 90,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 3,
    opacity: 0.92,
  },
  stampLike: { left: 24, borderColor: colors.primary, transform: [{ rotate: '-14deg' }] },
  stampPass: { right: 24, borderColor: colors.textSecondary, transform: [{ rotate: '14deg' }] },
  stampText: { fontSize: 26, fontWeight: '900', letterSpacing: 2 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  actionBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  passBtn: { backgroundColor: colors.surfaceLight, borderWidth: 2, borderColor: colors.borderStrong },
  likeBtn: { backgroundColor: colors.primary },
  infoBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(77,163,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(77,163,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionDisabled: { opacity: 0.4 },
  loadingWrap: { flex: 1, paddingTop: spacing.xl },
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: spacing.xl },
  loadingText: { color: colors.textSecondary, fontSize: 13, marginLeft: spacing.md },
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
  toastError: { borderColor: colors.danger },
  toastText: { color: colors.text, fontSize: 13, fontWeight: '700' },
});

export default DiscoverScreen;
