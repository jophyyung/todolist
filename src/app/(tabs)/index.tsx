import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlantCard } from '@/components/plant-card';
import { QuickAdd } from '@/components/quick-add';
import { TASK_ROW_INSET, TaskRow } from '@/components/task-row';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Divider, EmptyState, IconButton, ProgressBar, ScreenHeader, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useData } from '@/data/DataProvider';
import { useGarden } from '@/garden/use-garden';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { addDays, groupTasks, startOfDay, type SectionKey } from '@/lib/dates';
import type { Task } from '@/lib/types';
import { runGoalFrom, runStatusLabel, runWeek } from '@/running/stats';
import { courseWeek, statusLabel } from '@/study/progress';

const UPCOMING_PREVIEW = 5;

function greeting(now: number) {
  const h = new Date(now).getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function TodayScreen() {
  const theme = useTheme();
  const { tasks, courses, sessions, runs, settings, notificationsAllowed, requestNotifications } = useData();
  const now = useNow();
  const garden = useGarden();
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  const sections = useMemo(() => groupTasks(tasks, now), [tasks, now]);
  const get = (k: SectionKey) => sections.find((s) => s.key === k)?.data ?? [];
  const overdue = get('overdue');
  const today = get('today');
  const upcoming = get('upcoming');
  const someday = get('someday');
  const completed = get('completed');

  const dayStart = startOfDay(now);
  const doneToday = tasks.filter((t) => t.completedAt != null && t.completedAt >= dayStart).length;
  const todayTotal = overdue.length + today.length + doneToday;
  const behind = courses.map((c) => courseWeek(c, sessions, now)).filter((w) => w.status === 'behind');
  const runW = runWeek(runs, runGoalFrom(settings), now);
  const runBehind = runW.status === 'behind';

  const dateLabel = new Date(now).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const nothingAtAll = tasks.length === 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <ScreenHeader
          title={greeting(now)}
          subtitle={dateLabel}
          right={
            <IconButton
              name="plus"
              size={22}
              label="New task with details"
              onPress={() => router.push({ pathname: '/task/[id]', params: { id: 'new' } })}
            />
          }
        />

        <View style={styles.inner}>
          <PlantCard garden={garden} />

          {todayTotal > 0 && (
            <Card style={[styles.summary, { marginTop: Spacing.three }]}>
              <View style={styles.summaryRow}>
                <View style={{ flex: 1 }}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    TODAY
                  </ThemedText>
                  <ThemedText style={styles.summaryBig}>
                    {doneToday === todayTotal ? 'All done' : `${doneToday} of ${todayTotal} done`}
                  </ThemedText>
                </View>
                {overdue.length > 0 && (
                  <View style={[styles.badge, { backgroundColor: theme.dangerSoft }]}>
                    <ThemedText type="smallBold" style={{ color: theme.danger }}>
                      {overdue.length} overdue
                    </ThemedText>
                  </View>
                )}
              </View>
              <ProgressBar value={doneToday / todayTotal} color={doneToday === todayTotal ? theme.success : theme.accent} />
            </Card>
          )}

          <View style={{ marginTop: Spacing.three }}>
            <QuickAdd />
          </View>

          {!notificationsAllowed && (
            <Card style={[styles.banner, { backgroundColor: theme.accentSoft }]}>
              <SymbolView name="bell.badge.fill" size={22} tintColor={theme.accent} />
              <ThemedText type="small" style={{ flex: 1 }}>
                Turn on notifications so you&apos;re warned before things are due.
              </ThemedText>
              <Button label="Turn on" onPress={requestNotifications} style={styles.bannerButton} />
            </Card>
          )}

          {(behind.length > 0 || runBehind) && (
            <>
              <SectionTitle color="warning">Behind this week</SectionTitle>
              <Card>
                {runBehind && (
                  <Pressable
                    onPress={() => router.push({ pathname: '/run/[id]', params: { id: 'new' } })}
                    style={({ pressed }) => [styles.studyRow, pressed && { backgroundColor: theme.backgroundSelected }]}>
                    <SymbolView name="figure.run" size={20} tintColor={theme.warning} style={{ width: 26 }} />
                    <View style={{ flex: 1 }}>
                      <ThemedText style={{ fontWeight: 600 }}>Running</ThemedText>
                      <ThemedText type="small" style={{ color: theme.warning, fontSize: 13 }}>
                        {runStatusLabel(runW)}
                      </ThemedText>
                    </View>
                    <ThemedText type="smallBold" style={{ color: theme.accent }}>
                      Log
                    </ThemedText>
                  </Pressable>
                )}
                {runBehind && behind.length > 0 && <Divider inset={TASK_ROW_INSET} />}
                {behind.map((w, i) => (
                  <Fragment key={w.course.id}>
                    {i > 0 && <Divider inset={TASK_ROW_INSET} />}
                    <Pressable
                      onPress={() => router.push({ pathname: '/log/[courseId]', params: { courseId: String(w.course.id) } })}
                      style={({ pressed }) => [styles.studyRow, pressed && { backgroundColor: theme.backgroundSelected }]}>
                      <View style={[styles.dot, { backgroundColor: w.course.color }]} />
                      <View style={{ flex: 1 }}>
                        <ThemedText style={{ fontWeight: 600 }}>{w.course.name}</ThemedText>
                        <ThemedText type="small" style={{ color: theme.warning, fontSize: 13 }}>
                          {statusLabel(w)}
                        </ThemedText>
                      </View>
                      <ThemedText type="smallBold" style={{ color: theme.accent }}>
                        Log
                      </ThemedText>
                    </Pressable>
                  </Fragment>
                ))}
              </Card>
            </>
          )}

          <TaskGroup title="Overdue" tasks={overdue} now={now} color="danger" />
          <TaskGroup title="Today" tasks={today} now={now} />
          <TaskGroup
            title={upcomingTitle(upcoming, now)}
            tasks={showAllUpcoming ? upcoming : upcoming.slice(0, UPCOMING_PREVIEW)}
            now={now}
            footer={
              upcoming.length > UPCOMING_PREVIEW ? (
                <ShowMore
                  label={showAllUpcoming ? 'Show less' : `Show all ${upcoming.length}`}
                  onPress={() => setShowAllUpcoming((v) => !v)}
                />
              ) : null
            }
          />
          <TaskGroup title="Someday" tasks={someday} now={now} />

          {completed.length > 0 && (
            <>
              <SectionTitle
                right={
                  <Pressable onPress={() => setShowCompleted((v) => !v)} hitSlop={8}>
                    <ThemedText type="small" style={{ color: theme.accent }}>
                      {showCompleted ? 'Hide' : 'Show'}
                    </ThemedText>
                  </Pressable>
                }>
                Completed · {completed.length}
              </SectionTitle>
              {showCompleted && <TaskCard tasks={completed} now={now} />}
            </>
          )}

          {nothingAtAll && (
            <EmptyState
              icon="checklist"
              title="Nothing on your list"
              body="Type above and press return. Dates like “tomorrow 6pm” are picked up automatically, and you'll get a reminder."
            />
          )}
          {!nothingAtAll && todayTotal === 0 && overdue.length === 0 && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.clear}>
              Nothing due today.
            </ThemedText>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function upcomingTitle(upcoming: Task[], now: number) {
  const tomorrowEnd = addDays(startOfDay(now), 2);
  const tomorrow = upcoming.filter((t) => t.dueAt! < tomorrowEnd).length;
  return tomorrow ? `Upcoming · ${tomorrow} tomorrow` : 'Upcoming';
}

function TaskGroup({
  title,
  tasks,
  now,
  color,
  footer,
}: {
  title: string;
  tasks: Task[];
  now: number;
  color?: 'danger';
  footer?: ReactNode;
}) {
  if (!tasks.length) return null;
  return (
    <>
      <SectionTitle color={color}>{title}</SectionTitle>
      <TaskCard tasks={tasks} now={now} footer={footer} />
    </>
  );
}

function TaskCard({ tasks, now, footer }: { tasks: Task[]; now: number; footer?: ReactNode }) {
  return (
    <Card>
      {tasks.map((t, i) => (
        <Fragment key={t.id}>
          {i > 0 && <Divider inset={TASK_ROW_INSET} />}
          <TaskRow task={t} now={now} />
        </Fragment>
      ))}
      {footer}
    </Card>
  );
}

function ShowMore({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <>
      <Divider />
      <Pressable onPress={onPress} style={styles.showMore}>
        <ThemedText type="small" style={{ color: theme.accent }}>
          {label}
        </ThemedText>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 120 },
  inner: { paddingHorizontal: Spacing.three },
  summary: { padding: Spacing.three, gap: 12 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  summaryBig: { fontSize: 22, lineHeight: 28, fontWeight: 700 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: Spacing.three, marginTop: Spacing.three },
  bannerButton: { paddingVertical: 8, paddingHorizontal: 14 },
  studyRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: Spacing.three, paddingVertical: 12 },
  dot: { width: 12, height: 12, borderRadius: 6, marginHorizontal: 7 },
  showMore: { alignItems: 'center', paddingVertical: 12 },
  clear: { textAlign: 'center', marginTop: Spacing.four },
});
