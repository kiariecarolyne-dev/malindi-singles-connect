import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, gradients, radius, spacing } from '../theme';

/**
 * Primary button component.
 * variant: primary (gradient) | secondary (outline) | ghost | danger | gold
 */
const Button = ({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  style,
  textStyle,
  small = false,
}) => {
  const content = (
    <View style={styles.row}>
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' || variant === 'ghost' ? colors.primary : colors.white} />
      ) : (
        <>
          {icon ? (
            <Ionicons
              name={icon}
              size={small ? 15 : 18}
              color={iconColor(variant)}
              style={{ marginRight: spacing.sm }}
            />
          ) : null}
          <Text style={[styles.text, small && styles.textSmall, textStyle]}>{title}</Text>
        </>
      )}
    </View>
  );

  const handlePress = () => {
    if (!disabled && !loading && onPress) onPress();
  };

  if (variant === 'primary') {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={handlePress} disabled={disabled || loading} style={style}>
        <LinearGradient
          colors={gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.base, small && styles.small, disabled && styles.disabled]}
        >
          {content}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  if (variant === 'gold') {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={handlePress} disabled={disabled || loading} style={style}>
        <LinearGradient
          colors={gradients.gold}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.base, small && styles.small, disabled && styles.disabled]}
        >
          {content}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handlePress}
      disabled={disabled || loading}
      style={[
        styles.base,
        small && styles.small,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        variant === 'danger' && styles.danger,
        disabled && styles.disabled,
        style,
      ]}
    >
      {content}
    </TouchableOpacity>
  );
};

const iconColor = (variant) => {
  if (variant === 'secondary' || variant === 'ghost') return colors.primary;
  if (variant === 'danger') return colors.danger;
  if (variant === 'gold') return colors.black;
  return colors.white;
};

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  small: { minHeight: 40, borderRadius: radius.md, paddingHorizontal: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  text: { color: colors.white, fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  textSmall: { fontSize: 14 },
  secondary: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: 'transparent',
  },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: colors.danger },
  disabled: { opacity: 0.45 },
});

export default Button;
