import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const KEY = 'fleetline.settings.v1';

interface SettingsState {
  haptics: boolean;
  loaded: boolean;
  load: () => Promise<void>;
  setHaptics: (on: boolean) => void;
}

export const useSettings = create<SettingsState>((set, get) => ({
  haptics: true,
  loaded: false,
  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      const saved = raw ? (JSON.parse(raw) as Partial<SettingsState>) : {};
      set({ haptics: saved.haptics ?? true, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  setHaptics: (haptics) => {
    set({ haptics });
    AsyncStorage.setItem(KEY, JSON.stringify({ haptics: get().haptics })).catch(() => {});
  },
}));
