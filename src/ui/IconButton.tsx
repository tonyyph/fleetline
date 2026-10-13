import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { haptic } from '@/features/settings/haptics';

import { artIcons, type ArtIconName } from './art';
import type { IconName } from './Button';
import { Slice } from './Slice';
import { colors } from './theme';

/** Square wooden button holding a painted icon (`art`) or a gold vector glyph (`icon`). */
export function IconButton({
  icon,
  art,
  label,
  onPress,
  disabled,
  active,
  size = 48,
}: {
  icon?: IconName;
  art?: ArtIconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
  size?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, selected: !!active }}
      hitSlop={6}
      disabled={disabled}
      onPress={() => {
        haptic('tap');
        onPress();
      }}
      style={({ pressed }) => [
        disabled && { opacity: 0.4 },
        pressed && { opacity: 0.75, transform: [{ scale: 0.95 }] },
      ]}
    >
      <Slice name="btn_wood" style={[styles.btn, { width: size, height: size }]}>
        {art ? (
          <Image source={artIcons[art]} style={{ width: size * 0.66, height: size * 0.66 }} />
        ) : icon ? (
          <Ionicons name={icon} size={size * 0.44} color={colors.accent} />
        ) : null}
      </Slice>
      {active ? <View style={styles.activeBar} pointerEvents="none" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { alignItems: 'center', justifyContent: 'center' },
  activeBar: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: -6,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
});
