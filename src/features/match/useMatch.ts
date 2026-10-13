import NetInfo from '@react-native-community/netinfo';
import type { RealtimeChannel } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/features/auth/authStore';
import { useOnline } from '@/features/connection/useOnline';
import type { ShipPlacement } from '@/features/game/logic';
import { AppError, supabase, toAppError } from '@/lib/supabase';
import type { MatchRow, ProfileRow, ShotRow } from '@/types/database';

import * as api from './api';
import { fleetCells, mergeShots, newerMatch } from './model';

export type LiveStatus = 'connecting' | 'live' | 'reconnecting';

const HEARTBEAT_MS = 10_000;
const MAX_BACKOFF_MS = 15_000;

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const err = toAppError(e);
      if (!err.isNetwork || i >= attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }
}

/**
 * Everything the match screen needs: initial load, Realtime updates, reconnect with backoff,
 * resync on foreground / network return, heartbeat, and the player actions.
 * The server is the source of truth: after any failure we refetch instead of guessing.
 */
export function useMatch(matchId: string) {
  const me = useAuth((s) => s.userId);
  const online = useOnline();

  const [match, setMatch] = useState<MatchRow | null>(null);
  const [shots, setShots] = useState<ShotRow[]>([]);
  const [fleets, setFleets] = useState<Record<string, { id: string; cells: number[] }[]>>({});
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [loadError, setLoadError] = useState<AppError | null>(null);
  const [live, setLive] = useState<LiveStatus>('connecting');
  const [pendingCell, setPendingCell] = useState<number | null>(null);

  const mounted = useRef(true);
  const profilesRef = useRef(profiles);
  useEffect(() => {
    profilesRef.current = profiles;
  }, [profiles]);

  const refresh = useCallback(async () => {
    try {
      const [m, s, f] = await Promise.all([
        api.fetchMatch(matchId),
        api.fetchShots(matchId),
        api.fetchFleets(matchId),
      ]);
      if (!mounted.current) return;
      if (!m) {
        setLoadError(new AppError('match_not_found'));
        return;
      }
      setMatch((prev) => newerMatch(prev, m));
      setShots((prev) => mergeShots(prev, s));
      setFleets(Object.fromEntries(f.map((row) => [row.user_id, fleetCells(row.ships)])));
      setLoadError(null);

      const missing = [m.player1, m.player2].filter(
        (id): id is string => !!id && !profilesRef.current[id],
      );
      if (missing.length) {
        const rows = await api.fetchProfiles(missing);
        if (mounted.current)
          setProfiles((p) => ({ ...p, ...Object.fromEntries(rows.map((r) => [r.id, r])) }));
      }
    } catch (e) {
      if (mounted.current) setLoadError(toAppError(e));
    }
  }, [matchId]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Realtime subscription with exponential backoff. Each (re)subscribe triggers a full refresh,
  // so anything missed while disconnected is picked up.
  useEffect(() => {
    let current: RealtimeChannel | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let disposed = false;

    const connect = () => {
      const channel = supabase
        .channel(`match:${matchId}:${Date.now()}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
          (p) => {
            const next = p.new as MatchRow;
            setMatch((prev) => newerMatch(prev, next));
            if (next.status === 'finished') void refresh();
          },
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'shots', filter: `match_id=eq.${matchId}` },
          (p) => setShots((prev) => mergeShots(prev, [p.new as ShotRow])),
        );
      current = channel;
      channel.subscribe((status) => {
        if (disposed || current !== channel) return;
        if (status === 'SUBSCRIBED') {
          attempt = 0;
          setLive('live');
          void refresh();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setLive('reconnecting');
          current = null;
          void supabase.removeChannel(channel);
          const delay = Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS);
          attempt++;
          timer = setTimeout(connect, delay);
        }
      });
    };

    // Initial load. refresh() only sets state after its fetches resolve, so this is not a
    // synchronous cascade; the rule cannot see through the async boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    connect();

    return () => {
      disposed = true;
      clearTimeout(timer);
      if (current) void supabase.removeChannel(current);
      current = null;
    };
  }, [matchId, refresh]);

  // Coming back to the foreground or back online: resync.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  useEffect(() => {
    let wasOffline = false;
    return NetInfo.addEventListener((st) => {
      const isOnline = Boolean(st.isConnected) && st.isInternetReachable !== false;
      if (isOnline && wasOffline) void refresh();
      wasOffline = !isOnline;
    });
  }, [refresh]);

  // Heartbeat while the match is open, so the opponent can see we are still here.
  const isOpen = match ? ['waiting', 'placing', 'active'].includes(match.status) : false;
  useEffect(() => {
    if (!isOpen) return;
    const beat = () => void api.heartbeat(matchId).catch(() => {});
    beat();
    const id = setInterval(beat, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [isOpen, matchId]);

  // Opponent fleets only become readable once the match ends, so refetch on that transition.
  const apply = useCallback(
    (m: MatchRow) => {
      setMatch((prev) => newerMatch(prev, m));
      if (m.status === 'finished') void refresh();
    },
    [refresh],
  );

  /** Run an action; on failure resync and rethrow so the screen can show the message. */
  const act = useCallback(
    async <T>(fn: () => Promise<T>): Promise<T> => {
      try {
        return await withRetry(fn);
      } catch (e) {
        void refresh();
        throw toAppError(e);
      }
    },
    [refresh],
  );

  const fireAt = useCallback(
    async (cell: number) => {
      const shotId = Crypto.randomUUID(); // same id across retries → the server never double-fires
      setPendingCell(cell);
      try {
        const res = await act(() => api.fire(matchId, cell, shotId));
        setShots((prev) => mergeShots(prev, [res.shot]));
        // Carry the server's updated_at so an older Realtime event (e.g. a heartbeat sent just
        // before this shot) cannot roll the turn back on screen.
        setMatch((prev) =>
          prev
            ? newerMatch(prev, {
                ...prev,
                status: res.status,
                turn: res.turn,
                winner: res.winner,
                updated_at: res.updated_at,
              })
            : prev,
        );
        if (res.status === 'finished') void refresh();
        return res;
      } finally {
        if (mounted.current) setPendingCell(null);
      }
    },
    [act, matchId, refresh],
  );

  return {
    me,
    match,
    shots,
    fleets,
    profiles,
    loadError,
    live,
    online,
    pendingCell,
    refresh,
    fireAt,
    placeFleet: (ships: ShipPlacement[]) => act(() => api.placeFleet(matchId, ships)).then(apply),
    surrender: () => act(() => api.surrender(matchId)).then(apply),
    cancelRoom: () => act(() => api.cancelRoom(matchId)).then(apply),
    claimAbandoned: () => act(() => api.claimAbandoned(matchId)).then(apply),
    requestRematch: () => act(() => api.requestRematch(matchId)).then(apply),
  };
}

export type MatchController = ReturnType<typeof useMatch>;
