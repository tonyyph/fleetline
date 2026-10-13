import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { useSettings } from './settingsStore';

export type HapticKind = 'tap' | 'miss' | 'hit' | 'sunk' | 'win' | 'lose' | 'error';

/** Fire-and-forget haptic feedback, respecting the player's setting. */
export function haptic(kind: HapticKind): void {
  if (Platform.OS === 'web' || !useSettings.getState().haptics) return;
  const run = (): Promise<void> => {
    switch (kind) {
      case 'tap':
      case 'miss':
        return Haptics.selectionAsync();
      case 'hit':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      case 'sunk':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      case 'win':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      case 'lose':
      case 'error':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  };
  run().catch(() => {});
}
