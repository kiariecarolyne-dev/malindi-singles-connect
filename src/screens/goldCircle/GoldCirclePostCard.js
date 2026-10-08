import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import Avatar from '../../components/Avatar';
import { goldCircleService } from '../../services';
import { colors, radius, spacing } from '../../theme';
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
  onPressLike,
  onPressComments,
  onPressMenu,
}) => {
  const liked = Array.isArray(post.likedBy) && post.likedBy.includes(viewerUid);
  const category = categoryOf(post.category);
  const isOwn = post.authorUid === viewerUid;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Avatar uri={post.authorAvatar} name={post.authorName} size={44} ringColor={colors.gold} />
        <View style={styles.headerBody}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {post.authorName}
            </Text>
            <View style={styles.goldTag}>
              <Text style={styles.goldTagText}>⭐ Gold Member</Text>
            </View>
          </View>
          <Text style={styles.time}>{timeAgo(post.createdAt)}</Text>
        </View>
        <TouchableOpacity
          style={styles.menuBtn}
          onPress={() => onPressMenu(post, isOwn)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {category ? (
        <View style={[styles.category, post.category === 'story' && styles.categoryStory]}>
          <Text style={[styles.categoryText, post.category === 'story' && styles.categoryTextStory]}>
            {category.emoji} {post.category === 'story' ? 'Success Story' : category.label}
          </Text>
        </View>
      ) : null}

      <Text style={styles.text}>{post.text}</Text>

      {post.imageUrl ? (
        <Image source={{ uri: post.imageUrl }} style={styles.photo} resizeMode="cover" />
      ) : null}

      {post.sharedWhatsApp && post.whatsapp ? (
        <View style={styles.whatsapp}>
          <Ionicons name="logo-whatsapp" size={14} color={colors.success} />
          <Text style={styles.whatsappText}>📱 {post.whatsapp}</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.action, liked && styles.actionLiked]}
          onPress={() => onPressLike(post)}
          activeOpacity={0.7}
        >
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={18} color={liked ? colors.primary : colors.textSecondary} />
          <Text style={[styles.actionText, liked && styles.actionTextLiked]}>
            {post.likeCount || 0}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.action} onPress={() => onPressComments(post)} activeOpacity={0.7}>
          <Ionicons name="chatbubble-outline" size={17} color={colors.textSecondary} />
          <Text style={styles.actionText}>{post.commentCount || 0}</Text>
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
  },

  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerBody: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  name: { color: colors.text, fontSize: 15, fontWeight: '800', flexShrink: 1 },
  goldTag: {
    backgroundColor: colors.goldSoft,
    borderColor: colors.gold,
    borderWidth: 1,
    borderRadius: radius.round,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  goldTagText: { color: colors.gold, fontSize: 10, fontWeight: '900' },
  time: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  menuBtn: { padding: spacing.xs },

  category: {
    alignSelf: 'flex-start',
    backgroundColor: colors.secondarySoft,
    borderRadius: radius.round,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    marginTop: spacing.md,
  },
  categoryStory: { backgroundColor: colors.primarySoft },
  categoryText: { color: colors.textSecondary, fontSize: 11, fontWeight: '800' },
  categoryTextStory: { color: colors.primary },

  text: { color: colors.text, fontSize: 15, lineHeight: 22, marginTop: spacing.md },

  photo: {
    width: '100%',
    height: 240,
    borderRadius: radius.md,
    marginTop: spacing.md,
    backgroundColor: colors.surfaceLight,
  },

  whatsapp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.successSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    marginTop: spacing.md,
  },
  whatsappText: { color: colors.success, fontSize: 13, fontWeight: '800' },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.round,
  },
  actionLiked: { backgroundColor: colors.primarySoft },
  actionText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
  actionTextLiked: { color: colors.primary },
});

export default GoldCirclePostCard;
