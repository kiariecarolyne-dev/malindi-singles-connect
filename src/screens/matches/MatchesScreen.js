import React, { useCallback, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import Screen from '../../components/Screen';
import ScreenHeader from '../../components/ScreenHeader';
import Skeleton from '../../components/Skeleton';
import { useAuth } from '../../context/AuthContext';
import { matchService, messageService, profileService } from '../../services';
import { colors, radius, spacing } from '../../theme';
import { timeAgo } from '../../utils/time';

const MatchesScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [newMatches, setNewMatches] = useState([]);

  const load = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const [convs, matches] = await Promise.all([
        messageService.getMyConversations(user.uid),
        matchService.getMatches(user.uid),
      ]);

      const rows = await Promise.all(
        convs.map(async (c) => ({
          ...c,
          other: c.otherUid ? await profileService.getProfile(c.otherUid) : null,
        })),
      );

      const messaged = new Set(rows.filter((r) => r.lastMessage).map((r) => r.otherUid));
      setConversations(rows.filter((r) => r.other && r.lastMessage));
      setNewMatches(matches.filter((m) => !messaged.has(m.otherUid)));
      setError(null);
    } catch (e) {
      setError(e.message || 'Could not load your matches.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openChat = (conversationId, otherUid, matchId) =>
    navigation.navigate('Chat', { conversationId, otherUid, matchId });

  const openNewMatch = (m) =>
    openChat(m.conversationId || m.otherProfile.uid, m.otherUid || m.otherProfile.uid, m.id);

  const renderNewMatch = ({ item }) => (
    <TouchableOpacity style={styles.newMatch} onPress={() => openNewMatch(item)}>
      <Avatar
        uri={item.otherProfile?.photos?.[0]}
        name={item.otherProfile?.fullName}
        size={68}
        ringColor={colors.primary}
      />
      <Text style={styles.newMatchName} numberOfLines={1}>
        {item.otherProfile?.fullName?.split(' ')[0]}
      </Text>
      <Text style={styles.newMatchTag}>new</Text>
    </TouchableOpacity>
  );

  const renderConversation = ({ item }) => {
    const mine = item.lastFrom === user.uid;
    const preview = mine ? `You: ${item.lastMessage}` : item.lastMessage;
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => openChat(item.id, item.otherUid, item.matchId)}
      >
        <Avatar uri={item.other?.photos?.[0]} name={item.other?.fullName} size={56} />
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text style={styles.rowName} numberOfLines={1}>
              {item.other?.fullName}
            </Text>
            <Text style={styles.rowTime}>
              {item.lastMessageAt ? timeAgo(item.lastMessageAt) : ''}
            </Text>
          </View>
          <View style={styles.rowBottom}>
            <Text
              style={[styles.rowPreview, item.unread > 0 && styles.rowPreviewUnread]}
              numberOfLines={1}
            >
              {preview}
            </Text>
            {item.unread > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.unread > 9 ? '9+' : item.unread}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const isEmpty = !loading && !error && !conversations.length && !newMatches.length;

  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Matches" />

      {loading ? (
        <View style={styles.loading}>
          <Skeleton height={80} style={styles.skelBlock} />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={72} style={styles.skelRow} />
          ))}
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : isEmpty ? (
        <EmptyState
          emoji="💕"
          title="No matches yet"
          message="Like someone in Discover and when the feeling is mutual, they will show up here."
          actionLabel="Browse singles"
          onAction={() => navigation.navigate('Discover')}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {newMatches.length ? (
            <View>
              <Text style={styles.sectionTitle}>
                New matches <Text style={styles.sectionCount}>{newMatches.length}</Text>
              </Text>
              <FlatList
                data={newMatches}
                keyExtractor={(item) => item.id}
                renderItem={renderNewMatch}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.newMatchList}
              />
            </View>
          ) : null}

          {conversations.length ? (
            <View>
              <Text style={[styles.sectionTitle, styles.messagesTitle]}>Messages</Text>
              <FlatList
                data={conversations}
                keyExtractor={(item) => item.id}
                renderItem={renderConversation}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
              />
            </View>
          ) : (
            <View style={styles.nudge}>
              <Ionicons name="chatbubbles-outline" size={20} color={colors.primary} />
              <Text style={styles.nudgeText}>
                New matches say hi first — open one above and break the ice!
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl },
  loading: { paddingHorizontal: spacing.lg, gap: spacing.md },
  skelBlock: { height: 92, borderRadius: radius.lg },
  skelRow: { height: 72, borderRadius: radius.md },

  sectionTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.md,
    marginHorizontal: spacing.lg,
  },
  sectionCount: { color: colors.primary },
  messagesTitle: { marginTop: spacing.xl },

  newMatchList: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md },
  newMatch: { alignItems: 'center', width: 74 },
  newMatchName: { color: colors.text, fontSize: 12, fontWeight: '600', marginTop: 6 },
  newMatchTag: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginTop: 2,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowName: { color: colors.text, fontSize: 16, fontWeight: '700', flex: 1, marginRight: spacing.sm },
  rowTime: { color: colors.textMuted, fontSize: 11 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3, gap: spacing.sm },
  rowPreview: { color: colors.textMuted, fontSize: 14, flex: 1 },
  rowPreviewUnread: { color: colors.text, fontWeight: '600' },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  separator: { height: 1, backgroundColor: colors.border, marginLeft: 88 },

  nudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    margin: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
  },
  nudgeText: { color: colors.textSecondary, fontSize: 13, flex: 1, lineHeight: 19 },
});

export default MatchesScreen;
