import {
  CELL_COUNT,
  chooseShot,
  densityMap,
  isFleetDestroyed,
  randomFleet,
  resolveShot,
  seededRng,
  toCell,
  type AiLevel,
  type Shot,
  type ShipPlacement,
} from '..';

/** Let `level` shoot at `fleet` until it is sunk; returns the shots it needed. */
function playOut(level: AiLevel, fleet: ShipPlacement[], seed: number): Shot[] {
  const rng = seededRng(seed);
  const shots: Shot[] = [];
  const fired = new Set<number>();
  while (!isFleetDestroyed(shots)) {
    const cell = chooseShot(level, shots, rng);
    expect(fired.has(cell)).toBe(false);
    expect(cell).toBeGreaterThanOrEqual(0);
    expect(cell).toBeLessThan(CELL_COUNT);
    const r = resolveShot(fleet, fired, cell);
    fired.add(cell);
    shots.push(r.sunkCells ? { cell, ...r } : { cell, result: r.result });
    if (shots.length > CELL_COUNT) throw new Error('did not finish');
  }
  return shots;
}

const average = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('chooseShot', () => {
  it.each(['easy', 'normal', 'hard'] as const)(
    '%s sinks a whole fleet with legal shots',
    (level) => {
      for (let seed = 1; seed <= 5; seed++) {
        const shots = playOut(level, randomFleet(seededRng(seed * 7)), seed);
        expect(shots.length).toBeLessThanOrEqual(CELL_COUNT);
      }
    },
  );

  it('gets stronger with each level', () => {
    const games = 40;
    const avg = (level: AiLevel) =>
      average(
        Array.from(
          { length: games },
          (_, i) => playOut(level, randomFleet(seededRng(1000 + i)), 50 + i).length,
        ),
      );
    const easy = avg('easy');
    const normal = avg('normal');
    const hard = avg('hard');
    expect(normal).toBeLessThan(easy);
    expect(hard).toBeLessThan(normal);
    // Rough sanity bounds: random play needs ~95 shots, good density play ~45.
    expect(hard).toBeLessThan(60);
  });

  it('normal and hard follow up a hit next to it', () => {
    const hit: Shot[] = [{ cell: toCell(4, 4), result: 'hit' }];
    const around = [toCell(3, 4), toCell(5, 4), toCell(4, 3), toCell(4, 5)];
    for (const level of ['normal', 'hard'] as const) {
      for (let seed = 1; seed <= 10; seed++) {
        expect(around).toContain(chooseShot(level, hit, seededRng(seed)));
      }
    }
  });

  it('normal extends a line of hits instead of probing sideways', () => {
    const shots: Shot[] = [
      { cell: toCell(4, 4), result: 'hit' },
      { cell: toCell(5, 4), result: 'hit' },
    ];
    for (let seed = 1; seed <= 10; seed++) {
      expect([toCell(3, 4), toCell(6, 4)]).toContain(chooseShot('normal', shots, seededRng(seed)));
    }
  });

  it('never targets around a ship once it is sunk', () => {
    const sunk = [toCell(0, 0), toCell(1, 0)];
    const shots: Shot[] = [
      { cell: sunk[0]!, result: 'hit' },
      { cell: sunk[1]!, result: 'sunk', sunkCells: sunk },
    ];
    const density = densityMap(shots);
    expect(density[sunk[0]!]).toBe(0);
    // Back to hunting: the open middle of the board is likelier than the sunk ship's corner.
    expect(density[toCell(5, 5)]!).toBeGreaterThan(density[toCell(0, 1)]!);
  });
});
