import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AreaPicker from '../../components/AreaPicker';
import Button from '../../components/Button';
import Chip from '../../components/Chip';
import Field from '../../components/Field';
import Screen from '../../components/Screen';
import ScreenHeader from '../../components/ScreenHeader';
import { LIMITS } from '../../config/env';
import { DATING_INTENTIONS } from '../../constants/datingIntentions';
import { INTERESTS } from '../../constants/interests';
import { useAuth } from '../../context/AuthContext';
import { pickImage } from '../../utils/imagePicker';
import { colors, radius, spacing } from '../../theme';
import { validateBio, validateName } from '../../utils/validation';

const AGE_OPTIONS = [18, 21, 24, 27, 30, 35, 40, 45, 50, 60];

const EditProfileScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { profile, saveProfile } = useAuth();

  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [photos, setPhotos] = useState(profile?.photos || []);
  const [interests, setInterests] = useState(profile?.interests || []);
  const [area, setArea] = useState(profile?.area || null);
  const [intention, setIntention] = useState(profile?.datingIntention || null);
  const [minAge, setMinAge] = useState(profile?.preferences?.minAge ?? 18);
  const [maxAge, setMaxAge] = useState(profile?.preferences?.maxAge ?? 45);
  const [showLocation, setShowLocation] = useState(Boolean(profile?.showLocation));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const toggleInterest = (id) => {
    setInterests((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= LIMITS.interestsPerProfile) return prev;
      return [...prev, id];
    });
  };

  const addPhoto = async () => {
    try {
      const picked = await pickImage();
      if (picked && photos.length < LIMITS.photosPerProfile) {
        setPhotos((prev) => [...prev, picked.uri]);
      }
    } catch (e) {
      setErrors((prev) => ({ ...prev, photos: e.message }));
    }
  };

  const removePhoto = (index) => setPhotos((prev) => prev.filter((_, i) => i !== index));

  const handleSave = async () => {
    const next = {};
    const nameError = validateName(fullName);
    if (nameError) next.fullName = nameError;
    const bioError = validateBio(bio, LIMITS.bioMaxLength);
    if (bioError) next.bio = bioError;
    if (!area) next.area = 'Choose your area.';
    if (!intention) next.intention = 'Choose what you are looking for.';
    if (!photos.length) next.photos = 'Keep at least one photo.';
    if (minAge > maxAge) next.ageRange = 'Minimum age must be lower than maximum age.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      await saveProfile({
        fullName: fullName.trim(),
        bio: bio.trim(),
        photos,
        interests,
        area,
        datingIntention: intention,
        preferences: { minAge, maxAge },
        showLocation,
      });
      navigation.goBack();
    } catch (e) {
      setErrors({ save: e.message || 'Could not save changes.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Edit Profile" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.section}>Photos</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
            {photos.map((uri, i) => (
              <View key={`${uri}_${i}`} style={styles.photoWrap}>
                <Image source={{ uri }} style={styles.photo} />
                <TouchableOpacity style={styles.photoRemove} onPress={() => removePhoto(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={14} color={colors.white} />
                </TouchableOpacity>
                {i === 0 ? (
                  <View style={styles.mainTag}>
                    <Text style={styles.mainTagText}>Main</Text>
                  </View>
                ) : null}
              </View>
            ))}
            {photos.length < LIMITS.photosPerProfile ? (
              <TouchableOpacity style={styles.addPhoto} onPress={addPhoto} activeOpacity={0.8}>
                <Ionicons name="add" size={28} color={colors.primary} />
                <Text style={styles.addPhotoText}>Add</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>
          {errors.photos ? <Text style={styles.error}>{errors.photos}</Text> : null}

          <Field
            label="First name"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            error={errors.fullName}
          />

          <Field
            label="Bio"
            value={bio}
            onChangeText={setBio}
            multiline
            maxLength={LIMITS.bioMaxLength}
            placeholder="Say something honest and warm…"
            error={errors.bio}
          />
          <Text style={styles.counter}>
            {bio.length}/{LIMITS.bioMaxLength}
          </Text>

          <Text style={styles.label}>Interests ({interests.length}/{LIMITS.interestsPerProfile})</Text>
          <View style={styles.chips}>
            {INTERESTS.map((i) => (
              <Chip key={i.id} label={i.label} emoji={i.emoji} small selected={interests.includes(i.id)} onPress={() => toggleInterest(i.id)} />
            ))}
          </View>

          <Text style={styles.label}>Looking for</Text>
          <View style={styles.chips}>
            {DATING_INTENTIONS.map((i) => (
              <Chip key={i.id} label={i.label} emoji={i.emoji} small selected={intention === i.id} onPress={() => setIntention(i.id)} />
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

          <Text style={styles.label}>Show me people aged</Text>
          <Text style={styles.hint}>Minimum</Text>
          <View style={styles.chips}>
            {AGE_OPTIONS.map((a) => (
              <Chip key={`min-${a}`} label={`${a}`} small selected={minAge === a} onPress={() => setMinAge(a)} />
            ))}
          </View>
          <Text style={styles.hint}>Maximum</Text>
          <View style={styles.chips}>
            {AGE_OPTIONS.map((a) => (
              <Chip key={`max-${a}`} label={`${a}`} small selected={maxAge === a} onPress={() => setMaxAge(a)} />
            ))}
          </View>
          {errors.ageRange ? <Text style={styles.error}>{errors.ageRange}</Text> : null}

          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={styles.switchLabel}>📍 Location visibility</Text>
              <Text style={styles.hint}>
                {showLocation ? 'Others see your approximate distance only.' : 'Your distance stays hidden.'}
              </Text>
            </View>
            <Switch
              value={showLocation}
              onValueChange={setShowLocation}
              trackColor={{ false: colors.surfaceHigh, true: colors.primarySoft }}
              thumbColor={showLocation ? colors.primary : colors.textMuted}
            />
          </View>

          {errors.save ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={colors.danger} />
              <Text style={styles.errorText}>{errors.save}</Text>
            </View>
          ) : null}

          <Button title="Save changes" icon="checkmark" onPress={handleSave} loading={saving} style={styles.save} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  section: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: spacing.md },
  photoRow: { gap: spacing.md, paddingRight: spacing.lg },
  photoWrap: { width: 96, height: 128, borderRadius: radius.md, overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainTag: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.round,
  },
  mainTagText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  addPhoto: {
    width: 96,
    height: 128,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  addPhotoText: { color: colors.primary, fontSize: 12, fontWeight: '700', marginTop: 4 },
  label: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginTop: spacing.lg, marginBottom: spacing.sm },
  hint: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  counter: { color: colors.textMuted, fontSize: 12, textAlign: 'right', marginTop: -spacing.sm, marginBottom: spacing.sm },
  error: { color: colors.danger, fontSize: 12, marginTop: spacing.xs, marginBottom: spacing.sm },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.xl,
  },
  switchText: { flex: 1, marginRight: spacing.md },
  switchLabel: { color: colors.text, fontSize: 15, fontWeight: '700' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  errorText: { color: colors.danger, fontSize: 13, marginLeft: spacing.sm, flex: 1 },
  save: { marginTop: spacing.xl },
});

export default EditProfileScreen;
