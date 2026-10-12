import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import { CardSkeleton } from '../../components/Skeleton';
import ProfileCard from '../../components/ProfileCard';
import Screen from '../../components/Screen';
import SwipeDeck from '../../components/SwipeDeck';
import { LIMITS } from '../../config/env';
import { getAreaLabel } from '../../constants/areas';
import { useAuth } from '../../context/AuthContext';
import { likeService, premiumService, profileService } from '../../services';
import { compatibilityScore } from '../../utils/compatibility';
import { haversineKm } from '../../utils/distance';
import { colors, radius, spacing, gradients } from '../../theme';

const REASON = profileService.DISCOVER_REASON || {};
const INCOMPLETE = REASON.incompleteProfile || 'incomplete-profile';

const EMPTY_INFO = { reason: REASON.ok || 'ok', missing: [], diagnostics: null };

const dedupeByUid = (list) => {
  const seen = new Set();
  const out = [];
  list.forEach((item) => {
    if (!item || seen.has(item.uid)) return;
    seen.add(item.uid);
    out.push(item);
  });
  return out;
};

/**
 * The heart of the app: a swipe deck of nearby compatible singles.
 *
 * The deck comes from `getDiscoverDeck`, which also reports *why* it is empty.
 * An incomplete own profile (missing gender / who-you-want-to-meet) is shown
 * as its own actionable state instead of the generic "you have seen everyone"
 * — both used to be byte-identical empty screens.
 */
