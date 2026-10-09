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
import { colors, gradients, radius, shadows, spacing } from '../theme';

/**
 * The big discovery card: photo, identity, intention, interests,
 * distance and compatibility badge.
 */
const ProfileCard = ({ profile, distanceKm, compatibility, showDistance = true }) => {
  const [loaded, setLoaded] = useState(false);
  const age = profileAge(profile);
  const intention = getIntention(profile.datingIntention);
  const interests = getInterestsByIds(profile.interests).slice(0, 5);
  const active = isActiveRecently(profile.lastActiveAt);
  const verified = profile.verification?.status === 'verified';

  return (
    <View style={styles.card}>
      <Image
        source={{ uri: profile.photos?.[0] }}
        style={[styles.photo, { opacity: loaded ? 1 : 0 }]}
        onLoad={() => setLoaded(true)}
        fadeDuration={250}
      />
      <LinearGradient colors={gradients.card} style={styles.overlay} />

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
          <Text style={styles.name}>
            {profile.fullName}, {age > 0 ? age : ''}
          </Text>
          {verified ? <VerifiedBadge size="sm" /> : null}
        </View>

        <View style={styles.metaRow}>
          <Ionicons name="location" size={13} color={colors.primary} />
          <Text style={styles.meta}>{getAreaLabel(profile.area)}</Text>
          <View style={styles.dotSpacer} />
          {active ? <ActiveDot label="Active now" size="sm" /> : <Text style={styles.metaMuted}>Active recently</Text>}
        </View>

        {profile.bio ? (
          <Text style={styles.bio} numberOfLines={2}>
            “{profile.bio}”
          </Text>
        ) : null}

        <View style={styles.pillRow}>
          <View style={styles.intentionPill}>
            <Text style={styles.intentionText}>
              {intention.emoji} {intention.label}
            </Text>
          </View>
        </View>

        <View style={styles.interestRow}>
          {interests.map((i) => (
            <View key={i.id} style={styles.interestChip}>
              <Text style={styles.interestText}>
                {i.emoji} {i.label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  photo: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
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
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: 'rgba(255,197,66,0.4)',
  },
  compatText: { color: colors.gold, fontSize: 12, fontWeight: '800', marginLeft: 4 },
  distance: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.round,
  },
  distanceText: { color: colors.white, fontSize: 12, fontWeight: '700', marginLeft: 4 },
  info: { padding: spacing.lg },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { color: colors.white, fontSize: 26, fontWeight: '900' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
  meta: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginLeft: 4 },
  metaMuted: { color: colors.textMuted, fontSize: 12, marginLeft: spacing.md },
  dotSpacer: { width: spacing.md },
  bio: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: spacing.sm },
  pillRow: { flexDirection: 'row', marginTop: spacing.md },
  intentionPill: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.round,
  },
  intentionText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  interestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md },
  interestChip: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.round,
  },
  interestText: { color: colors.white, fontSize: 12, fontWeight: '600' },
});

export default ProfileCard;
