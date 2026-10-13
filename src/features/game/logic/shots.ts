import { isValidCell } from './board';
import { shipCells } from './fleet';
import {
  TOTAL_SHIP_CELLS,
  type Cell,
  type Shot,
  type ShotResult,
  type ShipPlacement,
} from './types';

export type FireError = 'not_active' | 'not_your_turn' | 'invalid_cell' | 'already_fired';

export interface FireCheckInput {
  status: string;
  isMyTurn: boolean;
  firedCells: ReadonlySet<Cell>;
  cell: unknown;
}

/** Client-side mirror of the server's checks, so the UI can refuse obviously bad taps early. */
export function checkFire({
  status,
  isMyTurn,
  firedCells,
  cell,
}: FireCheckInput): FireError | null {
  if (status !== 'active') return 'not_active';
  if (!isMyTurn) return 'not_your_turn';
  if (!isValidCell(cell)) return 'invalid_cell';
  if (firedCells.has(cell)) return 'already_fired';
  return null;
}

/**
 * Resolve a shot against a fleet given the cells already hit before it.
 * Mirrors `public.fire` on the server; used by local play and tests.
 */
export function resolveShot(
  fleet: readonly ShipPlacement[],
  priorShots: ReadonlySet<Cell>,
  target: Cell,
): { result: ShotResult; sunkCells?: Cell[] } {
  for (const ship of fleet) {
    const cells = shipCells(ship) ?? [];
    if (!cells.includes(target)) continue;
    const sunk = cells.every((c) => c === target || priorShots.has(c));
    return sunk ? { result: 'sunk', sunkCells: cells } : { result: 'hit' };
  }
  return { result: 'miss' };
}

export function countHits(shots: readonly Shot[]): number {
  return shots.filter((s) => s.result !== 'miss').length;
}

export function countSunk(shots: readonly Shot[]): number {
  return shots.filter((s) => s.result === 'sunk').length;
}

/** All ship cells hit means the fleet is gone. */
export function isFleetDestroyed(shots: readonly Shot[]): boolean {
  return countHits(shots) >= TOTAL_SHIP_CELLS;
}

export type CellMark = 'empty' | 'miss' | 'hit' | 'sunk';

/** Per-cell marks for a board, from the shots that landed on it. */
export function markBoard(shots: readonly Shot[]): Map<Cell, CellMark> {
  const marks = new Map<Cell, CellMark>();
  for (const s of shots) {
    if (!marks.has(s.cell) || marks.get(s.cell) === 'empty') {
      marks.set(s.cell, s.result === 'miss' ? 'miss' : 'hit');
    }
  }
  for (const s of shots) for (const c of s.sunkCells ?? []) marks.set(c, 'sunk');
  return marks;
}

export function accuracy(shots: readonly Shot[]): number {
  return shots.length === 0 ? 0 : countHits(shots) / shots.length;
}
