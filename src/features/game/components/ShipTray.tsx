import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, Pressable, ScrollView, StyleSheet } from 'react-native';

import { FLEET, type ShipId } from '@/features/game/logic';
import { haptic } from '@/features/settings/haptics';
import { AppText, colors, radius, shipArt, space } from '@/ui';

import { SHIP_ART } from './Board';

/** Thumbnail hull length per cell, so the tray shows the ships' relative sizes. */
const THUMB_CELL = 13;

/** The five ships to place: which is selected, which are already on the board. */
export function ShipTray({
  placed,
  selected,
  onSelect,
}: {
  placed: ReadonlySet<ShipId>;
  selected: ShipId | null;
  onSelect: (id: ShipId) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tray}
      accessibilityLabel="Danh sách tàu"
    >
      {FLEET.map((s) => {
        const isPlaced = placed.has(s.id);
        const isSelected = selected === s.id;
        return (
          <Pressable
            key={s.id}
            accessibilityRole="button"
            accessibilityLabel={`${s.name}, ${s.length} ô, ${isPlaced ? 'đã đặt' : 'chưa đặt'}`}
            accessibilityState={{ selected: isSelected }}
            onPress={() => {
              haptic('tap');
              onSelect(s.id);
            }}
            style={[
              styles.chip,
              isSelected && styles.chipSelected,
              isPlaced && !isSelected && styles.chipPlaced,
            ]}
          >
            <Image
              source={shipArt[SHIP_ART[s.id]].intact}
              style={{
                width: s.length * THUMB_CELL,
                height: s.length * THUMB_CELL * shipArt[SHIP_ART[s.id]].aspect,
                opacity: isPlaced && !isSelected ? 0.55 : 1,
              }}
            />
            <AppText
              variant="caption"
              color={isSelected ? colors.text : colors.textDim}
              numberOfLines={1}
            >
              {s.name}
            </AppText>
            {isPlaced ? <Ionicons name="checkmark" size={14} color={colors.success} /> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tray: { flexDirection: 'row', gap: space.sm, paddingRight: space.lg },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'rgba(32,20,10,0.88)',
  },
  chipSelected: { borderColor: colors.accent, backgroundColor: 'rgba(212,168,75,0.18)' },
  chipPlaced: { opacity: 0.8 },
});
