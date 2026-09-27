import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export type ChartPoint = {
  key: string | number;
  /** Axis label under the mark. */
  label: string;
  value: number;
  /** Shown above the selected mark, e.g. "12.4 km". */
  valueLabel: string;
  accessibilityLabel: string;
};

const LABEL_ROOM = 20;

/**
 * Single-series column chart. Tap a column to read its value; the latest one is shown by default.
 * Thin columns (≤ 24px) with a 4px rounded top, growing from one baseline.
 */
export function ColumnChart({ data, height = 140 }: { data: ChartPoint[]; height?: number }) {
  const theme = useTheme();
  const [selected, setSelected] = useState<number | null>(null);
  const active = selected ?? data.length - 1;
  const max = Math.max(0, ...data.map((d) => d.value));
  const plot = height - LABEL_ROOM;

  return (
    <View>
      <View style={[styles.plot, { height, borderBottomColor: theme.border }]}>
        {data.map((d, i) => {
          const h = max > 0 ? Math.max(d.value > 0 ? 3 : 0, (d.value / max) * plot) : 0;
          return (
            <Pressable
              key={d.key}
              onPress={() => setSelected(i)}
              accessibilityRole="button"
              accessibilityLabel={d.accessibilityLabel}
              style={styles.slot}>
              {i === active && (
                <ThemedText type="smallBold" numberOfLines={1} style={styles.valueLabel}>
                  {d.valueLabel}
                </ThemedText>
              )}
              <View
                style={[
                  styles.column,
                  { height: h, backgroundColor: theme.chart, opacity: selected == null || i === active ? 1 : 0.45 },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.axis}>
        {data.map((d, i) => (
          <ThemedText
            key={d.key}
            type="small"
            numberOfLines={1}
            style={[styles.axisLabel, { color: i === active ? theme.text : theme.textTertiary }]}>
            {d.label}
          </ThemedText>
        ))}
      </View>
    </View>
  );
}

/**
 * Single-series dot plot where a lower value is better (e.g. pace): faster sits higher.
 * Dots are 10px; tap one to read it.
 */
export function DotTrend({ data, height = 120, caption }: { data: ChartPoint[]; height?: number; caption: string }) {
  const theme = useTheme();
  const [selected, setSelected] = useState<number | null>(null);
  const active = selected ?? data.length - 1;
  const values = data.map((d) => d.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const plot = height - LABEL_ROOM - DOT;

  return (
    <View>
      <View style={[styles.plot, { height, borderBottomColor: theme.border }]}>
        {data.map((d, i) => {
          // Fastest (lowest) value at the top.
          const y = hi === lo ? plot / 2 : ((hi - d.value) / (hi - lo)) * plot;
          return (
            <Pressable
              key={d.key}
              onPress={() => setSelected(i)}
              accessibilityRole="button"
              accessibilityLabel={d.accessibilityLabel}
              style={styles.slot}>
              <View style={{ position: 'absolute', bottom: y, alignItems: 'center', width: '100%' }}>
                {i === active && (
                  <ThemedText type="smallBold" numberOfLines={1} style={styles.valueLabel}>
                    {d.valueLabel}
                  </ThemedText>
                )}
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: theme.chart, borderColor: theme.card, opacity: selected == null || i === active ? 1 : 0.45 },
                  ]}
                />
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.axis}>
        {data.map((d, i) => (
          <ThemedText
            key={d.key}
            type="small"
            numberOfLines={1}
            style={[styles.axisLabel, { color: i === active ? theme.text : theme.textTertiary }]}>
            {d.label}
          </ThemedText>
        ))}
      </View>
      <ThemedText type="small" themeColor="textTertiary" style={styles.caption}>
        {caption}
      </ThemedText>
    </View>
  );
}

const DOT = 10;

const styles = StyleSheet.create({
  plot: { flexDirection: 'row', alignItems: 'flex-end', borderBottomWidth: StyleSheet.hairlineWidth },
  slot: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  column: { width: '62%', maxWidth: 24, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  valueLabel: { fontSize: 11, marginBottom: 3 },
  axis: { flexDirection: 'row', marginTop: 6 },
  axisLabel: { flex: 1, textAlign: 'center', fontSize: 10 },
  dot: { width: DOT + 4, height: DOT + 4, borderRadius: (DOT + 4) / 2, borderWidth: 2 },
  caption: { fontSize: 11, marginTop: 6 },
});
