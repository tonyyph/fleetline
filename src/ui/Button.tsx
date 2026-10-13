import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { haptic } from '@/features/settings/haptics';

import { AppText } from './AppText';
import { artIcons, type ArtIconName } from './art';
import { Slice } from './Slice';
import { colors, fonts, space } from './theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type IconName = ComponentProps<typeof Ionicons>['name'];

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  /** Vector glyph, tinted to the label colour. */
  icon?: IconName;
  /** Painted icon; wins over `icon`. */
  art?: ArtIconName;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

const FG: Record<Variant, string> = {
  primary: colors.accentInk,
  secondary: colors.text,
  ghost: colors.textDim,
  danger: colors.danger,
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  art,
  loading,
  disabled,
  compact,
  style,
  accessibilityHint,
}: ButtonProps) {
  const fg = FG[variant];
  const inactive = disabled || loading;
  const glyph = compact ? 22 : 30;
  const content = (
    <View style={styles.row}>
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : art ? (
        <Image source={artIcons[art]} style={{ width: glyph, height: glyph }} />
      ) : icon ? (
        <Ionicons name={icon} size={compact ? 17 : 20} color={fg} />
      ) : null}
      <AppText
        variant="bodyStrong"
        color={fg}
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[
          styles.label,
          compact && styles.labelCompact,
          variant === 'primary' ? styles.labelOnGold : styles.labelOnWood,
        ]}
      >
        {label}
      </AppText>
    </View>
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={() => {
        haptic('tap');
        onPress();
      }}
      style={({ pressed }) => [inactive && styles.disabled, pressed && styles.pressed, style]}
    >
      {variant === 'ghost' ? (
        <View style={[styles.plate, compact && styles.compact]}>{content}</View>
      ) : (
        <Slice
          name={variant === 'primary' ? 'btn_gold' : 'btn_wood'}
          style={[
            styles.plate,
            compact && styles.compact,
            variant === 'primary' && (compact ? styles.goldCompact : styles.gold),
          ]}
        >
          {content}
        </Slice>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  plate: { minHeight: 56, paddingHorizontal: space.xl, justifyContent: 'center' },
  // Keep the label clear of the gold plate's compass ornaments (cap inset ~27pt).
  gold: { paddingHorizontal: 34 },
  goldCompact: { paddingHorizontal: 30 },
  compact: { minHeight: 44, paddingHorizontal: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  label: { fontFamily: fonts.caps, fontSize: 19, letterSpacing: 0.6 },
  labelCompact: { fontSize: 16 },
  labelOnGold: {
    textShadowColor: 'rgba(255,236,180,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
  labelOnWood: {
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
});
