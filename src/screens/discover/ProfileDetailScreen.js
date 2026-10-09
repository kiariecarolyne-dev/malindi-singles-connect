import React, { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import ActiveDot from '../../components/ActiveDot';
import Avatar from '../../components/Avatar';
import BlurredPhoto from '../../components/BlurredPhoto';
import Button from '../../components/Button';
import Chip from '../../components/Chip';
import { VerifiedBadge } from '../../components/Badge';
import ErrorState from '../../components/ErrorState';
import Screen from '../../components/Screen';
import ScreenHeader from '../../components/ScreenHeader';
import { getAreaLabel } from '../../constants/areas';
import { getIntention } from '../../constants/datingIntentions';
import { getInterestsByIds } from '../../constants/interests';
import { useAuth } from '../../context/AuthContext';
import { likeService, matchService, premiumService, profileService } from '../../services';
import { profileAge } from '../../utils/age';
import { compatibilityScore } from '../../utils/compatibility';
import { haversineKm, shortDistance } from '../../utils/distance';
import { isActiveRecently } from '../../utils/time';
import { colors, radius, spacing } from '../../theme';

const { width: SCREEN_W } = Dimensions.get('window');

const ProfileDetailScreen = ({ navigation, route }) => {
  const { user, profile: me } = useAuth();
  const uid = route?.params?.uid;

  const [other, setOther] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [myLike, setMyLike] = useState(null);
  const [theyLikedMe, setTheyLikedMe] = useState(false);
  const [matchState, setMatchState] = useState(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [actionBusy, setActionBusy] = useState(false);
  // 🔒 true when this person likes you but you are still on the free tier
  const [photoLocked, setPhotoLocked] = useState(false);

  const load = useCallback(async () => {
    if (!uid) return;
    try {
      const p = await profileService.getProfile(uid);
      if (!p) {
        setError('This profile is no longer available.');
        setOther(null);
        return;
      }
      setOther(p);
      const [mine, theirs, canView] = await Promise.all([
        likeService.getLikeFrom(user.uid, uid),
        likeService.getLikeFrom(uid, user.uid),
        premiumService.canViewFullProfile(user.uid, uid),
      ]);
      setMyLike(mine);
      setTheyLikedMe(theirs && theirs.type === 'like');
      setPhotoLocked(!canView);
      setMatchState(await matchService.findMatchBetween(user.uid, uid));
      setError(null);
    } catch (e) {
      setError(e.message || 'Could not load this profile.');
    } finally {
      setLoading(false);
    }
  }, [uid, user]);

  useEffect(() => {
    // Async fetch: every setState inside load() runs after await, never
    // synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const retry = () => {
    setLoading(true);
    setError(null);
    load();
  };

  const handleLike = async () => {
    setActionBusy(true);
    try {
      const result = await likeService.likeProfile(user.uid, uid);
      setMyLike({ type: 'like' });
      if (result.matched) {
        setMatchState({ id: result.matchId, conversationId: result.conversationId });
        navigation.navigate('MatchCelebration', { matchId: result.matchId, otherUid: uid });
      }
    } catch {
      setError('Could not save your like. Please try again.');
    } finally {
      setActionBusy(false);
    }
  };

  const handlePass = async () => {
    setActionBusy(true);
    try {
      await likeService.passProfile(user.uid, uid);
      setMyLike({ type: 'pass' });
    } catch {
      setError('Could not save your pass. Please try again.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleBlock = async () => {
    try {
      await profileService.blockUser(user.uid, uid);
      navigation.goBack();
    } catch {
      setError('Could not block this user.');
    }
  };

  if (loading) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Profile" onBack={() => navigation.goBack()} />
        <View style={styles.loadingBox}>
          <Text style={styles.loadingText}>Loading profile…</Text>
        </View>
      </Screen>
    );
  }

  if (error && !other) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Profile" onBack={() => navigation.goBack()} />
        <ErrorState message={error} onRetry={retry} />
      </Screen>
    );
  }

  const age = profileAge(other);
  const intention = getIntention(other.datingIntention);
  const interests = getInterestsByIds(other.interests);
  const active = isActiveRecently(other.lastActiveAt);
  const verified = other.verification?.status === 'verified';
  const km =
    other.showLocation === false || !other.location || !me?.location
      ? null
      : haversineKm(me.location.lat, me.location.lng, other.location.lat, other.location.lng);
  const compat = me ? compatibilityScore(other, me) : 0;
  const shared = me ? interests.filter((i) => (me.interests || []).includes(i.id)) : [];
  const alreadyLiked = myLike?.type === 'like';
  const alreadyPassed = myLike?.type === 'pass';

  // 🔒 Free tier: this person likes you, so their photos, bio and interests
  // stay hidden behind the Gold unlock (no way around it via deep links).
  if (photoLocked) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Someone likes you" onBack={() => navigation.goBack()} />
        <View style={styles.lockBox}>
          <BlurredPhoto
            uri={other.photos?.[0]}
            width={168}
            height={210}
            label="🔒 Locked"
          />
          <Text style={styles.lockTitle}>
            {other.fullName}
            {age > 0 ? `, ${age}` : ''}
          </Text>
          <Text style={styles.lockSub}>{getAreaLabel(other.area)}</Text>
          <Text style={styles.lockBody}>
            This person already likes you — but their photos, bio and interests stay private on the
            free tier. Unlock with 💎 Malindi Gold to see everything and match instantly.
          </Text>
          <Button
            title="Unlock for KSh 100"
            variant="gold"
            icon="diamond"
            onPress={() => navigation.navigate('Premium')}
            style={{ alignSelf: 'stretch' }}
          />
          <Button
            title="Back"
            variant="ghost"
            onPress={() => navigation.goBack()}
            style={{ alignSelf: 'stretch' }}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title={`${other.fullName}, ${age > 0 ? age : ''}`}
        subtitle={active ? 'Active now' : 'Active recently'}
        onBack={() => navigation.goBack()}
        rightIcon="ellipsis-horizontal"
        onRightPress={() => navigation.navigate('Report', { uid, name: other.fullName })}
        rightColor={colors.textSecondary}
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
        <View style={styles.gallery}>
          <FlatList
            data={other.photos?.length ? other.photos : [null]}
            keyExtractor={(item, i) => `${item || 'none'}_${i}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) =>
              setPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))
            }
            renderItem={({ item }) =>
              item ? (
                <Image source={{ uri: item }} style={styles.photo} fadeDuration={200} />
              ) : (
                <View style={[styles.photo, styles.photoEmpty]}>
                  <Avatar uri={null} name={other.fullName} size={90} />
                </View>
              )
            }
          />
          <LinearGradient colors={['transparent', 'rgba(10,15,30,0.75)']} style={styles.photoFade} />
          {other.photos?.length > 1 ? (
            <View style={styles.dots}>
              {other.photos.map((_, i) => (
                <View key={i} style={[styles.dot, i === photoIndex && styles.dotActive]} />
              ))}
            </View>
          ) : null}
          <View style={styles.badgeRow}>
            {compat > 0 ? (
              <View style={styles.compatBadge}>
                <Ionicons name="sparkles" size={13} color={colors.gold} />
                <Text style={styles.compatBadgeText}>{compat}% match</Text>
              </View>
            ) : null}
            {km != null ? (
              <View style={styles.distanceBadge}>
                <Ionicons name="navigate" size={12} color={colors.white} />
                <Text style={styles.distanceBadgeText}>{shortDistance(km)} away</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>
              {other.fullName}, {age > 0 ? age : ''}
            </Text>
            {verified ? <VerifiedBadge /> : null}
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="location" size={14} color={colors.primary} />
            <Text style={styles.meta}>{getAreaLabel(other.area)}</Text>
            <View style={styles.metaGap} />
            {active ? <ActiveDot label="Active now" size="sm" /> : <Text style={styles.metaMuted}>Active recently</Text>}
          </View>
          <View style={styles.intentionPill}>
            <Text style={styles.intentionText}>
              {intention.emoji} {intention.label}
            </Text>
          </View>
        </View>

        {other.bio ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>About {other.fullName}</Text>
            <Text style={styles.bio}>“{other.bio}”</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Interests</Text>
          <View style={styles.chips}>
            {interests.map((i) => (
              <Chip key={i.id} label={i.label} emoji={i.emoji} small />
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>❤️ {compat}% compatible</Text>
          {shared.length ? (
            <>
              <Text style={styles.sharedLabel}>You both like:</Text>
              <View style={styles.chips}>
                {shared.map((i) => (
                  <Chip key={i.id} label={i.label} emoji={i.emoji} small selected />
                ))}
              </View>
            </>
          ) : (
            <Text style={styles.sharedLabel}>Different interests can be exciting — say hi!</Text>
          )}
          <Text style={styles.compatNote}>A fun indicator, not a guarantee 😉</Text>
        </View>

        <View style={styles.actions}>
          {!matchState ? (
            alreadyLiked ? (
              <View style={styles.likedBox}>
                <Ionicons name="heart" size={18} color={colors.primary} />
                <Text style={styles.likedText}>
                  {theyLikedMe ? 'You both like each other!' : `You liked ${other.fullName} — waiting for a match`}
                </Text>
              </View>
            ) : alreadyPassed ? (
              <View style={styles.passedBox}>
                <Ionicons name="remove-circle" size={18} color={colors.textMuted} />
                <Text style={styles.passedText}>You passed on this profile</Text>
              </View>
            ) : (
              <View style={styles.likeRow}>
                <Button
                  title="Pass"
                  variant="secondary"
                  icon="close"
                  onPress={handlePass}
                  loading={actionBusy}
                  style={styles.passAction}
                />
                <Button title="Like" icon="heart" onPress={handleLike} loading={actionBusy} style={styles.likeAction} />
              </View>
            )
          ) : (
            <Button
              title="💬 Open chat"
              icon="chatbubble"
              onPress={() => navigation.navigate('Chat', { matchId: matchState.id, conversationId: matchState.conversationId || other.uid })}
            />
          )}
        </View>

        <View style={styles.safetyRow}>
          <TouchableOpacity style={styles.safetyBtn} onPress={handleBlock} activeOpacity={0.75}>
            <Ionicons name="ban-outline" size={16} color={colors.danger} />
            <Text style={styles.safetyText}>Block</Text>
          </TouchableOpacity>
          <View style={styles.safetyDivider} />
          <TouchableOpacity
            style={styles.safetyBtn}
            onPress={() => navigation.navigate('Report', { uid, name: other.fullName })}
            activeOpacity={0.75}
          >
            <Ionicons name="flag-outline" size={16} color={colors.warning} />
            <Text style={styles.safetyText}>Report</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.safetyNote}>
          🛡️ Meet in public, tell a friend, and never share money or passwords.
        </Text>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  lockBox: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    gap: spacing.sm,
  },
  lockTitle: { color: colors.text, fontSize: 22, fontWeight: '900', marginTop: spacing.lg },
  lockSub: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  lockBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginVertical: spacing.lg,
  },
  loadingBox: { padding: spacing.xxl, alignItems: 'center' },
  loadingText: { color: colors.textSecondary },
  gallery: { height: SCREEN_W * 1.15 },
  photo: { width: SCREEN_W, height: SCREEN_W * 1.15, backgroundColor: colors.surface },
  photoEmpty: { alignItems: 'center', justifyContent: 'center' },
  photoFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 80 },
  dots: { position: 'absolute', bottom: spacing.md, alignSelf: 'center', flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { backgroundColor: colors.primary, width: 18 },
  badgeRow: { position: 'absolute', bottom: spacing.xl, left: spacing.lg, flexDirection: 'row', gap: spacing.sm },
  compatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: 'rgba(255,197,66,0.45)',
  },
  compatBadgeText: { color: colors.gold, fontSize: 12, fontWeight: '800', marginLeft: 4 },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.round,
  },
  distanceBadgeText: { color: colors.white, fontSize: 12, fontWeight: '700', marginLeft: 4 },
  section: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  name: { color: colors.text, fontSize: 24, fontWeight: '900' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  meta: { color: colors.textSecondary, fontSize: 14, fontWeight: '600', marginLeft: 4 },
  metaGap: { width: spacing.md },
  metaMuted: { color: colors.textMuted, fontSize: 12 },
  intentionPill: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.round,
  },
  intentionText: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  card: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  cardLabel: { color: colors.text, fontSize: 15, fontWeight: '800', marginBottom: spacing.sm },
  bio: { color: colors.textSecondary, fontSize: 15, lineHeight: 23, fontStyle: 'italic' },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  sharedLabel: { color: colors.textSecondary, fontSize: 13, marginBottom: spacing.sm },
  compatNote: { color: colors.textMuted, fontSize: 11, marginTop: spacing.sm, fontStyle: 'italic' },
  actions: { marginHorizontal: spacing.lg, marginTop: spacing.xl },
  likeRow: { flexDirection: 'row', gap: spacing.md },
  passAction: { flex: 1 },
  likeAction: { flex: 1.4 },
  likedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  likedText: { color: colors.primary, fontSize: 14, fontWeight: '700', flex: 1 },
  passedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  passedText: { color: colors.textMuted, fontSize: 14, flex: 1 },
  safetyRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  safetyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md, gap: 6 },
  safetyText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
  safetyDivider: { width: StyleSheet.hairlineWidth, backgroundColor: colors.borderStrong },
  safetyNote: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    lineHeight: 18,
  },
});

export default ProfileDetailScreen;
