import { AppError, messageFor, toAppError } from '../errors';

describe('toAppError', () => {
  it('maps server error codes to their message', () => {
    const err = toAppError({ message: 'not_your_turn', code: 'P0001' });
    expect(err.code).toBe('not_your_turn');
    expect(err.message).toBe(messageFor('not_your_turn'));
  });

  it('recognises network failures', () => {
    expect(toAppError(new TypeError('Network request failed')).isNetwork).toBe(true);
    expect(toAppError({ message: 'TypeError: fetch failed' }).code).toBe('network');
  });

  it('falls back to unknown without leaking raw messages', () => {
    const err = toAppError(new Error('duplicate key value violates unique constraint "x"'));
    expect(err.code).toBe('unknown');
    expect(err.message).not.toContain('duplicate key');
  });

  it('passes AppErrors through', () => {
    const original = new AppError('room_full');
    expect(toAppError(original)).toBe(original);
  });
});
