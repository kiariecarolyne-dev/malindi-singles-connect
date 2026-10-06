import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import Button from '../../components/Button';
import Screen from '../../components/Screen';
import ScreenHeader from '../../components/ScreenHeader';
import { useAuth } from '../../context/AuthContext';
import { colors, radius, spacing } from '../../theme';
import { pickImage } from '../../utils/imagePicker';

const STEPS = [
  { icon: 'body-outline', text: 'Take a live selfie following the pose shown.' },
  { icon: 'images-outline', text: 'We compare it with your profile photos.' },
  { icon: 'checkmark-done-outline', text: 'A reviewer approves it — usually within 24 hours.' },
];

const VerificationScreen = ({ navigation }) => {
  const { profile, saveProfile } = useAuth();
  const status = profile?.verification?.status || 'unverified';

  const [stage, setStage] = useState('intro'); // intro | capture | pending | verified | rejected
  const [selfie, setSelfie] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const effectiveStage =
    stage === 'intro' && status === 'pending' ? 'pending' : stage === 'intro' && status === 'verified' ? 'verified' : stage === 'intro' && status === 'rejected' ? 'rejected' : stage;

  const capture = async () => {
    setBusy(true);
    setError(null);
    try {
      const img = await pickImage();
      if (img) setSelfie(img.uri);
    } catch (e) {
      setError(e.message || 'Could not open the photo library.');
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!selfie || busy) return;
    setBusy(true);
    setError(null);
    try {
      await saveProfile({
        verification: { ...(profile?.verification || {}), status: 'pending', selfie: true },
        verificationSelfie: selfie,
      });
      setStage('pending');
    } catch (e) {
      setError(e.message || 'Could not submit. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title="Photo Verification"
        onBack={navigation.canGoBack() ? () => navigation.goBack() : null}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {effectiveStage === 'intro' ? (
          <>
            <LinearGradient colors={['#132038', colors.surface]} style={styles.hero}>
              <View style={styles.heroCircle}>
                <Ionicons name="shield-checkmark" size={40} color={colors.info} />
              </View>
              <Text style={styles.heroTitle}>Get verified</Text>
              <Text style={styles.heroSub}>
                Verified profiles get more trust — and more matches. It takes a minute.
              </Text>
            </LinearGradient>

            {STEPS.map((s, i) => (
              <View key={s.icon} style={styles.stepRow}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>{i + 1}</Text>
                </View>
                <Ionicons name={s.icon} size={22} color={colors.primary} style={styles.stepIcon} />
                <Text style={styles.stepText}>{s.text}</Text>
              </View>
            ))}

            <View style={styles.privacy}>
              <Ionicons name="lock-closed" size={15} color={colors.textMuted} />
              <Text style={styles.privacyText}>
                Your verification selfie is used only for review — it is never shown on your profile.
              </Text>
            </View>

            <Button title="Start verification" icon="camera" onPress={() => setStage('capture')} style={styles.cta} />
          </>
        ) : null}

        {effectiveStage === 'capture' ? (
          <>
            <Text style={styles.title}>Take your selfie</Text>
            <View style={styles.poseCard}>
              <Text style={styles.poseEmoji}>😐</Text>
              <Text style={styles.poseText}>
                Look straight at the camera, neutral expression, good light. Match one of your profile
                photos.
              </Text>
            </View>

            {selfie ? (
              <Image source={{ uri: selfie }} style={styles.selfie} />
            ) : (
              <View style={styles.selfieEmpty}>
                <Ionicons name="person" size={54} color={colors.textMuted} />
              </View>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Button
              title={selfie ? 'Choose a different photo' : 'Choose selfie photo'}
              icon="images"
              variant="secondary"
              onPress={capture}
              loading={busy}
              style={styles.cta}
            />
            <Button
              title="Submit for review"
              icon="cloud-upload"
              onPress={submit}
              disabled={!selfie || busy}
              style={styles.ctaSmall}
            />
            <Text style={styles.demoNote}>
              Camera stand-in: in this demo the photo picker represents the live camera capture.
            </Text>
          </>
        ) : null}

        {effectiveStage === 'pending' ? (
          <View style={styles.stateWrap}>
            <View style={[styles.stateCircle, { backgroundColor: colors.goldSoft }]}>
              <Ionicons name="time" size={44} color={colors.gold} />
            </View>
            <Text style={styles.stateTitle}>Review in progress</Text>
            <Text style={styles.stateMsg}>
              Thanks! A reviewer is checking your selfie against your photos. This usually takes under
              24 hours — we will notify you.
            </Text>
            <Text style={styles.demoNote}>
              Demo tip: sign in as admin@malindisingles.app to approve it from the Admin tab.
            </Text>
            <Button title="Back" variant="secondary" onPress={() => navigation.goBack()} style={styles.stateBtn} />
          </View>
        ) : null}

        {effectiveStage === 'verified' ? (
          <View style={styles.stateWrap}>
            <View style={[styles.stateCircle, { backgroundColor: 'rgba(77, 163, 255, 0.16)' }]}>
              <Ionicons name="checkmark-circle" size={54} color={colors.info} />
            </View>
            <Text style={styles.stateTitle}>You are verified ✓</Text>
            <Text style={styles.stateMsg}>
              Your profile now shows the blue verification badge. Others know you are the real deal.
            </Text>
            <Button title="Done" onPress={() => navigation.goBack()} style={styles.stateBtn} />
          </View>
        ) : null}

        {effectiveStage === 'rejected' ? (
          <View style={styles.stateWrap}>
            <View style={[styles.stateCircle, { backgroundColor: colors.dangerSoft }]}>
              <Ionicons name="close-circle" size={44} color={colors.danger} />
            </View>
            <Text style={styles.stateTitle}>We could not verify that photo</Text>
            <Text style={styles.stateMsg}>
              The selfie did not match your profile photos clearly enough. Try again in better light
              with a neutral expression.
            </Text>
            <Button
              title="Try again"
              icon="camera"
              onPress={() => {
                setSelfie(null);
                setStage('capture');
              }}
              style={styles.stateBtn}
            />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },

  hero: { borderRadius: radius.xl, padding: spacing.xl, alignItems: 'center' },
  heroCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(77, 163, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroTitle: { color: colors.text, fontSize: 22, fontWeight: '900' },
  heroSub: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: spacing.sm, lineHeight: 21 },

  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: { color: colors.primary, fontWeight: '900', fontSize: 13 },
  stepIcon: { width: 24 },
  stepText: { color: colors.textSecondary, fontSize: 14, flex: 1, lineHeight: 20 },

  privacy: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.xl,
    alignItems: 'flex-start',
  },
  privacyText: { color: colors.textMuted, fontSize: 12, lineHeight: 18, flex: 1 },

  title: { color: colors.text, fontSize: 22, fontWeight: '900', marginTop: spacing.sm },
  poseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.secondarySoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(124, 92, 255, 0.4)',
  },
  poseEmoji: { fontSize: 40 },
  poseText: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, flex: 1 },

  selfie: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: radius.xl,
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
  },
  selfieEmpty: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: radius.xl,
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },

  error: { color: colors.danger, fontSize: 13, marginTop: spacing.md },
  cta: { marginTop: spacing.xl },
  ctaSmall: { marginTop: spacing.md },
  demoNote: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: spacing.md, lineHeight: 18 },

  stateWrap: { alignItems: 'center', paddingTop: spacing.xxl },
  stateCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  stateTitle: { color: colors.text, fontSize: 21, fontWeight: '900' },
  stateMsg: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  stateBtn: { alignSelf: 'stretch', marginTop: spacing.xl },
});

export default VerificationScreen;
