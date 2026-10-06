import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../theme';

/** Standard screen container: brand background + safe area. */
const Screen = ({ children, style, edges = ['top', 'bottom'], backgroundColor }) => (
  <SafeAreaView
    edges={edges}
    style={[styles.safe, backgroundColor ? { backgroundColor } : null, style]}
  >
    <View style={styles.inner}>{children}</View>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  inner: { flex: 1 },
});

export default Screen;
