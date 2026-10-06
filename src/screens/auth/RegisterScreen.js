import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AreaPicker from '../../components/AreaPicker';
import Button from '../../components/Button';
import Chip from '../../components/Chip';
import DateField from '../../components/DateField';
import Field from '../../components/Field';
import Screen from '../../components/Screen';
import ScreenHeader from '../../components/ScreenHeader';
import { APP } from '../../config/env';
import { DATING_INTENTIONS } from '../../constants/datingIntentions';
import { useAuth } from '../../context/AuthContext';
import { calculateAge, isAdult } from '../../utils/age';
import { colors, radius, spacing } from '../../theme';
import { validateDob, validateEmailOrPhone, validateName, validatePassword } from '../../utils/validation';

const GENDERS = [
  { id: 'female', label: 'Woman' },
  { id: 'male', label: 'Man' },
  { id: 'other', label: 'Other' },
];

const INTERESTED_IN = [
  { id: 'female', label: 'Women' },
  { id: 'male', label: 'Men' },
  { id: 'everyone', label: 'Everyone' },
];

const RegisterScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth();
  const confirmedAge = route?.params?.confirmedAge === true;

  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState(null);
  const [gender, setGender] = useState(null);
  const [interestedIn, setInterestedIn] = useState(null);
  const [intention, setIntention] = useState(null);
  const [area, setArea] = useState(null);
  const [contact, setContact] = useState('');
  const [password, setPassword] = useState('');
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const age = dob ? calculateAge(dob) : null;

  const validate = () => {
    const next = {};
    const nameError = validateName(fullName);
    if (nameError) next.fullName = nameError;

    const dobError = validateDob(dob);
    if (dobError) next.dob = dobError;
    else if (!isAdult(dob)) next.dob = `You must be at least ${APP.minAge} to join.`;

    if (!gender) next.gender = 'Please select your gender.';
    if (!interestedIn) next.interestedIn = 'Please choose who you want to meet.';
    if (!intention) next.intention = 'What are you looking for?';
    if (!area) next.area = 'Choose your area around Malindi.';

    const contactError = validateEmailOrPhone(contact);
    if (contactError) next.contact = contactError;

    const passError = validatePassword(password);
    if (passError) next.password = passError;

    if (!ageConfirmed) next.ageConfirmed = `Please confirm you are ${APP.minAge}+.`;

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    setFormError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      await signUp({
        fullName: fullName.trim(),
        email: contact.trim(),
        password,
        gender,
        interestedIn: interestedIn === 'everyone' ? ['female', 'male', 'other'] : [interestedIn],
        area,
        dateOfBirth: dob,
        datingIntention: intention,
      });
      // RootNavigator switches to onboarding automatically.
    } catch (e) {
      setFormError(e.message || 'Could not create your account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!confirmedAge) {
    navigation.replace('AgeVerification');
    return null;
  }

  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Create Account" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={20}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.step}>Step 1 of 3 — the basics</Text>
          <Text style={styles.heading}>Join the singles around Malindi</Text>

          <Field
            label="Full name"
            value={fullName}
            onChangeText={setFullName}
            placeholder="e.g. Aisha Salim"
            icon="person-outline"
            autoCapitalize="words"
            error={errors.fullName}
          />

          <DateField
            label="Date of birth"
            value={dob}
            onChange={setDob}
            error={errors.dob}
            hint={
              age !== null && isAdult(dob)
                ? `You are ${age} — welcome! 🎉`
                : `You must be ${APP.minAge}+ to join.`
            }
          />

          <Text style={styles.label}>Gender</Text>
          <View style={styles.chipRow}>
            {GENDERS.map((g) => (
              <Chip key={g.id} label={g.label} selected={gender === g.id} onPress={() => setGender(g.id)} />
            ))}
          </View>
          {errors.gender ? <Text style={styles.error}>{errors.gender}</Text> : null}

          <Text style={styles.label}>I want to meet</Text>
          <View style={styles.chipRow}>
            {INTERESTED_IN.map((g) => (
              <Chip
                key={g.id}
                label={g.label}
                selected={interestedIn === g.id}
                onPress={() => setInterestedIn(g.id)}
              />
            ))}
          </View>
          {errors.interestedIn ? <Text style={styles.error}>{errors.interestedIn}</Text> : null}

          <Text style={styles.label}>What are you looking for?</Text>
          <View style={styles.chipRow}>
            {DATING_INTENTIONS.map((i) => (
              <Chip
                key={i.id}
                label={i.label}
                emoji={i.emoji}
                selected={intention === i.id}
                onPress={() => setIntention(i.id)}
              />
            ))}
          </View>
          {errors.intention ? <Text style={styles.error}>{errors.intention}</Text> : null}

          <AreaPicker
            label="Your area"
            value={area}
            onChange={setArea}
            error={errors.area}
            placeholder="Search Malindi, Watamu, Shella…"
          />

          <Field
            label="Email or phone"
            value={contact}
            onChangeText={setContact}
            placeholder="you@example.com or 0712345678"
            icon="at-outline"
            autoCapitalize="none"
            keyboardType="email-address"
            error={errors.contact}
          />

          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            icon="lock-closed-outline"
            secureTextEntry
            error={errors.password}
          />

          <TouchableOpacity
            style={styles.ageRow}
            onPress={() => setAgeConfirmed((v) => !v)}
            activeOpacity={0.75}
          >
            <View style={[styles.checkbox, ageConfirmed && styles.checkboxOn]}>
              {ageConfirmed ? <Ionicons name="checkmark" size={15} color={colors.white} /> : null}
            </View>
            <Text style={styles.ageText}>
              I confirm I am {APP.minAge} years or older and I accept the community guidelines.
            </Text>
          </TouchableOpacity>
          {errors.ageConfirmed ? <Text style={styles.error}>{errors.ageConfirmed}</Text> : null}

          {formError ? (
            <View style={styles.formError}>
              <Ionicons name="alert-circle" size={16} color={colors.danger} />
              <Text style={styles.formErrorText}>{formError}</Text>
            </View>
          ) : null}

          <Button
            title="Create Account"
            icon="arrow-forward"
            onPress={handleSubmit}
            loading={submitting}
            style={styles.submit}
          />

          <TouchableOpacity style={styles.loginLink} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginLinkText}>
              Already have an account? <Text style={styles.loginLinkAccent}>Log in</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  step: { color: colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  heading: { color: colors.text, fontSize: 24, fontWeight: '900', marginTop: spacing.sm, marginBottom: spacing.xl },
  label: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: spacing.sm, marginTop: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  error: { color: colors.danger, fontSize: 12, marginBottom: spacing.md, marginLeft: spacing.xs },
  ageRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing.md, paddingRight: spacing.sm },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    marginTop: 1,
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  ageText: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, flex: 1 },
  formError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  formErrorText: { color: colors.danger, fontSize: 13, marginLeft: spacing.sm, flex: 1 },
  submit: { marginTop: spacing.xl },
  loginLink: { marginTop: spacing.lg, alignItems: 'center' },
  loginLinkText: { color: colors.textSecondary, fontSize: 14 },
  loginLinkAccent: { color: colors.primary, fontWeight: '800' },
});

export default RegisterScreen;
