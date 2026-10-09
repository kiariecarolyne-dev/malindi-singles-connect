import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import AppStack from './AppStack';
import AuthStack from './AuthStack';
import OnboardingStack from './OnboardingStack';
import Logo from '../components/Logo';
import { useAuth } from '../context/AuthContext';
import { colors, spacing } from '../theme';

/**
 * Root gate:
 *  restoring session -> splash
 *  no user           -> auth stack
 *  profile incomplete-> onboarding
 *  otherwise         -> main app
 */
const RootNavigator = () => {
  const { initializing, user, profileComplete, profileLoaded } = useAuth();

  if (initializing || (user && !profileLoaded)) {
    return (
      <View style={styles.splash}>
        <Logo size={92} />
        <Text style={styles.tagline}>Meet. Match. Connect. Today.</Text>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      </View>
    );
  }

  if (!user) return <AuthStack />;
  if (!profileComplete) return <OnboardingStack />;
  return <AppStack />;
};

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagline: {
    color: colors.textSecondary,
    marginTop: spacing.lg,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
  },
});

export default RootNavigator;
