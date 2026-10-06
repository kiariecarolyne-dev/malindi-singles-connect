import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import Screen from '../../components/Screen';
import ScreenHeader from '../../components/ScreenHeader';
import Skeleton from '../../components/Skeleton';
import { useAuth } from '../../context/AuthContext';
import { notificationService } from '../../services';
import { colors, radius, spacing } from '../../theme';
import { timeAgo } from '../../utils/time';

const ICONS = {
  welcome: { icon: 'sparkles', color: '#FFC542' },
  system: { icon: 'shield-checkmark', color: '#2ED573' },
  match: { icon: 'heart', color: '#FF3B6B' },
  like: { icon: 'thumbs-up', color: '#7C5CFF' },
  meetup: { icon: 'calendar', color: '#4DA3FF' },
  verification: { icon: 'checkmark-circle', color: '#4DA3FF' },
  boost: { icon: 'rocket', color: '#FF6B4A' },
  premium: { icon: 'diamond', color: '#FFC542' },
};

const NotificationsScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);

  const load = useCallback(async () => {
    if (!user?.uid) return;
    try {
      setItems(await notificationService.getMyNotifications(user.uid));
      setError(null);
    } catch (e) {
      setError(e.message || 'Could not load notifications.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
      if (!user?.uid) return undefined;
      return notificationService.subscribe(user.uid, () => {
        notificationService.getMyNotifications(user.uid).then(setItems);
      });
    }, [load, user]),
  );

  const unread = items.filter((n) => !n.read).length;

  const markAll = async () => {
    await notificationService.markAllRead(user.uid);
    load();
  };

  const open = async (n) => {
    if (!n.read) {
      await notificationService.markRead(n.id);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
    const { matchId, conversationId, otherUid } = n.data || {};
    if (n.type === 'match' && matchId && otherUid) {
      navigation.navigate('MatchCelebration', { matchId, conversationId, otherUid });
    } else if (n.type === 'meetup') {
      navigation.navigate('MainTabs', { screen: 'Meet' });
    } else if (n.type === 'like') {
      navigation.navigate('LikedYou');
    } else if (n.type === 'premium') {
      navigation.navigate('Premium');
    } else if (n.type === 'verification') {
      navigation.navigate('Verification');
    }
  };

  const renderItem = ({ item }) => {
    const style = ICONS[item.type] || ICONS.system;
    return (
      <TouchableOpacity style={[styles.row, !item.read && styles.rowUnread]} onPress={() => open(item)}>
        <View style={[styles.iconWrap, { backgroundColor: `${style.color}22` }]}>
          <Ionicons name={style.icon} size={20} color={style.color} />
        </View>
        <View style={styles.body}>
          <Text style={[styles.title, !item.read && styles.titleUnread]}>{item.title}</Text>
          {item.body ? (
            <Text style={styles.bodyText} numberOfLines={2}>
              {item.body}
            </Text>
          ) : null}
          <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
        </View>
        {!item.read ? <View style={styles.dot} /> : null}
      </TouchableOpacity>
    );
  };

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title="Notifications"
        onBack={() => navigation.goBack()}
        rightIcon={unread > 0 ? 'checkmark-done' : undefined}
        onRightPress={unread > 0 ? markAll : undefined}
        rightColor={colors.primary}
      />
      {loading ? (
        <View style={styles.loading}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={86} style={styles.skel} />
          ))}
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !items.length ? (
        <EmptyState
          emoji="🔔"
          title="No notifications yet"
          message="Likes, matches, meetup plans and safety tips will appear here."
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.content}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  loading: { paddingHorizontal: spacing.lg, gap: spacing.md, marginTop: spacing.md },
  skel: { borderRadius: radius.md },
  content: { paddingVertical: spacing.sm, paddingBottom: spacing.xxxl },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'flex-start',
  },
  rowUnread: { backgroundColor: colors.primarySoft },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  title: { color: colors.text, fontSize: 15, fontWeight: '600', lineHeight: 21 },
  titleUnread: { fontWeight: '800' },
  bodyText: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 2 },
  time: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary, marginTop: 6 },
  separator: { height: 1, backgroundColor: colors.border, marginLeft: 70 },
});

export default NotificationsScreen;
