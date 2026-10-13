import { BOARD_SIZE, CELL_COUNT, type Cell } from './types';

export const COLUMN_LABELS = 'ABCDEFGHIJ'.split('');
export const ROW_LABELS = Array.from({ length: BOARD_SIZE }, (_, i) => String(i + 1));

export function isInBounds(x: number, y: number): boolean {
  return (
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    x >= 0 &&
    y >= 0 &&
    x < BOARD_SIZE &&
    y < BOARD_SIZE
  );
}

export function isValidCell(cell: unknown): cell is Cell {
  return typeof cell === 'number' && Number.isInteger(cell) && cell >= 0 && cell < CELL_COUNT;
}

export function toCell(x: number, y: number): Cell {
  return y * BOARD_SIZE + x;
}

export function fromCell(cell: Cell): { x: number; y: number } {
  return { x: cell % BOARD_SIZE, y: Math.floor(cell / BOARD_SIZE) };
}

/** "A1" … "J10": column letter then row number. */
export function cellLabel(cell: Cell): string {
  const { x, y } = fromCell(cell);
  return `${COLUMN_LABELS[x]}${ROW_LABELS[y]}`;
}
