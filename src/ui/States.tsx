import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { Button } from './Button';
import { Screen } from './Screen';
import { colors, space } from './theme';

export function LoadingState({ label = 'Đang tải…' }: { label?: string }) {
  return (
    <Screen scroll={false} contentStyle={styles.center}>
      <ActivityIndicator color={colors.accent} size="large" />
      <AppText variant="body" align="center">
        {label}
      </AppText>
    </Screen>
  );
}

export function ErrorState({
  title = 'Không tải được',
  message,
  onRetry,
  onBack,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  onBack?: () => void;
}) {
  return (
    <Screen scroll={false} contentStyle={styles.center}>
      <AppText variant="heading" align="center">
        {title}
      </AppText>
      <AppText variant="body" align="center">
        {message}
      </AppText>
      <View style={styles.actions}>
        {onRetry ? <Button label="Thử lại" icon="refresh" onPress={onRetry} /> : null}
        {onBack ? (
          <Button label="Về trang chủ" variant="secondary" icon="home" onPress={onBack} />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'stretch', gap: space.lg },
  actions: { gap: space.md, marginTop: space.md },
});
