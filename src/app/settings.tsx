import Constants from 'expo-constants';
import { router } from 'expo-router';
import { StyleSheet, Switch, View } from 'react-native';

import { useSettings } from '@/features/settings/settingsStore';
import { AppText, IconButton, Panel, Screen, colors, space } from '@/ui';

export default function Settings() {
  const { haptics, setHaptics } = useSettings();
  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="title">Cài đặt</AppText>
        <IconButton icon="close" label="Đóng" onPress={() => router.back()} />
      </View>
      <Panel style={styles.row}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="bodyStrong">Rung phản hồi</AppText>
          <AppText variant="caption">Rung nhẹ khi bắn trúng, trượt hoặc đánh chìm tàu.</AppText>
        </View>
        <Switch
          value={haptics}
          onValueChange={setHaptics}
          trackColor={{ true: colors.accentDim, false: colors.line }}
          thumbColor={haptics ? colors.accent : colors.textMuted}
          accessibilityLabel="Rung phản hồi"
        />
      </Panel>
      <AppText variant="caption" align="center">
        Fleetline {Constants.expoConfig?.version ?? ''} · Âm thanh sẽ có trong bản sau.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
