import { StyleSheet, View } from 'react-native';

import { FLEET } from '@/features/game/logic';
import { AppText, colors } from '@/ui';

/** Ships afloat as a row of hull bars; sunk ships turn coral and drop out of the count. */
export function FleetStatus({
  sunkLengths,
  label,
}: {
  sunkLengths: readonly number[];
  label: string;
}) {
  // Match sunk ships to specs by length (two ships share length 3, so consume one at a time).
  const remaining = [...sunkLengths];
  const status = FLEET.map((s) => {
    const i = remaining.indexOf(s.length);
    if (i >= 0) {
      remaining.splice(i, 1);
      return { ...s, sunk: true };
    }
    return { ...s, sunk: false };
  });
  const afloat = status.filter((s) => !s.sunk).length;
  return (
    <View
      style={styles.wrap}
      accessibilityLabel={`${label}: còn ${afloat} trên ${FLEET.length} tàu`}
    >
      <View style={styles.header}>
        <AppText variant="label">{label}</AppText>
        <AppText variant="caption" color={colors.text}>
          {afloat}/{FLEET.length}
        </AppText>
      </View>
      <View style={styles.bars}>
        {status.map((s) => (
          <View
            key={s.id}
            style={[
              styles.bar,
              {
                flex: s.length,
                backgroundColor: s.sunk ? colors.sunk : colors.ship,
                opacity: s.sunk ? 0.6 : 1,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bars: { flexDirection: 'row', gap: 3 },
  bar: { height: 6, borderRadius: 3 },
});
