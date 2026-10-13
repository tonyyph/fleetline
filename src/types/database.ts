// Shape follows `supabase gen types typescript`. Regenerate after schema changes with:
//   pnpm dlx supabase gen types typescript --project-id <ref> --schema public > src/types/database.ts
// (kept hand-written here because the project ref is not known at build time).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type MatchKind = 'room' | 'quick' | 'rematch';
export type MatchStatus = 'waiting' | 'placing' | 'active' | 'finished' | 'cancelled';
export type FinishReason = 'sunk' | 'surrender' | 'abandoned';
export type ShotResultDb = 'miss' | 'hit' | 'sunk';

export type ProfileRow = {
  id: string;
  display_name: string;
  created_at: string;
  updated_at: string;
};

export type MatchRow = {
  id: string;
  kind: MatchKind;
  code: string | null;
  status: MatchStatus;
  player1: string;
  player2: string | null;
  p1_ready: boolean;
  p2_ready: boolean;
  turn: string | null;
  turn_number: number;
  winner: string | null;
  finish_reason: FinishReason | null;
  p1_seen_at: string | null;
  p2_seen_at: string | null;
  p1_rematch: boolean;
  p2_rematch: boolean;
  rematch_of: string | null;
  rematch_id: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
};

export type FleetRow = {
  match_id: string;
  user_id: string;
  ships: Json;
  cells: number[];
  created_at: string;
};

export type ShotRow = {
  id: string;
  match_id: string;
  shooter: string;
  cell: number;
  result: ShotResultDb;
  sunk_cells: number[] | null;
  turn_number: number;
  created_at: string;
};

export type QueueRow = {
  user_id: string;
  enqueued_at: string;
  last_seen_at: string;
};

type ReadOnlyTable<Row> = {
  Row: Row;
  Insert: never;
  Update: never;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: ReadOnlyTable<ProfileRow>;
      matches: ReadOnlyTable<MatchRow>;
      fleets: ReadOnlyTable<FleetRow>;
      shots: ReadOnlyTable<ShotRow>;
      matchmaking_queue: ReadOnlyTable<QueueRow>;
    };
    Views: { [_ in never]: never };
    Functions: {
      set_display_name: { Args: { p_name: string }; Returns: ProfileRow };
      ensure_profile: { Args: Record<string, never>; Returns: ProfileRow };
      create_room: { Args: Record<string, never>; Returns: MatchRow };
      join_room: { Args: { p_code: string }; Returns: MatchRow };
      cancel_room: { Args: { p_match_id: string }; Returns: MatchRow };
      join_queue: { Args: Record<string, never>; Returns: Json };
      leave_queue: { Args: Record<string, never>; Returns: Json };
      place_fleet: { Args: { p_match_id: string; p_ships: Json }; Returns: MatchRow };
      fire: { Args: { p_match_id: string; p_cell: number; p_shot_id?: string }; Returns: Json };
      surrender: { Args: { p_match_id: string }; Returns: MatchRow };
      heartbeat: { Args: { p_match_id: string }; Returns: string };
      claim_abandoned: { Args: { p_match_id: string }; Returns: MatchRow };
      request_rematch: { Args: { p_match_id: string }; Returns: MatchRow };
    };
    Enums: {
      match_kind: MatchKind;
      match_status: MatchStatus;
      finish_reason: FinishReason;
      shot_result: ShotResultDb;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
