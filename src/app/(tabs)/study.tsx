import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, EmptyState, IconButton, ProgressBar, ScreenHeader, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useData } from '@/data/DataProvider';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { addDays, startOfWeek } from '@/lib/dates';
import { courseWeek, formatMinutes, statusLabel, type CourseWeek } from '@/study/progress';

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function StudyScreen() {
  const theme = useTheme();
  const { courses, sessions } = useData();
  const now = useNow();
  const weeks = useMemo(() => courses.map((c) => courseWeek(c, sessions, now)), [courses, sessions, now]);

  const week = startOfWeek(now);
  const range = `${fmt(week)} – ${fmt(addDays(week, 6))}`;
  const totalMinutes = weeks.reduce((s, w) => s + w.minutes, 0);
  const totalDone = weeks.reduce((s, w) => s + Math.min(w.done, w.course.weeklyTarget), 0);
  const totalTarget = weeks.reduce((s, w) => s + w.course.weeklyTarget, 0);
  const daysLeft = weeks[0]?.daysLeft ?? 7 - ((new Date(now).getDay() + 6) % 7);
  const addCourse = () => router.push({ pathname: '/course/[id]', params: { id: 'new' } });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader
          title="Study"
          subtitle={`This week · ${range}`}
          right={courses.length ? <IconButton name="plus" size={22} label="Add course" onPress={addCourse} /> : null}
        />
        <View style={styles.inner}>
          {courses.length === 0 ? (
            <Card style={{ padding: Spacing.three }}>
              <EmptyState
                icon="graduationcap.fill"
                title="Add your courses"
                body="Set how many times a week you want to study each one. You'll get a nudge in the evening if you're falling behind."
                action={<Button label="Add a course" icon="plus" onPress={addCourse} style={{ marginTop: Spacing.three, alignSelf: 'stretch' }} />}
              />
            </Card>
          ) : (
            <>
              <Card style={styles.summary}>
                <View style={styles.summaryStats}>
                  <Stat label="Studied" value={formatMinutes(totalMinutes)} />
                  <Stat label="Sessions" value={`${totalDone} / ${totalTarget}`} />
                  <Stat label="Days left" value={String(daysLeft)} />
                </View>
                <ProgressBar value={totalTarget ? totalDone / totalTarget : 0} color={theme.accent} />
              </Card>

              <SectionTitle>Courses</SectionTitle>
              <View style={{ gap: Spacing.three }}>
                {weeks.map((w) => (
                  <CourseCard key={w.course.id} week={w} now={now} />
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function fmt(t: number) {
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <ThemedText style={styles.statValue}>{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

function CourseCard({ week: w, now }: { week: CourseWeek; now: number }) {
  const theme = useTheme();
  const todayIndex = (new Date(now).getDay() + 6) % 7;
  const statusColor = w.status === 'done' ? theme.success : w.status === 'behind' ? theme.warning : theme.textSecondary;

  return (
    <Card style={styles.courseCard}>
      <Pressable
        onPress={() => router.push({ pathname: '/course/[id]', params: { id: String(w.course.id) } })}
        style={styles.courseHeader}
        hitSlop={4}>
        <View style={[styles.courseIcon, { backgroundColor: w.course.color }]}>
          <ThemedText style={styles.courseInitial}>{w.course.name.slice(0, 1).toUpperCase()}</ThemedText>
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.courseName} numberOfLines={1}>
            {w.course.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Goal {w.course.weeklyTarget}× a week{w.minutes ? ` · ${formatMinutes(w.minutes)} so far` : ''}
          </ThemedText>
        </View>
        <SymbolView name="chevron.right" size={14} tintColor={theme.textTertiary} />
      </Pressable>

      <View style={styles.progressRow}>
        <View style={{ flex: 1 }}>
          <ProgressBar value={w.done / w.course.weeklyTarget} color={w.status === 'done' ? theme.success : w.course.color} />
        </View>
        <ThemedText type="smallBold">
          {w.done}/{w.course.weeklyTarget}
        </ThemedText>
      </View>

      <View style={styles.days}>
        {DAY_LETTERS.map((letter, i) => {
          const studied = w.perDay[i] > 0;
          const isToday = i === todayIndex;
          return (
            <View key={i} style={styles.day}>
              <View
                style={[
                  styles.dayDot,
                  { backgroundColor: studied ? w.course.color : theme.backgroundElement },
                  isToday && !studied && { borderWidth: 2, borderColor: w.course.color },
                ]}>
                {studied && <SymbolView name="checkmark" size={12} tintColor="#fff" weight="bold" />}
              </View>
              <ThemedText type="small" style={{ fontSize: 11, color: isToday ? theme.text : theme.textTertiary, fontWeight: isToday ? 700 : 500 }}>
                {letter}
              </ThemedText>
            </View>
          );
        })}
      </View>

      <View style={styles.footer}>
        <ThemedText type="small" style={{ color: statusColor, flex: 1 }}>
          {statusLabel(w)}
        </ThemedText>
        <Button
          label="Log study"
          icon="plus"
          variant={w.status === 'behind' ? 'filled' : 'soft'}
          style={styles.logButton}
          onPress={() => router.push({ pathname: '/log/[courseId]', params: { courseId: String(w.course.id) } })}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 120 },
  inner: { paddingHorizontal: Spacing.three },
  summary: { padding: Spacing.three, gap: 14 },
  summaryStats: { flexDirection: 'row' },
  statValue: { fontSize: 22, lineHeight: 28, fontWeight: 700 },
  courseCard: { padding: Spacing.three, gap: 14 },
  courseHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  courseIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  courseInitial: { color: '#fff', fontSize: 18, fontWeight: 700 },
  courseName: { fontSize: 17, fontWeight: 600 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { alignItems: 'center', gap: 4 },
  dayDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  logButton: { paddingVertical: 9, paddingHorizontal: 14 },
});
