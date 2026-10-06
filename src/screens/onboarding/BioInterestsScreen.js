import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '../../components/Button';
import Chip from '../../components/Chip';
import Field from '../../components/Field';
import Screen from '../../components/Screen';
import { LIMITS } from '../../config/env';
import { INTERESTS } from '../../constants/interests';
import { useAuth } from '../../context/AuthContext';
import { colors, radius, spacing } from '../../theme';
import { validateBio } from '../../utils/validation';

/** Onboarding step 3 — short bio + interest chips. Finishes the profile. */
const BioInterestsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { profile, saveProfile } = useAuth();
  const [bio, setBio] = useState(profile?.bio || '');
  const [interests, setInterests] = useState(profile?.interests || []);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const toggleInterest = (id) => {
    setInterests((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= LIMITS.interestsPerProfile) return prev;
      return [...prev, id];
    });
  };

  const handleFinish = async () => {
    const bioError = validateBio(bio, LIMITS.bioMaxLength);
    if (bioError) {
      setError(bioError);
      return;
    }
    if (!interests.length) {
      setError('Pick at least a few interests — they spark great icebreakers.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await saveProfile({ bio: bio.trim(), interests });
      // RootNavigator now shows the main app automatically.
    } catch (e) {
      setError(e.message || 'Could not save your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xxxl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.step}>Step 3 of 3 — about you</Text>
        <Text style={styles.heading}>Tell them about you</Text>
        <Text style={styles.sub}>
          A short, honest bio gets far more conversations started than a long one.
        </Text>

        <View style={styles.bioWrap}>
          <Field
            label="Your bio"
            value={bio}
            onChangeText={(t) => {
              setBio(t);
              if (error) setError(null);
            }}
            placeholder="Beach lover, foodie and entrepreneur. Looking for someone genuine…"
            multiline
            maxLength={LIMITS.bioMaxLength}
            error={error && error.startsWith('Please write') ? error : null}
          />
          <Text style={styles.counter}>
            {bio.length}/{LIMITS.bioMaxLength}
          </Text>
        </View>

        <Text style={styles.label}>Your interests</Text>
        <Text style={styles.hint}>
          Choose up to {LIMITS.interestsPerProfile} — {interests.length} selected
        </Text>
        <View style={styles.chips}>
          {INTERESTS.map((i) => (
            <Chip
              key={i.id}
              label={i.label}
              emoji={i.emoji}
              selected={interests.includes(i.id)}
              onPress={() => toggleInterest(i.id)}
            />
          ))}
        </View>

        {error && !error.startsWith('Please write') ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Button
          title="Meet your matches ❤️"
          icon="sparkles"
          onPress={handleFinish}
          loading={saving}
          style={styles.finish}
        />
        <Text style={styles.footer}>DISCOVER → MATCH → CHAT → MEET SAFELY</Text>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg },
  step: { color: colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  heading: { color: colors.text, fontSize: 26, fontWeight: '900', marginTop: spacing.sm },
  sub: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginTop: spacing.sm },
  bioWrap: { marginTop: spacing.lg },
  counter: { color: colors.textMuted, fontSize: 12, textAlign: 'right', marginTop: -spacing.sm },
  label: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginTop: spacing.lg },
  hint: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  errorText: { color: colors.danger, fontSize: 13, marginLeft: spacing.sm, flex: 1 },
  finish: { marginTop: spacing.xxl },
  footer: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: spacing.lg,
    letterSpacing: 1,
    fontWeight: '700',
  },
});

export default BioInterestsScreen;
