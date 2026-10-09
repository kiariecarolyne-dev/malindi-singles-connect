import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import Button from '../../components/Button';
import { colors, gradients, radius, spacing } from '../../theme';

const pct = (value, total) => (total > 0 ? Math.round((value / total) * 100) : 0);

const GoldCircleDailyTopic = ({ topic, format, tally, myVote, voting, onVote, onJoin }) => {
  const total = useMemo(
    () => (Array.isArray(tally) ? tally.reduce((sum, n) => sum + (n || 0), 0) : 0),
    [tally],
  );

  const hasPoll = Array.isArray(topic?.options) && topic.options.length > 0;
  const voted = myVote !== null && myVote !== undefined;

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={gradients.gold}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topLine}
      />

      <View style={styles.headerRow}>
        <Text style={styles.kicker}>TODAY&apos;S HOT TOPIC</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {format?.emoji} {format?.label}
          </Text>
        </View>
      </View>

      <Text style={styles.prompt}>{topic?.prompt}</Text>

      {hasPoll ? (
        <View style={styles.options}>
          {topic.options.map((option, index) => {
            const selected = voted && myVote === index;
            const count = Array.isArray(tally) ? tally[index] || 0 : 0;
            const percent = pct(count, total);
            return (
              <TouchableOpacity
                key={option}
                style={[styles.option, selected && styles.optionOn]}
                activeOpacity={0.85}
                disabled={voting || voted}
                onPress={() => onVote?.(index)}
              >
                {voted ? (
                  <View
                    pointerEvents="none"
                    style={[styles.optionFill, { width: `${percent}%` }, selected && styles.optionFillOn]}
                  />
                ) : null}
                <Text style={[styles.optionText, selected && styles.optionTextOn]} numberOfLines={1}>
                  {selected ? '✓ ' : ''}
                  {option}
                </Text>
                {voted ? <Text style={styles.optionPct}>{percent}%</Text> : null}
              </TouchableOpacity>
            );
          })}
          <Text style={styles.tallyNote}>
            {voted
              ? `${total} ${total === 1 ? 'Gold member has' : 'Gold members have'} voted`
              : 'Pick a side to see how everyone voted.'}
          </Text>
        </View>
      ) : null}

      <Button
        title={voting ? 'Saving…' : 'Participate in the discussion'}
        variant="gold"
        icon="chatbubbles"
        small
        loading={voting}
        onPress={onJoin}
        style={styles.joinBtn}
      />

      <Text style={styles.hint}>Comment, reply and react on the posts below.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.goldSoft,
    padding: spacing.md,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  topLine: { height: 3, borderRadius: 3, marginBottom: spacing.md },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  kicker: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    flexShrink: 1,
  },
  badge: {
    backgroundColor: colors.goldSoft,
    borderRadius: radius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  badgeText: { color: colors.gold, fontSize: 11, fontWeight: '700' },

  prompt: {
    color: colors.text,
    fontSize: 19,
    lineHeight: 26,
    fontWeight: '800',
    marginTop: spacing.md,
  },

  options: { marginTop: spacing.md, gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    overflow: 'hidden',
  },
  optionOn: { borderColor: colors.gold },
  optionFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.surfaceLight,
  },
  optionFillOn: { backgroundColor: colors.goldSoft },
  optionText: { color: colors.textSecondary, fontSize: 15, fontWeight: '700' },
  optionTextOn: { color: colors.gold },
  optionPct: { color: colors.text, fontSize: 13, fontWeight: '800' },
  tallyNote: { color: colors.textMuted, fontSize: 12, marginTop: spacing.xs },

  joinBtn: { marginTop: spacing.md },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});

export default GoldCircleDailyTopic;
