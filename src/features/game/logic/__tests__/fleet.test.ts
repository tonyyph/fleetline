import { checkPlacement, randomFleet, shipCells, validateFleet } from '../fleet';
import { seededRng } from '../rng';
import type { ShipPlacement } from '../types';

const valid: ShipPlacement[] = [
  { id: 'carrier', x: 0, y: 0, o: 'h' },
  { id: 'battleship', x: 0, y: 1, o: 'h' }, // touching the carrier is allowed
  { id: 'cruiser', x: 9, y: 0, o: 'v' },
  { id: 'submarine', x: 5, y: 5, o: 'v' },
  { id: 'destroyer', x: 8, y: 9, o: 'h' },
];

describe('shipCells', () => {
  it('extends right for horizontal and down for vertical', () => {
    expect(shipCells({ id: 'destroyer', x: 3, y: 4, o: 'h' })).toEqual([43, 44]);
    expect(shipCells({ id: 'destroyer', x: 3, y: 4, o: 'v' })).toEqual([43, 53]);
  });

  it('returns null when the ship would leave the board', () => {
    expect(shipCells({ id: 'carrier', x: 6, y: 0, o: 'h' })).toBeNull();
    expect(shipCells({ id: 'carrier', x: 0, y: 6, o: 'v' })).toBeNull();
    expect(shipCells({ id: 'carrier', x: 5, y: 0, o: 'h' })).toEqual([5, 6, 7, 8, 9]);
  });
});

describe('validateFleet', () => {
  it('accepts a full fleet with touching ships', () => {
    expect(validateFleet(valid)).toBeNull();
  });

  it('rejects overlap', () => {
    const fleet = [...valid.slice(0, 4), { id: 'destroyer', x: 0, y: 0, o: 'v' } as ShipPlacement];
    expect(validateFleet(fleet)).toBe('overlap');
  });

  it('rejects ships off the board', () => {
    const fleet = [...valid.slice(0, 4), { id: 'destroyer', x: 9, y: 9, o: 'h' } as ShipPlacement];
    expect(validateFleet(fleet)).toBe('out_of_bounds');
  });

  it('rejects missing, duplicate and unknown ships', () => {
    expect(validateFleet(valid.slice(0, 4))).toBe('missing_ship');
    expect(validateFleet([...valid.slice(0, 4), { ...valid[3], x: 7 }])).toBe('duplicate_ship');
    expect(
      validateFleet([...valid, { id: 'dinghy', x: 0, y: 9, o: 'h' } as unknown as ShipPlacement]),
    ).toBe('unknown_ship');
  });

  it('rejects a bad orientation', () => {
    const bad = { id: 'destroyer', x: 0, y: 9, o: 'd' } as unknown as ShipPlacement;
    expect(checkPlacement([], bad)).toBe('bad_orientation');
  });
});

describe('randomFleet', () => {
  it('always produces a valid fleet', () => {
    for (let seed = 1; seed <= 500; seed++) {
      expect(validateFleet(randomFleet(seededRng(seed)))).toBeNull();
    }
  });
});
