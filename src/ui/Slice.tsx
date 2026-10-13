import type { ReactNode } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { sliceArt, type SliceArtName } from './art';
import { fillImage, space } from './theme';

/**
 * Painted 9-slice art (button plates, wood panels, the board frame) stretched behind its
 * children. Corners keep their natural size; only the middle bands stretch.
 */
export function Slice({
  name,
  style,
  children,
  pointerEvents,
}: {
  name: SliceArtName;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  pointerEvents?: 'none' | 'auto' | 'box-none' | 'box-only';
}) {
  const a = sliceArt[name];
  return (
    <View style={style} pointerEvents={pointerEvents}>
      {/* Percent sizes resolve against the padded content box, so the art gets its own
          unpadded layer to fill. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Image
          source={a.src}
          capInsets={a.caps}
          resizeMode="stretch"
          style={fillImage}
          accessibilityIgnoresInvertColors
        />
      </View>
      {children}
    </View>
  );
}

/** Wooden card with brass corner brackets; the default container for grouped content. */
export function Panel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Slice name="panel_wood" style={[styles.panel, style]}>
      {children}
    </Slice>
  );
}

const styles = StyleSheet.create({
  panel: {
    minHeight: 72,
    paddingHorizontal: space.xl,
    paddingVertical: space.lg + 2,
    gap: space.sm,
  },
});
