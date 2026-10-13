import { fromCell, isInBounds, toCell } from './board';
import type { Rng } from './fleet';
import { BOARD_SIZE, CELL_COUNT, FLEET, type Cell, type Shot } from './types';

/**
 * Computer opponent for offline play. Every level only sees what a human would: the results of
 * its own shots (miss / hit / sunk with the sunk ship's cells), never the hidden fleet.
 *
 * - easy:   random shots; after a hit it follows up on a neighbour about half the time.
 * - normal: hunts on a checkerboard, then finishes every ship it hits (extends lines first).
 * - hard:   probability density: counts every placement of the remaining ships that fits what
 *           it knows, and fires at the most likely cell.
 */
export type AiLevel = 'easy' | 'normal' | 'hard';

interface Knowledge {
  fired: Set<Cell>;
  /** Hit cells that do not belong to a ship known to be sunk yet. */
  open: Set<Cell>;
  /** Cells no unsunk ship can occupy: misses and the cells of sunk ships. */
  blocked: Set<Cell>;
  /** Lengths of the ships still afloat. */
  remaining: number[];
}

function learn(shots: readonly Shot[]): Knowledge {
  const fired = new Set<Cell>();
  const sunkCells = new Set<Cell>();
  const remaining = FLEET.map((s) => s.length);
  for (const s of shots) {
    fired.add(s.cell);
    if (s.result === 'sunk' && s.sunkCells) {
      for (const c of s.sunkCells) sunkCells.add(c);
      const i = remaining.indexOf(s.sunkCells.length);
      if (i >= 0) remaining.splice(i, 1);
    }
  }
  const open = new Set<Cell>();
  const blocked = new Set<Cell>(sunkCells);
  for (const s of shots) {
    if (s.result === 'miss') blocked.add(s.cell);
    else if (!sunkCells.has(s.cell)) open.add(s.cell);
  }
  return { fired, open, blocked, remaining };
}

const pick = <T>(items: readonly T[], rng: Rng): T => items[Math.floor(rng() * items.length)]!;

function unfired(k: Knowledge): Cell[] {
  const cells: Cell[] = [];
  for (let c = 0; c < CELL_COUNT; c++) if (!k.fired.has(c)) cells.push(c);
  return cells;
}

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

function neighbours(cell: Cell): Cell[] {
  const { x, y } = fromCell(cell);
  return DIRS.filter(([dx, dy]) => isInBounds(x + dx, y + dy)).map(([dx, dy]) =>
    toCell(x + dx, y + dy),
  );
}

/** Untried cells next to open hits; ends of lines of two or more open hits come first. */
function targetCells(k: Knowledge): { line: Cell[]; around: Cell[] } {
  const line = new Set<Cell>();
  const around = new Set<Cell>();
  for (const hit of k.open) {
    const { x, y } = fromCell(hit);
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
    ] as const) {
      const before = isInBounds(x - dx, y - dy) && k.open.has(toCell(x - dx, y - dy));
      const after = isInBounds(x + dx, y + dy) && k.open.has(toCell(x + dx, y + dy));
      if (!before && !after) continue;
      // Walk to both ends of this run of open hits and try just past each end.
      for (const sign of [1, -1]) {
        let cx = x;
        let cy = y;
        while (isInBounds(cx + dx * sign, cy + dy * sign)) {
          cx += dx * sign;
          cy += dy * sign;
          const c = toCell(cx, cy);
          if (k.open.has(c)) continue;
          if (!k.fired.has(c)) line.add(c);
          break;
        }
      }
    }
    for (const n of neighbours(hit)) if (!k.fired.has(n)) around.add(n);
  }
  return { line: [...line], around: [...around] };
}

function easyShot(k: Knowledge, rng: Rng): Cell {
  const { around } = targetCells(k);
  if (around.length && rng() < 0.5) return pick(around, rng);
  return pick(unfired(k), rng);
}

function normalShot(k: Knowledge, rng: Rng): Cell {
  const { line, around } = targetCells(k);
  if (line.length) return pick(line, rng);
  if (around.length) return pick(around, rng);
  // Every ship covers at least two cells, so one colour of the checkerboard finds them all.
  const free = unfired(k);
  const even = free.filter((c) => {
    const { x, y } = fromCell(c);
    return (x + y) % 2 === 0;
  });
  return pick(even.length ? even : free, rng);
}

/** For each cell, how many placements of the remaining ships consistent with the shots cover it. */
export function densityMap(shots: readonly Shot[]): number[] {
  const k = learn(shots);
  const score = new Array<number>(CELL_COUNT).fill(0);
  const targeting = k.open.size > 0;
  for (const len of k.remaining) {
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        for (const o of ['h', 'v'] as const) {
          const cells: Cell[] = [];
          for (let i = 0; i < len; i++) {
            const cx = o === 'h' ? x + i : x;
            const cy = o === 'v' ? y + i : y;
            if (!isInBounds(cx, cy)) break;
            cells.push(toCell(cx, cy));
          }
          if (cells.length !== len || cells.some((c) => k.blocked.has(c))) continue;
          const covered = cells.filter((c) => k.open.has(c)).length;
          // While a ship is wounded, only placements through its hits matter, and the more hits
          // a placement explains the likelier it is.
          if (targeting && covered === 0) continue;
          const weight = targeting ? covered * covered : 1;
          for (const c of cells) if (!k.fired.has(c)) score[c]! += weight;
        }
      }
    }
  }
  return score;
}

function hardShot(shots: readonly Shot[], k: Knowledge, rng: Rng): Cell {
  const score = densityMap(shots);
  let best = -1;
  let ties: Cell[] = [];
  for (let c = 0; c < CELL_COUNT; c++) {
    if (k.fired.has(c)) continue;
    const s = score[c]!;
    if (s > best) {
      best = s;
      ties = [c];
    } else if (s === best) ties.push(c);
  }
  // No consistent placement left (cannot happen with honest results): fall back to hunting.
  return best > 0 ? pick(ties, rng) : normalShot(k, rng);
}

/** The cell the computer fires at next, given the results of its own shots so far. */
export function chooseShot(level: AiLevel, shots: readonly Shot[], rng: Rng = Math.random): Cell {
  const k = learn(shots);
  if (k.fired.size >= CELL_COUNT) throw new Error('board is full');
  switch (level) {
    case 'easy':
      return easyShot(k, rng);
    case 'normal':
      return normalShot(k, rng);
    case 'hard':
      return hardShot(shots, k, rng);
  }
}
