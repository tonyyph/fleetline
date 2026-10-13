import { toCell } from '../board';
import { accuracy, checkFire, isFleetDestroyed, markBoard, resolveShot } from '../shots';
import { TOTAL_SHIP_CELLS, type Shot, type ShipPlacement } from '../types';

const fleet: ShipPlacement[] = [
  { id: 'carrier', x: 0, y: 0, o: 'h' },
  { id: 'battleship', x: 0, y: 2, o: 'h' },
  { id: 'cruiser', x: 0, y: 4, o: 'h' },
  { id: 'submarine', x: 0, y: 6, o: 'h' },
  { id: 'destroyer', x: 0, y: 8, o: 'h' },
];

describe('resolveShot', () => {
  it('misses open water', () => {
    expect(resolveShot(fleet, new Set(), toCell(9, 9))).toEqual({ result: 'miss' });
  });

  it('hits, then sinks once every cell is hit', () => {
    const d1 = toCell(0, 8);
    const d2 = toCell(1, 8);
    expect(resolveShot(fleet, new Set(), d1)).toEqual({ result: 'hit' });
    expect(resolveShot(fleet, new Set([d1]), d2)).toEqual({ result: 'sunk', sunkCells: [d1, d2] });
  });

  it('only counts hits on the same ship toward sinking', () => {
    // Hits on the submarine row must not sink the destroyer.
    expect(resolveShot(fleet, new Set([toCell(1, 6)]), toCell(0, 8))).toEqual({ result: 'hit' });
  });
});

describe('checkFire', () => {
  const base = { status: 'active', isMyTurn: true, firedCells: new Set([5]), cell: 6 };
  it('allows a fresh cell on my turn', () => expect(checkFire(base)).toBeNull());
  it('refuses when the match is not active', () =>
    expect(checkFire({ ...base, status: 'placing' })).toBe('not_active'));
  it('refuses out of turn', () =>
    expect(checkFire({ ...base, isMyTurn: false })).toBe('not_your_turn'));
  it('refuses repeated cells', () => expect(checkFire({ ...base, cell: 5 })).toBe('already_fired'));
  it('refuses invalid cells', () => {
    expect(checkFire({ ...base, cell: 100 })).toBe('invalid_cell');
    expect(checkFire({ ...base, cell: -1 })).toBe('invalid_cell');
    expect(checkFire({ ...base, cell: 2.5 })).toBe('invalid_cell');
  });
});

describe('a full game against one fleet', () => {
  it('ends exactly when the last ship cell is hit', () => {
    const shots: Shot[] = [];
    const fired = new Set<number>();
    for (let cell = 0; cell < 100; cell++) {
      const r = resolveShot(fleet, fired, cell);
      fired.add(cell);
      shots.push({ cell, ...r });
      if (isFleetDestroyed(shots)) break;
    }
    expect(shots.filter((s) => s.result === 'sunk')).toHaveLength(5);
    expect(shots.filter((s) => s.result !== 'miss')).toHaveLength(TOTAL_SHIP_CELLS);
    // Last ship (destroyer, row 8) sinks on cell 81.
    expect(shots[shots.length - 1]).toEqual({ cell: 81, result: 'sunk', sunkCells: [80, 81] });
    const marks = markBoard(shots);
    expect(marks.get(0)).toBe('sunk');
    expect(marks.get(9)).toBe('miss');
    expect(accuracy(shots)).toBeCloseTo(17 / 82);
  });
});
