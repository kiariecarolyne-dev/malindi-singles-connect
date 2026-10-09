import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';

import ActiveDot from '../../components/ActiveDot';
import Avatar from '../../components/Avatar';
import Chip from '../../components/Chip';
import { VerifiedBadge } from '../../components/Badge';
import Screen from '../../components/Screen';
import SectionHeader from '../../components/SectionHeader';
import { getAreaLabel } from '../../constants/areas';
import { getIntention } from '../../constants/datingIntentions';
import { getInterestsByIds } from '../../constants/interests';
import { useAuth } from '../../context/AuthContext';
import { matchService, premiumService, profileService } from '../../services';
import { profileAge } from '../../utils/age';
import { isActiveRecently } from '../../utils/time';
import { colors, radius, spacing } from '../../theme';

const MenuRow = ({ emoji, label, sub, onPress, right, danger }) => (
  <TouchableOpacity
    style={styles.menuRow}
    onPress={onPress}
    activeOpacity={onPress ? 0.7 : 1}
    disabled={!onPress}
  >
    <View style={styles.menuEmoji}>
      <Text style={{ fontSize: 18 }}>{emoji}</Text>
    </View>
    <View style={styles.menuText}>
      <Text style={[styles.menuLabel, danger && { color: colors.danger }]}>{label}</Text>
      {sub ? <Text style={styles.menuSub}>{sub}</Text> : null}
    </View>
    {right !== undefined ? right : onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null}
  </TouchableOpacity>
);

