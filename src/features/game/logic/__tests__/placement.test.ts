import {
  initialPlacement,
  isPlacementComplete,
  placementReducer,
  type PlacementState,
} from '../placement';
import { validateFleet } from '../fleet';
import { seededRng } from '../rng';

const run = (...actions: Parameters<typeof placementReducer>[1][]): PlacementState =>
  actions.reduce(placementReducer, initialPlacement);

describe('placementReducer', () => {
  it('places the selected ship and advances to the next one', () => {
    const s = run({ type: 'tap', cell: 0 });
    expect(s.placed).toEqual([{ id: 'carrier', x: 0, y: 0, o: 'h' }]);
    expect(s.selected).toBe('battleship');
  });

  it('honours rotation', () => {
    const s = run({ type: 'rotate' }, { type: 'tap', cell: 0 });
    expect(s.placed[0].o).toBe('v');
  });

  it('reports overlap and out-of-bounds without changing the board', () => {
    const s1 = run(
      { type: 'tap', cell: 0 },
      { type: 'tap', cell: 10 },
      { type: 'select', id: 'cruiser' },
    );
    const s2 = placementReducer(s1, { type: 'rotate' });
    const s3 = placementReducer(s2, { type: 'tap', cell: 2 + 9 * 10 }); // C10, vertical → off board
    expect(s3.lastError).toBe('out_of_bounds');
    expect(s3.placed).toHaveLength(2);
  });

  it('picks a placed ship back up when tapped', () => {
    const s = run({ type: 'tap', cell: 0 }, { type: 'tap', cell: 3 });
    expect(s.placed).toHaveLength(0);
    expect(s.selected).toBe('carrier');
  });

  it('undoes step by step and clears', () => {
    const s = run({ type: 'tap', cell: 0 }, { type: 'tap', cell: 20 });
    const u = placementReducer(s, { type: 'undo' });
    expect(u.placed).toHaveLength(1);
    const c = placementReducer(s, { type: 'clear' });
    expect(c.placed).toHaveLength(0);
    expect(placementReducer(c, { type: 'undo' }).placed).toHaveLength(2);
  });

  it('randomizes into a complete valid fleet', () => {
    const s = run({ type: 'randomize', rng: seededRng(7) });
    expect(isPlacementComplete(s)).toBe(true);
    expect(validateFleet(s.placed)).toBeNull();
  });
});
