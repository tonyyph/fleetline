export const BOARD_SIZE = 10;
export const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;

/** A board cell as a flat index: `y * BOARD_SIZE + x`, so 0 = A1 and 99 = J10. */
export type Cell = number;

export type Orientation = 'h' | 'v';

export type ShipId = 'carrier' | 'battleship' | 'cruiser' | 'submarine' | 'destroyer';

export interface ShipSpec {
  id: ShipId;
  length: number;
  name: string;
}

/** Where a ship sits: its bow (top-left cell) and direction. Same shape the server validates. */
export interface ShipPlacement {
  id: ShipId;
  x: number;
  y: number;
  o: Orientation;
}

export type ShotResult = 'miss' | 'hit' | 'sunk';

export interface Shot {
  cell: Cell;
  result: ShotResult;
  /** Cells of the ship this shot sank; only present when result is 'sunk'. */
  sunkCells?: Cell[];
}

/** The classic fleet: 5, 4, 3, 3 and 2 cells. Order is the order the tray offers them in. */
export const FLEET: readonly ShipSpec[] = [
  { id: 'carrier', length: 5, name: 'Chiến hạm' },
  { id: 'battleship', length: 4, name: 'Galleon' },
  { id: 'cruiser', length: 3, name: 'Khinh hạm' },
  { id: 'submarine', length: 3, name: 'Brigantine' },
  { id: 'destroyer', length: 2, name: 'Sloop' },
];

export const SHIP_BY_ID: Readonly<Record<ShipId, ShipSpec>> = Object.fromEntries(
  FLEET.map((s) => [s.id, s]),
) as Record<ShipId, ShipSpec>;

export const TOTAL_SHIP_CELLS = FLEET.reduce((sum, s) => sum + s.length, 0);
