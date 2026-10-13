import { useState } from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Board, type BoardShip } from '@/features/game/components/Board';
import { markBoard } from '@/features/game/logic';
import type { MatchRow, ShotRow } from '@/types/database';
import { AppText, Banner, Button, Panel, art, colors, space } from '@/ui';

import { formatDuration, statsFor, toShot, wantsRematch } from '../model';
import { boardWidth } from './PlacementView';

interface Props {
  match: MatchRow;
  me: string;
  opponent: string | null;
  shots: readonly ShotRow[];
  opponentShips: readonly { id: string; cells: number[] }[];
  onRematch: () => Promise<void>;
  onHome: () => void;
}

function reasonText(match: MatchRow, won: boolean): string {
  switch (match.finish_reason) {
    case 'surrender':
      return won ? 'Đối thủ đã đầu hàng.' : 'Bạn đã đầu hàng.';
    case 'abandoned':
      return won ? 'Đối thủ đã rời trận quá lâu.' : 'Bạn đã mất kết nối quá lâu.';
    default:
      return won ? 'Toàn bộ hạm đội đối thủ đã bị đánh chìm.' : 'Hạm đội của bạn đã bị đánh chìm.';
  }
}

export function ResultView({
  match,
  me,
  opponent,
  shots,
  opponentShips,
  onRematch,
  onHome,
}: Props) {
  const { width } = useWindowDimensions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const won = match.winner === me;
  const stats = statsFor(shots, me, match);
  const iAsked = wantsRematch(match, me);
  const theyAsked = wantsRematch(match, opponent);

  const myShots = shots.filter((s) => s.shooter === me);
  const sunkCells = new Set(myShots.flatMap((s) => s.sunk_cells ?? []));
  const revealed: BoardShip[] = opponentShips.map((s) => ({
    id: s.id,
    cells: s.cells,
    tone: s.cells.every((c) => sunkCells.has(c)) ? 'sunk' : 'revealed',
  }));

  return (
    <View style={styles.wrap}>
      <Animated.View entering={FadeInDown.duration(260)} style={styles.hero}>
        <Image
          source={won ? art.result_win : art.result_lose}
          style={styles.heroArt}
          accessibilityElementsHidden
        />
        <AppText variant="label" align="center" color={won ? colors.accent : colors.danger}>
          {won ? 'Chiến thắng' : 'Thất bại'}
        </AppText>
        <AppText
          variant="display"
          align="center"
          color={won ? colors.text : colors.textDim}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {won ? 'Kho báu thuộc về bạn' : 'Về rương của Davy Jones'}
        </AppText>
        <AppText variant="body" align="center">
          {reasonText(match, won)}
        </AppText>
      </Animated.View>

      <Animated.View entering={FadeIn.delay(120).duration(220)} style={styles.stats}>
        <Stat label="Phát bắn" value={String(stats.shots)} />
        <Stat label="Trúng" value={String(stats.hits)} />
        <Stat label="Chính xác" value={`${Math.round(stats.accuracy * 100)}%`} />
        <Stat label="Thời lượng" value={formatDuration(stats.durationMs)} />
      </Animated.View>

      {opponentShips.length ? (
        <View style={styles.center}>
          <AppText variant="label" style={{ marginBottom: 6 }}>
            Hải đồ đối thủ, đã lộ
          </AppText>
          <Board
            size={Math.min(boardWidth(width), 320)}
            surface="chart"
            ships={revealed}
            marks={markBoard(myShots.map(toShot))}
            accessibilityLabel="Đội hình đối thủ sau trận"
          />
        </View>
      ) : null}

      {theyAsked && !iAsked ? <Banner tone="info" text="Đối thủ muốn chơi lại!" /> : null}
      {error ? <Banner tone="error" text={error} /> : null}

      <View style={styles.actions}>
        <Button
          label={iAsked ? 'Đang chờ đối thủ đồng ý…' : 'Tái đấu'}
          art="quickplay"
          disabled={iAsked || !opponent}
          loading={busy}
          onPress={async () => {
            setBusy(true);
            setError(null);
            try {
              await onRematch();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Có lỗi xảy ra.');
            } finally {
              setBusy(false);
            }
          }}
        />
        <Button label="Về trang chủ" icon="home-outline" variant="secondary" onPress={onHome} />
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Panel style={styles.stat}>
      <AppText
        variant="title"
        align="center"
        color={colors.accentBright}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </AppText>
      <AppText variant="caption" align="center">
        {label}
      </AppText>
    </Panel>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  hero: { gap: space.sm, alignItems: 'center' },
  heroArt: { width: 180, height: 180, marginBottom: -space.sm },
  stats: { flexDirection: 'row', gap: 6 },
  stat: { flex: 1, paddingHorizontal: space.sm, paddingVertical: space.md, gap: 0 },
  center: { alignItems: 'center' },
  actions: { gap: space.md },
});
