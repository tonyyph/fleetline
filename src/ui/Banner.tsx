import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { AppText } from './AppText';
import type { IconName } from './Button';
import { colors, radius, space } from './theme';

type Tone = 'info' | 'warn' | 'error';

const TONES: Record<Tone, { icon: IconName; color: string; bg: string }> = {
  info: { icon: 'information-circle', color: colors.accent, bg: 'rgba(32,20,10,0.88)' },
  warn: { icon: 'cloud-offline', color: colors.warning, bg: 'rgba(32,20,10,0.88)' },
  error: { icon: 'alert-circle', color: colors.danger, bg: 'rgba(40,14,8,0.9)' },
};

export function Banner({
  tone = 'info',
  text,
  action,
}: {
  tone?: Tone;
  text: string;
  action?: ReactNode;
}) {
  const t = TONES[tone];
  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(120)}
      style={[styles.banner, { backgroundColor: t.bg, borderColor: t.color + '55' }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Ionicons name={t.icon} size={18} color={t.color} />
      <View style={styles.text}>
        <AppText variant="body" color={colors.text}>
          {text}
        </AppText>
      </View>
      {action}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  text: { flex: 1 },
});
