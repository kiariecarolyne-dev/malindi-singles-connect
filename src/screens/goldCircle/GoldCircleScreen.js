import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
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
import Button from '../../components/Button';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import Screen from '../../components/Screen';
import Skeleton from '../../components/Skeleton';
import { LIMITS } from '../../config/env';
import { useAuth } from '../../context/AuthContext';
import { goldCircleService, premiumService, profileService } from '../../services';
import { colors, gradients, radius, spacing } from '../../theme';
import { pickPostImage } from '../../utils/imagePicker';
import GoldCircleComments from './GoldCircleComments';
import GoldCirclePostCard from './GoldCirclePostCard';
import GoldCircleUpgrade from './GoldCircleUpgrade';

/**
 * 💛 GOLD CIRCLE — the Gold-only community.
 *
 * Free members never reach the feed: this screen renders a polished
 * upgrade paywall instead, and the service layer + Firestore rules
 * deny every read/write regardless of what the client tries.
 */
const GoldCircleScreen = (props) => {
  const { user, profile } = useAuth();
  const gold = premiumService.isGold(profile);
  return gold && user ? <GoldCircleFeed {...props} /> : <GoldCircleUpgrade {...props} />;
};

/* ------------------------------------------------------------------ *
 * Feed                                                                *
 * ------------------------------------------------------------------ */

