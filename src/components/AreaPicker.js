import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { getAreaDisplay, getGroupedAreas } from '../constants/areas';
import { colors, radius, spacing } from '../theme';

/**
 * Searchable, grouped area picker for the Malindi / Watamu / surrounding
 * directory. Registration and profile editing both use it so nobody can end
 * up with an area outside the app's local focus.
 */
const AreaPicker = ({ value, onChange, label = 'Your area', error, placeholder = 'Search Malindi, Watamu…' }) => {
  const [query, setQuery] = useState('');
  const groups = getGroupedAreas(query);

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={[styles.inputWrap, error && styles.inputError]}>
        <Ionicons name="location-outline" size={18} color={colors.textMuted} style={styles.icon} />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 12, bottom: 12 }}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {value ? <Text style={styles.selected}>{getAreaDisplay(value)}</Text> : null}

      {groups.map((group) => (
        <View key={group.id} style={styles.group}>
          <Text style={styles.groupTitle}>
            {group.emoji} {group.label}
          </Text>
          <View style={styles.chips}>
            {group.areas.map((area) => {
              const active = area.id === value;
              return (
                <TouchableOpacity
                  key={area.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => onChange?.(area.id)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {area.emoji} {area.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}

      {!groups.length ? <Text style={styles.empty}>No area matches “{query}”.</Text> : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  label: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: spacing.sm },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  inputError: { borderColor: colors.danger },
  icon: { marginRight: spacing.sm },
  input: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: spacing.md },
  selected: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '700',
    marginTop: spacing.sm,
    marginLeft: spacing.xs,
  },
  group: { marginTop: spacing.lg },
  groupTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.round,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: colors.text, fontWeight: '800' },
  empty: { color: colors.textMuted, fontSize: 13, marginTop: spacing.md },
  error: { color: colors.danger, fontSize: 12, marginTop: spacing.xs, marginLeft: spacing.xs },
});

export default AreaPicker;