const DiscoverScreen = ({ navigation }) => {
  const { user, profile } = useAuth();
  const [deckState, setDeckState] = useState({ items: [], key: 0, ...EMPTY_INFO });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [exhausted, setExhausted] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [toast, setToast] = useState(null);

  const deckRef = useRef([]);
  const requestedPageRef = useRef(0);

  const { items: deck, reason, missing, diagnostics } = deckState;
  const { key: deckKey } = deckState;
  const isGold = premiumService.isGold(profile);

  const loadPage = useCallback(
    async (nextPage, append = false) => {
      if (!user?.uid) return;
      requestedPageRef.current = append
        ? Math.max(requestedPageRef.current, nextPage)
        : nextPage;
      try {
        const result = await profileService.getDiscoverDeck(user.uid, { page: nextPage });
        const batch = result?.profiles || [];
        if (__DEV__) {
          console.log('[Discover]', result?.reason, result?.diagnostics);
        }
        setDeckState((prev) => {
          const nextItems = append ? dedupeByUid([...prev.items, ...batch]) : batch;
          deckRef.current = nextItems;
          return {
            items: nextItems,
            key: append ? prev.key : prev.key + 1,
            reason: result?.reason || REASON.ok || 'ok',
            missing: result?.missing || [],
            diagnostics: result?.diagnostics || null,
          };
        });
        setPage(nextPage);
        setExhausted(batch.length < LIMITS.discoverPageSize);
        setError(null);
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
      const nextPage = page + 1;
      if (!exhausted && remaining > 0 && remaining <= 3 && nextPage > requestedPageRef.current) {
        loadPage(nextPage, true);
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

  const retry = () => {
    requestedPageRef.current = 0;
    setLoading(true);
    loadPage(0);
  };

  const distanceFor = (p) => {
    if (p.showLocation === false || !p.location || !profile?.location) return null;
    return haversineKm(profile.location.lat, profile.location.lng, p.location.lat, p.location.lng);
  };

  const renderCard = (cardProfile, direction, stamps) => (
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
      {stamps ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[styles.stamp, styles.stampLike, { opacity: stamps.like }]}
          >
            <Text style={[styles.stampText, { color: colors.success }]}>LIKE</Text>
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[styles.stamp, styles.stampPass, { opacity: stamps.nope }]}
          >
            <Text style={[styles.stampText, { color: colors.danger }]}>NOPE</Text>
          </Animated.View>
        </>
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
        accessibilityRole="button"
        accessibilityLabel="Pass"
      >
        <Ionicons name="close" size={32} color={colors.textSecondary} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.infoBtn, disabled && styles.actionDisabled]}
        onPress={() => currentProfile && navigation.navigate('ProfileDetail', { uid: currentProfile.uid })}
        disabled={disabled}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="View full profile"
      >
        <Ionicons name="information" size={22} color={colors.info} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionBtn, styles.likeBtn, disabled && styles.actionDisabled]}
        onPress={() => swipe('right')}
        disabled={disabled}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Like"
      >
        <LinearGradient
          colors={gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.likeGradient}
        >
          <Ionicons name="heart" size={30} color={colors.white} />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  const renderBody = () => {
    if (loading) {
      return (
        <View style={styles.loadingWrap}>
          <CardSkeleton />
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Finding singles around Malindi…</Text>
          </View>
        </View>
      );
    }

    if (error) {
      return <ErrorState message={error} onRetry={retry} />;
    }

    if (reason === INCOMPLETE) {
      const labels = missing.map((field) => MISSING_LABELS[field] || field);
      return (
        <EmptyState
          emoji="🪪"
          title="Finish your profile to see matches"
          message={`We can only match you once we know ${labels.join(
            ' and ',
          )}. Add it to your profile and your deck will fill up.`}
          actionLabel="Go to my profile"
          onAction={() => navigation.navigate('Profile')}
        />
      );
    }

    if (deck.length === 0) {
      return (
        <EmptyState
          emoji="🌅"
          title="You have seen everyone for now"
          message="New singles join every day. Meanwhile, try Quick Match or see who is active right now around Malindi."
          actionLabel="⚡ Try Quick Match"
          onAction={() => navigation.navigate('Active')}
        />
      );
    }

    return (
      <SwipeDeck
        key={deckKey}
        profiles={deck}
        onLike={handleLike}
        onPass={handlePass}
        onIndexChange={handleIndexChange}
        renderCard={renderCard}
        actions={renderActions}
      />
    );
  };

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Discover</Text>
          <Text style={styles.subtitle}>
            ❤️ Singles around {getAreaLabel(profile?.area)} · tap a card for the full profile
          </Text>
        </View>
        {__DEV__ ? (
          <TouchableOpacity
            style={[styles.iconBtn, showDebug && styles.iconBtnActive]}
            onPress={() => setShowDebug((v) => !v)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Toggle discovery diagnostics"
          >
            <Ionicons name="bug" size={18} color={showDebug ? colors.primary : colors.textSecondary} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={retry}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Refresh deck"
        >
          <Ionicons name="refresh" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {isGold ? (
        <View style={styles.goldActive}>
          <Ionicons name="checkmark-circle" size={16} color={colors.gold} />
          <Text style={styles.goldActiveText}>Malindi Gold active — see everyone who likes you</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.goldStrip}
          activeOpacity={0.9}
          onPress={() => navigation.navigate('Premium')}
          accessibilityRole="button"
          accessibilityLabel="Unlock Malindi Gold"
        >
          <LinearGradient
            colors={gradients.gold}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.goldStripInner}
          >
            <Ionicons name="sparkles" size={16} color={colors.black} />
            <View style={styles.goldStripText}>
              <Text style={styles.goldStripTitle}>MALINDI GOLD</Text>
              <Text style={styles.goldStripSub} numberOfLines={1}>
                See who likes you · KSh 100
              </Text>
            </View>
            <View style={styles.goldStripCta}>
              <Text style={styles.goldStripCtaText}>Unlock</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.black} />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.circleStrip}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('GoldCircle')}
        accessibilityRole="button"
        accessibilityLabel="Explore Gold Circle"
      >
        <Ionicons name="chatbubbles" size={16} color={colors.gold} />
        <View style={styles.circleStripText}>
          <Text style={styles.circleStripTitle} numberOfLines={1}>
            💛 GOLD CIRCLE
          </Text>
          <Text style={styles.circleStripSub} numberOfLines={1}>
            {isGold ? 'You’re a Gold member — join the conversation' : 'Premium community for Gold members'}
          </Text>
        </View>
        <Text style={styles.circleStripCta}>{isGold ? 'Enter' : '🔒 Explore'}</Text>
      </TouchableOpacity>

      {__DEV__ && showDebug ? (
        <DiagnosticsPanel reason={reason} diagnostics={diagnostics} missing={missing} />
      ) : null}

      <View style={styles.body}>{renderBody()}</View>

      {toast ? (
        <View style={[styles.toast, toast.tone === 'error' && styles.toastError]}>
          <Text style={styles.toastText}>{toast.text}</Text>
        </View>
      ) : null}
    </Screen>
  );
};

