import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { BattleView } from '@/features/match/components/BattleView';
import { MatchHeader } from '@/features/match/components/MatchHeader';
import { PlacementView } from '@/features/match/components/PlacementView';
import { ResultView } from '@/features/match/components/ResultView';
import { haptic } from '@/features/settings/haptics';
import {
  SOLO_ME,
  fleetToCells,
  soloMatchRow,
  soloShotRow,
  soloShotRows,
} from '@/features/solo/game';
import { AI_CAPTAINS, captainFor } from '@/features/solo/levels';
import { useSolo } from '@/features/solo/soloStore';
import { messageFor } from '@/lib/supabase';
import { AppText, Banner, IconButton, LoadingState, Panel, Screen, colors, space } from '@/ui';

/** Thinking time before the computer fires, so its shots read as turns, not instant replies. */
const AI_DELAY_MS = 750;

const goHome = () => {
  if (router.canDismiss()) router.dismissAll();
  else router.replace('/');
};

export default function SoloScreen() {
  const loaded = useSolo((s) => s.loaded);
  if (!loaded) return <LoadingState label="Đang mở hải đồ…" />;
  return <SoloContent />;
}

function SoloContent() {
  const { game, start, place, fire, aiMove, surrender } = useSolo();
  // A finished game stays saved for the result screen, but opening the mode again starts fresh.
  const [picking, setPicking] = useState(() => !game || game.status === 'finished');
  const [error, setError] = useState<string | null>(null);

  const aiTurn = !picking && game?.status === 'active' && game.turn === 'ai';
  const shotCount = game?.shots.length ?? 0;
  useEffect(() => {
    if (!aiTurn) return;
    const id = setTimeout(aiMove, AI_DELAY_MS + Math.random() * 400);
    return () => clearTimeout(id);
  }, [aiTurn, shotCount, aiMove]);

  const winner = !picking && game?.status === 'finished' ? game.winner : null;
  useEffect(() => {
    if (winner) haptic(winner === 'me' ? 'win' : 'lose');
  }, [winner]);

  if (picking || !game) {
    return (
      <LevelPicker
        onPick={(level) => {
          start(level);
          setError(null);
          setPicking(false);
        }}
      />
    );
  }

  const captain = captainFor(game.level);
  const match = soloMatchRow(game);
  const shots = soloShotRows(game);

  const leave = () => {
    if (game.status === 'finished') return goHome();
    Alert.alert('Rời trận?', 'Trận được lưu lại. Bạn có thể quay lại từ trang chủ.', [
      { text: 'Ở lại', style: 'cancel' },
      { text: 'Về trang chủ', onPress: goHome },
    ]);
  };

  let body: React.ReactNode = null;
  switch (game.status) {
    case 'placing':
      body = (
        <PlacementView
          onConfirm={async (ships) => {
            const r = place(ships);
            if (!r.ok) {
              haptic('error');
              setError(messageFor(r.error));
            }
          }}
        />
      );
      break;
    case 'active':
      body = (
        <BattleView
          match={match}
          me={SOLO_ME}
          shots={shots}
          myShips={fleetToCells(game.myFleet)}
          presence={null}
          pendingCell={null}
          onFire={async (cell) => {
            const r = fire(cell);
            if (!r.ok || !r.shot) throw new Error(messageFor(r.ok ? 'unknown' : r.error));
            return { shot: soloShotRow(r.game, r.shot, r.game.shots.length - 1) };
          }}
          onSurrender={async () => surrender()}
          onClaim={async () => {}}
        />
      );
      break;
    case 'finished':
      body = (
        <ResultView
          match={match}
          me={SOLO_ME}
          opponent={captain.name}
          shots={shots}
          opponentShips={fleetToCells(game.aiFleet)}
          onRematch={async () => start(game.level)}
          onHome={goHome}
        />
      );
      break;
  }

  return (
    <Screen>
      <MatchHeader
        title={`vs ${captain.name}`}
        opponentName={null}
        presence={null}
        live="live"
        onHome={leave}
      />
      {error ? <Banner tone="error" text={error} /> : null}
      {body}
    </Screen>
  );
}

function LevelPicker({
  onPick,
}: {
  onPick: (level: (typeof AI_CAPTAINS)[number]['level']) => void;
}) {
  return (
    <Screen>
      <IconButton icon="chevron-back" label="Quay lại" onPress={() => router.back()} />
      <View style={styles.intro}>
        <AppText variant="title">Đấu với máy</AppText>
        <AppText variant="body">
          Chơi ngoại tuyến, không cần mạng. Chọn thuyền trưởng đối thủ.
        </AppText>
      </View>
      {AI_CAPTAINS.map((c, i) => (
        <Animated.View key={c.level} entering={FadeInDown.delay(i * 70).duration(240)}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${c.name}, mức ${c.levelLabel}. ${c.description}`}
            onPress={() => {
              haptic('tap');
              onPick(c.level);
            }}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Panel style={styles.card}>
              <Image source={c.avatar} style={styles.avatar} />
              <View style={styles.cardText}>
                <AppText variant="label" color={colors.accent}>
                  {c.levelLabel}
                </AppText>
                <AppText variant="heading" numberOfLines={1} adjustsFontSizeToFit>
                  {c.name}
                </AppText>
                <AppText variant="caption" color={colors.textDim}>
                  {c.description}
                </AppText>
              </View>
            </Panel>
          </Pressable>
        </Animated.View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: space.xs },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: colors.accentDim,
  },
  cardText: { flex: 1, gap: 2 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
});
