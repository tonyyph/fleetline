import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { haptic } from '@/features/settings/haptics';
import { AppText, Button, Panel, colors, fonts, space } from '@/ui';

export function WaitingRoom({ code, onCancel }: { code: string; onCancel: () => Promise<void> }) {
  const [copied, setCopied] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const copy = async () => {
    await Clipboard.setStringAsync(code);
    haptic('tap');
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.wrap}>
      <Panel style={styles.card}>
        <AppText variant="label" align="center">
          Mã phòng
        </AppText>
        <AppText
          variant="display"
          align="center"
          selectable
          accessibilityLabel={`Mã phòng ${code.split('').join(' ')}`}
          style={styles.code}
        >
          {code}
        </AppText>
        <AppText variant="body" align="center">
          Gửi mã này cho bạn bè. Trận bắt đầu ngay khi họ lên tàu.
        </AppText>
        <View style={styles.row}>
          <Button
            label={copied ? 'Đã sao chép' : 'Sao chép'}
            icon={copied ? 'checkmark' : 'copy-outline'}
            variant="secondary"
            compact
            onPress={copy}
            style={styles.flex}
          />
          <Button
            label="Chia sẻ"
            icon="share-outline"
            variant="secondary"
            compact
            style={styles.flex}
            onPress={() => {
              void Share.share({ message: `Vào Fleetline đấu với mình nhé! Mã phòng: ${code}` });
            }}
          />
        </View>
      </Panel>

      <View style={styles.waiting}>
        <AppText variant="bodyStrong" align="center">
          Đang chờ đối thủ…
        </AppText>
        <AppText variant="caption" align="center">
          Bạn có thể rời màn hình này; phòng vẫn mở và có thể quay lại từ trang chủ.
        </AppText>
      </View>

      <Button
        label="Huỷ phòng"
        variant="danger"
        icon="close"
        loading={cancelling}
        onPress={async () => {
          setCancelling(true);
          try {
            await onCancel();
          } finally {
            setCancelling(false);
          }
        }}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xl, flex: 1, justifyContent: 'center' },
  card: { gap: space.md, paddingVertical: space.xl + 4, paddingHorizontal: space.xl + 4 },
  code: {
    fontFamily: fonts.caps,
    letterSpacing: 8,
    color: colors.accentBright,
    fontSize: 46,
    lineHeight: 56,
  },
  row: { flexDirection: 'row', gap: space.md, marginTop: space.sm },
  flex: { flex: 1 },
  waiting: { gap: space.xs },
});
