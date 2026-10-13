import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { SEARCH_TIMEOUT_MS, useQuickMatch } from '@/features/matchmaking/useQuickMatch';
import { haptic } from '@/features/settings/haptics';
import { AppText, Banner, Button, Screen, art, space } from '@/ui';

/** Spyglass sweeping the horizon over a slowly turning compass rose. */
function Lookout() {
  const t = useSharedValue(0);
  const sway = useSharedValue(0);
  useEffect(() => {
    t.set(withRepeat(withTiming(1, { duration: 24000, easing: Easing.linear }), -1, false));
    sway.set(
      withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }), -1, true),
    );
  }, [t, sway]);
  const compass = useAnimatedStyle(() => ({ transform: [{ rotate: `${t.get() * 360}deg` }] }));
  const glass = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-14 + sway.get() * 28}deg` }, { translateY: -4 + sway.get() * 8 }],
  }));
  return (
    <View style={styles.lookout} accessibilityElementsHidden>
      <Animated.Image source={art.compass_rose} style={[styles.compass, compass]} />
      <Animated.Image source={art.matchmaking_spyglass} style={[styles.glass, glass]} />
    </View>
  );
}

export default function Matchmaking() {
  const { state, cancel, retry } = useQuickMatch();
  const [elapsed, setElapsed] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (state.phase === 'matched') {
      haptic('win');
      router.replace({ pathname: '/match/[id]', params: { id: state.matchId } });
    }
  }, [state]);

  const startedAt = state.phase === 'searching' ? state.startedAt : null;
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 500);
    return () => clearInterval(id);
  }, [startedAt]);

  const onCancel = async () => {
    setLeaving(true);
    const matched = await cancel();
    if (matched) router.replace({ pathname: '/match/[id]', params: { id: matched } });
    else router.back();
  };

  return (
    <Screen scroll={false} contentStyle={styles.content}>
      <View style={styles.center}>
        {state.phase === 'searching' || state.phase === 'matched' ? <Lookout /> : null}
        <AppText variant="title" align="center">
          {state.phase === 'timeout'
            ? 'Chưa tìm thấy đối thủ'
            : state.phase === 'error'
              ? 'Không thể tìm trận'
              : 'Đang dò tìm đối thủ'}
        </AppText>
        {state.phase === 'searching' ? (
          <AppText variant="body" align="center">
            {elapsed}s · tối đa {SEARCH_TIMEOUT_MS / 1000}s
          </AppText>
        ) : null}
        {state.phase === 'timeout' ? (
          <AppText variant="body" align="center">
            Hiện ít người đang tìm trận. Thử lại, hoặc tạo phòng và gửi mã cho bạn bè.
          </AppText>
        ) : null}
      </View>

      {state.phase === 'searching' && state.networkError ? (
        <Banner tone="warn" text={state.networkError.message} />
      ) : null}
      {state.phase === 'error' ? <Banner tone="error" text={state.error.message} /> : null}

      <View style={styles.actions}>
        {state.phase === 'timeout' || state.phase === 'error' ? (
          <>
            <Button label="Tìm lại" art="quickplay" onPress={retry} />
            <Button
              label="Về trang chủ"
              icon="home-outline"
              variant="secondary"
              onPress={() => router.back()}
            />
          </>
        ) : (
          <Button
            label="Huỷ tìm trận"
            variant="secondary"
            icon="close"
            loading={leaving}
            onPress={onCancel}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg },
  lookout: { width: 260, height: 260, alignItems: 'center', justifyContent: 'center' },
  compass: { position: 'absolute', width: 260, height: 260, opacity: 0.45 },
  glass: { width: 200, height: 200 },
  actions: { gap: space.md },
});
