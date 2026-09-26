import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useData } from '@/data/DataProvider';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { formatDue } from '@/lib/dates';
import { parseQuickAdd } from '@/lib/quickAdd';

const REPEAT_LABEL = { none: '', daily: 'Every day', weekdays: 'Weekdays', weekly: 'Every week' } as const;

/** Type a task in plain words ("gym tomorrow 6pm") and press return to add it. */
export function QuickAdd() {
  const theme = useTheme();
  const { addTask, settings } = useData();
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const input = useRef<TextInput>(null);

  const now = useNow();
  const parsed = text.trim() ? parseQuickAdd(text, now) : null;

  async function submit() {
    if (!text.trim()) return;
    const parsed = parseQuickAdd(text, Date.now());
    await addTask({
      title: parsed.title,
      notes: '',
      dueAt: parsed.dueAt,
      repeat: parsed.repeat,
      priority: parsed.priority,
      reminders: settings.defaultReminders.length ? settings.defaultReminders : [0],
    });
    setText('');
    // Keep the keyboard up so several tasks can be added in a row.
    input.current?.focus();
  }

  function openDetails() {
    const draft = parsed ? JSON.stringify(parsed) : undefined;
    setText('');
    input.current?.blur();
    router.push({ pathname: '/task/[id]', params: { id: 'new', ...(draft ? { draft } : {}) } });
  }

  return (
    <Card style={[styles.card, { borderColor: focused ? theme.accent : 'transparent' }]}>
      <View style={styles.row}>
        <SymbolView name="plus.circle.fill" size={26} tintColor={theme.accent} />
        <TextInput
          ref={input}
          value={text}
          onChangeText={setText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={submit}
          submitBehavior="submit"
          placeholder="Add a task, e.g. gym tomorrow 6pm"
          placeholderTextColor={theme.textTertiary}
          returnKeyType="done"
          style={[styles.input, { color: theme.text }]}
        />
        {focused && (
          <Pressable onPress={openDetails} hitSlop={10} accessibilityLabel="More options">
            <SymbolView name="slider.horizontal.3" size={20} tintColor={theme.textSecondary} />
          </Pressable>
        )}
      </View>
      {parsed?.matched && (
        <View style={styles.preview}>
          {parsed.dueAt != null && <Tag icon="calendar" text={formatDue(parsed.dueAt, now)} color={theme.accent} bg={theme.accentSoft} />}
          {parsed.repeat !== 'none' && <Tag icon="repeat" text={REPEAT_LABEL[parsed.repeat]} color={theme.accent} bg={theme.accentSoft} />}
          {parsed.priority > 0 && (
            <Tag icon="flag.fill" text={parsed.priority === 2 ? 'Urgent' : 'High'} color={theme.danger} bg={theme.dangerSoft} />
          )}
        </View>
      )}
      {focused && !text && (
        <ThemedText type="small" themeColor="textTertiary" style={styles.hint}>
          Try &quot;tomorrow 6pm&quot;, &quot;fri at 5&quot;, &quot;in 30 min&quot;, &quot;every weekday 9am&quot; or add ! for important.
        </ThemedText>
      )}
    </Card>
  );
}

function Tag({ icon, text, color, bg }: { icon: 'calendar' | 'repeat' | 'flag.fill'; text: string; color: string; bg: string }) {
  return (
    <View style={[styles.tag, { backgroundColor: bg }]}>
      <SymbolView name={icon} size={12} tintColor={color} />
      <ThemedText type="small" style={{ color, fontSize: 13 }}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: Spacing.three, paddingVertical: 4, borderWidth: 1.5, borderColor: 'transparent' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  input: { flex: 1, fontSize: 16, paddingVertical: 12 },
  preview: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingBottom: 10, paddingLeft: 38 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  hint: { paddingBottom: 10, paddingLeft: 38, fontSize: 13 },
});
