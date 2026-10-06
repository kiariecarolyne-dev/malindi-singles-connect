import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '../../components/Button';
import Field from '../../components/Field';
import Logo from '../../components/Logo';
import { useAuth } from '../../context/AuthContext';
import { validateEmail } from '../../utils/validation';
import { colors, radius, spacing } from '../../theme';

const LoginScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();

  const [contact, setContact] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const next = {};
    const emailError = validateEmail(contact);
    if (emailError) next.contact = emailError;
    if (!password) next.password = 'Enter your password.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleLogin = async () => {
    setFormError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      await signIn(contact.trim(), password);
    } catch (e) {
      setFormError(e.message || 'Could not log in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#1B1030', colors.background]} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xxl },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Logo size={72} showWordmark={false} />
            <Text style={styles.title}>Welcome back ❤️</Text>
            <Text style={styles.subtitle}>Someone around Malindi missed you.</Text>
          </View>

          <Field
            label="Email"
            value={contact}
            onChangeText={setContact}
            placeholder="you@example.com"
            icon="at-outline"
            autoCapitalize="none"
            keyboardType="email-address"
            error={errors.contact}
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            icon="lock-closed-outline"
            secureTextEntry
            error={errors.password}
          />

          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgot}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          {formError ? (
            <View style={styles.formError}>
              <Ionicons name="alert-circle" size={16} color={colors.danger} />
              <Text style={styles.formErrorText}>{formError}</Text>
            </View>
          ) : null}

          <Button title="Log In" icon="log-in-outline" onPress={handleLogin} loading={submitting} style={styles.submit} />

          <TouchableOpacity style={styles.registerLink} onPress={() => navigation.navigate('AgeVerification')}>
            <Text style={styles.registerLinkText}>
              New here? <Text style={styles.registerLinkAccent}>Create an account</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.lg },
  header: { alignItems: 'center', marginBottom: spacing.xxl },
  title: { color: colors.text, fontSize: 26, fontWeight: '900', marginTop: spacing.lg },
  subtitle: { color: colors.textSecondary, fontSize: 14, marginTop: spacing.xs },
  forgot: { alignSelf: 'flex-end', marginBottom: spacing.md },
  forgotText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  formError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  formErrorText: { color: colors.danger, fontSize: 13, marginLeft: spacing.sm, flex: 1 },
  submit: { marginTop: spacing.sm },
  registerLink: { marginTop: spacing.xl, alignItems: 'center' },
  registerLinkText: { color: colors.textSecondary, fontSize: 14 },
  registerLinkAccent: { color: colors.primary, fontWeight: '800' },
});

export default LoginScreen;