const GoldCircleFeed = ({ navigation }) => {
  const { user, profile } = useAuth();

  const [posts, setPosts] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [commentsPost, setCommentsPost] = useState(null);
  const [busyPostId, setBusyPostId] = useState(null);

  const [text, setText] = useState('');
  const [category, setCategory] = useState('discussion');
  const [image, setImage] = useState(null);
  const [shareWhatsapp, setShareWhatsapp] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [composerError, setComposerError] = useState(null);

  const inputRef = useRef(null);
  const listRef = useRef(null);

  const fetchFirstPage = useCallback(async () => {
    const page = await goldCircleService.getFeed(user.uid, null);
    setPosts(page.posts);
    setCursor(page.nextCursor);
    setError(null);
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await fetchFirstPage();
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load Gold Circle.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchFirstPage]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchFirstPage();
    } catch (e) {
      setError(e.message || 'Could not refresh Gold Circle.');
    } finally {
      setRefreshing(false);
    }
  }, [fetchFirstPage]);

  const onLoadMore = useCallback(async () => {
    if (!cursor || loadingMore || loading) return;
    setLoadingMore(true);
    try {
      const page = await goldCircleService.getFeed(user.uid, cursor);
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...page.posts.filter((p) => !seen.has(p.id))];
      });
      setCursor(page.nextCursor);
    } catch {
      // Pagination failures keep the already-loaded feed usable.
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, loading, user]);

  /* ---------------- composer ---------------- */

  const attachPhoto = async () => {
    try {
      const picked = await pickPostImage();
      if (picked) setImage(picked);
    } catch (e) {
      Alert.alert('Could not add photo', e.message || 'Please try again.');
    }
  };

  const toggleWhatsapp = () => {
    if (shareWhatsapp) {
      setShareWhatsapp(false);
      setWhatsappNumber('');
      return;
    }
    Alert.alert(
      '📱 Share my WhatsApp',
      'Your WhatsApp number will be visible to Gold Circle members. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => {
            setShareWhatsapp(true);
            setWhatsappNumber((prev) => prev || profile?.phone || profile?.whatsapp || '');
          },
        },
      ],
    );
  };

  const submit = async () => {
    if (submitting) return;
    setComposerError(null);
    if (!text.trim()) {
      setComposerError('Your post needs some text before you share it.');
      return;
    }
    let whatsapp = null;
    if (shareWhatsapp) {
      try {
        whatsapp = goldCircleService.normalizeWhatsApp(whatsappNumber);
      } catch (e) {
        setComposerError(e.message);
        return;
      }
    }

    setSubmitting(true);
    try {
      const created = await goldCircleService.createPost({
        uid: user.uid,
        profile,
        text,
        category,
        image,
        whatsapp,
      });
      setPosts((prev) => [created, ...prev]);
      setText('');
      setCategory('discussion');
      setImage(null);
      setShareWhatsapp(false);
      setWhatsappNumber('');
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    } catch (e) {
      setComposerError(e.message || 'Could not share your post.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------------- post actions ---------------- */

  const onPressLike = async (post) => {
    if (busyPostId) return;
    setBusyPostId(post.id);
    try {
      const next = await goldCircleService.toggleLike(user.uid, post.id);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id ? { ...p, likedBy: next.likedBy, likeCount: next.likeCount } : p,
        ),
      );
    } catch (e) {
      Alert.alert('Could not update', e.message || 'Please try again.');
    } finally {
      setBusyPostId(null);
    }
  };

  const confirmDelete = (post) => {
    Alert.alert('Delete post', 'Delete this post from Gold Circle?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await goldCircleService.deletePost(user.uid, post);
            setPosts((prev) => prev.filter((p) => p.id !== post.id));
          } catch (e) {
            Alert.alert('Could not delete', e.message || 'Please try again.');
          }
        },
      },
    ]);
  };

  const confirmBlock = (post) => {
    Alert.alert(
      'Block member',
      `Block ${post.authorName}? Their posts will no longer appear in your Gold Circle.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await profileService.blockUser(user.uid, post.authorUid);
              setPosts((prev) => prev.filter((p) => p.authorUid !== post.authorUid));
            } catch (e) {
              Alert.alert('Could not block', e.message || 'Please try again.');
            }
          },
        },
      ],
    );
  };

  const onPressMenu = (post, isOwn) => {
    if (isOwn) {
      Alert.alert('Your post', undefined, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete post', style: 'destructive', onPress: () => confirmDelete(post) },
      ]);
      return;
    }
    Alert.alert('Post options', undefined, [
      {
        text: 'Report post',
        onPress: () =>
          navigation.navigate('Report', { uid: post.authorUid, context: 'Gold Circle post' }),
      },
      { text: 'Block member', style: 'destructive', onPress: () => confirmBlock(post) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const onCommentCountChange = (delta) => {
    if (!commentsPost) return;
    setPosts((prev) =>
      prev.map((p) =>
        p.id === commentsPost.id
          ? { ...p, commentCount: Math.max(0, (p.commentCount || 0) + delta) }
          : p,
      ),
    );
  };

  /* ---------------- header + composer ---------------- */

  const canGoBack = navigation.canGoBack();

  const header = (
    <View>
      <View style={styles.hero}>
        <View style={styles.heroRow}>
          {canGoBack ? (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.heroSide}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </TouchableOpacity>
          ) : (
            <View style={styles.heroSide} />
          )}
          <Text style={styles.heroTitle}>💛 GOLD CIRCLE</Text>
          <View style={styles.heroSide} />
        </View>
        <Text style={styles.heroSub}>Exclusive community for Malindi Gold members</Text>
        <LinearGradient
          colors={gradients.gold}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.heroLine}
        />
      </View>

      <View style={styles.composer}>
        <View style={styles.composerHead}>
          <Avatar uri={profile?.photos?.[0]} name={profile?.fullName} size={36} />
          <Text style={styles.composerTitle}>What&apos;s on your mind?</Text>
        </View>

        <TextInput
          ref={inputRef}
          style={styles.composerInput}
          value={text}
          onChangeText={(value) => {
            setText(value);
            if (composerError) setComposerError(null);
          }}
          placeholder="Share your thoughts, relationship experiences, questions, photos or success story..."
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={LIMITS.goldCirclePostMaxLength}
          editable={!submitting}
        />

        {image ? (
          <View style={styles.previewWrap}>
            <Text style={styles.previewLabel}>📷 {image.fileName || 'Photo attached'}</Text>
            <TouchableOpacity onPress={() => setImage(null)} style={styles.previewRemove}>
              <Ionicons name="close-circle" size={20} color={colors.danger} />
            </TouchableOpacity>
          </View>
        ) : null}

        {shareWhatsapp ? (
          <View style={styles.whatsappBox}>
            <Text style={styles.whatsappLabel}>Your WhatsApp number</Text>
            <TextInput
              style={styles.whatsappInput}
              value={whatsappNumber}
              onChangeText={setWhatsappNumber}
              placeholder="07XXXXXXXX"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              maxLength={20}
              editable={!submitting}
            />
            <Text style={styles.whatsappHint}>
              Only shown on this post — Gold Circle members will see it.
            </Text>
          </View>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {goldCircleService.CATEGORIES.map((c) => {
            const on = category === c.id;
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.chip, on && styles.chipOn]}
                onPress={() => setCategory(c.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>
                  {c.emoji} {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {composerError ? <Text style={styles.composerError}>{composerError}</Text> : null}

        <View style={styles.composerActions}>
          <TouchableOpacity style={styles.attachBtn} onPress={attachPhoto} disabled={submitting}>
            <Ionicons name="image-outline" size={20} color={image ? colors.gold : colors.textSecondary} />
            <Text style={[styles.attachText, image && styles.attachTextOn]}>Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.attachBtn, shareWhatsapp && styles.attachBtnOn]}
            onPress={toggleWhatsapp}
            disabled={submitting}
          >
            <Ionicons
              name="logo-whatsapp"
              size={20}
              color={shareWhatsapp ? colors.success : colors.textSecondary}
            />
            <Text style={[styles.attachText, shareWhatsapp && styles.attachTextSuccess]}>
              {shareWhatsapp ? 'Sharing' : 'Share my WhatsApp'}
            </Text>
          </TouchableOpacity>

          <Button
            title="Post"
            variant="gold"
            small
            onPress={submit}
            loading={submitting}
            disabled={!text.trim() || submitting}
            style={styles.postBtn}
          />
        </View>

        {text.length > LIMITS.goldCirclePostMaxLength - 400 ? (
          <Text style={styles.counter}>
            {text.length}/{LIMITS.goldCirclePostMaxLength}
          </Text>
        ) : null}
      </View>
    </View>
  );

  const empty = (
    <EmptyState
      emoji="💛"
      title="Welcome to Gold Circle"
      message="Be one of the first members to start the conversation."
      actionLabel="Share something with the community"
      onAction={() => inputRef.current?.focus()}
    />
  );

  /* ---------------- render ---------------- */

  if (loading) {
    return (
      <Screen edges={['top']}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>💛 GOLD CIRCLE</Text>
          <Text style={styles.heroSub}>Exclusive community for Malindi Gold members</Text>
        </View>
        <View style={styles.loading}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={150} style={styles.skel} />
          ))}
          <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.lg }} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      {error && !posts.length ? (
        <View>
          {header}
          <ErrorState message={error} onRetry={async () => {
            setLoading(true);
            try {
              await fetchFirstPage();
            } catch (e) {
              setError(e.message || 'Could not load Gold Circle.');
            } finally {
              setLoading(false);
            }
          }} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <GoldCirclePostCard
              post={item}
              viewerUid={user.uid}
              onPressLike={onPressLike}
              onPressComments={setCommentsPost}
              onPressMenu={onPressMenu}
            />
          )}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={colors.gold} style={{ marginVertical: spacing.lg }} />
            ) : null
          }
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.gold}
              colors={[colors.gold]}
            />
          }
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.4}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      )}

      {commentsPost ? (
        <GoldCircleComments
          post={commentsPost}
          onClose={() => setCommentsPost(null)}
          onCountChange={onCommentCountChange}
        />
      ) : null}
    </Screen>
  );
};

const styles = StyleSheet.create({
  list: { padding: spacing.lg, paddingBottom: spacing.xxxl },

  loading: { paddingHorizontal: spacing.lg, gap: spacing.md, marginTop: spacing.md },
  skel: { borderRadius: radius.lg },

  hero: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.goldSoft,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  heroSide: { width: 34, alignItems: 'center' },
  heroTitle: {
    flex: 1,
    textAlign: 'center',
    color: colors.text,
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  heroSub: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  heroLine: { height: 3, borderRadius: 2, alignSelf: 'stretch', marginTop: spacing.md },

  composer: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  composerHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  composerTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  composerInput: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    minHeight: 76,
    textAlignVertical: 'top',
    marginTop: spacing.sm,
  },

  previewWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.goldSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  previewLabel: { color: colors.gold, fontSize: 13, fontWeight: '700', flex: 1 },
  previewRemove: { padding: 2 },

  whatsappBox: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.success,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  whatsappLabel: { color: colors.text, fontSize: 12, fontWeight: '800' },
  whatsappInput: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: spacing.xs,
    paddingVertical: 4,
  },
  whatsappHint: { color: colors.textMuted, fontSize: 11, marginTop: 2 },

  chipRow: { gap: spacing.sm, paddingVertical: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceLight,
    borderRadius: radius.round,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  chipOn: { borderColor: colors.gold, backgroundColor: colors.goldSoft },
  chipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  chipTextOn: { color: colors.gold },

  composerError: { color: colors.danger, fontSize: 12, marginTop: spacing.xs },

  composerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceLight,
    borderRadius: radius.round,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  attachBtnOn: { borderColor: colors.success },
  attachText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  attachTextOn: { color: colors.gold },
  attachTextSuccess: { color: colors.success },
  postBtn: { flex: 1 },

  counter: { color: colors.textMuted, fontSize: 11, textAlign: 'right', marginTop: spacing.xs },
});

export default GoldCircleScreen;
