import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { chooseShot, type AiLevel, type ShipPlacement } from '@/features/game/logic';

import {
  fireSolo,
  isSoloGame,
  newSoloGame,
  placeSoloFleet,
  shotsBy,
  surrenderSolo,
  type SoloGame,
  type SoloResult,
} from './game';

const KEY = 'fleetline.solo.v1';

interface SoloState {
  game: SoloGame | null;
  loaded: boolean;
  load: () => Promise<void>;
  start: (level: AiLevel) => void;
  place: (fleet: readonly ShipPlacement[]) => SoloResult;
  fire: (cell: number) => SoloResult;
  /** The computer takes its turn; a no-op unless it is the computer's turn. */
  aiMove: () => void;
  surrender: () => void;
}

function save(game: SoloGame | null) {
  const write = game
    ? AsyncStorage.setItem(KEY, JSON.stringify(game))
    : AsyncStorage.removeItem(KEY);
  write.catch(() => {});
}

/** The single offline game, saved after every move so it survives the app being closed. */
export const useSolo = create<SoloState>((set, get) => {
  const commit = (r: SoloResult): SoloResult => {
    if (r.ok) {
      set({ game: r.game });
      save(r.game);
    }
    return r;
  };
  return {
    game: null,
    loaded: false,
    load: async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : null;
        set({ game: isSoloGame(parsed) ? parsed : null, loaded: true });
      } catch {
        set({ loaded: true });
      }
    },
    start: (level) => {
      const game = newSoloGame(level);
      set({ game });
      save(game);
    },
    place: (fleet) => {
      const { game } = get();
      return game ? commit(placeSoloFleet(game, fleet)) : { ok: false, error: 'not_placing' };
    },
    fire: (cell) => {
      const { game } = get();
      return game ? commit(fireSolo(game, 'me', cell)) : { ok: false, error: 'not_active' };
    },
    aiMove: () => {
      const { game } = get();
      if (!game || game.status !== 'active' || game.turn !== 'ai') return;
      commit(fireSolo(game, 'ai', chooseShot(game.level, shotsBy(game, 'ai'))));
    },
    surrender: () => {
      const { game } = get();
      if (!game) return;
      const next = surrenderSolo(game);
      set({ game: next });
      save(next);
    },
  };
});
