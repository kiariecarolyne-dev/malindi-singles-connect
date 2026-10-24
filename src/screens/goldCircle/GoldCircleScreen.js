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
import { getDailyTopic, getFormat, nairobiDayKey } from '../../constants/goldCircleTopics';
import { getDailyChallenge } from '../../constants/goldCircleChallenges';
import {
  COUPLE_CHALLENGES,
  getDailyRelationshipPoll,
  getDailySideDilemma,
  WHO_KNOWS_QUESTIONS,
} from '../../constants/goldCircleLoveGames';
import { getDailyGreenRed } from '../../constants/goldCircleGames';
import { useAuth } from '../../context/AuthContext';
import { goldCircleService, premiumService, profileService } from '../../services';
import { colors, gradients, radius, spacing } from '../../theme';
import { pickPostImage } from '../../utils/imagePicker';
import GoldCircleComments from './GoldCircleComments';
import GoldCircleDailyTopic from './GoldCircleDailyTopic';
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

  const [view, setView] = useState('feed');
  const [savedPosts, setSavedPosts] = useState([]);
  const [savedIds, setSavedIds] = useState(() => new Set());
  const [feedCategory, setFeedCategory] = useState('for_you');

  const [text, setText] = useState('');
  const [category, setCategory] = useState('discussion');
  const [image, setImage] = useState(null);
  const [shareWhatsapp, setShareWhatsapp] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [location, setLocation] = useState('');
  const [budget, setBudget] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [composerError, setComposerError] = useState(null);

  const [dailyTopic, setDailyTopic] = useState(() => getDailyTopic());
  const [dailyChallenge, setDailyChallenge] = useState(() => getDailyChallenge());
  const [voteInfo, setVoteInfo] = useState({ dayKey: null, tally: null, myVote: null });
  const [voting, setVoting] = useState(false);
  const [challengeDone, setChallengeDone] = useState(false);
  const [challengeBusy, setChallengeBusy] = useState(false);
  const [dailyGame, setDailyGame] = useState(() => getDailyGreenRed());
  const [gameTally, setGameTally] = useState(null);
  const [gameVote, setGameVote] = useState(null);
  const [gameVoting, setGameVoting] = useState(false);

  const [sideDilemma, setSideDilemma] = useState(() => getDailySideDilemma());
  const [sideTally, setSideTally] = useState(null);
  const [sideVote, setSideVote] = useState(null);
  const [sideVoting, setSideVoting] = useState(false);

  const [relationshipPoll, setRelationshipPoll] = useState(() => getDailyRelationshipPoll());
  const [pollTally, setPollTally] = useState(null);
  const [pollVote, setPollVote] = useState(null);
  const [pollVoting, setPollVoting] = useState(false);

  const [quizMode, setQuizMode] = useState('solo');
  const [quizAnswers, setQuizAnswers] = useState(() => Array(WHO_KNOWS_QUESTIONS.length).fill(null));
  const [partnerAnswers, setPartnerAnswers] = useState(() => Array(WHO_KNOWS_QUESTIONS.length).fill(null));
  const [quizCompared, setQuizCompared] = useState(false);
  const [quizScore, setQuizScore] = useState(null);

  const [completedChallenges, setCompletedChallenges] = useState(() => new Set());
  const [sharingChallengeId, setSharingChallengeId] = useState(null);

  const inputRef = useRef(null);
  const listRef = useRef(null);
  const dayKey = dailyTopic.dayKey;
  const currentVote = voteInfo.dayKey === dayKey ? voteInfo : null;
  const myVote = currentVote ? currentVote.myVote : null;

  const fetchFirstPage = useCallback(async () => {
    const page = await goldCircleService.getFeed(user.uid, null, feedCategory);
    setPosts(page.posts);
    setCursor(page.nextCursor);
    setError(null);
    try {
      const ids = await goldCircleService.getSavedPostIds(user.uid);
      setSavedIds(new Set(ids));
    } catch {
      // Saved state is non-critical for feed rendering.
    }
  }, [user, feedCategory]);

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

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [counts, mine] = await Promise.all([
          goldCircleService.getDailyTally(dayKey),
          goldCircleService.getMyDailyVote(user.uid, dayKey),
        ]);
        if (active) {
          setVoteInfo({ dayKey, tally: counts, myVote: typeof mine === 'number' ? mine : null });
        }
      } catch {
        if (active) setVoteInfo({ dayKey, tally: null, myVote: null });
      }
    })();
    return () => {
      active = false;
    };
  }, [dayKey, user.uid]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const done = await goldCircleService.getDailyChallengeCompletion(user.uid, dailyChallenge.dayKey);
        if (active) setChallengeDone(done);
      } catch {
        if (active) setChallengeDone(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user.uid, dailyChallenge.dayKey]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [counts, mine] = await Promise.all([
          goldCircleService.getGameTally(dailyGame.dayKey),
          goldCircleService.getMyGameVote(user.uid, dailyGame.dayKey),
        ]);
        if (active) {
          setGameTally(counts);
          setGameVote(typeof mine === 'number' ? mine : null);
        }
      } catch {
        if (active) {
          setGameTally(null);
          setGameVote(null);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [user.uid, dailyGame.dayKey]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [counts, mine] = await Promise.all([
          goldCircleService.getSideTally(sideDilemma.dayKey),
          goldCircleService.getMySideVote(user.uid, sideDilemma.dayKey),
        ]);
        if (active) {
          setSideTally(counts);
          setSideVote(typeof mine === 'number' ? mine : null);
        }
      } catch {
        if (active) {
          setSideTally(null);
          setSideVote(null);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [user.uid, sideDilemma.dayKey]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [counts, mine] = await Promise.all([
          goldCircleService.getPollTally(relationshipPoll.dayKey),
          goldCircleService.getMyPollVote(user.uid, relationshipPoll.dayKey),
        ]);
        if (active) {
          setPollTally(counts);
          setPollVote(typeof mine === 'number' ? mine : null);
        }
      } catch {
        if (active) {
          setPollTally(null);
          setPollVote(null);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [user.uid, relationshipPoll.dayKey]);

  useEffect(() => {
    const timer = setInterval(() => {
      const nextTopic = getDailyTopic();
      setDailyTopic((current) => (current.dayKey === nextTopic.dayKey ? current : nextTopic));
      const nextChallenge = getDailyChallenge();
      setDailyChallenge((current) => (current.dayKey === nextChallenge.dayKey ? current : nextChallenge));
      const nextGame = getDailyGreenRed();
      setDailyGame((current) => (current.dayKey === nextGame.dayKey ? current : nextGame));
      const nextSide = getDailySideDilemma();
      setSideDilemma((current) => (current.dayKey === nextSide.dayKey ? current : nextSide));
      const nextPoll = getDailyRelationshipPoll();
      setRelationshipPoll((current) => (current.dayKey === nextPoll.dayKey ? current : nextPoll));
    }, 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const handleVote = async (optionIndex) => {
    if (voting || myVote !== null) return;
    setVoting(true);
    try {
      await goldCircleService.voteDailyTopic({ uid: user.uid, dayKey, optionIndex });
      const counts = await goldCircleService.getDailyTally(dayKey);
      setVoteInfo({ dayKey, tally: counts, myVote: optionIndex });
    } catch (e) {
      Alert.alert('Vote not saved', e.message || 'Please try again.');
    } finally {
      setVoting(false);
    }
  };

  const handleCompleteChallenge = async () => {
    if (challengeBusy || challengeDone) return;
    setChallengeBusy(true);
    try {
      await goldCircleService.completeDailyChallenge(user.uid, dailyChallenge.dayKey);
      setChallengeDone(true);
    } catch (e) {
      Alert.alert('Challenge not saved', e.message || 'Please try again.');
    } finally {
      setChallengeBusy(false);
    }
  };

  const handleGameVote = async (optionIndex) => {
    if (gameVoting || gameVote !== null) return;
    setGameVoting(true);
    try {
      await goldCircleService.voteGame({ uid: user.uid, dayKey: dailyGame.dayKey, optionIndex });
      const counts = await goldCircleService.getGameTally(dailyGame.dayKey);
      setGameTally(counts);
      setGameVote(optionIndex);
    } catch (e) {
      Alert.alert('Vote not saved', e.message || 'Please try again.');
    } finally {
      setGameVoting(false);
    }
  };

  const handleSideVote = async (optionIndex) => {
    if (sideVoting || sideVote !== null) return;
    setSideVoting(true);
    try {
      await goldCircleService.voteSide({ uid: user.uid, dayKey: sideDilemma.dayKey, optionIndex });
      const counts = await goldCircleService.getSideTally(sideDilemma.dayKey);
      setSideTally(counts);
      setSideVote(optionIndex);
    } catch (e) {
      Alert.alert('Vote not saved', e.message || 'Please try again.');
    } finally {
      setSideVoting(false);
    }
  };

  const handlePollVote = async (optionIndex) => {
    if (pollVoting || pollVote !== null) return;
    setPollVoting(true);
    try {
      await goldCircleService.votePoll({
        uid: user.uid,
        pollKey: relationshipPoll.dayKey,
        optionIndex,
        optionCount: relationshipPoll.options.length,
      });
      const counts = await goldCircleService.getPollTally(relationshipPoll.dayKey);
      setPollTally(counts);
      setPollVote(optionIndex);
    } catch (e) {
      Alert.alert('Vote not saved', e.message || 'Please try again.');
    } finally {
      setPollVoting(false);
    }
  };

  const setQuizAnswer = (mode, index, value) => {
    if (mode === 'solo') {
      setQuizAnswers((prev) => {
        const next = [...prev];
        next[index] = value;
        return next;
      });
      setQuizScore(null);
    } else {
      setPartnerAnswers((prev) => {
        const next = [...prev];
        next[index] = value;
        return next;
      });
      setQuizCompared(false);
    }
  };

  const scoreQuiz = () => {
    const score = WHO_KNOWS_QUESTIONS.reduce(
      (sum, q, i) => sum + (quizAnswers[i] === q.answer ? 1 : 0),
      0,
    );
    setQuizScore(score);
  };

  const compareQuiz = () => {
    setQuizCompared(true);
  };

  const shareChallenge = async (challenge) => {
    if (sharingChallengeId) return;
    setSharingChallengeId(challenge.id);
    try {
      const created = await goldCircleService.createPost({
        uid: user.uid,
        profile,
        text: `${challenge.title}: ${challenge.detail}`,
        category: 'couple_moment',
        image: null,
        whatsapp: null,
        isAnonymous: false,
        location: null,
        budget: null,
      });
      setPosts((prev) => [created, ...prev]);
      setCompletedChallenges((prev) => {
        const next = new Set(prev);
        next.add(challenge.id);
        return next;
      });
      Alert.alert('Shared', 'Your couple challenge is now a Gold Circle post.');
    } catch (e) {
      Alert.alert('Could not share', e.message || 'Please try again.');
    } finally {
      setSharingChallengeId(null);
    }
  };

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
      const page = await goldCircleService.getFeed(user.uid, cursor, feedCategory);
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
  }, [cursor, loadingMore, loading, user, feedCategory]);

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
    // Explicit opt-in only — the number is confirmed again before publishing.
    setShareWhatsapp(true);
    setWhatsappNumber((prev) => prev || profile?.phone || profile?.whatsapp || '');
  };

  const confirmPublish = (title, message, confirmLabel) =>
    new Promise((resolve) => {
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, onPress: () => resolve(true) },
      ]);
    });

  const submit = async () => {
    if (submitting) return;
    setComposerError(null);
    if (!text.trim() && !image) {
      setComposerError('Write something or add a photo before you share.');
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
      const confirmed = await confirmPublish(
        '📱 Share my WhatsApp?',
        `${whatsapp} will be visible to Gold Circle members on this post. Publish now?`,
        'Publish',
      );
      if (!confirmed) return;
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
        isAnonymous,
        location: location.trim() || null,
        budget: budget.trim() || null,
      });
      setPosts((prev) => [created, ...prev]);
      setText('');
      setCategory('discussion');
      setImage(null);
      setShareWhatsapp(false);
      setWhatsappNumber('');
      setIsAnonymous(false);
      setLocation('');
      setBudget('');
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

  const onPressSave = async (post) => {
    if (busyPostId) return;
    setBusyPostId(post.id);
    try {
      const saved = await goldCircleService.toggleSave(user.uid, post.id);
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (saved) next.add(post.id);
        else next.delete(post.id);
        return next;
      });
      if (view === 'saved' && !saved) {
        setSavedPosts((prev) => prev.filter((p) => p.id !== post.id));
      }
    } catch (e) {
      Alert.alert('Could not save', e.message || 'Please try again.');
    } finally {
      setBusyPostId(null);
    }
  };

  const loadSaved = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await goldCircleService.getSavedPosts(user.uid);
      setSavedPosts(rows);
      setError(null);
    } catch (e) {
      setError(e.message || 'Could not load saved posts.');
    } finally {
      setLoading(false);
    }
  }, [user]);

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
    const _opts = [
      {
        text: 'Report post',
        onPress: () =>
          navigation.navigate('Report', { uid: post.authorUid || null, context: 'Gold Circle post' }),
      },
    ];
    if (post.authorUid) {
      _opts.push({ text: 'Block member', style: 'destructive', onPress: () => confirmBlock(post) });
    }
    _opts.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Post options', undefined, _opts);
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
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </TouchableOpacity>
          ) : (
            <View style={styles.heroSide} />
          )}
          <Text style={styles.heroTitle}>Gold Circle 🔥</Text>
          <TouchableOpacity
            style={styles.heroSide}
            onPress={() => {
              if (view === 'saved') {
                setView('feed');
              } else {
                setView('saved');
                loadSaved();
              }
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={view === 'saved' ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={view === 'saved' ? colors.gold : colors.text}
            />
          </TouchableOpacity>
        </View>
        <Text style={styles.heroSub}>One topic a day. One community. Talk about what matters.</Text>
        <LinearGradient
          colors={gradients.gold}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.heroLine}
        />
      </View>

      <GoldCircleDailyTopic
        topic={dailyTopic}
        format={getFormat(dailyTopic.format)}
        tally={currentVote ? currentVote.tally : null}
        myVote={myVote}
        voting={voting}
        onVote={handleVote}
        onJoin={() => inputRef.current?.focus()}
      />

      <View style={styles.challengeCard}>
        <Text style={styles.challengeKicker}>DAILY LOVE CHALLENGE</Text>
        <Text style={styles.challengePrompt}>{dailyChallenge.prompt}</Text>
        <TouchableOpacity
          style={[styles.challengeBtn, challengeDone && styles.challengeBtnDone]}
          onPress={handleCompleteChallenge}
          disabled={challengeBusy || challengeDone}
          activeOpacity={0.85}
        >
          <Ionicons
            name={challengeDone ? 'checkmark-circle' : 'ellipse-outline'}
            size={18}
            color={challengeDone ? colors.success : colors.gold}
          />
          <Text style={[styles.challengeBtnText, challengeDone && styles.challengeBtnTextDone]}>
            {challengeDone ? 'Completed' : challengeBusy ? 'Saving…' : 'Mark complete'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.gameCard}>
        <Text style={styles.gameKicker}>GREEN FLAG OR RED FLAG?</Text>
        <Text style={styles.gameStatement}>{dailyGame.statement}</Text>
        <View style={styles.gameOptions}>
          {['Green flag', 'Red flag'].map((label, index) => {
            const count = Array.isArray(gameTally) ? gameTally[index] || 0 : 0;
            const total = Array.isArray(gameTally) ? gameTally.reduce((s, n) => s + (n || 0), 0) : 0;
            const percent = total > 0 ? Math.round((count / total) * 100) : 0;
            const selected = gameVote === index;
            const voted = gameVote !== null;
            return (
              <TouchableOpacity
                key={label}
                style={[styles.gameBtn, index === 0 ? styles.gameBtnGreen : styles.gameBtnRed, selected && styles.gameBtnSelected]}
                onPress={() => handleGameVote(index)}
                disabled={gameVoting || voted}
                activeOpacity={0.85}
              >
                {voted ? <View style={[styles.gameFill, { width: `${percent}%` }]} /> : null}
                <Text style={styles.gameBtnText}>{selected ? '✓ ' : ''}{label}</Text>
                {voted ? <Text style={styles.gamePct}>{percent}%</Text> : null}
              </TouchableOpacity>
            );
          })}
        </View>
        {gameVote !== null ? (
          <Text style={styles.gameNote}>
            {Array.isArray(gameTally) ? gameTally.reduce((s, n) => s + (n || 0), 0) : 0} Gold members voted
          </Text>
        ) : (
          <Text style={styles.gameNote}>Pick a side to see how everyone voted.</Text>
        )}
      </View>

      <View style={styles.gameCard}>
        <Text style={styles.gameKicker}>CHOOSE A SIDE</Text>
        <Text style={styles.gameStatement}>{sideDilemma.prompt}</Text>
        <View style={styles.gameOptions}>
          {sideDilemma.options.map((label, index) => {
            const count = Array.isArray(sideTally) ? sideTally[index] || 0 : 0;
            const total = Array.isArray(sideTally) ? sideTally.reduce((s, n) => s + (n || 0), 0) : 0;
            const percent = total > 0 ? Math.round((count / total) * 100) : 0;
            const selected = sideVote === index;
            const voted = sideVote !== null;
            return (
              <TouchableOpacity
                key={label}
                style={[styles.gameBtn, index === 0 ? styles.gameBtnGreen : styles.gameBtnRed, selected && styles.gameBtnSelected]}
                onPress={() => handleSideVote(index)}
                disabled={sideVoting || voted}
                activeOpacity={0.85}
              >
                {voted ? <View style={[styles.gameFill, { width: `${percent}%` }]} /> : null}
                <Text style={styles.gameBtnText}>{selected ? '✓ ' : ''}{label}</Text>
                {voted ? <Text style={styles.gamePct}>{percent}%</Text> : null}
              </TouchableOpacity>
            );
          })}
        </View>
        {sideVote !== null ? (
          <Text style={styles.gameNote}>
            {Array.isArray(sideTally) ? sideTally.reduce((s, n) => s + (n || 0), 0) : 0} Gold members chose
          </Text>
        ) : (
          <Text style={styles.gameNote}>Pick a side to see how everyone voted.</Text>
        )}
      </View>

      <View style={styles.gameCard}>
        <Text style={styles.gameKicker}>RELATIONSHIP POLL</Text>
        <Text style={styles.gameStatement}>{relationshipPoll.question}</Text>
        {relationshipPoll.expiresDayKey && relationshipPoll.expiresDayKey < nairobiDayKey() ? (
          <Text style={styles.gameNote}>This poll is no longer available.</Text>
        ) : (
          <>
            <View style={styles.gameOptions}>
              {relationshipPoll.options.map((label, index) => {
                const count = Array.isArray(pollTally) ? pollTally[index] || 0 : 0;
                const total = Array.isArray(pollTally) ? pollTally.reduce((s, n) => s + (n || 0), 0) : 0;
                const percent = total > 0 ? Math.round((count / total) * 100) : 0;
                const selected = pollVote === index;
                const voted = pollVote !== null;
                return (
                  <TouchableOpacity
                    key={label}
                    style={[styles.gameBtn, styles.gameBtnRed, selected && styles.gameBtnSelected]}
                    onPress={() => handlePollVote(index)}
                    disabled={pollVoting || voted}
                    activeOpacity={0.85}
                  >
                    {voted ? <View style={[styles.gameFill, { width: `${percent}%` }]} /> : null}
                    <Text style={styles.gameBtnText}>{selected ? '✓ ' : ''}{label}</Text>
                    {voted ? <Text style={styles.gamePct}>{percent}%</Text> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
            {pollVote !== null ? (
              <Text style={styles.gameNote}>
                {Array.isArray(pollTally) ? pollTally.reduce((s, n) => s + (n || 0), 0) : 0} Gold members voted
              </Text>
            ) : (
              <Text style={styles.gameNote}>Pick an option to see the results.</Text>
            )}
          </>
        )}
      </View>

      <View style={styles.gameCard}>
        <Text style={styles.gameKicker}>WHO KNOWS THEIR PARTNER BEST?</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
          <TouchableOpacity style={[styles.chip, quizMode === 'solo' && styles.chipOn]} onPress={() => setQuizMode('solo')}>
            <Text style={[styles.chipText, quizMode === 'solo' && styles.chipTextOn]}>Solo practice</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.chip, quizMode === 'couple' && styles.chipOn]} onPress={() => setQuizMode('couple')}>
            <Text style={[styles.chipText, quizMode === 'couple' && styles.chipTextOn]}>Couple mode</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.gameNote}>
          {quizMode === 'solo'
            ? 'Private practice only. Your answers are not shared.'
            : 'Each partner answers privately. Compare only when both are ready.'}
        </Text>
        {WHO_KNOWS_QUESTIONS.map((q, qi) => {
          const answers = quizMode === 'solo' ? quizAnswers : partnerAnswers;
          return (
            <View key={q.id} style={{ marginTop: spacing.md }}>
              <Text style={styles.challengePrompt}>{q.question}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs }}>
                {q.options.map((opt, oi) => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.chip, answers[qi] === oi && styles.chipOn]}
                    onPress={() => setQuizAnswer(quizMode === 'solo' ? 'solo' : 'couple', qi, oi)}
                  >
                    <Text style={[styles.chipText, answers[qi] === oi && styles.chipTextOn]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        })}
        {quizMode === 'solo' ? (
          <Button
            title={quizScore === null ? 'Score my answers' : `Score: ${quizScore}/${WHO_KNOWS_QUESTIONS.length}`}
            variant="gold"
            small
            onPress={scoreQuiz}
            style={{ marginTop: spacing.md }}
          />
        ) : (
          <>
            <Button
              title="Compare answers"
              variant="gold"
              small
              onPress={compareQuiz}
              disabled={partnerAnswers.includes(null) || quizAnswers.includes(null)}
              style={{ marginTop: spacing.md }}
            />
            {quizCompared ? (
              <Text style={styles.gameNote}>
                You agreed on{' '}
                {WHO_KNOWS_QUESTIONS.reduce((sum, _q, i) => sum + (quizAnswers[i] === partnerAnswers[i] ? 1 : 0), 0)}{' '}
                of {WHO_KNOWS_QUESTIONS.length} questions. Private answers stay on this device.
              </Text>
            ) : (
              <Text style={styles.gameNote}>Answers stay private until you choose to compare.</Text>
            )}
          </>
        )}
      </View>

      <View style={styles.gameCard}>
        <Text style={styles.gameKicker}>SHAREABLE COUPLE CHALLENGES</Text>
        <Text style={styles.gameNote}>Complete together. Sharing is always your explicit choice.</Text>
        {COUPLE_CHALLENGES.map((challenge) => {
          const done = completedChallenges.has(challenge.id);
          return (
            <View key={challenge.id} style={{ marginTop: spacing.md }}>
              <Text style={styles.challengePrompt}>{challenge.title}</Text>
              <Text style={styles.gameNote}>{challenge.detail}</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                <TouchableOpacity
                  style={[styles.challengeBtn, done && styles.challengeBtnDone]}
                  onPress={() => {
                    setCompletedChallenges((prev) => {
                      const next = new Set(prev);
                      if (done) next.delete(challenge.id);
                      else next.add(challenge.id);
                      return next;
                    });
                  }}
                >
                  <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={done ? colors.success : colors.gold} />
                  <Text style={[styles.challengeBtnText, done && styles.challengeBtnTextDone]}>
                    {done ? 'Completed' : 'Mark done'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.challengeBtn}
                  onPress={() => shareChallenge(challenge)}
                  disabled={sharingChallengeId === challenge.id}
                >
                  <Ionicons name="share-outline" size={16} color={colors.gold} />
                  <Text style={styles.challengeBtnText}>
                    {sharingChallengeId === challenge.id ? 'Sharing…' : 'Share as post'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>

      {view === 'feed' ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.feedCategoryRow}
        >
          {goldCircleService.CATEGORIES.map((c) => {
            const on = feedCategory === c.id;
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.feedCategoryChip, on && styles.feedCategoryChipOn]}
                onPress={() => setFeedCategory(c.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.feedCategoryText, on && styles.feedCategoryTextOn]}>
                  {c.emoji} {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}

      <View style={styles.composer}>
        <View style={styles.composerHead}>
          <Avatar uri={profile?.photos?.[0]} name={profile?.fullName} size={32} />
          <Text style={styles.composerTitle}>Join today&apos;s discussion</Text>
        </View>

        <TextInput
          ref={inputRef}
          style={styles.composerInput}
          value={text}
          onChangeText={(value) => {
            setText(value);
            if (composerError) setComposerError(null);
          }}
          placeholder="Share your take on today&apos;s topic, or post your own..."
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={LIMITS.goldCirclePostMaxLength}
          editable={!submitting}
        />

        {image ? (
          <View style={styles.previewWrap}>
            <Text style={styles.previewLabel}>📷 {image.fileName || 'Photo attached'}</Text>
            <TouchableOpacity onPress={() => setImage(null)} style={styles.previewRemove}>
              <Ionicons name="close-circle" size={18} color={colors.danger} />
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

        <View style={styles.composerOptions}>
          <TouchableOpacity
            style={[styles.toggleRow, isAnonymous && styles.toggleRowOn]}
            onPress={() => setIsAnonymous((v) => !v)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={isAnonymous ? 'eye-off' : 'eye-outline'}
              size={15}
              color={isAnonymous ? colors.gold : colors.textSecondary}
            />
            <Text style={[styles.toggleText, isAnonymous && styles.toggleTextOn]}>
              {isAnonymous ? 'Anonymous confession' : 'Post as yourself'}
            </Text>
          </TouchableOpacity>

          <View style={styles.extraRow}>
            <TextInput
              style={styles.extraInput}
              value={location}
              onChangeText={setLocation}
              placeholder="Date idea location (optional)"
              placeholderTextColor={colors.textMuted}
              editable={!submitting}
            />
            <TextInput
              style={styles.extraInput}
              value={budget}
              onChangeText={setBudget}
              placeholder="Budget (optional)"
              placeholderTextColor={colors.textMuted}
              editable={!submitting}
            />
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {goldCircleService.CATEGORIES.filter((c) => c.id !== 'photo').map((c) => {
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
            <Ionicons name="image-outline" size={17} color={image ? colors.gold : colors.textSecondary} />
            <Text style={[styles.attachText, image && styles.attachTextOn]}>Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.attachBtn}
            onPress={toggleWhatsapp}
            disabled={submitting}
          >
            <Ionicons
              name="logo-whatsapp"
              size={17}
              color={shareWhatsapp ? colors.success : colors.textSecondary}
            />
            <Text style={[styles.attachText, shareWhatsapp && styles.attachTextSuccess]}>
              {shareWhatsapp ? 'Sharing' : 'WhatsApp'}
            </Text>
          </TouchableOpacity>

          <Button
            title="Post"
            variant="gold"
            icon="send"
            small
            onPress={submit}
            loading={submitting}
            disabled={(!text.trim() && !image) || submitting}
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
          data={view === 'saved' ? savedPosts : posts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <GoldCirclePostCard
              post={item}
              viewerUid={user.uid}
              saved={savedIds.has(item.id)}
              onPressSave={onPressSave}
              onPressAuthor={(p) => {
                if (p.authorUid) navigation.navigate('ProfileDetail', { uid: p.authorUid });
              }}
              onPressLike={onPressLike}
              onPressComments={setCommentsPost}
              onPressMenu={onPressMenu}
            />
          )}
          ListHeaderComponent={header}
          ListEmptyComponent={
            view === 'saved' ? (
              <EmptyState
                emoji="🔖"
                title="No saved posts yet"
                message="Save posts you want to revisit and they will appear here."
              />
            ) : empty
          }
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
          onEndReached={view === 'feed' ? onLoadMore : undefined}
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
          onOpenAuthor={(uid) => {
            setCommentsPost(null);
            navigation.navigate('ProfileDetail', { uid });
          }}
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
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.goldSoft,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  heroSide: { width: 32, alignItems: 'center' },
  heroTitle: {
    flex: 1,
    textAlign: 'center',
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  heroSub: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  heroLine: { width: 48, height: 2, borderRadius: 2, alignSelf: 'center', marginTop: spacing.md },

  challengeCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.goldSoft,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  challengeKicker: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  challengePrompt: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  challengeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.goldSoft,
  },
  challengeBtnDone: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
  },
  challengeBtnText: { color: colors.gold, fontSize: 13, fontWeight: '700' },
  challengeBtnTextDone: { color: colors.success },
  gameCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.goldSoft,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  gameKicker: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  gameStatement: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: spacing.sm,
  },
  gameOptions: { gap: spacing.sm, marginTop: spacing.md },
  gameBtn: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gameBtnGreen: { borderColor: colors.success, backgroundColor: colors.successSoft },
  gameBtnRed: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  gameBtnSelected: { borderWidth: 2 },
  gameFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.08)' },
  gameBtnText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  gamePct: { color: colors.text, fontSize: 13, fontWeight: '800' },
  gameNote: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm },
  composer: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  composerHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  composerTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  composerInput: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    minHeight: 64,
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
    backgroundColor: colors.surfaceLight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  whatsappLabel: { color: colors.text, fontSize: 11, fontWeight: '700' },
  whatsappInput: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: spacing.xs,
    paddingVertical: 4,
  },
  whatsappHint: { color: colors.textMuted, fontSize: 11, marginTop: 2 },

  chipRow: { gap: spacing.xs, paddingVertical: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceLight,
    borderRadius: radius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  chipOn: { borderColor: colors.gold, backgroundColor: colors.goldSoft },
  chipText: { color: colors.textSecondary, fontSize: 11, fontWeight: '600' },
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
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  attachText: { color: colors.textSecondary, fontSize: 11, fontWeight: '600' },
  attachTextOn: { color: colors.gold },
  attachTextSuccess: { color: colors.success },
  postBtn: { flex: 1 },

  feedCategoryRow: { gap: spacing.xs, paddingVertical: spacing.sm },
  feedCategoryChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceLight,
    borderRadius: radius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    marginRight: spacing.xs,
  },
  feedCategoryChipOn: { borderColor: colors.gold, backgroundColor: colors.goldSoft },
  feedCategoryText: { color: colors.textSecondary, fontSize: 11, fontWeight: '600' },
  feedCategoryTextOn: { color: colors.gold },

  composerOptions: { marginTop: spacing.sm, gap: spacing.sm },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceLight,
  },
  toggleRowOn: { borderColor: colors.gold, backgroundColor: colors.goldSoft },
  toggleText: { color: colors.textSecondary, fontSize: 11, fontWeight: '600' },
  toggleTextOn: { color: colors.gold },
  extraRow: { flexDirection: 'row', gap: spacing.sm },
  extraInput: {
    flex: 1,
    backgroundColor: colors.surfaceLight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 13,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },

  counter: { color: colors.textMuted, fontSize: 11, textAlign: 'right', marginTop: spacing.xs },
});

export default GoldCircleScreen;
