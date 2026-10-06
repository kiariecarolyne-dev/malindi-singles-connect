import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import Avatar from '../../components/Avatar';
import Button from '../../components/Button';
import ErrorState from '../../components/ErrorState';
import { useAuth } from '../../context/AuthContext';
import { matchService, profileService } from '../../services';
import { getRandomIcebreaker } from '../../constants/icebreakers';
import { colors, gradients, spacing } from '../../theme';

const FloatingHeart = ({ left, delay, size }) => {
  const anim = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: 2600,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim, delay]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -170] });
  const opacity = anim.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] });

  return (
    <Animated.Text style={[styles.floatHeart, { left, fontSize: size, transform: [{ translateY }], opacity }]}>
      ❤️
    </Animated.Text>
  );
};

/**
 * 🎉 IT'S A MATCH — celebration with animation, then straight into chatting.
 */
const MatchCelebrationScreen = ({ navigation, route }) => {
  const { user, profile } = useAuth();
  const matchId = route?.params?.matchId;
  const otherUid = route?.params?.otherUid;

  const [other, setOther] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [error, setError] = useState(null);

  const heartScale = useState(() => new Animated.Value(0))[0];
  const leftSlide = useState(() => new Animated.Value(-260))[0];
  const rightSlide = useState(() => new Animated.Value(260))[0];
  const fadeIn = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [profileData, match] = await Promise.all([
          profileService.getProfile(otherUid),
          matchId ? matchService.getMatch(matchId) : matchService.findMatchBetween(user.uid, otherUid),
        ]);
        if (cancelled) return;
        if (!profileData) {
          setError('This match is no longer available.');
          return;
        }
        setOther(profileData);
        setConversationId(match?.conversationId || null);
      } catch {
        if (!cancelled) setError('Could not load this match.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [matchId, otherUid, user]);

  useEffect(() => {
    if (!other) return;
    Animated.parallel([
      Animated.spring(heartScale, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }),
      Animated.spring(leftSlide, { toValue: 0, friction: 5, useNativeDriver: true }),
      Animated.spring(rightSlide, { toValue: 0, friction: 5, useNativeDriver: true }),
      Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [other, heartScale, leftSlide, rightSlide, fadeIn]);

  if (error) {
    return (
      <View style={styles.root}>
        <ErrorState message={error} onRetry={() => navigation.goBack()} />
        <View style={styles.lateBtn}>
          <Button title="Back to Discover" onPress={() => navigation.replace('MainTabs')} />
        </View>
      </View>
    );
  }

  if (!other) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.loading}>Checking your match…</Text>
      </View>
    );
  }

  const openChat = (withIcebreaker) => {
    navigation.replace('Chat', {
      matchId,
      conversationId: conversationId || other.uid,
      otherUid: other.uid,
      autoIcebreaker: withIcebreaker ? getRandomIcebreaker() : undefined,
    });
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#2A0F2B', '#131A35', colors.background]} style={StyleSheet.absoluteFill} />

      {[{ left: 40, delay: 0, size: 26 }, { left: 130, delay: 500, size: 20 }, { left: 230, delay: 1100, size: 30 }, { left: 310, delay: 300, size: 22 }].map(
        (h, i) => (
          <FloatingHeart key={i} left={h.left} delay={h.delay} size={h.size} />
        ),
      )}

      <View style={styles.content}>
        <Text style={styles.itsMatch}>
          IT&apos;S A <Text style={{ color: colors.primary }}>MATCH!</Text>
        </Text>

        <View style={styles.avatars}>
          <Animated.View style={[styles.avatarSide, { transform: [{ translateX: leftSlide }] }]}>
            <Avatar uri={profile?.photos?.[0]} name={profile?.fullName} size={112} ringColor={colors.primary} />
          </Animated.View>

          <Animated.View style={[styles.heartWrap, { transform: [{ scale: heartScale }] }]}>
            <LinearGradient colors={gradients.primary} style={styles.heartCircle}>
              <Ionicons name="heart" size={38} color={colors.white} />
            </LinearGradient>
          </Animated.View>

          <Animated.View style={[styles.avatarSide, { transform: [{ translateX: rightSlide }] }]}>
            <Avatar uri={other.photos?.[0]} name={other.fullName} size={112} ringColor={colors.primary} />
          </Animated.View>
        </View>

        <Animated.View style={[styles.textWrap, { opacity: fadeIn }]}>
          <Text style={styles.who}>
            You and <Text style={styles.name}>{other.fullName}</Text> like each other.
          </Text>
          <Text style={styles.sub}>Say hello before the moment passes — people around Malindi are active now.</Text>
        </Animated.View>

        <Animated.View style={[styles.actions, { opacity: fadeIn }]}>
          <Button title="Start Chatting" icon="chatbubble" onPress={() => openChat(false)} />
          <Button
            title="Send Icebreaker"
            variant="secondary"
            icon="sparkles"
            onPress={() => openChat(true)}
            style={styles.iceBtn}
          />
          <Button title="Keep discovering" variant="ghost" onPress={() => navigation.replace('MainTabs')} style={styles.keepBtn} />
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  loading: { color: colors.textSecondary, fontSize: 15 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xxl, paddingBottom: spacing.xxl },
  itsMatch: {
    color: colors.text,
    fontSize: 40,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 1,
  },
  avatars: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xxxl,
  },
  avatarSide: { alignItems: 'center' },
  heartWrap: { marginHorizontal: -14, zIndex: 2 },
  heartCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.background,
  },
  textWrap: { marginTop: spacing.xxl, alignItems: 'center' },
  who: { color: colors.text, fontSize: 19, fontWeight: '800', textAlign: 'center' },
  name: { color: colors.primary },
  sub: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 21,
  },
  actions: { marginTop: spacing.xxxl },
  iceBtn: { marginTop: spacing.md },
  keepBtn: { marginTop: spacing.sm },
  floatHeart: { position: 'absolute', bottom: 0 },
  lateBtn: { paddingHorizontal: spacing.xxl },
});

export default MatchCelebrationScreen;
