/** Moonlit Caribbean night: dark teal sea, weathered oak, aged gold, parchment and ember. */
export const colors = {
  bg: '#0a1418',
  bgDeep: '#060d10',
  surface: '#2b1b12',
  surfaceHi: '#3a2618',
  line: '#5a4126',
  lineSoft: '#3d2a19',
  water: '#0f2328',
  waterHi: '#10262b',
  parchment: '#e7d3a6',
  ink: '#2a1d12',
  accent: '#d4a84b',
  accentBright: '#f0cf7a',
  accentDim: '#8d6a26',
  accentInk: '#2a1607',
  text: '#efe4cc',
  textDim: '#d8cbb0',
  textMuted: '#a8916a',
  ship: '#8a6a43',
  shipEdge: '#a07a4a',
  hit: '#d9472b',
  hitGlow: 'rgba(217,71,43,0.35)',
  sunk: '#7a2416',
  miss: '#b9cfc9',
  missDot: 'rgba(185,207,201,0.85)',
  success: '#7fc8bb',
  warning: '#e8b04a',
  danger: '#e8735a',
  overlay: 'rgba(6,13,16,0.86)',
} as const;

export const fonts = {
  display: 'GrenzeGotisch_700Bold',
  displaySemi: 'GrenzeGotisch_600SemiBold',
  body: 'Alegreya_400Regular',
  bodyMedium: 'Alegreya_500Medium',
  bodySemi: 'Alegreya_700Bold',
  caps: 'AlegreyaSC_700Bold',
  capsMedium: 'AlegreyaSC_500Medium',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 6, md: 10, lg: 16, pill: 999 } as const;

/** Cap Dynamic Type growth where layout is fixed-size (board labels, pills). */
export const MAX_FONT_SCALE = 1.4;

/** Soft dark shadow that keeps light text readable over painted backgrounds. */
export const textShadow = {
  textShadowColor: 'rgba(0,0,0,0.75)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 4,
} as const;

/**
 * Full-bleed style for <Image>. A static `require` gives an Image its intrinsic width/height,
 * which beats `absoluteFill`'s edges, so the size has to be explicit.
 */
export const fillImage = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
} as const;
