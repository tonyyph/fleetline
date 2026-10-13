import { Redirect, useLocalSearchParams } from 'expo-router';

import { BattleView } from '@/features/match/components/BattleView';
import { PlacementView } from '@/features/match/components/PlacementView';
import { ResultView } from '@/features/match/components/ResultView';
import { WaitingRoom } from '@/features/match/components/WaitingRoom';
import { MatchHeader } from '@/features/match/components/MatchHeader';
import { randomFleet, resolveShot, seededRng, shipCells } from '@/features/game/logic';
import type { MatchRow, ShotRow } from '@/types/database';
import { Screen } from '@/ui';

/**
 * Development-only gallery of the match screens with local data, so layout and motion can be
 * checked without a backend: exp://127.0.0.1:<port>/--/dev?screen=placement|battle|result|waiting
 */
const ME = 'me';
const THEM = 'them';
const myFleet = randomFleet(seededRng(3));
const theirFleet = randomFleet(seededRng(11));
const toCells = (f: typeof myFleet) => f.map((p) => ({ id: p.id, cells: shipCells(p) ?? [] }));

function fakeShots(count: number): ShotRow[] {
  const rng = seededRng(5);
  const fired = { [ME]: new Set<number>(), [THEM]: new Set<number>() };
  const rows: ShotRow[] = [];
  for (let i = 0; i < count; i++) {
    const shooter = i % 2 === 0 ? ME : THEM;
    const target = shooter === ME ? theirFleet : myFleet;
    let cell = Math.floor(rng() * 100);
    while (fired[shooter].has(cell)) cell = (cell + 7) % 100;
    // Bias my shots onto their ships so hits and a sinking show up.
    if (shooter === ME && i % 4 === 0) {
      const next = target.flatMap((p) => shipCells(p) ?? []).find((c) => !fired[ME].has(c));
      if (next !== undefined) cell = next;
    }
    const r = resolveShot(target, fired[shooter], cell);
    fired[shooter].add(cell);
    rows.push({
      id: `s${i}`,
      match_id: 'dev',
      shooter,
      cell,
      result: r.result,
      sunk_cells: r.sunkCells ?? null,
      turn_number: i + 1,
      created_at: new Date(2026, 9, 12, 10, 0, i).toISOString(),
    });
  }
  return rows;
}

const baseMatch: MatchRow = {
  id: 'dev',
  kind: 'room',
  code: 'K7QX4M',
  status: 'active',
  player1: ME,
  player2: THEM,
  p1_ready: true,
  p2_ready: true,
  turn: ME,
  turn_number: 30,
  winner: null,
  finish_reason: null,
  p1_seen_at: null,
  p2_seen_at: null,
  p1_rematch: false,
  p2_rematch: true,
  rematch_of: null,
  rematch_id: null,
  created_at: '2026-10-12T10:00:00Z',
  started_at: '2026-10-12T10:00:00Z',
  finished_at: '2026-10-12T10:06:41Z',
  updated_at: '2026-10-12T10:06:41Z',
};

const noop = async () => {};

export default function DevGallery() {
  const { screen = 'battle', presence } = useLocalSearchParams<{
    screen?: string;
    presence?: string;
  }>();
  if (!__DEV__) return <Redirect href="/" />;
  const shots = fakeShots(40);
  const p = presence === 'away' || presence === 'gone' ? presence : 'online';

  return (
    <Screen>
      <MatchHeader
        title={screen === 'waiting' ? 'Phòng riêng' : 'vs Thuyền trưởng 2048'}
        opponentName={screen === 'waiting' ? null : 'Thuyền trưởng 2048'}
        presence={screen === 'waiting' || screen === 'result' ? null : p}
        live="live"
        onHome={() => {}}
      />
      {screen === 'waiting' ? <WaitingRoom code="K7QX4M" onCancel={noop} /> : null}
      {screen === 'placement' ? <PlacementView onConfirm={noop} /> : null}
      {screen === 'battle' ? (
        <BattleView
          match={baseMatch}
          me={ME}
          shots={shots}
          myShips={toCells(myFleet)}
          presence={p}
          pendingCell={null}
          onFire={async (cell) => ({
            shot: { ...shots[0], id: `x${cell}`, cell, result: 'miss', sunk_cells: null },
          })}
          onSurrender={noop}
          onClaim={noop}
        />
      ) : null}
      {screen === 'result' ? (
        <ResultView
          match={{
            ...baseMatch,
            status: 'finished',
            winner: ME,
            finish_reason: 'sunk',
            turn: null,
          }}
          me={ME}
          opponent={THEM}
          shots={shots}
          opponentShips={toCells(theirFleet)}
          onRematch={noop}
          onHome={() => {}}
        />
      ) : null}
    </Screen>
  );
}
