import { memo, useEffect } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import {
  BOARD_SIZE,
  COLUMN_LABELS,
  ROW_LABELS,
  cellLabel,
  fromCell,
  type Cell,
  type CellMark,
  type ShipId,
} from '@/features/game/logic';
import {
  AppText,
  Slice,
  art,
  colors,
  fillImage,
  fonts,
  shipArt,
  textShadow,
  type ShipArtName,
} from '@/ui';

export type ShipTone = 'own' | 'sunk' | 'revealed' | 'preview' | 'invalid' | 'selected';

export interface BoardShip {
  id: string;
  cells: readonly Cell[];
  tone: ShipTone;
  /** Sprite to draw; by default picked from the ship id, else from its length. */
  art?: ShipArtName;
}

/** `chart`: the opponent's waters as a parchment sea chart. `sea`: your own fleet on open water. */
export type BoardSurface = 'chart' | 'sea';

interface BoardProps {
  /** Total width including the coordinate labels and frame. */
  size: number;
  surface?: BoardSurface;
  ships?: readonly BoardShip[];
  marks?: ReadonlyMap<Cell, CellMark>;
  onPressCell?: (cell: Cell) => void;
  disabled?: boolean;
  pendingCell?: Cell | null;
  /** Most recent shot on this board: gets a ripple and an outline. */
  lastCell?: Cell | null;
  showLabels?: boolean;
  accessibilityLabel: string;
}

const MARK_TEXT: Record<CellMark, string> = {
  empty: 'chưa bắn',
  miss: 'trượt',
  hit: 'trúng',
  sunk: 'tàu chìm',
};

/** Which painted hull each ship of the fleet uses. */
export const SHIP_ART: Record<ShipId, ShipArtName> = {
  carrier: 'ship_5',
  battleship: 'ship_4',
  cruiser: 'ship_3a',
  submarine: 'ship_3b',
  destroyer: 'ship_2',
};

const SURFACE = {
  chart: { texture: art.board_parchment, line: 'rgba(42,29,18,0.32)', edge: 'rgba(74,44,14,0.55)' },
  sea: { texture: art.board_water, line: 'rgba(239,228,204,0.13)', edge: 'rgba(3,8,10,0.6)' },
} as const;

/** Frame thickness: the painted frame's cap inset, so it sits entirely outside the grid. */
const FRAME = 14;

export function boardMetrics(size: number, showLabels = true) {
  const frame = showLabels ? FRAME : 2;
  const label = showLabels ? Math.max(14, Math.round(size * 0.045)) : 0;
  const cell = Math.floor((size - label - frame * 2) / BOARD_SIZE);
  return { label, frame, cell, grid: cell * BOARD_SIZE };
}

function artFor(ship: BoardShip): ShipArtName {
  if (ship.art) return ship.art;
  const byId = SHIP_ART[ship.id as ShipId];
  if (byId) return byId;
  switch (ship.cells.length) {
    case 5:
      return 'ship_5';
    case 4:
      return 'ship_4';
    case 3:
      return (ship.cells[0] ?? 0) % 2 ? 'ship_3b' : 'ship_3a';
    default:
      return 'ship_2';
  }
}

/** A painted hull spanning its cells; vertical ships are the same sprite turned 90°. */
const ShipSprite = memo(function ShipSprite({ ship, cell }: { ship: BoardShip; cell: number }) {
  const a = shipArt[artFor(ship)];
  const pts = ship.cells.map(fromCell);
  const x0 = Math.min(...pts.map((p) => p.x));
  const y0 = Math.min(...pts.map((p) => p.y));
  const len = pts.length;
  const vertical = len > 1 && pts.every((p) => p.x === pts[0]!.x);
  const w = len * cell * 0.98;
  const h = w * a.aspect;
  const cx = vertical ? x0 * cell + cell / 2 : x0 * cell + (len * cell) / 2;
  const cy = vertical ? y0 * cell + (len * cell) / 2 : y0 * cell + cell / 2;
  const tone = ship.tone;
  const opacity =
    tone === 'revealed' ? 0.6 : tone === 'preview' ? 0.55 : tone === 'invalid' ? 0.5 : 1;

  return (
    <Animated.View
      entering={tone === 'preview' || tone === 'invalid' ? undefined : FadeIn.duration(160)}
      pointerEvents="none"
      style={{ position: 'absolute', left: cx - w / 2, top: cy - h / 2, width: w, height: h }}
    >
      <View
        style={[
          styles.shipShadow,
          tone === 'selected' && styles.shipSelected,
          vertical && { transform: [{ rotate: '90deg' }] },
        ]}
      >
        <Image
          source={tone === 'sunk' ? a.sunk : a.intact}
          style={{ width: w, height: h, opacity }}
          tintColor={tone === 'invalid' ? colors.hit : undefined}
        />
      </View>
    </Animated.View>
  );
});

