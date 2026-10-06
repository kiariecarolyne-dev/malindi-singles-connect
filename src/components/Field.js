import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing } from '../theme';

/** Labeled text input with error message and optional secure toggle. */
const Field = ({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  secureTextEntry,
  keyboardType,
  autoCapitalize = 'sentences',
  multiline = false,
  maxLength,
  icon,
  editable = true,
  onPressIn,
}) => {
  const [hidden, setHidden] = useState(Boolean(secureTextEntry));

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.inputWrap,
          error && styles.inputError,
          multiline && styles.multilineWrap,
          !editable && styles.disabled,
        ]}
      >
        {icon ? <Ionicons name={icon} size={18} color={colors.textMuted} style={styles.icon} /> : null}
        <TextInput
          style={[styles.input, multiline && styles.multiline]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={hidden}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          multiline={multiline}
          maxLength={maxLength}
          editable={editable}
          onPressIn={onPressIn}
        />
        {secureTextEntry ? (
          <TouchableOpacity onPress={() => setHidden((h) => !h)} style={styles.eye} hitSlop={{ top: 12, bottom: 12 }}>
            <Ionicons name={hidden ? 'eye' : 'eye-off'} size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
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
  multilineWrap: { minHeight: 110, alignItems: 'flex-start', paddingVertical: spacing.md },
  inputError: { borderColor: colors.danger },
  disabled: { opacity: 0.6 },
  icon: { marginRight: spacing.sm },
  input: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: spacing.md },
  multiline: { textAlignVertical: 'top', minHeight: 90 },
  eye: { paddingLeft: spacing.sm },
  error: { color: colors.danger, fontSize: 12, marginTop: spacing.xs, marginLeft: spacing.xs },
});

export default Field;
