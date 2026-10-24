import React from 'react';
import { Image, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import Avatar from '../../components/Avatar';
import { getAreaLabel } from '../../constants/areas';
import { goldCircleService } from '../../services';
import { colors, radius, shadows, spacing } from '../../theme';
import { timeAgo } from '../../utils/time';

const categoryOf = (id) => goldCircleService.CATEGORIES.find((c) => c.id === id);

/** Show only a first name in the community feed. */
const firstName = (name) => (name || '').trim().split(/\s+/)[0] || 'Gold member';

/** "29 · Malindi · 2h" — each part only when the profile provides it. */
const authorMeta = (post) =>
  [
    post.authorAge ? `${post.authorAge}` : null,
    post.authorArea ? getAreaLabel(post.authorArea) : null,
    timeAgo(post.createdAt),
  ]
    .filter(Boolean)
    .join(' · ');

/**
 * 💛 One Gold Circle post: author + Gold indicator, category badge,
 * text, optional photo, optional shared WhatsApp number, like/comment
 * counts and the ••• safety menu (report / block / delete).
 */
const GoldCirclePostCard = ({
  post,
  viewerUid,
  saved,
  onPressSave,
  onPressAuthor,
  onPressLike,
  onPressComments,
  onPressMenu,
}) => {
  const liked = Array.isArray(post.likedBy) && post.likedBy.includes(viewerUid);
  const category = categoryOf(post.category);
  const isOwn = post.authorUid === viewerUid;
  const isAnonymous = Boolean(post.isAnonymous) && post.authorUid !== viewerUid;

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.header}
        activeOpacity={isAnonymous ? 1 : 0.7}
        disabled={isAnonymous}
        onPress={() => onPressAuthor?.(post)}
      >
        <Avatar uri={post.authorAvatar} name={post.authorName} size={36} ringColor={colors.gold} />
        <View style={styles.headerBody}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {firstName(post.authorName)}
            </Text>
            <Text style={styles.goldMark}>✦ Gold</Text>
          </View>
          <Text style={styles.time}>{authorMeta(post)}</Text>
        </View>
      </TouchableOpacity>

      {category ? (
        <View style={[styles.category, post.category === 'story' && styles.categoryStory]}>
          <Text style={[styles.categoryText, post.category === 'story' && styles.categoryTextStory]}>
            {category.emoji} {category.label}
          </Text>
        </View>
      ) : null}

      {post.text ? <Text style={styles.text}>{post.text}</Text> : null}

      {post.imageUrl ? (
        <Image source={{ uri: post.imageUrl }} style={styles.photo} resizeMode="contain" />
      ) : null}

      {post.location || post.budget ? (
        <View style={styles.metaRow}>
          {post.location ? (
            <View style={styles.metaChip}>
              <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
              <Text style={styles.metaText}>{post.location}</Text>
            </View>
          ) : null}
          {post.budget ? (
            <View style={styles.metaChip}>
              <Ionicons name="wallet-outline" size={12} color={colors.textSecondary} />
              <Text style={styles.metaText}>{post.budget}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {post.sharedWhatsApp && post.whatsapp ? (
        <View style={styles.whatsapp}>
          <Ionicons name="logo-whatsapp" size={13} color={colors.success} />
          <Text style={styles.whatsappLabel}>WhatsApp</Text>
          <Text style={styles.whatsappNumber}>{post.whatsapp}</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.action} onPress={() => onPressLike(post)} activeOpacity={0.7}>
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={15}
            color={liked ? colors.primary : colors.textMuted}
          />
          <Text style={[styles.actionText, liked && styles.actionTextLiked]}>
            {post.likeCount || 0}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.action} onPress={() => onPressComments(post)} activeOpacity={0.7}>
          <Ionicons name="chatbubble-outline" size={14} color={colors.textMuted} />
          <Text style={styles.actionText}>{post.commentCount || 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.action} onPress={() => onPressSave?.(post)} activeOpacity={0.7}>
          <Ionicons
            name={saved ? 'bookmark' : 'bookmark-outline'}
            size={15}
            color={saved ? colors.gold : colors.textMuted}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.action}
          onPress={async () => {
            try {
              await Share.share({
                message: `${post.text || ''}${post.location ? `\n📍 ${post.location}` : ''}${
                  post.budget ? ` · ${post.budget}` : ''
                }\n\n— ${post.authorName || 'Gold member'} on Gold Circle`,
              });
            } catch {
              // Sharing cancelled or unavailable.
            }
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="share-outline" size={15} color={colors.textMuted} />
        </TouchableOpacity>

        <View style={styles.spacer} />

        <TouchableOpacity
          style={styles.menuBtn}
          onPress={() => onPressMenu(post, isOwn)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="ellipsis-horizontal" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.soft,
  },

  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerBody: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  name: { color: colors.text, fontSize: 15, fontWeight: '700', flexShrink: 1 },
  goldMark: { color: colors.gold, fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  time: { color: colors.textMuted, fontSize: 11, marginTop: 1 },

  category: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceLight,
    borderRadius: radius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginTop: spacing.md,
  },
  categoryStory: { backgroundColor: colors.goldSoft },
  categoryText: { color: colors.textSecondary, fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  categoryTextStory: { color: colors.gold, letterSpacing: 0.8, textTransform: 'uppercase' },

  text: { color: colors.text, fontSize: 15, lineHeight: 22, marginTop: spacing.md },

  photo: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.md,
    marginTop: spacing.md,
    backgroundColor: colors.surfaceLight,
  },

  whatsapp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceLight,
    borderRadius: radius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginTop: spacing.md,
  },
  whatsappLabel: { color: colors.success, fontSize: 11, fontWeight: '700' },
  whatsappNumber: { color: colors.textSecondary, fontSize: 11, fontWeight: '600' },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceLight,
    borderRadius: radius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  metaText: { color: colors.textSecondary, fontSize: 11, fontWeight: '600' },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2 },
  actionText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  actionTextLiked: { color: colors.primary },
  spacer: { flex: 1 },
  menuBtn: { padding: spacing.xs },
});

export default GoldCirclePostCard;
