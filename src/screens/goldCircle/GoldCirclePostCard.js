import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import Avatar from '../../components/Avatar';
import { goldCircleService } from '../../services';
import { colors, radius, shadows, spacing } from '../../theme';
import { timeAgo } from '../../utils/time';

const categoryOf = (id) => goldCircleService.CATEGORIES.find((c) => c.id === id);

/**
 * 💛 One Gold Circle post: author + Gold indicator, category badge,
 * text, optional photo, optional shared WhatsApp number, like/comment
 * counts and the ••• safety menu (report / block / delete).
 */
const GoldCirclePostCard = ({
  post,
  viewerUid,
  onPressAuthor,
  onPressLike,
  onPressComments,
  onPressMenu,
}) => {
  const liked = Array.isArray(post.likedBy) && post.likedBy.includes(viewerUid);
  const category = categoryOf(post.category);
  const isOwn = post.authorUid === viewerUid;

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.header}
        activeOpacity={0.7}
        onPress={() => onPressAuthor?.(post)}
      >
        <Avatar uri={post.authorAvatar} name={post.authorName} size={36} ringColor={colors.gold} />
        <View style={styles.headerBody}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {post.authorName}
            </Text>
            <Text style={styles.goldMark}>✦ Gold</Text>
          </View>
          <Text style={styles.time}>{timeAgo(post.createdAt)}</Text>
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
