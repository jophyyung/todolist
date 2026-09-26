import DateTimePicker from '@react-native-community/datetimepicker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, Divider, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useData } from '@/data/DataProvider';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { addDays, atTime, formatReminder, HOUR, startOfDay } from '@/lib/dates';
import type { QuickAdd } from '@/lib/quickAdd';
import type { Priority, Repeat, TaskInput } from '@/lib/types';

const REMINDER_OPTIONS = [0, 15, 60, 1440];
const REPEAT_OPTIONS: { value: Repeat; label: string }[] = [
  { value: 'none', label: 'Never' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekly', label: 'Weekly' },
];
const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 0, label: 'Normal' },
  { value: 1, label: 'High' },
  { value: 2, label: 'Urgent' },
];

function presets(now: number) {
  const today = startOfDay(now);
  const nextHour = Math.ceil((now + 1) / HOUR) * HOUR;
  return [
    { label: 'In 1 hour', at: nextHour },
    { label: 'This evening', at: atTime(today, 19) },
    { label: 'Tomorrow 9am', at: atTime(addDays(today, 1), 9) },
    { label: 'Next week', at: atTime(addDays(today, 7), 9) },
  ].filter((p) => p.at > now);
}

export default function TaskScreen() {
  const { id, draft } = useLocalSearchParams<{ id: string; draft?: string }>();
  const theme = useTheme();
  const { tasks, settings, addTask, editTask, removeTask } = useData();
  const existing = id === 'new' ? undefined : tasks.find((t) => t.id === Number(id));
  const seed: Partial<QuickAdd> = !existing && draft ? JSON.parse(draft) : {};
  const now = useNow();

  const [title, setTitle] = useState(existing?.title ?? seed.title ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [dueAt, setDueAt] = useState<number | null>(existing?.dueAt ?? seed.dueAt ?? null);
  const [reminders, setReminders] = useState<number[]>(existing?.reminders ?? settings.defaultReminders);
  const [repeat, setRepeat] = useState<Repeat>(existing?.repeat ?? seed.repeat ?? 'none');
  const [priority, setPriority] = useState<Priority>(existing?.priority ?? seed.priority ?? 0);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const canSave = title.trim().length > 0;

  async function save() {
    if (!canSave) return;
    const input: TaskInput = {
      title: title.trim(),
      notes: notes.trim(),
      dueAt,
      reminders: reminders.length ? [...reminders].sort((a, b) => a - b) : [0],
      repeat: dueAt == null ? 'none' : repeat,
      priority,
    };
    if (existing) await editTask(existing.id, input);
    else await addTask(input);
    router.back();
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: theme.background }}>
      <Stack.Screen
        options={{
          title: existing ? 'Edit Task' : 'New Task',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <ThemedText style={{ color: theme.accent }}>Cancel</ThemedText>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable onPress={save} disabled={!canSave} hitSlop={8}>
              <ThemedText style={{ color: canSave ? theme.accent : theme.textTertiary, fontWeight: 600 }}>Save</ThemedText>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="What needs doing?"
            placeholderTextColor={theme.textTertiary}
            style={[styles.titleInput, { color: theme.text }]}
            autoFocus={!existing}
            returnKeyType="done"
            onSubmitEditing={save}
          />
          <Divider inset={Spacing.three} />
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Notes"
            placeholderTextColor={theme.textTertiary}
            style={[styles.notesInput, { color: theme.text }]}
            multiline
          />
        </Card>

        <SectionTitle>When</SectionTitle>
        <Card style={styles.padded}>
          <View style={styles.chips}>
            <Chip label="No date" selected={dueAt == null} onPress={() => setDueAt(null)} />
            {presets(now).map((p) => (
              <Chip key={p.label} label={p.label} selected={dueAt === p.at} onPress={() => setDueAt(p.at)} />
            ))}
          </View>
          <Divider />
          <View style={styles.pickerRow}>
            <ThemedText themeColor={dueAt == null ? 'textSecondary' : 'text'}>{dueAt == null ? 'Pick a date' : 'Date & time'}</ThemedText>
            <DateTimePicker
              value={new Date(dueAt ?? atTime(addDays(startOfDay(now), 1), 9))}
              mode="datetime"
              display="compact"
              minuteInterval={5}
              onValueChange={(_e, date) => setDueAt(date.getTime())}
            />
          </View>
        </Card>

        {dueAt != null && (
          <>
            <SectionTitle>Remind me</SectionTitle>
            <Card style={styles.padded}>
              <View style={styles.chips}>
                {REMINDER_OPTIONS.map((m) => (
                  <Chip
                    key={m}
                    label={formatReminder(m)}
                    icon={reminders.includes(m) ? 'bell.fill' : undefined}
                    selected={reminders.includes(m)}
                    onPress={() => setReminders((r) => (r.includes(m) ? r.filter((x) => x !== m) : [...r, m]))}
                  />
                ))}
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                Plus one nudge an hour after if it&apos;s still not done.
              </ThemedText>
            </Card>

            <SectionTitle>Repeat</SectionTitle>
            <Card style={styles.padded}>
              <View style={styles.chips}>
                {REPEAT_OPTIONS.map((o) => (
                  <Chip key={o.value} label={o.label} selected={repeat === o.value} onPress={() => setRepeat(o.value)} />
                ))}
              </View>
            </Card>
          </>
        )}

        <SectionTitle>Priority</SectionTitle>
        <Card style={styles.padded}>
          <View style={styles.chips}>
            {PRIORITY_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                label={o.label}
                icon={o.value > 0 ? 'flag.fill' : undefined}
                selected={priority === o.value}
                onPress={() => setPriority(o.value)}
              />
            ))}
          </View>
        </Card>

        {existing && (
          <Button
            label={confirmDelete ? 'Tap again to delete' : 'Delete task'}
            color="danger"
            variant="soft"
            style={{ marginTop: Spacing.five }}
            onPress={async () => {
              if (!confirmDelete) return setConfirmDelete(true);
              await removeTask(existing.id);
              router.back();
            }}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, paddingBottom: Spacing.six },
  titleInput: { fontSize: 18, fontWeight: 600, paddingHorizontal: Spacing.three, paddingVertical: 14 },
  notesInput: { fontSize: 16, minHeight: 72, paddingHorizontal: Spacing.three, paddingVertical: 12, textAlignVertical: 'top' },
  padded: { padding: Spacing.three, gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
