import { StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { colors, radius, space } from './theme';

export function Pill({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'accent';
}) {
  const dot = {
    neutral: colors.textMuted,
    good: colors.success,
    warn: colors.warning,
    bad: colors.danger,
    accent: colors.accent,
  }[tone];
  return (
    <View style={styles.pill} accessibilityRole="text" accessibilityLabel={label}>
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <AppText variant="caption" color={colors.textDim} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(20,12,7,0.78)',
    borderWidth: 1,
    borderColor: colors.line,
    alignSelf: 'flex-start',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
