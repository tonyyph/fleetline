import type { MatchRow, ShotRow } from '@/types/database';
import {
  fleetCells,
  formatDuration,
  mergeShots,
  newerMatch,
  presenceOf,
  statsFor,
  toShot,
} from '../model';

const match = {
  id: 'm',
  player1: 'a',
  player2: 'b',
  started_at: '2026-10-12T10:00:00Z',
  finished_at: '2026-10-12T10:04:05Z',
} as MatchRow;

const shot = (shooter: string, result: ShotRow['result'], cell: number): ShotRow => ({
  id: `${shooter}${cell}`,
  match_id: 'm',
  shooter,
  cell,
  result,
  sunk_cells: result === 'sunk' ? [cell - 1, cell] : null,
  turn_number: cell,
  created_at: '',
});

describe('match model', () => {
  it('converts rows to shots, keeping sunk cells only when sunk', () => {
    expect(toShot(shot('a', 'miss', 5))).toEqual({ cell: 5, result: 'miss' });
    expect(toShot(shot('a', 'sunk', 5))).toEqual({ cell: 5, result: 'sunk', sunkCells: [4, 5] });
  });

  it('computes per-player stats and duration', () => {
    const shots = [
      shot('a', 'miss', 1),
      shot('a', 'hit', 2),
      shot('b', 'hit', 3),
      shot('a', 'sunk', 4),
    ];
    expect(statsFor(shots, 'a', match)).toEqual({
      shots: 3,
      hits: 2,
      accuracy: 2 / 3,
      durationMs: 245_000,
    });
    expect(formatDuration(245_000)).toBe('4:05');
    expect(formatDuration(null)).toBe('—');
  });

  it('classifies presence by heartbeat age', () => {
    const now = Date.parse('2026-10-12T10:10:00Z');
    expect(presenceOf('2026-10-12T10:09:50Z', now, '')).toBe('online');
    expect(presenceOf('2026-10-12T10:09:00Z', now, '')).toBe('away');
    expect(presenceOf(null, now, '2026-10-12T10:00:00Z')).toBe('gone');
  });

  it('reads fleets defensively', () => {
    expect(fleetCells([{ id: 'carrier', cells: [0, 1] }, 'junk', null])).toEqual([
      { id: 'carrier', cells: [0, 1] },
    ]);
    expect(fleetCells(null)).toEqual([]);
  });
});

describe('sync helpers', () => {
  it('keeps the newer match row regardless of timestamp format', () => {
    const older = { ...match, turn: 'a', updated_at: '2026-10-12T10:00:05.000+00:00' };
    const newer = { ...match, turn: 'b', updated_at: '2026-10-12T17:00:06+07:00' };
    expect(newerMatch(newer, older).turn).toBe('b');
    expect(newerMatch(older, newer).turn).toBe('b');
    // Heartbeats keep updated_at: equal timestamps take the incoming row.
    expect(newerMatch(newer, { ...newer, p1_seen_at: 'x' }).p1_seen_at).toBe('x');
  });

  it('merges shots without duplicates, in turn order', () => {
    const merged = mergeShots(
      [shot('a', 'miss', 3), shot('b', 'hit', 1)],
      [shot('a', 'miss', 3), shot('a', 'hit', 2)],
    );
    expect(merged.map((s) => s.cell)).toEqual([1, 2, 3]);
  });
});
