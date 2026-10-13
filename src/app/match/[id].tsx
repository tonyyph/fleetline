import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Board } from '@/features/game/components/Board';
import { BattleView } from '@/features/match/components/BattleView';
import { MatchHeader } from '@/features/match/components/MatchHeader';
import { boardWidth, PlacementView } from '@/features/match/components/PlacementView';
import { ResultView } from '@/features/match/components/ResultView';
import { WaitingRoom } from '@/features/match/components/WaitingRoom';
import { isReady, opponentOf, presenceOf, seenAtOf } from '@/features/match/model';
import { useMatch } from '@/features/match/useMatch';
import { haptic } from '@/features/settings/haptics';
import { AppText, Banner, ErrorState, LoadingState, Screen, space } from '@/ui';

const TITLES = {
  waiting: 'Phòng riêng',
  placing: 'Chuẩn bị',
  active: 'Giao chiến',
  finished: 'Kết thúc',
  cancelled: 'Phòng đã đóng',
} as const;

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export default function MatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // Keyed so a rematch (same route, new id) starts from a clean state and fresh subscription.
  return <MatchContent key={id} id={id} />;
}

function MatchContent({ id }: { id: string }) {
  const game = useMatch(id);
  const { match, me, loadError } = game;
  const now = useNow(5_000);
  const { width } = useWindowDimensions();
  const [actionError, setActionError] = useState<string | null>(null);

  // Rematch agreed: both clients see rematch_id appear and move to the new match together.
  const rematchId = match?.rematch_id;
  useEffect(() => {
    if (rematchId) router.replace({ pathname: '/match/[id]', params: { id: rematchId } });
  }, [rematchId]);

  // Result haptic once, when the match flips to finished.
  const finishedWinner = match?.status === 'finished' ? match.winner : undefined;
  useEffect(() => {
    if (finishedWinner !== undefined && me) haptic(finishedWinner === me ? 'win' : 'lose');
  }, [finishedWinner, me]);

  const goHome = () => {
    if (router.canDismiss()) router.dismissAll();
    else router.replace('/');
  };

  const leave = () => {
    if (match && (match.status === 'placing' || match.status === 'active')) {
      Alert.alert('Rời màn hình trận?', 'Trận vẫn tiếp tục. Bạn có thể quay lại từ trang chủ.', [
        { text: 'Ở lại', style: 'cancel' },
        { text: 'Về trang chủ', onPress: goHome },
      ]);
    } else {
      goHome();
    }
  };

  if (!me || (!match && !loadError)) return <LoadingState label="Đang tải trận đấu…" />;
  if (!match) {
    return (
      <ErrorState
        message={loadError?.message ?? ''}
        onRetry={() => void game.refresh()}
        onBack={goHome}
      />
    );
  }

  const opponent = opponentOf(match, me);
  const presence =
    opponent && match.status !== 'finished' && match.status !== 'cancelled'
      ? presenceOf(seenAtOf(match, opponent), now, match.created_at)
      : null;
  const opponentName = opponent ? (game.profiles[opponent]?.display_name ?? 'Đối thủ') : null;

  const run = async (fn: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await fn();
    } catch (e) {
      haptic('error');
      setActionError(e instanceof Error ? e.message : 'Có lỗi xảy ra.');
    }
  };

  const myFleet = game.fleets[me] ?? [];
  const opponentFleet = opponent ? (game.fleets[opponent] ?? []) : [];

  let body: React.ReactNode;
  switch (match.status) {
    case 'waiting':
      body = <WaitingRoom code={match.code ?? '------'} onCancel={() => run(game.cancelRoom)} />;
      break;
    case 'placing':
      body = isReady(match, me) ? (
        <View style={styles.locked}>
          <AppText variant="title">Hạm đội đã sẵn sàng</AppText>
          <AppText variant="body">
            {presence === 'online' || presence === null
              ? `Đang chờ ${opponentName ?? 'đối thủ'} bố trí tàu…`
              : 'Đối thủ đang mất kết nối. Trận sẽ tiếp tục khi họ quay lại.'}
          </AppText>
          <View style={styles.center}>
            <Board
              size={boardWidth(width)}
              ships={myFleet.map((s) => ({ ...s, tone: 'own' }))}
              accessibilityLabel="Đội hình của bạn"
            />
          </View>
          {presence === 'gone' ? (
            <Banner tone="warn" text="Đối thủ đã im lặng hơn 2 phút. Bạn có thể nhận thắng." />
          ) : null}
        </View>
      ) : (
        <PlacementView onConfirm={(ships) => run(() => game.placeFleet(ships))} />
      );
      break;
    case 'active':
      body = (
        <BattleView
          match={match}
          me={me}
          shots={game.shots}
          myShips={myFleet}
          presence={presence}
          pendingCell={game.pendingCell}
          onFire={game.fireAt}
          onSurrender={() => run(game.surrender)}
          onClaim={game.claimAbandoned}
        />
      );
      break;
    case 'finished':
      body = (
        <ResultView
          match={match}
          me={me}
          opponent={opponent}
          shots={game.shots}
          opponentShips={opponentFleet}
          onRematch={game.requestRematch}
          onHome={goHome}
        />
      );
      break;
    case 'cancelled':
      body = (
        <ErrorState title="Phòng đã đóng" message="Chủ phòng đã huỷ phòng này." onBack={goHome} />
      );
      break;
  }

  return (
    <Screen>
      <MatchHeader
        title={
          opponentName && match.status !== 'waiting' ? `vs ${opponentName}` : TITLES[match.status]
        }
        opponentName={opponentName}
        presence={presence}
        live={game.live}
        onHome={leave}
      />
      {game.online === false ? (
        <Banner
          tone="warn"
          text="Không có mạng. Trận được giữ nguyên và sẽ đồng bộ khi có kết nối."
        />
      ) : null}
      {actionError ? <Banner tone="error" text={actionError} /> : null}
      {match.status === 'placing' && isReady(match, me) && presence === 'gone' ? (
        <Banner
          tone="info"
          text="Kết thúc trận và tính thắng cho bạn?"
          action={
            <AppText variant="bodyStrong" onPress={() => void run(game.claimAbandoned)}>
              Nhận thắng
            </AppText>
          }
        />
      ) : null}
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  locked: { gap: space.md },
  center: { alignItems: 'center', marginTop: space.md },
});
