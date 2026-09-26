import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { WILTED, type Garden } from '@/garden/plant';
import { useTheme } from '@/hooks/use-theme';

export function PlantEmoji({ garden, size }: { garden: Garden; size: number }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.pot,
        { width: size * 1.6, height: size * 1.6, borderRadius: size * 0.8 },
        { backgroundColor: garden.wilted ? theme.dangerSoft : theme.successSoft },
      ]}>
      <ThemedText style={{ fontSize: size, lineHeight: size * 1.25 }}>{garden.wilted ? WILTED : garden.stage.emoji}</ThemedText>
    </View>
  );
}

export function HistoryDots({ garden, size = 10 }: { garden: Garden; size?: number }) {
  const theme = useTheme();
  return (
    <View style={styles.dots}>
      {garden.history.map((h) => (
        <View
          key={h.day}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor:
              h.state === 'kept' ? theme.success : h.state === 'failed' ? theme.danger : h.state === 'pending' ? 'transparent' : theme.backgroundElement,
            borderWidth: h.state === 'pending' ? 1.5 : 0,
            borderColor: theme.success,
          }}
        />
      ))}
    </View>
  );
}

export function statusLine(g: Garden): { text: string; tone: 'success' | 'warning' | 'danger' } {
  if (g.today === 'broken') return { text: g.reasons[0] ?? 'A task was missed today', tone: 'danger' };
  if (g.today === 'kept') return { text: 'Watered today', tone: 'success' };
  if (g.wilted) return { text: g.reasons[0] ?? 'Yesterday was missed', tone: 'danger' };
  return { text: 'Needs water: finish a task or log study today', tone: 'warning' };
}

export function PlantCard({ garden }: { garden: Garden }) {
  const theme = useTheme();
  const status = statusLine(garden);
  const toNext = garden.next ? garden.next.minStreak - garden.streak : 0;

  return (
    <Pressable onPress={() => router.push('/plant')} accessibilityRole="button" accessibilityLabel="Open your plant">
      {({ pressed }) => (
        <Card style={[styles.card, { opacity: pressed ? 0.85 : 1 }]}>
          <View style={styles.row}>
            <PlantEmoji garden={garden} size={34} />
            <View style={{ flex: 1, gap: 2 }}>
              <View style={styles.titleRow}>
                <ThemedText style={styles.title}>{garden.wilted ? 'Your plant wilted' : garden.stage.name}</ThemedText>
                <View style={[styles.streak, { backgroundColor: garden.streak ? theme.accentSoft : theme.backgroundElement }]}>
                  <SymbolView name="flame.fill" size={12} tintColor={garden.streak ? '#F76B15' : theme.textTertiary} />
                  <ThemedText type="smallBold" style={{ fontSize: 13 }}>
                    {garden.streak}
                  </ThemedText>
                </View>
              </View>
              <ThemedText type="small" numberOfLines={2} style={{ color: theme[status.tone], fontSize: 13 }}>
                {status.text}
              </ThemedText>
              {garden.next && !garden.wilted && (
                <ThemedText type="small" themeColor="textTertiary" style={{ fontSize: 12 }}>
                  {toNext} more day{toNext === 1 ? '' : 's'} to grow into a {garden.next.name.toLowerCase()} {garden.next.emoji}
                </ThemedText>
              )}
            </View>
            <SymbolView name="chevron.right" size={14} tintColor={theme.textTertiary} />
          </View>
          <HistoryDots garden={garden} />
        </Card>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  pot: { alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 17, fontWeight: 700 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  dots: { flexDirection: 'row', justifyContent: 'space-between' },
});
