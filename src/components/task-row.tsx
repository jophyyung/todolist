import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useData } from '@/data/DataProvider';
import { useTheme } from '@/hooks/use-theme';
import { formatDue, formatTime } from '@/lib/dates';
import type { Task } from '@/lib/types';

export const TASK_ROW_INSET = 52;

export function TaskRow({ task, now }: { task: Task; now: number }) {
  const theme = useTheme();
  const { toggleComplete, snooze, removeTask } = useData();
  const done = task.completedAt != null;
  const overdue = !done && task.dueAt != null && task.dueAt < now;
  const snoozed = !done && task.snoozedUntil != null && task.snoozedUntil > now;
  const ringColor = task.priority === 2 ? theme.danger : task.priority === 1 ? theme.warning : theme.textTertiary;

  const renderActions = (_p: unknown, _t: unknown, methods: { close(): void }) => (
    <View style={styles.actions}>
      {!done && task.dueAt != null && (
        <Pressable
          style={[styles.action, { backgroundColor: theme.warning }]}
          onPress={() => {
            methods.close();
            snooze(task, 60);
          }}>
          <SymbolView name="moon.zzz.fill" size={20} tintColor="#fff" />
          <ThemedText type="small" style={styles.actionText}>
            Snooze
          </ThemedText>
        </Pressable>
      )}
      <Pressable
        style={[styles.action, { backgroundColor: theme.danger }]}
        onPress={() => {
          methods.close();
          removeTask(task.id);
        }}>
        <SymbolView name="trash.fill" size={20} tintColor="#fff" />
        <ThemedText type="small" style={styles.actionText}>
          Delete
        </ThemedText>
      </Pressable>
    </View>
  );

  return (
    <ReanimatedSwipeable renderRightActions={renderActions} overshootRight={false} friction={2}>
      <Pressable
        onPress={() => router.push({ pathname: '/task/[id]', params: { id: String(task.id) } })}
        style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.backgroundSelected : theme.card }]}>
        <Pressable
          onPress={() => toggleComplete(task)}
          hitSlop={14}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done }}
          accessibilityLabel={`Complete ${task.title}`}>
          <SymbolView name={done ? 'checkmark.circle.fill' : 'circle'} size={26} tintColor={done ? theme.success : ringColor} />
        </Pressable>
        <View style={styles.body}>
          <ThemedText
            numberOfLines={2}
            style={[styles.title, done && { textDecorationLine: 'line-through', color: theme.textSecondary }]}>
            {task.title}
          </ThemedText>
          {(task.dueAt != null || task.notes || task.repeat !== 'none') && (
            <View style={styles.meta}>
              {task.dueAt != null && (
                <View style={[styles.pill, overdue && { backgroundColor: theme.dangerSoft }]}>
                  <SymbolView name={overdue ? 'exclamationmark.circle.fill' : 'clock'} size={12} tintColor={overdue ? theme.danger : theme.textSecondary} />
                  <ThemedText type="small" style={{ color: overdue ? theme.danger : theme.textSecondary, fontSize: 13 }}>
                    {formatDue(task.dueAt, now)}
                  </ThemedText>
                </View>
              )}
              {task.repeat !== 'none' && <SymbolView name="repeat" size={12} tintColor={theme.textSecondary} />}
              {snoozed && (
                <ThemedText type="small" style={{ color: theme.warning, fontSize: 13 }}>
                  Snoozed till {formatTime(task.snoozedUntil!)}
                </ThemedText>
              )}
              {task.notes ? (
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={{ flexShrink: 1, fontSize: 13 }}>
                  {task.notes}
                </ThemedText>
              ) : null}
            </View>
          )}
        </View>
        {task.priority > 0 && !done && (
          <SymbolView name="flag.fill" size={14} tintColor={task.priority === 2 ? theme.danger : theme.warning} />
        )}
      </Pressable>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: 13,
  },
  body: { flex: 1, gap: 4 },
  title: { fontSize: 16, lineHeight: 21, fontWeight: 500 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1, marginLeft: -4 },
  actions: { flexDirection: 'row' },
  action: { width: 76, alignItems: 'center', justifyContent: 'center', gap: 2 },
  actionText: { color: '#fff' },
});
