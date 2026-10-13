import { useCallback, useEffect, useRef, useState } from 'react';

import { joinQueue, leaveQueue } from '@/features/match/api';
import { toAppError, type AppError } from '@/lib/supabase';

export type QuickMatchState =
  | { phase: 'searching'; startedAt: number; networkError: AppError | null }
  | { phase: 'matched'; matchId: string }
  | { phase: 'timeout' }
  | { phase: 'error'; error: AppError };

const POLL_MS = 2_500;
export const SEARCH_TIMEOUT_MS = 90_000;

/**
 * Quick play: poll `join_queue` (which doubles as the queue heartbeat) until the server pairs us.
 * Leaves the queue on cancel, timeout or unmount. Network blips keep the search alive.
 */
export function useQuickMatch() {
  const [state, setState] = useState<QuickMatchState>(() => ({
    phase: 'searching',
    startedAt: Date.now(),
    networkError: null,
  }));
  const [attempt, setAttempt] = useState(0);
  const searching = useRef(false);

  useEffect(() => {
    searching.current = true;
    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const stop = () => {
      if (!searching.current) return;
      searching.current = false;
      clearTimeout(timer);
    };

    const poll = async () => {
      if (!searching.current) return;
      if (Date.now() - startedAt > SEARCH_TIMEOUT_MS) {
        stop();
        void leaveQueue().catch(() => {});
        setState({ phase: 'timeout' });
        return;
      }
      try {
        const res = await joinQueue();
        if (!searching.current) {
          // Cancelled while the request was in flight: make sure we are not left queued.
          if (res.status === 'waiting') void leaveQueue().catch(() => {});
          return;
        }
        if (res.status === 'matched') {
          stop();
          setState({ phase: 'matched', matchId: res.match_id });
          return;
        }
        setState({ phase: 'searching', startedAt, networkError: null });
      } catch (e) {
        const err = toAppError(e);
        if (!searching.current) return;
        if (!err.isNetwork) {
          stop();
          setState({ phase: 'error', error: err });
          return;
        }
        setState({ phase: 'searching', startedAt, networkError: err });
      }
      timer = setTimeout(poll, POLL_MS);
    };

    void poll();
    return () => {
      if (searching.current) {
        stop();
        void leaveQueue().catch(() => {});
      }
    };
  }, [attempt]);

  /** Cancel; resolves with a match id if we were paired just before cancelling. */
  const cancel = useCallback(async (): Promise<string | null> => {
    searching.current = false;
    try {
      const res = await leaveQueue();
      return res.status === 'matched' ? res.match_id : null;
    } catch {
      return null;
    }
  }, []);

  const retry = useCallback(() => {
    setState({ phase: 'searching', startedAt: Date.now(), networkError: null });
    setAttempt((a) => a + 1);
  }, []);

  return { state, cancel, retry };
}