function Ripple({ size, color }: { size: number; color: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) }));
  }, [t]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.8 * (1 - t.get()),
    transform: [{ scale: 0.5 + t.get() * 1.3 }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: color,
        },
        style,
      ]}
    />
  );
}

function PendingPulse({ size }: { size: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(
      withRepeat(withTiming(1, { duration: 600, easing: Easing.inOut(Easing.quad) }), -1, true),
    );
  }, [t]);
  const style = useAnimatedStyle(() => ({ opacity: 0.35 + 0.65 * t.get() }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          width: size * 0.62,
          height: size * 0.62,
          borderRadius: size,
          borderWidth: 2,
          borderColor: colors.hit,
        },
        style,
      ]}
    />
  );
}

const Marker = memo(function Marker({
  mark,
  size,
  isLast,
  surface,
}: {
  mark: CellMark;
  size: number;
  isLast: boolean;
  surface: BoardSurface;
}) {
  if (mark === 'empty') return null;
  if (mark === 'miss') {
    const chart = surface === 'chart';
    const s = size * (chart ? 0.62 : 0.92);
    return (
      <>
        {isLast ? <Ripple size={size * 0.85} color={chart ? colors.ink : colors.miss} /> : null}
        <Animated.Image
          entering={isLast ? ZoomIn.duration(180) : undefined}
          source={chart ? art.mark_miss_chart : art.mark_miss_water}
          style={{ width: s, height: s }}
        />
      </>
    );
  }
  // A sunk ship's own sprite is already burning, so its cells get a smaller flame.
  const sunk = mark === 'sunk';
  const s = size * (sunk ? 0.7 : 1.2);
  return (
    <>
      {isLast ? <Ripple size={size * 0.95} color={colors.hit} /> : null}
      <Animated.Image
        entering={isLast ? ZoomIn.duration(200) : undefined}
        source={art.mark_hit}
        style={{ width: s, height: s, opacity: sunk ? 0.85 : 1 }}
      />
    </>
  );
});

