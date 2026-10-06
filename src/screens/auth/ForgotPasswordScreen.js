import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '../../components/Button';
import Field from '../../components/Field';
import Screen from '../../components/Screen';
import ScreenHeader from '../../components/ScreenHeader';
import { DEMO_MODE } from '../../config/env';
import { authService } from '../../services';
import { colors, radius, spacing } from '../../theme';

const ForgotPasswordScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [contact, setContact] = useState('');
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    setFormError(null);
    if (!contact.trim()) {
      setError('Enter the email you registered with.');
      return;
    }
    setError(null);
    setSending(true);
    try {
      await authService.sendPasswordReset(contact.trim());
      setSent(true);
    } catch (e) {
      setFormError(e.message || 'Could not send the reset request.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Reset Password" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.iconCircle}>
          <Ionicons name="key-outline" size={30} color={colors.primary} />
        </View>

        {sent ? (
          <>
            <Text style={styles.title}>Request received ✓</Text>
            <Text style={styles.body}>
              If an account exists for <Text style={styles.strong}>{contact}</Text>, a reset link will
              be sent to it.
            </Text>
            {DEMO_MODE ? (
              <View style={styles.note}>
                <Ionicons name="information-circle" size={16} color={colors.info} />
                <Text style={styles.noteText}>
                  Demo mode: no real email is sent. In production this runs through Firebase
                  Authentication.
                </Text>
              </View>
            ) : null}
            <Button title="Back to log in" onPress={() => navigation.navigate('Login')} style={styles.btn} />
          </>
        ) : (
          <>
            <Text style={styles.title}>Forgot your password?</Text>
            <Text style={styles.body}>
              Enter your email and we will send you a reset link. You will be back in the app in no
              time.
            </Text>

            <Field
              label="Email"
              value={contact}
              onChangeText={setContact}
              placeholder="you@example.com"
              icon="at-outline"
              autoCapitalize="none"
              keyboardType="email-address"
              error={error}
            />

            {formError ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={colors.danger} />
                <Text style={styles.errorBoxText}>{formError}</Text>
              </View>
            ) : null}

            <Button title="Send reset link" icon="send-outline" onPress={handleSend} loading={sending} />
          </>
        )}
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.xxl, alignItems: 'stretch' },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  title: { color: colors.text, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  body: { color: colors.textSecondary, fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: spacing.md },
  strong: { color: colors.text, fontWeight: '700' },
  note: {
    flexDirection: 'row',
    backgroundColor: 'rgba(77,163,255,0.1)',
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
    alignItems: 'flex-start',
  },
  noteText: { color: colors.textSecondary, fontSize: 12, marginLeft: spacing.sm, flex: 1, lineHeight: 18 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorBoxText: { color: colors.danger, fontSize: 13, marginLeft: spacing.sm, flex: 1 },
  btn: { marginTop: spacing.xl },
});

export default ForgotPasswordScreen;
