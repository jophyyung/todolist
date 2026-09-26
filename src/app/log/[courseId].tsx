import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Chip, Stepper } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useData } from '@/data/DataProvider';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { courseWeek, formatMinutes } from '@/study/progress';

const PRESETS = [15, 30, 45, 60, 90, 120];

export default function LogStudySheet() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const theme = useTheme();
  const now = useNow();
  const { courses, sessions, logSession } = useData();
  const course = courses.find((c) => c.id === Number(courseId));
  const [minutes, setMinutes] = useState(30);

  if (!course) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ThemedText>This course no longer exists.</ThemedText>
      </View>
    );
  }

  const w = courseWeek(course, sessions, now);
  const after = w.done + 1;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.titleRow}>
        <View style={[styles.dot, { backgroundColor: course.color }]} />
        <ThemedText style={styles.title}>Log {course.name}</ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {w.done} of {course.weeklyTarget} sessions this week
        {w.minutes ? ` · ${formatMinutes(w.minutes)}` : ''}
      </ThemedText>

      <View style={styles.amountRow}>
        <ThemedText style={styles.amount}>{formatMinutes(minutes)}</ThemedText>
        <Stepper value={minutes} min={5} max={600} step={5} onChange={setMinutes} />
      </View>
      <View style={styles.chips}>
        {PRESETS.map((m) => (
          <Chip key={m} label={formatMinutes(m)} selected={minutes === m} onPress={() => setMinutes(m)} />
        ))}
      </View>

      <Button
        label={after === course.weeklyTarget ? 'Save · goal reached!' : 'Save session'}
        icon="checkmark"
        style={{ marginTop: Spacing.four }}
        onPress={async () => {
          await logSession(course.id, minutes);
          router.back();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.four, gap: Spacing.two },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: 700 },
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.four },
  amount: { fontSize: 40, lineHeight: 48, fontWeight: 700 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.two },
});