export function Board({
  size,
  surface = 'sea',
  ships = [],
  marks,
  onPressCell,
  disabled,
  pendingCell,
  lastCell,
  showLabels = true,
  accessibilityLabel,
}: BoardProps) {
  const m = boardMetrics(size, showLabels);
  const look = SURFACE[surface];
  const interactive = !!onPressCell && !disabled;
  const cells = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, i) => i);
  const lines = Array.from({ length: BOARD_SIZE - 1 }, (_, i) => (i + 1) * m.cell);
  const labelSize = Math.min(13, m.label * 0.8);
  const framed = m.grid + m.frame * 2;

  return (
    <View accessibilityLabel={accessibilityLabel} style={{ width: m.label + framed }}>
      {showLabels ? (
        <View style={[styles.colLabels, { marginLeft: m.label + m.frame, height: m.label }]}>
          {COLUMN_LABELS.map((c) => (
            <AppText key={c} style={[styles.labelText, { width: m.cell, fontSize: labelSize }]}>
              {c}
            </AppText>
          ))}
        </View>
      ) : null}
      <View style={styles.row}>
        {showLabels ? (
          <View style={{ width: m.label, paddingTop: m.frame }}>
            {ROW_LABELS.map((r) => (
              <AppText
                key={r}
                style={[
                  styles.labelText,
                  { height: m.cell, lineHeight: m.cell, fontSize: labelSize },
                ]}
              >
                {r}
              </AppText>
            ))}
          </View>
        ) : null}

        <View
          style={[
            { width: framed, height: framed, padding: m.frame },
            !showLabels && styles.thinFrame,
          ]}
        >
          <View style={[styles.grid, { width: m.grid, height: m.grid }]}>
            <Image
              source={look.texture}
              resizeMode="cover"
              style={fillImage}
              accessibilityIgnoresInvertColors
            />
            <Svg width={m.grid} height={m.grid} style={StyleSheet.absoluteFill}>
              <Defs>
                <RadialGradient id="edge" cx="50%" cy="50%" r="72%">
                  <Stop offset="0.55" stopColor={look.edge} stopOpacity="0" />
                  <Stop offset="1" stopColor={look.edge} stopOpacity="1" />
                </RadialGradient>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#edge)" />
            </Svg>
            {surface === 'chart' && showLabels ? (
              <Image
                source={art.compass_rose}
                style={[
                  styles.compass,
                  { width: m.grid * 0.42, height: m.grid * 0.42, right: m.cell * 0.3 },
                  { bottom: m.cell * 0.3 },
                ]}
              />
            ) : null}
            {lines.map((p) => (
              <View
                key={`v${p}`}
                pointerEvents="none"
                style={[styles.vLine, { left: p, backgroundColor: look.line }]}
              />
            ))}
            {lines.map((p) => (
              <View
                key={`h${p}`}
                pointerEvents="none"
                style={[styles.hLine, { top: p, backgroundColor: look.line }]}
              />
            ))}

            {/* Ships sit under the markers */}
            {ships.map((s) => (
              <ShipSprite key={`${s.id}-${s.tone}-${s.cells[0]}`} ship={s} cell={m.cell} />
            ))}

            {/* Touch targets + markers */}
            {cells.map((c) => {
              const { x, y } = fromCell(c);
              const mark = marks?.get(c) ?? 'empty';
              const pos = { left: x * m.cell, top: y * m.cell, width: m.cell, height: m.cell };
              const content = (
                <>
                  <Marker mark={mark} size={m.cell} isLast={lastCell === c} surface={surface} />
                  {pendingCell === c ? <PendingPulse size={m.cell} /> : null}
                  {lastCell === c && mark !== 'empty' ? (
                    <View pointerEvents="none" style={styles.lastOutline} />
                  ) : null}
                </>
              );
              if (!interactive) {
                return (
                  <View key={c} pointerEvents="none" style={[styles.cell, pos]}>
                    {content}
                  </View>
                );
              }
              return (
                <Pressable
                  key={c}
                  accessibilityRole="button"
                  accessibilityLabel={`${cellLabel(c)}, ${MARK_TEXT[mark]}`}
                  onPress={() => onPressCell?.(c)}
                  style={({ pressed }) => [styles.cell, pos, pressed && styles.pressed]}
                >
                  {content}
                </Pressable>
              );
            })}
            {disabled ? <View pointerEvents="none" style={styles.dim} /> : null}
          </View>
          {showLabels ? (
            <Slice name="frame_board" pointerEvents="none" style={StyleSheet.absoluteFill} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  colLabels: { flexDirection: 'row', alignItems: 'center' },
  labelText: {
    textAlign: 'center',
    fontFamily: fonts.caps,
    color: colors.textMuted,
    ...textShadow,
  },
  thinFrame: { borderWidth: 2, borderColor: colors.line, borderRadius: 4 },
  grid: { position: 'relative', overflow: 'hidden', backgroundColor: colors.water },
  compass: { position: 'absolute', opacity: 0.2 },
  vLine: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth * 2 },
  hLine: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth * 2 },
  shipShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.7,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 0 },
  },
  shipSelected: { shadowColor: colors.accentBright, shadowOpacity: 1, shadowRadius: 6 },
  cell: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: 'rgba(212,168,75,0.28)' },
  dim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(6,13,16,0.12)',
  },
  lastOutline: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
});
