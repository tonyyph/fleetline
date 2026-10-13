import { isInBounds, toCell } from './board';
import {
  FLEET,
  SHIP_BY_ID,
  type Cell,
  type Orientation,
  type ShipId,
  type ShipPlacement,
} from './types';

export type FleetError =
  | 'unknown_ship'
  | 'duplicate_ship'
  | 'missing_ship'
  | 'out_of_bounds'
  | 'overlap'
  | 'bad_orientation';

/** Cells covered by a placement, or null if any of them falls off the board. */
export function shipCells(p: ShipPlacement): Cell[] | null {
  const spec = SHIP_BY_ID[p.id];
  if (!spec) return null;
  const cells: Cell[] = [];
  for (let i = 0; i < spec.length; i++) {
    const x = p.o === 'h' ? p.x + i : p.x;
    const y = p.o === 'v' ? p.y + i : p.y;
    if (!isInBounds(x, y)) return null;
    cells.push(toCell(x, y));
  }
  return cells;
}

/** Can `candidate` be added to `placed`? Ships may touch but not overlap. */
export function checkPlacement(
  placed: readonly ShipPlacement[],
  candidate: ShipPlacement,
): FleetError | null {
  if (!SHIP_BY_ID[candidate.id]) return 'unknown_ship';
  if (candidate.o !== 'h' && candidate.o !== 'v') return 'bad_orientation';
  if (placed.some((p) => p.id === candidate.id)) return 'duplicate_ship';
  const cells = shipCells(candidate);
  if (!cells) return 'out_of_bounds';
  const taken = occupiedCells(placed);
  if (cells.some((c) => taken.has(c))) return 'overlap';
  return null;
}

export function occupiedCells(placed: readonly ShipPlacement[]): Map<Cell, ShipId> {
  const map = new Map<Cell, ShipId>();
  for (const p of placed) for (const c of shipCells(p) ?? []) map.set(c, p.id);
  return map;
}

/** A complete fleet has every ship of FLEET exactly once, on the board, without overlaps. */
export function validateFleet(fleet: readonly ShipPlacement[]): FleetError | null {
  const placed: ShipPlacement[] = [];
  for (const p of fleet) {
    const err = checkPlacement(placed, p);
    if (err) return err;
    placed.push(p);
  }
  if (placed.length !== FLEET.length) return 'missing_ship';
  return null;
}

export type Rng = () => number;

/** Random valid fleet. Retries per ship; a 10x10 board always has room, so this terminates fast. */
export function randomFleet(rng: Rng = Math.random): ShipPlacement[] {
  for (;;) {
    const placed: ShipPlacement[] = [];
    for (const spec of FLEET) {
      for (let attempt = 0; attempt < 200; attempt++) {
        const o: Orientation = rng() < 0.5 ? 'h' : 'v';
        const candidate = { id: spec.id, x: Math.floor(rng() * 10), y: Math.floor(rng() * 10), o };
        if (!checkPlacement(placed, candidate)) {
          placed.push(candidate);
          break;
        }
      }
    }
    if (placed.length === FLEET.length) return placed;
  }
}
