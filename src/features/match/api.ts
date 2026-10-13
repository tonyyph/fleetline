import { supabase, toAppError } from '@/lib/supabase';
import type { Json, MatchRow, ProfileRow, ShotRow } from '@/types/database';
import type { ShipPlacement } from '@/features/game/logic';

/** Unwrap a supabase-js result, turning `{ error }` into a thrown AppError. */
async function unwrap<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  let res: { data: T | null; error: unknown };
  try {
    res = await p;
  } catch (e) {
    throw toAppError(e);
  }
  if (res.error) throw toAppError(res.error);
  return res.data as T;
}

export const MATCH_OPEN_STATUSES = ['waiting', 'placing', 'active'] as const;

export function createRoom(): Promise<MatchRow> {
  return unwrap(supabase.rpc('create_room'));
}

export function joinRoom(code: string): Promise<MatchRow> {
  return unwrap(supabase.rpc('join_room', { p_code: code }));
}

export function cancelRoom(matchId: string): Promise<MatchRow> {
  return unwrap(supabase.rpc('cancel_room', { p_match_id: matchId }));
}

export function placeFleet(matchId: string, ships: ShipPlacement[]): Promise<MatchRow> {
  return unwrap(
    supabase.rpc('place_fleet', { p_match_id: matchId, p_ships: ships as unknown as Json }),
  );
}

export interface FireResponse {
  shot: ShotRow;
  status: MatchRow['status'];
  turn: string | null;
  winner: string | null;
  updated_at: string;
}

export async function fire(matchId: string, cell: number, shotId: string): Promise<FireResponse> {
  const data = await unwrap(
    supabase.rpc('fire', { p_match_id: matchId, p_cell: cell, p_shot_id: shotId }),
  );
  return data as unknown as FireResponse;
}

export function surrender(matchId: string): Promise<MatchRow> {
  return unwrap(supabase.rpc('surrender', { p_match_id: matchId }));
}

export function heartbeat(matchId: string): Promise<string> {
  return unwrap(supabase.rpc('heartbeat', { p_match_id: matchId }));
}

export function claimAbandoned(matchId: string): Promise<MatchRow> {
  return unwrap(supabase.rpc('claim_abandoned', { p_match_id: matchId }));
}

export function requestRematch(matchId: string): Promise<MatchRow> {
  return unwrap(supabase.rpc('request_rematch', { p_match_id: matchId }));
}

export function fetchMatch(matchId: string): Promise<MatchRow | null> {
  return unwrap(supabase.from('matches').select('*').eq('id', matchId).maybeSingle());
}

export function fetchShots(matchId: string): Promise<ShotRow[]> {
  return unwrap(supabase.from('shots').select('*').eq('match_id', matchId).order('turn_number'));
}

/** RLS returns only the caller's fleet while the match runs, and both once it is finished. */
export function fetchFleets(matchId: string): Promise<{ user_id: string; ships: Json }[]> {
  return unwrap(supabase.from('fleets').select('user_id, ships').eq('match_id', matchId));
}

export function fetchProfiles(ids: string[]): Promise<ProfileRow[]> {
  return unwrap(supabase.from('profiles').select('*').in('id', ids));
}

/** The caller's unfinished match, if any (RLS limits the query to their own matches). */
export function fetchOpenMatch(): Promise<MatchRow | null> {
  return unwrap(
    supabase
      .from('matches')
      .select('*')
      .in('status', [...MATCH_OPEN_STATUSES])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  );
}

export type QueueResult =
  | { status: 'waiting'; since: string }
  | { status: 'matched'; match_id: string }
  | { status: 'left' };

export async function joinQueue(): Promise<QueueResult> {
  return (await unwrap(supabase.rpc('join_queue'))) as unknown as QueueResult;
}

export async function leaveQueue(): Promise<QueueResult> {
  return (await unwrap(supabase.rpc('leave_queue'))) as unknown as QueueResult;
}
