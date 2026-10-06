import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import Screen from '../../components/Screen';
import ScreenHeader from '../../components/ScreenHeader';
import Skeleton from '../../components/Skeleton';
import { useAuth } from '../../context/AuthContext';
import { profileService } from '../../services';
import { colors, radius, spacing } from '../../theme';

const BlockedUsersScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [blocked, setBlocked] = useState([]);

  const load = useCallback(async () => {
    if (!user?.uid) return;
    try {
      setBlocked(await profileService.getBlockedUsers(user.uid));
      setError(null);
    } catch (e) {
      setError(e.message || 'Could not load blocked users.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const unblock = async (p) => {
    await profileService.unblockUser(user.uid, p.uid);
    setBlocked((prev) => prev.filter((x) => x.uid !== p.uid));
  };

  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Blocked Users" onBack={() => navigation.goBack()} />
      {loading ? (
        <View style={styles.loading}>
          {[0, 1].map((i) => (
            <Skeleton key={i} height={72} style={styles.skel} />
          ))}
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !blocked.length ? (
        <EmptyState
          emoji="🕊️"
          title="No one is blocked"
          message="If someone makes you uncomfortable you can block them from any profile or chat — they will show up here."
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.hint}>
            Blocked people cannot see you, message you or appear in Discover. Unblock any time.
          </Text>
          {blocked.map((p) => (
            <View key={p.uid} style={styles.row}>
              <Avatar uri={p.photos?.[0]} name={p.fullName} size={48} />
              <View style={styles.body}>
                <Text style={styles.name}>{p.fullName}</Text>
                <Text style={styles.area}>{p.area || ''}</Text>
              </View>
              <TouchableOpacity style={styles.unblockBtn} onPress={() => unblock(p)}>
                <Ionicons name="lock-open-outline" size={15} color={colors.primary} />
                <Text style={styles.unblockText}>Unblock</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  loading: { paddingHorizontal: spacing.lg, gap: spacing.md, marginTop: spacing.md },
  skel: { borderRadius: radius.md },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  body: { flex: 1 },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  area: { color: colors.textMuted, fontSize: 13, marginTop: 1 },
  unblockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.round,
  },
  unblockText: { color: colors.primary, fontWeight: '800', fontSize: 13 },
});

export default BlockedUsersScreen;
