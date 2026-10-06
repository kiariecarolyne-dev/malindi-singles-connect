import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';
import Screen from '../../components/Screen';
import { ICEBREAKERS } from '../../constants/icebreakers';
import { useAuth } from '../../context/AuthContext';
import { messageService, profileService } from '../../services';
import { colors, gradients, radius, spacing } from '../../theme';
import { formatDayLabel, formatTime, isActiveRecently, timeAgo } from '../../utils/time';

const EMOJIS = ['😀', '😂', '😍', '❤️', '🔥', '👍', '🌊', '☕', '😎', '🥰'];

const TypingBubble = ({ name }) => {
  const anim = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  return (
    <View style={styles.typingRow}>
      <View style={[styles.bubble, styles.theirs, styles.typingBubble]}>
        {[0, 1, 2].map((i) => (
          <Animated.View
            key={i}
            style={[
              styles.typingDot,
              {
                opacity: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.3, 1],
                }),
                transform: [
                  {
                    translateY: anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -4],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
      </View>
      <Text style={styles.typingLabel}>{name} is typing…</Text>
    </View>
  );
};

const ChatScreen = ({ navigation, route }) => {
  const { user } = useAuth();
  const conversationId = route?.params?.conversationId;
  const otherUid = route?.params?.otherUid;
  const matchId = route?.params?.matchId;

  const [other, setOther] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showEmojis, setShowEmojis] = useState(false);
  const [showIcebreakers, setShowIcebreakers] = useState(false);
  const autoSent = useRef(false);

  const firstName = other?.fullName?.split(' ')[0] || 'them';
  const online = other ? isActiveRecently(other.lastActiveAt) : false;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [p, conv] = await Promise.all([
          profileService.getProfile(otherUid),
          messageService.getConversation(conversationId),
        ]);
        if (!active) return;
        if (!conv && conversationId) {
          await messageService.ensureConversation(conversationId, user.uid, otherUid);
        }
        const ms = await messageService.getMessages(conversationId);
        if (!active) return;
        setOther(p);
        setMessages(ms);
        messageService.markRead(conversationId, user.uid);
      } catch {
        if (active) setOther({});
      } finally {
        if (active) setLoading(false);
      }
    })();

    const unsub = messageService.subscribeMessages(conversationId, async () => {
      const ms = await messageService.getMessages(conversationId);
      setMessages(ms);
      messageService.markRead(conversationId, user.uid);
    });
    const unsubTyping = messageService.subscribeTyping(conversationId, () => {
      const users = messageService.getTypingUsers(conversationId);
      setTyping(users.includes(otherUid));
    });

    return () => {
      active = false;
      unsub();
      unsubTyping();
    };
  }, [conversationId, otherUid, user]);

  const send = useCallback(
    async (text) => {
      const clean = (text || '').trim();
      if (!clean) return;
      setInput('');
      await messageService.sendMessage(conversationId, user.uid, clean);
    },
    [conversationId, user],
  );

  useEffect(() => {
    const ib = route?.params?.autoIcebreaker;
    if (ib && conversationId && !autoSent.current) {
      autoSent.current = true;
      messageService.sendMessage(conversationId, user.uid, ib);
    }
  }, [conversationId, route, user]);

  const items = useMemo(() => {
    const out = [];
    for (let i = 0; i < messages.length; i += 1) {
      const m = messages[i];
      out.push({ kind: 'msg', key: m.id, message: m });
      const next = messages[i + 1];
      if (!next || new Date(m.createdAt).toDateString() !== new Date(next.createdAt).toDateString()) {
        out.push({ kind: 'day', key: `day-${m.createdAt}`, label: formatDayLabel(m.createdAt) });
      }
    }
    return out;
  }, [messages]);

  const confirmBlock = () => {
    Alert.alert(
      `Block ${firstName}?`,
      'You will no longer see each other or be able to message. You can unblock in settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            await profileService.blockUser(user.uid, otherUid);
            navigation.popToTop();
          },
        },
      ],
    );
  };

  const confirmDelete = () => {
    Alert.alert('Delete conversation?', 'This clears every message in this chat.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await messageService.deleteConversation(conversationId);
          setMessages([]);
        },
      },
    ]);
  };

  const openMenu = () => {
    Alert.alert(other?.fullName || 'Conversation', undefined, [
      { text: 'View profile', onPress: () => navigation.navigate('ProfileDetail', { uid: otherUid }) },
      { text: 'Report', onPress: () => navigation.navigate('Report', { uid: otherUid }) },
      { text: 'Block user', style: 'destructive', onPress: confirmBlock },
      { text: 'Delete conversation', style: 'destructive', onPress: confirmDelete },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const renderItem = ({ item }) => {
    if (item.kind === 'day') {
      return (
        <View style={styles.dayWrap}>
          <Text style={styles.dayLabel}>{item.label}</Text>
        </View>
      );
    }

    const m = item.message;
    const mine = m.senderUid === user.uid;

    return (
      <View style={[styles.msgRow, mine ? styles.msgRowMine : styles.msgRowTheirs]}>
        {!mine ? <Avatar uri={other?.photos?.[0]} name={other?.fullName} size={30} style={styles.msgAvatar} /> : null}
        <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
          {mine ? (
            <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bubbleGradient}>
              <Text style={styles.mineText}>{m.text}</Text>
            </LinearGradient>
          ) : (
            <Text style={styles.theirsText}>{m.text}</Text>
          )}
          <View style={styles.metaRow}>
            <Text style={[styles.time, mine && styles.timeMine]}>{formatTime(m.createdAt)}</Text>
            {mine ? (
              <Ionicons
                name={m.read ? 'checkmark-done' : 'checkmark'}
                size={14}
                color={m.read ? '#7CF4D8' : 'rgba(255,255,255,0.6)'}
                style={styles.tick}
              />
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerCenter}
          onPress={() => navigation.navigate('ProfileDetail', { uid: otherUid })}
        >
          <Avatar uri={other?.photos?.[0]} name={other?.fullName} size={40} ringColor={online ? colors.success : undefined} />
          <View style={styles.headerText}>
            <Text style={styles.headerName} numberOfLines={1}>
              {other?.fullName || ' '}
            </Text>
            <View style={styles.statusRow}>
              {online ? <View style={styles.onlineDot} /> : null}
              <Text style={[styles.headerStatus, online && styles.headerStatusOn]}>
                {typing
                  ? 'typing…'
                  : online
                    ? 'Active now'
                    : other?.lastActiveAt
                      ? `Active ${timeAgo(other.lastActiveAt)}`
                      : ''}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={openMenu} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="ellipsis-vertical" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View style={styles.center}>
            <Text style={styles.loading}>Loading conversation…</Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.key}
            renderItem={renderItem}
            inverted
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <EmptyState
                  emoji="👋"
                  title={`Say hi to ${firstName}!`}
                  message="Break the ice — send a suggested opener below or write your own."
                />
              </View>
            }
          />
        )}

        {typing ? <TypingBubble name={firstName} /> : null}

        {showEmojis ? (
          <ScrollView horizontal style={styles.emojiBar} contentContainerStyle={styles.emojiContent} showsHorizontalScrollIndicator={false}>
            {EMOJIS.map((e) => (
              <TouchableOpacity key={e} style={styles.emojiBtn} onPress={() => setInput((v) => `${v || ''}${e}`)}>
                <Text style={styles.emoji}>{e}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}

        {showIcebreakers || messages.length === 0 ? (
          <ScrollView horizontal style={styles.ibBar} contentContainerStyle={styles.ibContent} showsHorizontalScrollIndicator={false}>
            {ICEBREAKERS.map((ib) => (
              <TouchableOpacity key={ib} style={styles.ibChip} onPress={() => send(ib)}>
                <Text style={styles.ibText}>{ib}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.composer}>
          <TouchableOpacity
            style={styles.composerIcon}
            onPress={() => setShowEmojis((v) => !v)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name={showEmojis ? 'chevron-down' : 'happy-outline'} size={24} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.composerIcon}
            onPress={() => setShowIcebreakers((v) => !v)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="sparkles-outline" size={22} color={showIcebreakers ? colors.primary : colors.textSecondary} />
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={`Message ${firstName}…`}
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={800}
          />

          <TouchableOpacity
            disabled={!input.trim()}
            onPress={() => send(input)}
            style={styles.sendWrap}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <LinearGradient
              colors={input.trim() ? gradients.primary : [colors.surfaceHigh, colors.surfaceHigh]}
              style={styles.sendBtn}
            >
              <Ionicons name="arrow-up" size={20} color={colors.white} />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {matchId ? null : <View style={styles.bottomInset} />}
      </KeyboardAvoidingView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerText: { flex: 1 },
  headerName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  headerStatus: { color: colors.textMuted, fontSize: 12 },
  headerStatusOn: { color: colors.success },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },

  kav: { flex: 1 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loading: { color: colors.textSecondary, fontSize: 14 },
  emptyWrap: { transform: [{ scaleY: -1 }], paddingTop: spacing.xxl },

  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 3, gap: 6 },
  msgRowMine: { justifyContent: 'flex-end' },
  msgRowTheirs: { justifyContent: 'flex-start' },
  msgAvatar: { marginBottom: 18 },
  bubble: { maxWidth: '78%', borderRadius: radius.lg, overflow: 'hidden' },
  mine: { borderBottomRightRadius: 6 },
  theirs: { backgroundColor: colors.surface, borderBottomLeftRadius: 6 },
  bubbleGradient: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  mineText: { color: colors.white, fontSize: 15, lineHeight: 21 },
  theirsText: { color: colors.text, fontSize: 15, lineHeight: 21, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 3,
    marginTop: 3,
    marginHorizontal: spacing.sm,
    marginBottom: 4,
  },
  time: { fontSize: 10, color: colors.textMuted },
  timeMine: { color: 'rgba(255,255,255,0.85)' },
  tick: { marginLeft: 1 },

  dayWrap: { alignItems: 'center', marginVertical: spacing.md },
  dayLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.round,
    overflow: 'hidden',
  },

  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, marginBottom: spacing.xs },
  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 10, paddingHorizontal: 12 },
  typingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.textSecondary },
  typingLabel: { color: colors.textMuted, fontSize: 11, fontStyle: 'italic' },

  emojiBar: { maxHeight: 46, flexGrow: 0 },
  emojiContent: { paddingHorizontal: spacing.sm, alignItems: 'center' },
  emojiBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  emoji: { fontSize: 26 },

  ibBar: { maxHeight: 46, flexGrow: 0 },
  ibContent: { paddingHorizontal: spacing.sm, gap: spacing.sm, alignItems: 'center' },
  ibChip: {
    backgroundColor: colors.secondarySoft,
    borderWidth: 1,
    borderColor: 'rgba(124, 92, 255, 0.4)',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.round,
    marginHorizontal: 3,
  },
  ibText: { color: colors.text, fontSize: 13, maxWidth: 240 },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.backgroundAlt,
  },
  composerIcon: { padding: 6 },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    maxHeight: 120,
    minHeight: 40,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
  },
  sendWrap: { marginLeft: 2 },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomInset: { height: spacing.md },
});

export default ChatScreen;