const ProfileScreen = ({ navigation }) => {
  const { profile, user, saveProfile, signOut, isAdmin } = useAuth();
  const [matchCount, setMatchCount] = useState(0);
  const [likedCount, setLikedCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const [matches, liked] = await Promise.all([
            matchService.getMatches(user.uid),
            profileService.getLikedYouProfiles(user.uid),
          ]);
          if (!cancelled) {
            setMatchCount(matches.length);
            setLikedCount(liked.length);
          }
        } catch {
          // counts are decorative — never block the profile
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [user]),
  );

  if (!profile) return <Screen edges={['top']} />;

  const age = profileAge(profile);
  const intention = getIntention(profile.datingIntention);
  const interests = getInterestsByIds(profile.interests);
  const active = isActiveRecently(profile.lastActiveAt);
  const verified = profile.verification?.status === 'verified';
  const gold = premiumService.isGold(profile);

  const toggleLocation = async (value) => {
    try {
      await saveProfile({ showLocation: value });
    } catch {
      Alert.alert('Could not update', 'Please try again.');
    }
  };

  const confirmLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <Screen edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
        <LinearGradient colors={['#1B1030', colors.background]} style={styles.banner}>
          <View style={styles.avatarWrap}>
            <Avatar uri={profile.photos?.[0]} name={profile.fullName} size={104} ringColor={colors.primary} />
            <View style={styles.activeBadge}>
              {active ? <ActiveDot size="sm" /> : <View style={styles.idleDot} />}
            </View>
          </View>
          <Text style={styles.name}>
            {profile.fullName}, {age > 0 ? age : ''}
          </Text>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={13} color={colors.primary} />
            <Text style={styles.location}>{getAreaLabel(profile.area)}</Text>
            {verified ? <VerifiedBadge size="sm" /> : null}
          </View>
          <View style={styles.intentionPill}>
            <Text style={styles.intentionText}>
              {intention.emoji} {intention.label}
            </Text>
          </View>
          {gold ? (
            <View style={styles.goldPill}>
              <Ionicons name="diamond" size={12} color={colors.black} />
              <Text style={styles.goldPillText}>Malindi Gold member</Text>
            </View>
          ) : null}
        </LinearGradient>

        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{matchCount}</Text>
            <Text style={styles.statLabel}>Matches</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{likedCount}</Text>
            <Text style={styles.statLabel}>Likes you</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{intention.emoji}</Text>
            <Text style={styles.statLabel}>Looking for</Text>
          </View>
        </View>

        {profile.bio ? (
          <View style={styles.bioCard}>
            <Text style={styles.bioText}>“{profile.bio}”</Text>
          </View>
        ) : null}

        <SectionHeader title="Your interests" emoji="✨" />
        <View style={styles.chips}>
          {interests.map((i) => (
            <Chip key={i.id} label={i.label} emoji={i.emoji} small />
          ))}
        </View>

        <SectionHeader title="Your profile" emoji="👤" />
        <View style={styles.menu}>
          <MenuRow emoji="✏️" label="Edit profile" sub="Photos, bio, interests, preferences" onPress={() => navigation.navigate('EditProfile')} />
          <MenuRow
            emoji={verified ? '✅' : '🔐'}
            label="Verification"
            sub={verified ? 'Your profile is verified' : 'Get your verified badge'}
            onPress={() => navigation.navigate('Verification')}
          />
          <MenuRow
            emoji="👀"
            label="People who liked you"
            sub={`${likedCount} waiting for you`}
            onPress={() => navigation.navigate('LikedYou')}
          />
          <MenuRow emoji="🚀" label="Boost me" sub="Be seen by more singles for 30 minutes" onPress={() => navigation.navigate('Boost')} />
          <MenuRow
            emoji="💎"
            label="Malindi Gold"
            sub={gold ? 'Active — every like unlocked, lifetime' : 'KSh 100 once — see everyone who likes you'}
            onPress={() => navigation.navigate('Premium')}
            right={
              gold ? (
                <View style={styles.menuGoldTag}>
                  <Text style={styles.menuGoldTagText}>ACTIVE</Text>
                </View>
              ) : undefined
            }
          />
          <MenuRow
            emoji="💛"
            label="Gold Circle"
            sub={gold ? 'The exclusive community for Gold members' : 'Gold-only community — join to enter'}
            onPress={() => navigation.navigate('GoldCircle')}
          />
        </View>

        <SectionHeader title="Settings" emoji="⚙️" />
        <View style={styles.menu}>
          <MenuRow
            emoji="📍"
            label="Location visibility"
            sub={profile.showLocation ? 'Others can see your approximate distance' : 'Your distance is hidden'}
            right={
              <Switch
                value={Boolean(profile.showLocation)}
                onValueChange={toggleLocation}
                trackColor={{ false: colors.surfaceHigh, true: colors.primarySoft }}
                thumbColor={profile.showLocation ? colors.primary : colors.textMuted}
              />
            }
          />
          <MenuRow emoji="🔔" label="Notifications" sub="Likes, matches, messages, reminders" onPress={() => navigation.navigate('Notifications')} />
          <MenuRow emoji="🚫" label="Blocked users" onPress={() => navigation.navigate('BlockedUsers')} />
          <MenuRow emoji="🛡️" label="Community guidelines" sub="Meet safely. Respect everyone." onPress={() => Alert.alert('Community guidelines', 'Be honest in your profile. Be respectful in chat. Meet in public. Report anyone who makes you uncomfortable. Anyone under 18 is removed immediately.')} />
          {isAdmin ? <MenuRow emoji="🧑‍⚖️" label="Admin moderation" sub="Review reports and verify profiles" onPress={() => navigation.navigate('Admin')} /> : null}
        </View>

        <SectionHeader title="Account" emoji="📧" />
        <View style={styles.menu}>
          <MenuRow emoji="📧" label={`Signed in as ${user?.email}`} sub="Your account lives in Firebase Auth" />
        </View>

        <View style={styles.menu}>
          <MenuRow emoji="🚪" label="Log out" onPress={confirmLogout} danger right={<Ionicons name="log-out-outline" size={18} color={colors.danger} />} />
        </View>

        <Text style={styles.version}>Malindi Singles Connect v1.0.0 · Meet. Match. Connect. Today.</Text>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  banner: { alignItems: 'center', paddingTop: spacing.xxl, paddingBottom: spacing.xl, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl },
  avatarWrap: { position: 'relative' },
  activeBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.border,
  },
  idleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textMuted },
  name: { color: colors.text, fontSize: 26, fontWeight: '900', marginTop: spacing.md },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs, gap: 6 },
  location: { color: colors.textSecondary, fontSize: 14, fontWeight: '600', marginRight: spacing.sm },
  intentionPill: {
    marginTop: spacing.md,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.round,
  },
  intentionText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  goldPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.round,
  },
  goldPillText: { color: colors.black, fontSize: 12, fontWeight: '900' },
  menuGoldTag: {
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.round,
  },
  menuGoldTagText: { color: colors.black, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  statRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: colors.text, fontSize: 20, fontWeight: '900' },
  statLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2, fontWeight: '600' },
  statDivider: { width: StyleSheet.hairlineWidth, backgroundColor: colors.borderStrong },
  bioCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  bioText: { color: colors.textSecondary, fontSize: 14, lineHeight: 22, fontStyle: 'italic' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.lg },
  menu: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  menuEmoji: { width: 36, alignItems: 'flex-start' },
  menuText: { flex: 1, marginRight: spacing.sm },
  menuLabel: { color: colors.text, fontSize: 15, fontWeight: '600' },
  menuSub: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
  version: { color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: spacing.xl },
});

export default ProfileScreen;
