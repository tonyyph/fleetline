import { Image, View } from 'react-native';

import { art, wordmarkAspect } from './art';

/** The skull-and-cannons emblem. */
export function LogoMark({ size = 72 }: { size?: number }) {
  return (
    <Image
      source={art.logo_emblem}
      style={{ width: size, height: size }}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

/** Emblem over the FLEETLINE wordmark. */
export function Logo({ size = 150, width = 300 }: { size?: number; width?: number }) {
  return (
    <View
      style={{ alignItems: 'center' }}
      accessibilityRole="header"
      accessibilityLabel="Fleetline"
    >
      <LogoMark size={size} />
      <Image
        source={art.logo_wordmark}
        style={{ width, height: width * wordmarkAspect, marginTop: -size * 0.08 }}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </View>
  );
}
