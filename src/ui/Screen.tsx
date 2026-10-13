import type { ReactNode } from 'react';
import { Image, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { art } from './art';
import { colors, fillImage, space } from './theme';

export type BackdropKind = 'home' | 'deck' | 'sea';

const SOURCES = { home: art.bg_home, deck: art.bg_battle, sea: art.bg_home } as const;
// How much night is laid over the painting: the home screen shows it off, game screens
// mute it so boards and text stay readable.
const SHADE = { home: [0.05, 0.15, 0.7], deck: [0.35, 0.5, 0.75], sea: [0.55, 0.7, 0.85] } as const;

/** Painted full-screen background with a vertical night gradient on top. */
export function Backdrop({ kind = 'sea' }: { kind?: BackdropKind }) {
  const [top, mid, bottom] = SHADE[kind];
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image
        source={SOURCES[kind]}
        resizeMode="cover"
        style={fillImage}
        accessibilityIgnoresInvertColors
      />
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.bgDeep} stopOpacity={top} />
            <Stop offset="0.45" stopColor={colors.bgDeep} stopOpacity={mid} />
            <Stop offset="1" stopColor={colors.bgDeep} stopOpacity={bottom} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#shade)" />
      </Svg>
    </View>
  );
}

export function Screen({
  children,
  scroll = true,
  backdrop = 'sea',
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  backdrop?: BackdropKind;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={styles.root}>
      <Backdrop kind={backdrop} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.content, contentStyle]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.content, styles.fill, contentStyle]}>{children}</View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  fill: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.lg },
});
