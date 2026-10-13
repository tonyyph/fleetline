import { StyleSheet, View } from 'react-native';

import { AppText, IconButton, Pill, space } from '@/ui';

import type { Presence } from '../model';
import type { LiveStatus } from '../useMatch';

export function MatchHeader({
  title,
  opponentName,
  presence,
  live,
  onHome,
}: {
  title: string;
  opponentName: string | null;
  presence: Presence | null;
  live: LiveStatus;
  onHome: () => void;
}) {
  const presencePill =
    presence === 'online'
      ? { label: `${opponentName ?? 'Đối thủ'} · trực tuyến`, tone: 'good' as const }
      : presence === 'away'
        ? { label: `${opponentName ?? 'Đối thủ'} · mất kết nối`, tone: 'warn' as const }
        : presence === 'gone'
          ? { label: `${opponentName ?? 'Đối thủ'} · đã rời`, tone: 'bad' as const }
          : null;
  return (
    <View style={styles.header}>
      <IconButton icon="chevron-back" label="Về trang chủ" onPress={onHome} />
      <View style={styles.middle}>
        <AppText variant="heading" numberOfLines={1}>
          {title}
        </AppText>
        <View style={styles.pills}>
          {presencePill ? <Pill label={presencePill.label} tone={presencePill.tone} /> : null}
          {live !== 'live' ? (
            <Pill label={live === 'connecting' ? 'Đang kết nối' : 'Đang kết nối lại'} tone="warn" />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  middle: { flex: 1, gap: 6 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
