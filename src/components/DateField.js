import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radius, spacing } from '../theme';

/**
 * Day / Month / Year input — no extra date-picker dependency.
 * onChange receives an ISO string (yyyy-mm-dd) or null when incomplete/invalid.
 */
const DateField = ({ label = 'Date of birth', value, onChange, error, hint }) => {
  const [day, setDay] = useState(value ? value.slice(8, 10) : '');
  const [month, setMonth] = useState(value ? value.slice(5, 7) : '');
  const [year, setYear] = useState(value ? value.slice(0, 4) : '');

  const emit = (d, m, y) => {
    if (d.length === 2 && m.length === 2 && y.length === 4) {
      const iso = `${y}-${m}-${d}`;
      const date = new Date(iso);
      if (!Number.isNaN(date.getTime()) && date <= new Date()) onChange(iso);
      else onChange(null);
    } else {
      onChange(null);
    }
  };

  const update = (part, text) => {
    let d = day;
    let m = month;
    let y = year;
    if (part === 'day') {
      d = text.replace(/[^0-9]/g, '').slice(0, 2);
      setDay(d);
    } else if (part === 'month') {
      m = text.replace(/[^0-9]/g, '').slice(0, 2);
      setMonth(m);
    } else {
      y = text.replace(/[^0-9]/g, '').slice(0, 4);
      setYear(y);
    }
    emit(d, m, y);
  };

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.row, error && styles.rowError]}>
        <TextInput
          style={styles.cell}
          value={day}
          onChangeText={(t) => update('day', t)}
          placeholder="DD"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          maxLength={2}
        />
        <Text style={styles.sep}>/</Text>
        <TextInput
          style={styles.cell}
          value={month}
          onChangeText={(t) => update('month', t)}
          placeholder="MM"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          maxLength={2}
        />
        <Text style={styles.sep}>/</Text>
        <TextInput
          style={[styles.cell, styles.yearCell]}
          value={year}
          onChangeText={(t) => update('year', t)}
          placeholder="YYYY"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          maxLength={4}
        />
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  label: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  rowError: { borderColor: colors.danger },
  cell: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '600', textAlign: 'center', paddingVertical: spacing.md },
  yearCell: { flex: 1.6 },
  sep: { color: colors.textMuted, fontSize: 16, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: spacing.xs, marginLeft: spacing.xs },
  error: { color: colors.danger, fontSize: 12, marginTop: spacing.xs, marginLeft: spacing.xs },
});

export default DateField;
