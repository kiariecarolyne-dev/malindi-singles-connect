import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import ActiveDot from './ActiveDot';
import { VerifiedBadge } from './Badge';
import { getAreaLabel } from '../constants/areas';
import { getIntention } from '../constants/datingIntentions';
import { getInterestsByIds } from '../constants/interests';
import { profileAge } from '../utils/age';
import { shortDistance } from '../utils/distance';
import { isActiveRecently } from '../utils/time';
import { colors, radius, shadows, spacing } from '../theme';

const MAX_INTEREST_CHIPS = 3;

/**
 * The big discovery card: a full-bleed photo with a bottom scrim carrying the
 * identity, area, intention and interests. Falls back to a gradient + initials
 * panel whenever a member has no photo (or the image fails to load) so the deck
 * never shows an empty shell.
 */
const ProfileCard = ({ profile, distanceKm, compatibility, showDistance = true }) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const photoUri = typeof profile?.photos?.[0] === 'string' ? profile.photos[0] : null;
  const showPhoto = Boolean(photoUri) && loaded && !failed;
  const initials =
    (profile?.fullName || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase() || '?';

  const age = profileAge(profile);
  const intention = getIntention(profile?.datingIntention);
  const interests = getInterestsByIds(profile?.interests);
  const visibleInterests = interests.slice(0, MAX_INTEREST_CHIPS);
  const extraInterests = Math.max(0, interests.length - visibleInterests.length);
  const active = isActiveRecently(profile?.lastActiveAt);
  const verified = profile?.verification?.status === 'verified';

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={[colors.surfaceLight, colors.surfaceHigh]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.photoFallback}
      >
        <View style={styles.initialsCircle}>
          <Text style={styles.initialsText}>{initials}</Text>
        </View>
      </LinearGradient>

      <Image
        source={photoUri ? { uri: photoUri } : undefined}
        style={[styles.photo, { opacity: showPhoto ? 1 : 0 }]}
        resizeMode="cover"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        fadeDuration={200}
      />

      <LinearGradient colors={['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.28)', 'rgba(6,9,18,0.96)']} locations={[0.35, 0.62, 1]} style={styles.scrim} />

      <View style={styles.topRow}>
        {compatibility != null ? (
          <View style={styles.compat}>
            <Ionicons name="sparkles" size={12} color={colors.gold} />
            <Text style={styles.compatText}>{compatibility}% match</Text>
          </View>
        ) : (
          <View />
        )}
        {showDistance && distanceKm != null ? (
          <View style={styles.distance}>
            <Ionicons name="navigate" size={12} color={colors.white} />
            <Text style={styles.distanceText}>{shortDistance(distanceKm)}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {profile?.fullName || 'Member'}
            {age > 0 ? <Text style={styles.age}>, {age}</Text> : null}
          </Text>
          {verified ? <VerifiedBadge size="sm" /> : null}
        </View>

        <View style={styles.metaRow}>
          <Ionicons name="location" size={13} color={colors.primary} />
          <Text style={styles.meta} numberOfLines={1}>
            {getAreaLabel(profile?.area)}
          </Text>
          <View style={styles.dotSpacer} />
          {active ? (
            <ActiveDot label="Active now" size="sm" />
          ) : (
            <Text style={styles.metaMuted}>Active recently</Text>
          )}
        </View>

        {profile?.bio ? (
          <Text style={styles.bio} numberOfLines={2}>
            “{profile.bio}”
          </Text>
        ) : null}

        <View style={styles.chipRow}>
          <View style={styles.intentionPill}>
            <Text style={styles.intentionText} numberOfLines={1}>
              {intention.emoji} {intention.label}
            </Text>
          </View>
          {visibleInterests.map((interest) => (
            <View key={interest.id} style={styles.interestChip}>
              <Text style={styles.interestText}>
                {interest.emoji} {interest.label}
              </Text>
            </View>
          ))}
          {extraInterests > 0 ? (
            <View style={styles.interestChip}>
              <Text style={styles.interestText}>+{extraInterests}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radius.xxl,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    ...shadows.card,
  },
  photo: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  photoFallback: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  initialsCircle: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: { color: colors.text, fontSize: 52, fontWeight: '900', opacity: 0.92 },
  scrim: { ...StyleSheet.absoluteFillObject },
  topRow: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compat: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: 'rgba(255,197,66,0.45)',
  },
  compatText: { color: colors.gold, fontSize: 12, fontWeight: '800', marginLeft: 4 },
  distance: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.round,
  },
  distanceText: { color: colors.white, fontSize: 12, fontWeight: '700', marginLeft: 4 },
  info: { padding: spacing.lg, paddingTop: spacing.xxxl, justifyContent: 'flex-end' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { color: colors.white, fontSize: 30, fontWeight: '900', flexShrink: 1 },
  age: { color: colors.white, fontSize: 24, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
  meta: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginLeft: 4, flexShrink: 1 },
  metaMuted: { color: colors.textMuted, fontSize: 12, marginLeft: spacing.md },
  dotSpacer: { width: spacing.sm },
  bio: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md },
  intentionPill: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.round,
  },
  intentionText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  interestChip: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.round,
  },
  interestText: { color: colors.white, fontSize: 12, fontWeight: '600' },
});

export default ProfileCard;
