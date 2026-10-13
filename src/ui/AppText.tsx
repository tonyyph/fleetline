import { Text, type TextProps, type TextStyle } from 'react-native';

import { colors, fonts, MAX_FONT_SCALE, textShadow } from './theme';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'bodyStrong' | 'caption' | 'label';

const VARIANTS: Record<Variant, TextStyle> = {
  display: {
    fontFamily: fonts.display,
    fontSize: 42,
    lineHeight: 48,
    color: colors.text,
    ...textShadow,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 38,
    color: colors.accent,
    ...textShadow,
  },
  heading: { fontFamily: fonts.displaySemi, fontSize: 23, lineHeight: 28, color: colors.text },
  body: { fontFamily: fonts.body, fontSize: 17, lineHeight: 23, color: colors.textDim },
  bodyStrong: { fontFamily: fonts.bodySemi, fontSize: 17, lineHeight: 23, color: colors.text },
  caption: { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 20, color: colors.textMuted },
  label: {
    fontFamily: fonts.caps,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 1.6,
    color: colors.textMuted,
  },
};

export interface AppTextProps extends TextProps {
  variant?: Variant;
  color?: string;
  align?: TextStyle['textAlign'];
}

export function AppText({ variant = 'body', color, align, style, ...rest }: AppTextProps) {
  return (
    <Text
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      {...rest}
      style={[
        VARIANTS[variant],
        color ? { color } : null,
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}