const MISSING_LABELS = {
  gender: 'your gender',
  interestedIn: 'who you want to meet',
  profile: 'a completed profile',
};

/** Dev-only panel: shows exactly where the discovery pipeline lost members. */
const DiagnosticsPanel = ({ reason, diagnostics, missing }) => {
  const dropped = diagnostics?.dropped || {};
  const rows = [
    ['reason', reason],
    ['my gender', diagnostics?.myGender ?? '—'],
    ['my interestedIn', (diagnostics?.myInterestedIn || []).join(', ') || '—'],
    ['my age range', (diagnostics?.myAgeRange || []).join('–') || '—'],
    ['profiles scanned', diagnostics?.scanned ?? '—'],
    ['matched', diagnostics?.matched ?? '—'],
    ['already seen', dropped.alreadySeen ?? '—'],
    ['blocked / hidden', dropped.blockedOrHidden ?? '—'],
    ['suspended', dropped.suspended ?? '—'],
    ['not my type', dropped.notMyType ?? '—'],
    ['not reciprocal', dropped.notReciprocal ?? '—'],
    ['missing age', dropped.missingAge ?? '—'],
    ['out of age range', dropped.outOfAgeRange ?? '—'],
  ];
  return (
    <View style={styles.debug}>
      <Text style={styles.debugTitle}>Discovery diagnostics (dev)</Text>
      {missing?.length ? <Text style={styles.debugMissing}>missing: {missing.join(', ')}</Text> : null}
      {rows.map(([label, value]) => (
        <View key={label} style={styles.debugRow}>
          <Text style={styles.debugKey}>{label}</Text>
          <Text style={styles.debugValue}>{String(value)}</Text>
        </View>
      ))}
      <Text style={styles.debugHint}>
        “missing age” means a profile has neither age nor dateOfBirth; “not my type” means the
        member’s gender is outside your “who you want to meet”.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  headerText: { flex: 1, paddingRight: spacing.sm },
  title: { color: colors.text, fontSize: 26, fontWeight: '900' },
  subtitle: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  iconBtnActive: { borderColor: colors.primary },
  body: { flex: 1 },

  goldStrip: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  goldStripInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  goldStripText: { flex: 1 },
  goldStripTitle: { color: colors.black, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  goldStripSub: { color: 'rgba(0,0,0,0.72)', fontSize: 11, fontWeight: '700', marginTop: 1 },
  goldStripCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(255,255,255,0.55)',
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.round,
  },
  goldStripCtaText: { color: colors.black, fontSize: 11, fontWeight: '900' },
  goldActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gold,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  goldActiveText: { color: colors.gold, fontSize: 12, fontWeight: '800', flex: 1 },

  circleStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  circleStripText: { flex: 1 },
  circleStripTitle: { color: colors.gold, fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  circleStripSub: { color: colors.textSecondary, fontSize: 11, marginTop: 1 },
  circleStripCta: { color: colors.gold, fontSize: 12, fontWeight: '900' },

  debug: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.backgroundAlt,
  },
  debugTitle: { color: colors.primary, fontSize: 12, fontWeight: '900', marginBottom: spacing.xs },
  debugMissing: { color: colors.danger, fontSize: 11, fontWeight: '700', marginBottom: spacing.xs },
  debugRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 1 },
  debugKey: { color: colors.textMuted, fontSize: 11 },
  debugValue: { color: colors.text, fontSize: 11, fontWeight: '700' },
  debugHint: { color: colors.textMuted, fontSize: 10, lineHeight: 14, marginTop: spacing.xs },

  cardHost: { flex: 1 },
  cardTouch: { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent' },
  stamp: {
    position: 'absolute',
    top: 96,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 3,
  },
  stampLike: { left: 24, borderColor: colors.success, transform: [{ rotate: '-14deg' }] },
  stampPass: { right: 24, borderColor: colors.danger, transform: [{ rotate: '14deg' }] },
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
    overflow: 'hidden',
  },
  likeBtn: { backgroundColor: colors.primary },
  likeGradient: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  passBtn: { backgroundColor: colors.surfaceLight, borderWidth: 2, borderColor: colors.borderStrong },
  infoBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(77,163,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(77,163,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionDisabled: { opacity: 0.4 },

  loadingWrap: { flex: 1, paddingTop: spacing.lg },
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
