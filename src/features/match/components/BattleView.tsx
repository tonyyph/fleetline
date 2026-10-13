import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Board, type BoardShip } from '@/features/game/components/Board';
import { FleetStatus } from '@/features/game/components/FleetStatus';
import { checkFire, markBoard, type Shot } from '@/features/game/logic';
import { haptic } from '@/features/settings/haptics';
import { messageFor } from '@/lib/supabase';
import type { MatchRow, ShotRow } from '@/types/database';
import { AppText, Banner, Button, Slice, colors, radius, space } from '@/ui';

import { toShot, type Presence } from '../model';
import { boardWidth } from './PlacementView';

interface Props {
  match: MatchRow;
  me: string;
  shots: readonly ShotRow[];
  myShips: readonly { id: string; cells: number[] }[];
  presence: Presence | null;
  pendingCell: number | null;
  onFire: (cell: number) => Promise<{ shot: ShotRow }>;
  onSurrender: () => Promise<void>;
  onClaim: () => Promise<void>;
}

function describe(shot: ShotRow): string {
  if (shot.result === 'miss') return 'Trượt rồi';
  if (shot.result === 'hit') return 'Trúng đích!';
  return `Đánh chìm tàu ${shot.sunk_cells?.length ?? ''} ô!`;
}

export function BattleView({
  match,
  me,
  shots,
  myShips,
  presence,
  pendingCell,
  onFire,
  onSurrender,
  onClaim,
}: Props) {
  const { width } = useWindowDimensions();
  const size = boardWidth(width);
  const [toast, setToast] = useState<{ text: string; tone: 'hit' | 'miss' | 'error' } | null>(null);
  const [claiming, setClaiming] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const myShots = shots.filter((s) => s.shooter === me);
  const theirShots = shots.filter((s) => s.shooter !== me);
  const myShotModels: Shot[] = myShots.map(toShot);
  const theirShotModels: Shot[] = theirShots.map(toShot);
  const fired = new Set(myShots.map((s) => s.cell));
  const isMyTurn = match.turn === me;

  const show = (text: string, tone: 'hit' | 'miss' | 'error') => {
    clearTimeout(toastTimer.current);
    setToast({ text, tone });
    toastTimer.current = setTimeout(() => setToast(null), 1600);
  };
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // Feel the opponent's shots land on our fleet.
  const lastTheirs = theirShots[theirShots.length - 1];
  const seenTheirs = useRef(lastTheirs?.id);
  useEffect(() => {
    if (!lastTheirs || lastTheirs.id === seenTheirs.current) return;
    seenTheirs.current = lastTheirs.id;
    haptic(lastTheirs.result === 'miss' ? 'miss' : lastTheirs.result === 'sunk' ? 'sunk' : 'hit');
  }, [lastTheirs]);

  const handleFire = async (cell: number) => {
    const err = checkFire({
      status: match.status,
      isMyTurn: isMyTurn && pendingCell === null,
      firedCells: fired,
      cell,
    });
    if (err) {
      haptic('error');
      show(
        messageFor(err === 'not_your_turn' && pendingCell !== null ? 'not_your_turn' : err),
        'error',
      );
      return;
    }
    try {
      const { shot } = await onFire(cell);
      haptic(shot.result === 'miss' ? 'miss' : shot.result === 'sunk' ? 'sunk' : 'hit');
      show(describe(shot), shot.result === 'miss' ? 'miss' : 'hit');
    } catch (e) {
      haptic('error');
      show(e instanceof Error ? e.message : messageFor('unknown'), 'error');
    }
  };

  const lostCells = new Set(theirShots.flatMap((s) => s.sunk_cells ?? []));
  const ownShips: BoardShip[] = myShips.map((s) => ({
    id: s.id,
    cells: s.cells,
    tone: s.cells.every((c) => lostCells.has(c)) ? 'sunk' : 'own',
  }));
  const sunkEnemy: BoardShip[] = myShots
    .filter((s) => s.result === 'sunk' && s.sunk_cells)
    .map((s) => ({ id: `sunk-${s.id}`, cells: s.sunk_cells!, tone: 'sunk' }));

  const mySunkLengths = theirShots
    .filter((s) => s.result === 'sunk')
    .map((s) => s.sunk_cells?.length ?? 0);
  const enemySunkLengths = myShots
    .filter((s) => s.result === 'sunk')
    .map((s) => s.sunk_cells?.length ?? 0);

  const miniSize = Math.min(Math.floor(size * 0.5), 210);

  return (
    <View style={styles.wrap}>
      <Slice
        name={isMyTurn ? 'banner_parchment' : 'btn_wood'}
        style={[styles.turn, isMyTurn ? styles.turnMine : styles.turnTheirs]}
      >
        <View accessibilityLiveRegion="polite" style={styles.turnText}>
          <AppText variant="heading" align="center" color={isMyTurn ? colors.ink : colors.text}>
            {isMyTurn ? 'Lượt của bạn' : 'Lượt đối thủ'}
          </AppText>
          <AppText variant="caption" align="center" color={isMyTurn ? '#5a3d22' : colors.textDim}>
            {isMyTurn ? 'Khai hỏa vào hải phận đối thủ' : 'Đối thủ đang nạp đạn…'}
          </AppText>
        </View>
      </Slice>

      {presence === 'away' ? (
        <Banner
          tone="warn"
          text="Đối thủ đang mất kết nối. Trận vẫn được giữ nguyên, hãy chờ họ quay lại."
        />
      ) : null}
      {presence === 'gone' ? (
        <Banner
          tone="warn"
          text="Đối thủ đã im lặng hơn 2 phút."
          action={
            <Button
              label="Nhận thắng"
              compact
              loading={claiming}
              onPress={async () => {
                setClaiming(true);
                try {
                  await onClaim();
                } catch (e) {
                  show(e instanceof Error ? e.message : messageFor('unknown'), 'error');
                } finally {
                  setClaiming(false);
                }
              }}
            />
          }
        />
      ) : null}

      <View style={styles.center}>
        <View>
          <AppText variant="label" style={styles.boardTitle}>
            Hải đồ đối thủ
          </AppText>
          <Board
            size={size}
            surface="chart"
            ships={sunkEnemy}
            marks={markBoard(myShotModels)}
            onPressCell={handleFire}
            disabled={!isMyTurn}
            pendingCell={pendingCell}
            lastCell={myShots[myShots.length - 1]?.cell ?? null}
            accessibilityLabel="Bàn đối thủ. Chạm vào ô để bắn."
          />
          {toast ? (
            <Animated.View
              entering={FadeIn.duration(120)}
              exiting={FadeOut.duration(160)}
              pointerEvents="none"
              style={[
                styles.toast,
                toast.tone === 'hit' && styles.toastHit,
                toast.tone === 'error' && styles.toastError,
              ]}
            >
              <AppText variant="heading" color={colors.text}>
                {toast.text}
              </AppText>
            </Animated.View>
          ) : null}
        </View>
      </View>

      <View style={styles.lower}>
        <View>
          <AppText variant="label" style={styles.boardTitle}>
            Hạm đội của bạn
          </AppText>
          <Board
            size={miniSize}
            surface="sea"
            showLabels={false}
            ships={ownShips}
            marks={markBoard(theirShotModels)}
            lastCell={lastTheirs?.cell ?? null}
            accessibilityLabel="Bàn của bạn"
          />
        </View>
        <View style={styles.stats}>
          <FleetStatus label="Đối thủ" sunkLengths={enemySunkLengths} />
          <FleetStatus label="Bạn" sunkLengths={mySunkLengths} />
          <AppText variant="caption">
            Đã bắn {myShots.length} · Trúng {myShots.filter((s) => s.result !== 'miss').length}
          </AppText>
        </View>
      </View>

      <Button
        label="Kéo cờ trắng (đầu hàng)"
        variant="danger"
        art="surrender"
        compact
        onPress={() =>
          Alert.alert('Đầu hàng?', 'Đối thủ sẽ được tính thắng trận này.', [
            { text: 'Tiếp tục chiến đấu', style: 'cancel' },
            {
              text: 'Đầu hàng',
              style: 'destructive',
              onPress: () => void onSurrender().catch(() => {}),
            },
          ])
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  turn: { minHeight: 66, justifyContent: 'center' },
  turnMine: { minHeight: 88, paddingHorizontal: 48, paddingTop: space.md, paddingBottom: space.lg },
  turnTheirs: { paddingHorizontal: space.xl, paddingVertical: space.sm },
  turnText: { gap: 0 },
  center: { alignItems: 'center' },
  boardTitle: { marginBottom: 6 },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    top: '45%',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(32,20,10,0.95)',
    borderWidth: 1,
    borderColor: colors.accentDim,
  },
  toastHit: { backgroundColor: 'rgba(122,36,22,0.96)', borderColor: colors.hit },
  toastError: { borderColor: colors.danger },
  lower: { flexDirection: 'row', gap: space.lg, alignItems: 'flex-start' },
  stats: { flex: 1, gap: space.md, paddingTop: 22 },
});
