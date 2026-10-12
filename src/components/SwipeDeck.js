import React, { useEffect, useState } from 'react';
import { Animated, Dimensions, PanResponder, StyleSheet, View } from 'react-native';

import { spacing } from '../theme';

const { width: SCREEN_W } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_W * 0.28;
const FLY_OUT = SCREEN_W * 1.4;

/**
 * Card deck with pan-to-swipe gestures.
 * Swipe right = like, swipe left = pass. The action buttons call the same
 * `swipe` api exposed through the `actions` render prop.
 *
 * `renderCard(profile, direction, stamps)` — for the top card, `stamps` is
 * `{ like, nope }`, two Animated opacities bound to the drag distance so a
 * LIKE / NOPE stamp fades in smoothly instead of popping at a threshold.
 *
 * PanResponder is created per render so handlers always close over the latest
 * profiles/index; the `flinging` state blocks a second fling mid-animation.
 */
const SwipeDeck = ({ profiles, onLike, onPass, renderCard, actions, onIndexChange, maxVisible = 2 }) => {
  const [index, setIndex] = useState(0);
  const [position] = useState(() => new Animated.ValueXY({ x: 0, y: 0 }));
  const [direction, setDirection] = useState(null);
  const [flinging, setFlinging] = useState(false);

  useEffect(() => {
    if (onIndexChange) onIndexChange(index);
  }, [index, onIndexChange]);

  const completeSwipe = (dir) => {
    const current = profiles[index];
    if (current) {
      if (dir === 'right' && onLike) onLike(current);
      if (dir === 'left' && onPass) onPass(current);
    }
    position.setValue({ x: 0, y: 0 });
    setDirection(null);
    setFlinging(false);
    setIndex((i) => i + 1);
  };

  /** Animate the top card off-screen, then advance the deck. */
  const fling = (dir, dy = 0) => {
    if (flinging || index >= profiles.length) return;
    setFlinging(true);
    Animated.timing(position, {
      toValue: { x: dir === 'right' ? FLY_OUT : -FLY_OUT, y: dy },
      duration: 240,
      useNativeDriver: false,
    }).start(() => completeSwipe(dir));
  };

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6,
    onPanResponderMove: (_, g) => {
      position.setValue({ x: g.dx, y: g.dy * 0.3 });
      const next = g.dx > 30 ? 'right' : g.dx < -30 ? 'left' : null;
      setDirection((prev) => (prev === next ? prev : next));
    },
    onPanResponderRelease: (_, g) => {
      if (g.dx > SWIPE_THRESHOLD) {
        fling('right', g.dy);
      } else if (g.dx < -SWIPE_THRESHOLD) {
        fling('left', g.dy);
      } else {
        Animated.spring(position, {
          toValue: { x: 0, y: 0 },
          friction: 6,
          useNativeDriver: false,
        }).start(() => setDirection(null));
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(position, {
        toValue: { x: 0, y: 0 },
        friction: 6,
        useNativeDriver: false,
      }).start(() => setDirection(null));
    },
  });

  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_W, 0, SCREEN_W],
    outputRange: ['-12deg', '0deg', '12deg'],
  });
  const likeOpacity = position.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD * 0.6, SWIPE_THRESHOLD],
    outputRange: [0, 0.7, 1],
    extrapolate: 'clamp',
  });
  const nopeOpacity = position.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, -SWIPE_THRESHOLD * 0.6, 0],
    outputRange: [1, 0.7, 0],
    extrapolate: 'clamp',
  });

  const visible = profiles.slice(index, index + maxVisible);
  const currentProfile = profiles[index] || null;
  const stamps = { like: likeOpacity, nope: nopeOpacity };

  return (
    <View style={styles.wrap}>
      <View style={styles.deck}>
        {visible
          .map((profile, i) => ({ profile, i }))
          .reverse()
          .map(({ profile, i }) => {
            const isTop = i === 0;
            const animStyle = isTop
              ? { transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }] }
              : { transform: [{ scale: Math.max(0.92, 1 - i * 0.04) }, { translateY: 10 * i }] };

            return (
              <Animated.View
                key={profile.uid}
                style={[styles.cardLayer, isTop ? animStyle : [animStyle, styles.cardBehind]]}
                {...(isTop ? panResponder.panHandlers : {})}
              >
                {renderCard(profile, isTop ? direction : null, isTop ? stamps : null)}
              </Animated.View>
            );
          })}
      </View>
      {actions ? (
        <View style={styles.actions}>
          {actions({ swipe: fling, currentProfile, disabled: index >= profiles.length })}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  deck: { flex: 1, marginHorizontal: spacing.lg },
  cardLayer: { ...StyleSheet.absoluteFillObject },
  cardBehind: { zIndex: 0 },
  actions: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
});

export default SwipeDeck;
