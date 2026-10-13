import { cellLabel, fromCell, isInBounds, isValidCell, toCell } from '../board';

describe('board coordinates', () => {
  it('maps corners to labels', () => {
    expect(cellLabel(0)).toBe('A1');
    expect(cellLabel(9)).toBe('J1');
    expect(cellLabel(90)).toBe('A10');
    expect(cellLabel(99)).toBe('J10');
  });

  it('round-trips every cell', () => {
    for (let c = 0; c < 100; c++) {
      const { x, y } = fromCell(c);
      expect(toCell(x, y)).toBe(c);
    }
  });

  it('rejects cells off the board or non-integers', () => {
    expect(isValidCell(-1)).toBe(false);
    expect(isValidCell(100)).toBe(false);
    expect(isValidCell(1.5)).toBe(false);
    expect(isValidCell('5')).toBe(false);
    expect(isInBounds(10, 0)).toBe(false);
    expect(isInBounds(0, -1)).toBe(false);
    expect(isInBounds(9, 9)).toBe(true);
  });
});
