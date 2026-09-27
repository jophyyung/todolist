import { SymbolView } from 'expo-symbols';
import { Fragment } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { HistoryDots, PlantEmoji, statusLine } from '@/components/plant-card';
import { ThemedText } from '@/components/themed-text';
import { Card, Divider, ProgressBar, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { STAGES } from '@/garden/plant';
import { useGarden } from '@/garden/use-garden';
import { useTheme } from '@/hooks/use-theme';

const RULES: { icon: 'drop.fill' | 'clock.fill' | 'graduationcap.fill' | 'trash.fill'; text: string }[] = [
  { icon: 'drop.fill', text: 'Water it every day: complete a task, or log a study session or a run.' },
  { icon: 'clock.fill', text: 'Every task with a due time must be ticked off before that time. Late counts as missed.' },
  { icon: 'graduationcap.fill', text: 'By the end of Sunday, every course and your running goal must be met.' },
  { icon: 'trash.fill', text: 'Deleting a task after it’s overdue still counts as missing it.' },
];

export default function PlantScreen() {
  const theme = useTheme();
  const garden = useGarden();
  const status = statusLine(garden);
  const prevMin = garden.stage.minStreak;
  const progress = garden.next ? (garden.streak - prevMin) / (garden.next.minStreak - prevMin) : 1;

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <PlantEmoji garden={garden} size={72} />
        <ThemedText style={styles.name}>{garden.wilted ? 'Wilted' : garden.stage.name}</ThemedText>
        <ThemedText type="small" style={{ color: theme[status.tone], textAlign: 'center' }}>
          {status.text}
        </ThemedText>
      </View>

      <Card style={styles.stats}>
        <Stat value={String(garden.streak)} label="Day streak" />
        <Stat value={String(garden.best)} label="Best streak" />
        <Stat value={garden.next ? String(garden.next.minStreak - garden.streak) : '—'} label="Days to next stage" />
      </Card>

      {garden.next && (
        <Card style={[styles.padded, { marginTop: Spacing.three }]}>
          <View style={styles.nextRow}>
            <ThemedText style={{ fontSize: 22 }}>{garden.stage.emoji}</ThemedText>
            <View style={{ flex: 1 }}>
              <ProgressBar value={progress} color={theme.success} />
            </View>
            <ThemedText style={{ fontSize: 22 }}>{garden.next.emoji}</ThemedText>
          </View>
        </Card>
      )}

      {garden.reasons.length > 0 && (
        <>
          <SectionTitle color="danger">Why it wilted</SectionTitle>
          <Card style={styles.padded}>
            {garden.reasons.map((r) => (
              <ThemedText key={r} type="small">
                • {r}
              </ThemedText>
            ))}
            <ThemedText type="small" themeColor="textSecondary">
              Strict mode: the streak starts again from a seed.
            </ThemedText>
          </Card>
        </>
      )}

      <SectionTitle>Last 14 days</SectionTitle>
      <Card style={styles.padded}>
        <HistoryDots garden={garden} size={16} />
        <View style={styles.legend}>
          <Legend color={theme.success} label="Kept" />
          <Legend color={theme.danger} label="Missed" />
          <Legend color={theme.backgroundElement} label="Before planting" />
        </View>
      </Card>

      <SectionTitle>Rules</SectionTitle>
      <Card>
        {RULES.map((r, i) => (
          <Fragment key={r.icon}>
            {i > 0 && <Divider inset={52} />}
            <View style={styles.ruleRow}>
              <SymbolView name={r.icon} size={18} tintColor={theme.accent} style={{ width: 20 }} />
              <ThemedText type="small" style={{ flex: 1 }}>
                {r.text}
              </ThemedText>
            </View>
          </Fragment>
        ))}
      </Card>

      <SectionTitle>Growth stages</SectionTitle>
      <Card style={styles.stages}>
        {STAGES.map((s) => {
          const reached = garden.best >= s.minStreak;
          return (
            <View key={s.name} style={[styles.stage, { opacity: reached ? 1 : 0.35 }]}>
              <ThemedText style={{ fontSize: 28, lineHeight: 36 }}>{s.emoji}</ThemedText>
              <ThemedText type="small" style={{ fontSize: 11, textAlign: 'center' }}>
                {s.minStreak === 0 ? 'Start' : `${s.minStreak}d`}
              </ThemedText>
            </View>
          );
        })}
      </Card>
    </ScrollView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <ThemedText style={{ fontSize: 24, lineHeight: 30, fontWeight: 700 }}>{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, textAlign: 'center' }}>
        {label}
      </ThemedText>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, paddingBottom: Spacing.six },
  hero: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.three },
  name: { fontSize: 26, lineHeight: 32, fontWeight: 700 },
  stats: { flexDirection: 'row', padding: Spacing.three, marginTop: Spacing.two },
  padded: { padding: Spacing.three, gap: 10 },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  legend: { flexDirection: 'row', gap: Spacing.three },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: Spacing.three, paddingVertical: 12 },
  stages: { flexDirection: 'row', justifyContent: 'space-between', padding: Spacing.three },
  stage: { alignItems: 'center', gap: 2 },
});
