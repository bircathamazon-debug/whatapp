import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { DEFAULT_CATEGORIES, DEFAULT_ZONES } from '../../shared/types';

interface Props {
  selectedCategory: string | null;
  selectedZone: string | null;
  onSelectCategory: (id: string | null) => void;
  onSelectZone: (id: string | null) => void;
}

export default function FilterChips({
  selectedCategory,
  selectedZone,
  onSelectCategory,
  onSelectZone,
}: Props) {
  return (
    <View>
      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        <TouchableOpacity
          style={[styles.chip, !selectedCategory && styles.chipActive]}
          onPress={() => onSelectCategory(null)}
        >
          <Text style={[styles.chipText, !selectedCategory && styles.chipTextActive]}>
            הכל
          </Text>
        </TouchableOpacity>
        {DEFAULT_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.chip, selectedCategory === cat.id && styles.chipActive]}
            onPress={() => onSelectCategory(selectedCategory === cat.id ? null : cat.id)}
          >
            <Text style={styles.chipIcon}>{cat.icon}</Text>
            <Text
              style={[
                styles.chipText,
                selectedCategory === cat.id && styles.chipTextActive,
              ]}
            >
              {cat.labelHe}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Zone chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        <TouchableOpacity
          style={[styles.chip, styles.zoneChip, !selectedZone && styles.zoneChipActive]}
          onPress={() => onSelectZone(null)}
        >
          <Text style={[styles.chipText, !selectedZone && styles.chipTextActive]}>
            כל האזורים
          </Text>
        </TouchableOpacity>
        {DEFAULT_ZONES.map((zone) => (
          <TouchableOpacity
            key={zone.id}
            style={[
              styles.chip,
              styles.zoneChip,
              selectedZone === zone.id && styles.zoneChipActive,
            ]}
            onPress={() => onSelectZone(selectedZone === zone.id ? null : zone.id)}
          >
            <Text
              style={[
                styles.chipText,
                selectedZone === zone.id && styles.chipTextActive,
              ]}
            >
              {zone.labelHe}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row-reverse',
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 8,
  },
  chip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  chipActive: { backgroundColor: '#1a3c5e' },
  zoneChip: { backgroundColor: '#e6f4ea' },
  zoneChipActive: { backgroundColor: '#2d7a4f' },
  chipText: { fontSize: 13, color: '#555', fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  chipIcon: { fontSize: 14 },
});
