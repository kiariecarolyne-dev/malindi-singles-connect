import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '../../components/Button';
import Screen from '../../components/Screen';
import { LIMITS } from '../../config/env';
import { useAuth } from '../../context/AuthContext';
import { pickImage, suggestedAvatar } from '../../utils/imagePicker';
import { colors, radius, spacing } from '../../theme';

/** Onboarding step 2 — main photo + optional extras. */
const PhotoSetupScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { profile, saveProfile } = useAuth();
  const [photos, setPhotos] = useState(profile?.photos || []);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);

  const addPhoto = async (slotIndex) => {
    setError(null);
    setPicking(true);
    try {
      const picked = await pickImage();
      if (picked) {
        setPhotos((prev) => {
          const next = [...prev];
          next[slotIndex] = picked.uri;
          return next.filter(Boolean);
        });
      }
    } catch (e) {
      setError(e.message || 'Could not add photo.');
    } finally {
      setPicking(false);
    }
  };

  const useSuggested = () => {
    setPhotos((prev) => (prev.length ? prev : [suggestedAvatar(profile?.gender, 3)]));
    setError(null);
  };

  const removePhoto = (index) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleContinue = async () => {
    if (saving) return;
    if (!photos.length) {
      setError('Please add at least one photo so people can recognise you.');
      return;
    }
    setSaving(true);
    try {
      await saveProfile({ photos });
      if (__DEV__) {
        console.warn('[PhotoSetup] photos saved — navigating to BioInterests');
      }
      navigation.navigate('BioInterests');
    } catch (e) {
      if (__DEV__) {
        console.warn('[PhotoSetup] Continue failed:', e?.code || e?.name || 'unknown', e?.message || '');
      }
      setError(e.message || 'Could not save your photos. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xxxl }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.step}>Step 2 of 3 — your photos</Text>
        <Text style={styles.heading}>Add your best photos</Text>
        <Text style={styles.sub}>
          Photos are the first impression. Show your smile — no group shots as your main photo.
        </Text>

        <View style={styles.mainRow}>
          <TouchableOpacity
            style={styles.mainSlot}
            activeOpacity={0.85}
            onPress={() => addPhoto(0)}
          >
            {photos[0] ? (
              <>
                <Image source={{ uri: photos[0] }} style={styles.mainImage} />
                <TouchableOpacity style={styles.removeBtn} onPress={() => removePhoto(0)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={16} color={colors.white} />
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.slotInner}>
                <Ionicons name="camera" size={34} color={colors.primary} />
                <Text style={styles.slotText}>Main photo</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.extraGrid}>
            {Array.from({ length: 4 }).map((_, i) => {
              const slot = i + 1;
              return (
                <TouchableOpacity
                  key={slot}
                  style={styles.extraSlot}
                  activeOpacity={0.85}
                  onPress={() => addPhoto(slot)}
                >
                  {photos[slot] ? (
                    <>
                      <Image source={{ uri: photos[slot] }} style={styles.extraImage} />
                      <TouchableOpacity style={styles.removeBtnSm} onPress={() => removePhoto(slot)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close" size={12} color={colors.white} />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <Ionicons name="add" size={22} color={colors.textMuted} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <Text style={styles.counter}>
          {photos.length}/{LIMITS.photosPerProfile} photos added
        </Text>

        <Button
          title={picking ? 'Opening library…' : 'Choose from library'}
          icon="images-outline"
          variant="secondary"
          onPress={() => addPhoto(photos.length)}
          loading={picking}
          style={styles.pickBtn}
        />
        <TouchableOpacity onPress={useSuggested} style={styles.suggested}>
          <Text style={styles.suggestedText}>No photo right now? Use a suggested avatar</Text>
        </TouchableOpacity>

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Button
          title="Continue"
          icon="arrow-forward"
          onPress={handleContinue}
          loading={saving}
          disabled={!photos.length}
          style={styles.continue}
        />
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg },
  step: { color: colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  heading: { color: colors.text, fontSize: 26, fontWeight: '900', marginTop: spacing.sm },
  sub: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginTop: spacing.sm },
  mainRow: { flexDirection: 'row', marginTop: spacing.xl },
  mainSlot: {
    width: 170,
    height: 226,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainImage: { width: '100%', height: '100%' },
  slotInner: { alignItems: 'center' },
  slotText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginTop: spacing.sm },
  extraGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', marginLeft: spacing.md, justifyContent: 'space-between' },
  extraSlot: {
    width: '48%',
    aspectRatio: 0.75,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  extraImage: { width: '100%', height: '100%' },
  removeBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnSm: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: { color: colors.textMuted, fontSize: 12, marginTop: spacing.xs, textAlign: 'center' },
  pickBtn: { marginTop: spacing.xl },
  suggested: { alignItems: 'center', marginTop: spacing.md },
  suggestedText: { color: colors.info, fontSize: 13, fontWeight: '600' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  errorText: { color: colors.danger, fontSize: 13, marginLeft: spacing.sm, flex: 1 },
  continue: { marginTop: spacing.xl },
});

export default PhotoSetupScreen;
