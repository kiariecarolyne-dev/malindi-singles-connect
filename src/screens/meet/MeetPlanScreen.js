import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import Button from '../../components/Button';
import Screen from '../../components/Screen';
import ScreenHeader from '../../components/ScreenHeader';
import {
  buildPlanText as buildText,
  meetupService,
} from '../../services';
import { MEET_ACTIVITIES, MEET_SAFETY_RULES, PUBLIC_PLACES } from '../../constants/meet';
import { useAuth } from '../../context/AuthContext';
import { colors, radius, spacing } from '../../theme';

const TIME_SLOTS = ['ASAP', '12:00', '14:00', '16:00', '18:00', '20:00'];

const MeetPlanScreen = ({ navigation, route }) => {
  const { user } = useAuth();
  const otherUid = route?.params?.otherUid;
  const matchId = route?.params?.matchId;
  const otherName = (route?.params?.otherName || 'them').split(' ')[0];

  const [activityId, setActivityId] = useState(null);
  const [placeId, setPlaceId] = useState(null);
  const [timeLabel, setTimeLabel] = useState(null);
  const [agreed, setAgreed] = useState(false);
  const [sending, setSending] = useState(false);

  const ready = activityId && placeId && timeLabel && agreed && !sending;

  const send = async () => {
    if (!ready) return;
    setSending(true);
    try {
      await meetupService.createMeetup({
        fromUid: user.uid,
        toUid: otherUid,
        matchId,
        activityId,
        placeId,
        timeLabel,
      });
      Alert.alert(
        'Plan sent! 🙌',
        `${otherName} will see your invite in chat and here. You will get a notification when they respond.`,
        [{ text: 'Done', onPress: () => navigation.goBack() }],
      );
    } catch (e) {
      Alert.alert('Could not send', e.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen edges={['top']}>
      <ScreenHeader title={`Plan with ${otherName}`} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Pick an activity, a public place and a time — today only. Your plan is sent straight into
          your chat.
        </Text>

        <Text style={styles.label}>Activity</Text>
        <View style={styles.chips}>
          {MEET_ACTIVITIES.map((a) => {
            const on = activityId === a.id;
            return (
              <TouchableOpacity
                key={a.id}
                style={[styles.chip, on && styles.chipOn]}
                onPress={() => setActivityId(a.id)}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>
                  {a.emoji} {a.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>Public place</Text>
        {PUBLIC_PLACES.map((p) => {
          const on = placeId === p.id;
          return (
            <TouchableOpacity
              key={p.id}
              style={[styles.placeRow, on && styles.placeRowOn]}
              onPress={() => setPlaceId(p.id)}
            >
              <Ionicons
                name={on ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={on ? colors.primary : colors.textMuted}
              />
              <View style={styles.placeBody}>
                <Text style={styles.placeName}>{p.label}</Text>
                <Text style={styles.placeArea}>{p.area}</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        <Text style={styles.label}>Time today</Text>
        <View style={styles.chips}>
          {TIME_SLOTS.map((t) => {
            const on = timeLabel === t;
            return (
              <TouchableOpacity
                key={t}
                style={[styles.timeChip, on && styles.chipOn]}
                onPress={() => setTimeLabel(t)}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{t}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {activityId && placeId && timeLabel ? (
          <View style={styles.preview}>
            <Text style={styles.previewLabel}>Preview</Text>
            <Text style={styles.previewText}>{buildText(activityId, placeId, timeLabel)}</Text>
          </View>
        ) : null}

        <View style={styles.safety}>
          <Text style={styles.safetyTitle}>🛡️ Safety rules</Text>
          {MEET_SAFETY_RULES.map((r) => (
            <View key={r.id} style={styles.ruleRow}>
              <Text style={styles.ruleBullet}>•</Text>
              <Text style={styles.ruleText}>{r.text}</Text>
            </View>
          ))}
          <View style={styles.agreeRow}>
            <Switch
              value={agreed}
              onValueChange={setAgreed}
              trackColor={{ false: colors.surfaceHigh, true: colors.primary }}
              thumbColor={colors.white}
            />
            <Text style={styles.agreeText}>
              I will meet only in the public place above and follow these safety rules.
            </Text>
          </View>
        </View>

        <Button
          title={sending ? 'Sending…' : 'Send meet plan'}
          icon="paper-plane"
          onPress={send}
          disabled={!ready}
          style={styles.sendBtn}
        />
        <Text style={styles.hint}>
          {ready ? 'Your plan is also shared in your chat.' : 'Choose activity, place, time and accept the safety rules.'}
        </Text>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  intro: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: spacing.sm },

  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.round,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  chipTextOn: { color: colors.primary, fontWeight: '800' },
  timeChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.round,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  placeRowOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  placeBody: { flex: 1 },
  placeName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  placeArea: { color: colors.textMuted, fontSize: 12, marginTop: 1 },

  preview: {
    marginTop: spacing.xl,
    backgroundColor: colors.secondarySoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(124, 92, 255, 0.4)',
  },
  previewLabel: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  previewText: { color: colors.text, fontSize: 14, lineHeight: 21 },

  safety: {
    marginTop: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  safetyTitle: { color: colors.text, fontSize: 15, fontWeight: '800', marginBottom: spacing.sm },
  ruleRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 3 },
  ruleBullet: { color: colors.success, fontWeight: '800' },
  ruleText: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, flex: 1 },
  agreeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  agreeText: { color: colors.text, fontSize: 13, flex: 1, lineHeight: 19 },

  sendBtn: { marginTop: spacing.xl },
  hint: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: spacing.sm },
});

export default MeetPlanScreen;
