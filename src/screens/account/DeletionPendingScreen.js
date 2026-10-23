import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import Button from '../../components/Button';
import Field from '../../components/Field';
import Screen from '../../components/Screen';
import { useAuth } from '../../context/AuthContext';
import { colors, radius, spacing } from '../../theme';

/**
 * Shown by the root navigator when the backend reports a durable deletion
 * state other than `none`.
 *
 * This screen exists because the normal "delete account" entry point lives in
 * the Profile tab — and a half-deleted account has no profile (and therefore
 * no Profile tab). Without this gate the app would send the member to
 * onboarding, which recreates the profile and silently undoes the deletion.
 */
const STEP_LABELS = {
  profile: 'Profile',
  account: 'Account',
  goldEntitlement: 'Gold membership',
  likes: 'Likes',
  passes: 'Passes',
  blocks: 'Blocked list',
  notifications: 'Notifications',
  matches: 'Matches',
  conversations: 'Chats',
  meetups: 'Meetup plans',
  reports: 'Reports',
  payments: 'Payment records',
  goldCirclePosts: 'Gold Circle posts',
  goldCircleVotes: 'Gold Circle votes',
  profilePhotos: 'Profile photos',
  verificationSelfie: 'Verification selfie',
  readPrivateData: 'Private profile data',
};

const describeSteps = (steps) => {
  if (!Array.isArray(steps) || steps.length === 0) return null;
  return steps.map((step) => STEP_LABELS[step] || step).join(', ');
};

const DeletionPendingScreen = ({ state }) => {
  const { user, signOut, retryDeletion, deletionFailedSteps } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const completed = state === 'completed';
  const pendingSteps = describeSteps(deletionFailedSteps);
  const title = completed
    ? 'Your data is deleted, but your sign-in is not'
    : 'Your account deletion is not finished';
  const body = completed
    ? 'Your profile and personal data have been permanently deleted. Your sign-in could not be removed yet, so finish deleting to remove it. You will not be able to reuse this email until that is done.'
    : 'Some of your data has already been deleted, so your account is not usable. The deletion must be finished before you can use the app again.';
  const finishTitle = completed ? 'Finish removing my sign-in' : 'Finish deleting my account';

  const handleRetry = async () => {
    if (!password) {
      setError('Enter your password to continue.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await retryDeletion(password);
      setPassword('');
      Alert.alert(
        'Account deleted',
        'Your account and your data have been permanently deleted.',
      );
    } catch (e) {
      setError(e?.message || 'We could not finish deleting your account. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.iconWrap}>
          <Ionicons
            name="alert-circle"
            size={48}
            color={completed ? colors.warning : colors.danger}
          />
        </View>

        <Text style={styles.title}>{title}</Text>

        <Text style={styles.body}>
          {body}
          {!completed && pendingSteps ? `\n\nStill not finished: ${pendingSteps}.` : ''}
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Confirm it is you</Text>
          <Text style={styles.cardLine}>{user?.email || 'this account'}</Text>
          <Text style={styles.cardHint}>
            For your security, enter your password to finish deleting your account.
          </Text>
          <Field
            label="Password"
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              if (error) setError(null);
            }}
            placeholder="Your password"
            secureTextEntry
            autoCapitalize="none"
            icon="lock-closed-outline"
            editable={!busy}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <Button
          title={finishTitle}
          icon="trash-outline"
          variant="danger"
          loading={busy}
          onPress={handleRetry}
        />

        <Button
          title="Sign out"
          variant="secondary"
          icon="log-out-outline"
          disabled={busy}
          style={styles.signOut}
          onPress={signOut}
        />

        <Text style={styles.note}>
          {completed
            ? 'Your deleted data cannot be restored.'
            : 'Deletion is permanent and cannot be undone once it has finished.'}
        </Text>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  iconWrap: { alignItems: 'center', marginTop: spacing.xxl, marginBottom: spacing.lg },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  body: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  cardLine: { color: colors.textSecondary, fontSize: 14, marginTop: spacing.xs },
  cardHint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.sm },
  signOut: { marginTop: spacing.md },
  note: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});

export default DeletionPendingScreen;
