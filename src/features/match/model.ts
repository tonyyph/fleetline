import type { Cell, Shot, ShipPlacement } from '@/features/game/logic';
import type { Json, MatchRow, ShotRow } from '@/types/database';

export function mergeShots(prev: readonly ShotRow[], incoming: readonly ShotRow[]): ShotRow[] {
  const byId = new Map(prev.map((s) => [s.id, s]));
  for (const s of incoming) byId.set(s.id, s);
  return [...byId.values()].sort(
    (a, b) => a.turn_number - b.turn_number || a.created_at.localeCompare(b.created_at),
  );
}

/** Prefer the newer row; heartbeats keep updated_at, so ties take the incoming row. */
export function newerMatch(prev: MatchRow | null, next: MatchRow): MatchRow {
  if (!prev || prev.id !== next.id) return next;
  // Compare instants, not strings: PostgREST, Realtime and jsonb format timestamps differently.
  return Date.parse(next.updated_at) >= Date.parse(prev.updated_at) ? next : prev;
}

export function toShot(row: ShotRow): Shot {
  return row.sunk_cells
    ? { cell: row.cell, result: row.result, sunkCells: row.sunk_cells }
    : { cell: row.cell, result: row.result };
}

/** Server stores ships as [{id, cells}]; the UI only needs the cells per ship. */
export function fleetCells(ships: Json): { id: string; cells: Cell[] }[] {
  if (!Array.isArray(ships)) return [];
  return ships.flatMap((s) => {
    if (typeof s !== 'object' || s === null || Array.isArray(s)) return [];
    const cells = s.cells;
    return typeof s.id === 'string' && Array.isArray(cells)
      ? [{ id: s.id, cells: cells as Cell[] }]
      : [];
  });
}

export function opponentOf(match: MatchRow, me: string): string | null {
  return match.player1 === me ? match.player2 : match.player1;
}

export function seenAtOf(match: MatchRow, player: string | null): string | null {
  if (!player) return null;
  return match.player1 === player ? match.p1_seen_at : match.p2_seen_at;
}

export function isReady(match: MatchRow, player: string): boolean {
  return match.player1 === player ? match.p1_ready : match.p2_ready;
}

export function wantsRematch(match: MatchRow, player: string | null): boolean {
  if (!player) return false;
  return match.player1 === player ? match.p1_rematch : match.p2_rematch;
}

export const OPPONENT_ONLINE_MS = 25_000;
export const ABANDON_AFTER_MS = 120_000;

export type Presence = 'online' | 'away' | 'gone';

/** Presence from the heartbeat timestamp. `gone` means the server will accept claim_abandoned. */
export function presenceOf(seenAt: string | null, now: number, createdAt: string): Presence {
  const last = Date.parse(seenAt ?? createdAt);
  const age = now - last;
  if (age < OPPONENT_ONLINE_MS) return 'online';
  if (age < ABANDON_AFTER_MS) return 'away';
  return 'gone';
}

export interface MatchStats {
  shots: number;
  hits: number;
  accuracy: number;
  durationMs: number | null;
}

export function statsFor(shots: readonly ShotRow[], shooter: string, match: MatchRow): MatchStats {
  const mine = shots.filter((s) => s.shooter === shooter);
  const hits = mine.filter((s) => s.result !== 'miss').length;
  const durationMs =
    match.started_at && match.finished_at
      ? Date.parse(match.finished_at) - Date.parse(match.started_at)
      : null;
  return { shots: mine.length, hits, accuracy: mine.length ? hits / mine.length : 0, durationMs };
}

export function formatDuration(ms: number | null): string {
  if (ms === null || ms < 0) return '—';
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export type { ShipPlacement };
