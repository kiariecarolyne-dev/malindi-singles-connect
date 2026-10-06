import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import Avatar from '../../components/Avatar';
import Button from '../../components/Button';
import Screen from '../../components/Screen';
import ScreenHeader from '../../components/ScreenHeader';
import { REPORT_REASONS } from '../../constants/reportReasons';
import { useAuth } from '../../context/AuthContext';
import { profileService, reportService } from '../../services';
import { colors, radius, spacing } from '../../theme';

const ReportScreen = ({ navigation, route }) => {
  const { user } = useAuth();
  const targetUid = route?.params?.uid;
  const context = route?.params?.context;

  const [target, setTarget] = useState(null);
  const [reason, setReason] = useState(null);
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!targetUid) return;
    try {
      setTarget(await profileService.getProfile(targetUid));
    } catch {
      setTarget(null);
    }
  }, [targetUid]);

  useEffect(() => {
    // Async fetch: setTarget runs only after the profile promise resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const submit = async () => {
    if (!reason || sending) return;
    setSending(true);
    setError(null);
    try {
      await reportService.submitReport({
        fromUid: user.uid,
        targetUid,
        reason,
        details,
      });
      setSent(true);
    } catch (e) {
      setError(e.message || 'Could not send your report. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const blockToo = async () => {
    await profileService.blockUser(user.uid, targetUid);
    navigation.popToTop();
  };

  if (sent) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Report sent" onBack={() => navigation.goBack()} />
        <View style={styles.doneWrap}>
          <View style={styles.doneCircle}>
            <Ionicons name="shield-checkmark" size={44} color={colors.success} />
          </View>
          <Text style={styles.doneTitle}>Thank you for reporting</Text>
          <Text style={styles.doneMsg}>
            Our safety team reviews every report within 24 hours. You will not hear from this person
            again if you block them.
          </Text>
          <Button title="Block them too" variant="danger" icon="ban" onPress={blockToo} style={styles.doneBtn} />
          <Button title="Done" variant="secondary" onPress={() => navigation.goBack()} style={styles.doneBtn} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Report" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.targetRow}>
          <Avatar uri={target?.photos?.[0]} name={target?.fullName} size={54} />
          <View style={styles.targetBody}>
            <Text style={styles.targetName}>{target?.fullName || 'Loading…'}</Text>
            {context ? <Text style={styles.targetCtx}>{context}</Text> : null}
          </View>
        </View>

        <Text style={styles.label}>Why are you reporting them?</Text>
        {REPORT_REASONS.map((r) => {
          const on = reason === r.id;
          return (
            <TouchableOpacity
              key={r.id}
              style={[styles.reasonRow, on && styles.reasonRowOn]}
              onPress={() => setReason(r.id)}
            >
              <Text style={styles.reasonEmoji}>{r.emoji}</Text>
              <Text style={[styles.reasonText, on && styles.reasonTextOn]}>{r.label}</Text>
              <Ionicons
                name={on ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={on ? colors.primary : colors.textMuted}
              />
            </TouchableOpacity>
          );
        })}

        <Text style={styles.label}>Details (optional)</Text>
        <TextInput
          style={styles.textarea}
          value={details}
          onChangeText={setDetails}
          placeholder="Tell us what happened — dates, screenshots in chat, etc."
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={600}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          title={sending ? 'Sending…' : 'Submit report'}
          icon="flag"
          onPress={submit}
          disabled={!reason || sending}
          style={styles.submitBtn}
        />
        <Text style={styles.note}>
          Reports are private. The person you report never sees who reported them.
        </Text>
        {sending ? <ActivityIndicator style={{ marginTop: 12 }} color={colors.primary} /> : null}
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },

  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  targetBody: { flex: 1 },
  targetName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  targetCtx: { color: colors.textMuted, fontSize: 12, marginTop: 2 },

  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },

  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reasonRowOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  reasonEmoji: { fontSize: 18 },
  reasonText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600', flex: 1 },
  reasonTextOn: { color: colors.primary, fontWeight: '800' },

  textarea: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
    padding: spacing.md,
    minHeight: 110,
    textAlignVertical: 'top',
  },

  error: { color: colors.danger, fontSize: 13, marginTop: spacing.md },
  submitBtn: { marginTop: spacing.xl },
  note: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: spacing.md, lineHeight: 18 },

  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxl },
  doneCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  doneTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  doneMsg: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  doneBtn: { alignSelf: 'stretch', marginTop: spacing.lg },
});

export default ReportScreen;
