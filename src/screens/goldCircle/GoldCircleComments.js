import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import { getAreaLabel } from '../../constants/areas';
import { LIMITS } from '../../config/env';
import { useAuth } from '../../context/AuthContext';
import { goldCircleService } from '../../services';
import { colors, radius, spacing } from '../../theme';
import { timeAgo } from '../../utils/time';

const firstName = (name) => (name || '').trim().split(/\s+/)[0] || 'Gold member';

const commentMeta = (comment) =>
  [
    comment.authorAge ? `${comment.authorAge}` : null,
    comment.authorArea ? getAreaLabel(comment.authorArea) : null,
    timeAgo(comment.createdAt),
  ]
    .filter(Boolean)
    .join(' · ');

/**
 * 💬 Comment thread for one Gold Circle post.
 * Flat list of comments (simple and reliable), with the same safety
 * basics as the feed: own comments can be deleted, loading/empty/error
 * states everywhere.
 */
const GoldCircleComments = ({ post, onClose, onCountChange, onOpenAuthor }) => {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const postId = post?.id;

  const load = useCallback(async () => {
    if (!user?.uid || !postId) return;
    setLoading(true);
    try {
      const rows = await goldCircleService.getComments(user.uid, postId);
      setComments(rows);
      setError(null);
    } catch (e) {
      setError(e.message || 'Could not load comments.');
    } finally {
      setLoading(false);
    }
  }, [user, postId]);

  useEffect(() => {
    // Async fetch: state settles once the comments promise resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const send = async () => {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    try {
      const created = await goldCircleService.addComment({
        uid: user.uid,
        profile,
        postId,
        text: value,
      });
      setComments((prev) => [
        ...prev,
        {
          id: created.id,
          authorUid: user.uid,
          authorName: profile?.fullName || 'Gold member',
          authorAvatar: profile?.photos?.[0] || null,
          text: value,
          createdAt: new Date().toISOString(),
        },
      ]);
      setText('');
      onCountChange?.(1);
    } catch (e) {
      Alert.alert('Could not send', e.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  const removeComment = (comment) => {
    if (comment.authorUid !== user?.uid) return;
    Alert.alert('Delete comment', 'Delete your comment from this post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await goldCircleService.deleteComment(user.uid, postId, comment.id);
            setComments((prev) => prev.filter((c) => c.id !== comment.id));
            onCountChange?.(-1);
          } catch (e) {
            Alert.alert('Could not delete', e.message || 'Please try again.');
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.8}
      onPress={() => {
        if (item.authorUid !== user?.uid) onOpenAuthor?.(item.authorUid);
      }}
      onLongPress={() => removeComment(item)}
      delayLongPress={350}
    >
      <Avatar uri={item.authorAvatar} name={item.authorName} size={32} />
      <View style={styles.rowBody}>
        <View style={styles.rowHead}>
          <Text style={styles.rowName} numberOfLines={1}>
            {firstName(item.authorName)}
          </Text>
          <Text style={styles.rowTime}>{commentMeta(item)}</Text>
        </View>
        <Text style={styles.rowText}>{item.text}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} transparent={false}>
      <View style={styles.wrap}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Ionicons name="chatbubble-outline" size={15} color={colors.gold} />
            <Text style={styles.title}>Comments</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.close} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={styles.body}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.gold} size="large" />
            </View>
          ) : error ? (
            <ErrorState message={error} onRetry={load} />
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <EmptyState
                  emoji="💬"
                  title="No comments yet"
                  message="Be the first to reply to this post."
                />
              }
            />
          )}

          <View style={styles.composer}>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder="Write a comment..."
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={LIMITS.goldCircleCommentMaxLength}
              editable={!sending}
            />
            <TouchableOpacity
              style={[styles.send, (!text.trim() || sending) && styles.sendOff]}
              onPress={send}
              disabled={!text.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color={colors.black} />
              ) : (
                <Ionicons name="send" size={17} color={colors.black} />
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>
            Tap a member to view their profile · long-press your own comment to delete.
          </Text>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl + spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { color: colors.text, fontSize: 16, fontWeight: '800' },
  close: { padding: spacing.xs },

  body: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.lg, paddingBottom: spacing.xl },

  row: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  rowBody: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  rowName: { color: colors.text, fontSize: 13, fontWeight: '800', flexShrink: 1 },
  rowTime: { color: colors.textMuted, fontSize: 11 },
  rowText: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 2 },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  send: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOff: { opacity: 0.4 },
  hint: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
});

export default GoldCircleComments;
