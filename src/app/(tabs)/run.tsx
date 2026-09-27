import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Fragment, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ColumnChart, DotTrend } from '@/components/charts';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Divider, EmptyState, IconButton, ProgressBar, ScreenHeader, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useData } from '@/data/DataProvider';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { addDays, formatDue, startOfWeek } from '@/lib/dates';
import {
  formatDuration,
  formatGoalAmount,
  formatKm,
  formatPace,
  paceOf,
  paceTrend,
  records,
  runGoalFrom,
  runStatusLabel,
  runWeek,
  weeklyTotals,
} from '@/running/stats';

const WEEKS = 8;
const RECENT = 10;

const shortDate = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'numeric' });

export default function RunScreen() {
  const theme = useTheme();
  const { runs, settings } = useData();
  const now = useNow();
  const goal = runGoalFrom(settings);

  const week = runWeek(runs, goal, now);
  const totals = useMemo(() => weeklyTotals(runs, now, WEEKS), [runs, now]);
  const trend = useMemo(() => paceTrend(runs), [runs]);
  const rec = useMemo(() => records(runs, now), [runs, now]);

  const weekStart = startOfWeek(now);
  const range = `${fmtDay(weekStart)} – ${fmtDay(addDays(weekStart, 6))}`;
  const logRun = () => router.push({ pathname: '/run/[id]', params: { id: 'new' } });
  const statusColor = week.status === 'done' ? theme.success : week.status === 'behind' ? theme.warning : theme.textSecondary;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader
          title="Running"
          subtitle={`This week · ${range}`}
          right={runs.length ? <IconButton name="plus" size={22} label="Log a run" onPress={logRun} /> : null}
        />
        <View style={styles.inner}>
          <Card style={styles.goalCard}>
            {goal.kind === 'none' ? (
              <>
                <ThemedText style={styles.goalTitle}>{formatKm(week.distanceM)} this week</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {week.runs} run{week.runs === 1 ? '' : 's'} · no weekly goal yet
                </ThemedText>
                <Button label="Set a weekly goal" variant="soft" onPress={() => router.push('/run-goal')} />
              </>
            ) : (
              <>
                <View style={styles.goalRow}>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.goalTitle}>
                      {goal.kind === 'km'
                        ? `${(week.distanceM / 1000).toFixed(1)} / ${goal.value} km`
                        : `${week.runs} / ${goal.value} runs`}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {goal.kind === 'km' ? `${week.runs} run${week.runs === 1 ? '' : 's'}` : formatKm(week.distanceM)} ·{' '}
                      {week.daysLeft} day{week.daysLeft === 1 ? '' : 's'} left
                    </ThemedText>
                  </View>
                  <Pressable onPress={() => router.push('/run-goal')} hitSlop={10} accessibilityLabel="Edit weekly goal">
                    <ThemedText type="small" style={{ color: theme.accent }}>
                      Edit goal
                    </ThemedText>
                  </Pressable>
                </View>
                <ProgressBar value={goal.value ? week.done / goal.value : 0} color={week.status === 'done' ? theme.success : theme.chart} />
                <View style={styles.statusRow}>
                  {week.status !== 'on-track' && (
                    <SymbolView
                      name={week.status === 'done' ? 'checkmark.circle.fill' : 'exclamationmark.triangle.fill'}
                      size={14}
                      tintColor={statusColor}
                    />
                  )}
                  <ThemedText type="small" style={{ color: statusColor, flex: 1 }}>
                    {runStatusLabel(week)}
                    {week.status === 'behind' && week.daysLeft === 1 ? '. Miss it and the plant wilts.' : ''}
                  </ThemedText>
                </View>
              </>
            )}
          </Card>

          <Button label="Log a run" icon="figure.run" onPress={logRun} style={{ marginTop: Spacing.three }} />

          {runs.length === 0 ? (
            <Card style={{ marginTop: Spacing.three }}>
              <EmptyState
                icon="figure.run"
                title="No runs yet"
                body="After each run, log the distance and time. Weekly totals, pace trends and personal bests appear here."
              />
            </Card>
          ) : (
            <>
              <SectionTitle>Distance per week</SectionTitle>
              <Card style={styles.chartCard}>
                <ColumnChart
                  data={totals.map((w) => ({
                    key: w.weekStart,
                    label: shortDate(w.weekStart),
                    value: w.distanceM,
                    valueLabel: formatKm(w.distanceM),
                    accessibilityLabel: `Week of ${fmtDay(w.weekStart)}: ${formatKm(w.distanceM)}, ${w.runs} runs`,
                  }))}
                />
              </Card>

              {trend.length >= 2 && (
                <>
                  <SectionTitle>Pace, last {trend.length} runs</SectionTitle>
                  <Card style={styles.chartCard}>
                    <DotTrend
                      caption="Higher is faster. Runs of 1 km or more."
                      data={trend.map(({ run, pace }) => ({
                        key: run.id,
                        label: shortDate(run.at),
                        value: pace,
                        valueLabel: formatPace(pace).replace(' /km', ''),
                        accessibilityLabel: `${fmtDay(run.at)}: ${formatPace(pace)} over ${formatKm(run.distanceM)}`,
                      }))}
                    />
                  </Card>
                </>
              )}

              <SectionTitle>Records</SectionTitle>
              <Card style={styles.statsGrid}>
                <Stat label="Total distance" value={formatKm(rec.totalDistanceM)} />
                <Stat label="Runs" value={String(rec.totalRuns)} />
                <Stat label="This month" value={formatKm(rec.monthDistanceM)} />
                <Stat label="Longest run" value={rec.longest ? formatKm(rec.longest.distanceM) : '–'} />
                <Stat label="Fastest pace" value={formatPace(rec.fastest?.pace ?? null)} />
                <Stat label="Best 5K (est.)" value={rec.best5kS != null ? formatDuration(rec.best5kS) : '–'} />
                <Stat label="Average pace" value={formatPace(rec.averagePace)} />
              </Card>

              <SectionTitle>Recent runs</SectionTitle>
              <Card>
                {runs.slice(0, RECENT).map((r, i) => (
                  <Fragment key={r.id}>
                    {i > 0 && <Divider inset={Spacing.three} />}
                    <Pressable
                      onPress={() => router.push({ pathname: '/run/[id]', params: { id: String(r.id) } })}
                      style={({ pressed }) => [styles.runRow, pressed && { backgroundColor: theme.backgroundSelected }]}>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={{ fontWeight: 600 }}>{formatKm(r.distanceM)}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={{ fontSize: 13 }}>
                          {formatDue(r.at, now)}
                          {r.note ? ` · ${r.note}` : ''}
                        </ThemedText>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <ThemedText type="small">{formatDuration(r.durationS)}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 13 }}>
                          {formatPace(paceOf(r))}
                        </ThemedText>
                      </View>
                      <SymbolView name="chevron.right" size={13} tintColor={theme.textTertiary} />
                    </Pressable>
                  </Fragment>
                ))}
              </Card>
              {goal.kind !== 'none' && (
                <ThemedText type="small" themeColor="textTertiary" style={styles.footnote}>
                  Weekly goal: {formatGoalAmount(goal.kind, goal.value)}. Any run also waters your plant.
                </ThemedText>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function fmtDay(t: number) {
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText style={styles.statValue} numberOfLines={1}>
        {value}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 120 },
  inner: { paddingHorizontal: Spacing.three },
  goalCard: { padding: Spacing.three, gap: 12 },
  goalRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  goalTitle: { fontSize: 24, lineHeight: 30, fontWeight: 700 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chartCard: { padding: Spacing.three },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: Spacing.two },
  stat: { width: '50%', paddingHorizontal: Spacing.three, paddingVertical: 10 },
  statValue: { fontSize: 18, lineHeight: 24, fontWeight: 700 },
  runRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Spacing.three, paddingVertical: 12 },
  footnote: { marginTop: Spacing.two, textAlign: 'center', fontSize: 12 },
});
