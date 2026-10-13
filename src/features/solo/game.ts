import {
  isFleetDestroyed,
  checkFire,
  randomFleet,
  resolveShot,
  shipCells,
  validateFleet,
  type AiLevel,
  type Cell,
  type FireError,
  type FleetError,
  type Rng,
  type Shot,
  type ShipPlacement,
} from '@/features/game/logic';
import type { MatchRow, ShotRow } from '@/types/database';

/**
 * Offline game against the computer. Same rules as the server's `fire`: one shot per turn,
 * turns alternate whatever the result, and the first fleet fully sunk loses. Everything here is
 * a pure function of the previous state so it can be saved, restored and tested.
 */
export type SoloSide = 'me' | 'ai';

export interface SoloShot extends Shot {
  shooter: SoloSide;
  at: number;
}

export interface SoloGame {
  version: 1;
  id: string;
  level: AiLevel;
  status: 'placing' | 'active' | 'finished';
  myFleet: ShipPlacement[] | null;
  aiFleet: ShipPlacement[];
  shots: SoloShot[];
  turn: SoloSide | null;
  winner: SoloSide | null;
  finishReason: 'sunk' | 'surrender' | null;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
}

export type SoloResult =
  | { ok: true; game: SoloGame; shot?: SoloShot }
  | { ok: false; error: FireError | FleetError | 'not_placing' };

export function newSoloGame(level: AiLevel, rng: Rng = Math.random, now = Date.now()): SoloGame {
  return {
    version: 1,
    id: `solo-${now.toString(36)}-${Math.floor(rng() * 1e9).toString(36)}`,
    level,
    status: 'placing',
    myFleet: null,
    aiFleet: randomFleet(rng),
    shots: [],
    turn: null,
    winner: null,
    finishReason: null,
    createdAt: now,
    startedAt: null,
    finishedAt: null,
  };
}

/** Lock the player's fleet and start the battle; a coin toss picks who fires first. */
export function placeSoloFleet(
  game: SoloGame,
  fleet: readonly ShipPlacement[],
  rng: Rng = Math.random,
  now = Date.now(),
): SoloResult {
  if (game.status !== 'placing') return { ok: false, error: 'not_placing' };
  const error = validateFleet(fleet);
  if (error) return { ok: false, error };
  return {
    ok: true,
    game: {
      ...game,
      status: 'active',
      myFleet: fleet.map((p) => ({ ...p })),
      turn: rng() < 0.5 ? 'me' : 'ai',
      startedAt: now,
    },
  };
}

export const shotsBy = (game: SoloGame, side: SoloSide): SoloShot[] =>
  game.shots.filter((s) => s.shooter === side);

export function fireSolo(
  game: SoloGame,
  shooter: SoloSide,
  cell: Cell,
  now = Date.now(),
): SoloResult {
  const own = shotsBy(game, shooter);
  const fired = new Set(own.map((s) => s.cell));
  const error = checkFire({
    status: game.status,
    isMyTurn: game.turn === shooter,
    firedCells: fired,
    cell,
  });
  if (error) return { ok: false, error };
  const target = shooter === 'me' ? game.aiFleet : (game.myFleet ?? []);
  const r = resolveShot(target, fired, cell);
  const shot: SoloShot = r.sunkCells
    ? { shooter, cell, result: r.result, sunkCells: r.sunkCells, at: now }
    : { shooter, cell, result: r.result, at: now };
  const shots = [...game.shots, shot];
  const won = isFleetDestroyed([...own, shot]);
  return {
    ok: true,
    shot,
    game: won
      ? {
          ...game,
          shots,
          status: 'finished',
          turn: null,
          winner: shooter,
          finishReason: 'sunk',
          finishedAt: now,
        }
      : { ...game, shots, turn: shooter === 'me' ? 'ai' : 'me' },
  };
}

export function surrenderSolo(game: SoloGame, now = Date.now()): SoloGame {
  if (game.status === 'finished') return game;
  return {
    ...game,
    status: 'finished',
    turn: null,
    winner: 'ai',
    finishReason: 'surrender',
    finishedAt: now,
  };
}

/** Loose shape check for a game read back from storage. */
export function isSoloGame(value: unknown): value is SoloGame {
  if (typeof value !== 'object' || value === null) return false;
  const g = value as Partial<SoloGame>;
  return (
    g.version === 1 &&
    typeof g.id === 'string' &&
    (g.level === 'easy' || g.level === 'normal' || g.level === 'hard') &&
    Array.isArray(g.aiFleet) &&
    validateFleet(g.aiFleet) === null &&
    Array.isArray(g.shots) &&
    (g.myFleet === null || (Array.isArray(g.myFleet) && validateFleet(g.myFleet) === null))
  );
}

// --- Adapters to the online row shapes, so the match screens render solo games unchanged ---

export const SOLO_ME = 'me';
export const SOLO_AI = 'ai';

const iso = (t: number | null) => (t === null ? null : new Date(t).toISOString());

export function soloMatchRow(game: SoloGame): MatchRow {
  return {
    id: game.id,
    kind: 'room',
    code: null,
    status: game.status,
    player1: SOLO_ME,
    player2: SOLO_AI,
    p1_ready: game.myFleet !== null,
    p2_ready: true,
    turn: game.turn,
    turn_number: game.shots.length,
    winner: game.winner,
    finish_reason: game.finishReason,
    p1_seen_at: null,
    p2_seen_at: null,
    p1_rematch: false,
    p2_rematch: false,
    rematch_of: null,
    rematch_id: null,
    created_at: iso(game.createdAt)!,
    started_at: iso(game.startedAt),
    finished_at: iso(game.finishedAt),
    updated_at: iso(game.finishedAt ?? game.startedAt ?? game.createdAt)!,
  };
}

export function soloShotRow(game: SoloGame, shot: SoloShot, index: number): ShotRow {
  return {
    id: `${game.id}-${index}`,
    match_id: game.id,
    shooter: shot.shooter,
    cell: shot.cell,
    result: shot.result,
    sunk_cells: shot.sunkCells ?? null,
    turn_number: index + 1,
    created_at: new Date(shot.at).toISOString(),
  };
}

export const soloShotRows = (game: SoloGame): ShotRow[] =>
  game.shots.map((s, i) => soloShotRow(game, s, i));

export const fleetToCells = (fleet: readonly ShipPlacement[] | null) =>
  (fleet ?? []).map((p) => ({ id: p.id, cells: shipCells(p) ?? [] }));
