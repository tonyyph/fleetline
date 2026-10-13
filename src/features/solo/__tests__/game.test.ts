import { randomFleet, seededRng, shipCells, type ShipPlacement } from '@/features/game/logic';

import {
  fireSolo,
  isSoloGame,
  newSoloGame,
  placeSoloFleet,
  soloMatchRow,
  soloShotRows,
  surrenderSolo,
  type SoloGame,
  type SoloResult,
} from '../game';

const ok = (r: SoloResult): SoloGame => {
  if (!r.ok) throw new Error(`expected ok, got ${r.error}`);
  return r.game;
};

/** A game in battle with the player to move. */
function activeGame(): SoloGame {
  const game = newSoloGame('normal', seededRng(1), 1000);
  // rng() < 0.5 means the player fires first.
  return ok(placeSoloFleet(game, randomFleet(seededRng(2)), () => 0, 2000));
}

describe('solo game', () => {
  it('starts in placement with a valid hidden computer fleet', () => {
    const g = newSoloGame('hard', seededRng(3));
    expect(g.status).toBe('placing');
    expect(isSoloGame(g)).toBe(true);
    expect(g.aiFleet).toHaveLength(5);
  });

  it('refuses an invalid fleet', () => {
    const g = newSoloGame('easy', seededRng(3));
    const bad: ShipPlacement[] = [{ id: 'carrier', x: 8, y: 0, o: 'h' }];
    const r = placeSoloFleet(g, bad);
    expect(r).toEqual({ ok: false, error: 'out_of_bounds' });
  });

  it('alternates turns after every shot, hit or miss', () => {
    let g = activeGame();
    expect(g.turn).toBe('me');
    const target = shipCells(g.aiFleet[0]!)![0]!;
    const r = fireSolo(g, 'me', target, 3000);
    g = ok(r);
    expect(r.ok && r.shot?.result).toBe('hit');
    expect(g.turn).toBe('ai');
    expect(fireSolo(g, 'me', 99)).toEqual({ ok: false, error: 'not_your_turn' });
    g = ok(fireSolo(g, 'ai', 0, 3100));
    expect(g.turn).toBe('me');
    expect(fireSolo(g, 'me', target)).toEqual({ ok: false, error: 'already_fired' });
  });

  it('ends when a fleet is fully sunk', () => {
    let g = activeGame();
    const targets = g.aiFleet.flatMap((p) => shipCells(p)!);
    const misses = Array.from({ length: 100 }, (_, i) => i);
    for (const cell of targets) {
      g = ok(fireSolo(g, 'me', cell));
      if (g.status === 'finished') break;
      g = ok(fireSolo(g, 'ai', misses.shift()!));
    }
    expect(g.status).toBe('finished');
    expect(g.winner).toBe('me');
    expect(g.finishReason).toBe('sunk');
    expect(soloShotRows(g).at(-1)?.result).toBe('sunk');
  });

  it('surrender hands the win to the computer', () => {
    const g = surrenderSolo(activeGame(), 5000);
    expect(g).toMatchObject({ status: 'finished', winner: 'ai', finishReason: 'surrender' });
    expect(soloMatchRow(g).finished_at).toBe(new Date(5000).toISOString());
  });

  it('rejects corrupted saved data', () => {
    expect(isSoloGame(null)).toBe(false);
    expect(isSoloGame({ ...activeGame(), level: 'godlike' })).toBe(false);
    expect(isSoloGame(JSON.parse(JSON.stringify(activeGame())))).toBe(true);
  });
});
