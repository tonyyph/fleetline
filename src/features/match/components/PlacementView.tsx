import { useReducer, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { Board, type BoardShip } from '@/features/game/components/Board';
import { ShipTray } from '@/features/game/components/ShipTray';
import {
  initialPlacement,
  isPlacementComplete,
  placementReducer,
  shipCells,
  type FleetError,
  type ShipPlacement,
} from '@/features/game/logic';
import { haptic } from '@/features/settings/haptics';
import { AppText, Banner, Button, IconButton, colors, space } from '@/ui';

const PLACEMENT_ERRORS: Record<FleetError, string> = {
  out_of_bounds: 'Tàu vượt ra ngoài bàn. Chọn ô khác hoặc xoay tàu.',
  overlap: 'Tàu không được chồng lên nhau.',
  duplicate_ship: 'Tàu này đã được đặt.',
  missing_ship: 'Còn tàu chưa đặt.',
  unknown_ship: 'Tàu không hợp lệ.',
  bad_orientation: 'Hướng không hợp lệ.',
};

export function boardWidth(windowWidth: number): number {
  return Math.min(windowWidth - space.lg * 2, 440);
}

/** Local placement (pure reducer), then one `place_fleet` call that the server validates. */
export function PlacementView({
  onConfirm,
}: {
  onConfirm: (ships: ShipPlacement[]) => Promise<void>;
}) {
  const [state, dispatch] = useReducer(placementReducer, initialPlacement);
  const [submitting, setSubmitting] = useState(false);
  const { width } = useWindowDimensions();

  const ships: BoardShip[] = state.placed.map((p) => ({
    id: p.id,
    cells: shipCells(p) ?? [],
    tone: 'own',
  }));
  const complete = isPlacementComplete(state);

  return (
    <View style={styles.wrap}>
      <View style={styles.intro}>
        <AppText variant="title">Bố trí hạm đội</AppText>
        <AppText variant="caption">Chạm ô để thả neo mũi tàu. Chạm tàu đã đặt để nhổ neo.</AppText>
      </View>

      <ShipTray
        placed={new Set(state.placed.map((p) => p.id))}
        selected={state.selected}
        onSelect={(id) => dispatch({ type: 'select', id })}
      />

      <View style={styles.tools}>
        <IconButton
          art="rotate"
          label={
            state.orientation === 'h'
              ? 'Đang đặt ngang, chạm để xoay dọc'
              : 'Đang đặt dọc, chạm để xoay ngang'
          }
          onPress={() => dispatch({ type: 'rotate' })}
          active
        />
        <AppText variant="bodyStrong" color={colors.textDim} style={styles.toolLabel}>
          {state.orientation === 'h' ? 'Ngang' : 'Dọc'}
        </AppText>
        <View style={styles.spacer} />
        <IconButton
          art="undo"
          label="Hoàn tác"
          onPress={() => dispatch({ type: 'undo' })}
          disabled={!state.history.length}
        />
        <IconButton
          icon="trash-outline"
          label="Xoá hết"
          onPress={() => dispatch({ type: 'clear' })}
          disabled={!state.placed.length}
        />
        <IconButton
          art="random"
          label="Đặt ngẫu nhiên"
          onPress={() => dispatch({ type: 'randomize' })}
        />
      </View>

      <View style={styles.board}>
        <Board
          size={boardWidth(width)}
          surface="sea"
          ships={ships}
          onPressCell={(cell) => {
            const next = placementReducer(state, { type: 'tap', cell });
            haptic(next.lastError ? 'error' : 'tap');
            dispatch({ type: 'tap', cell });
          }}
          accessibilityLabel="Bàn của bạn, chạm để đặt tàu"
        />
      </View>

      {state.lastError ? <Banner tone="error" text={PLACEMENT_ERRORS[state.lastError]} /> : null}

      <Button
        label={complete ? 'Sẵn sàng ra trận' : `Còn ${5 - state.placed.length} tàu chưa đặt`}
        icon="flag"
        disabled={!complete}
        loading={submitting}
        onPress={async () => {
          setSubmitting(true);
          try {
            await onConfirm(state.placed);
          } finally {
            setSubmitting(false);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md + 2 },
  intro: { gap: space.xs },
  tools: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  toolLabel: { marginLeft: 2 },
  spacer: { flex: 1 },
  board: { alignItems: 'center' },
});
