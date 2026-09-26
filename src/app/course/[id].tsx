import { router, Stack, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Fragment, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Divider, SectionTitle, Stepper } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useData } from '@/data/DataProvider';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { formatDue } from '@/lib/dates';
import { COURSE_COLORS } from '@/lib/types';
import { formatMinutes } from '@/study/progress';

export default function CourseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { courses, sessions, addCourse, editCourse, removeCourse, removeSession } = useData();
  const existing = id === 'new' ? undefined : courses.find((c) => c.id === Number(id));

  const [name, setName] = useState(existing?.name ?? '');
  const [color, setColor] = useState(existing?.color ?? COURSE_COLORS[courses.length % COURSE_COLORS.length]);
  const [target, setTarget] = useState(existing?.weeklyTarget ?? 2);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const now = useNow();
  const history = existing ? sessions.filter((s) => s.courseId === existing.id).slice(0, 20) : [];
  const canSave = name.trim().length > 0;

  async function save() {
    if (!canSave) return;
    const input = { name: name.trim(), color, weeklyTarget: target };
    if (existing) await editCourse(existing.id, input);
    else await addCourse(input);
    router.back();
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: theme.background }}>
      <Stack.Screen
        options={{
          title: existing ? 'Edit Course' : 'New Course',
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
            value={name}
            onChangeText={setName}
            placeholder="Course name, e.g. Biology"
            placeholderTextColor={theme.textTertiary}
            style={[styles.nameInput, { color: theme.text }]}
            autoFocus={!existing}
            returnKeyType="done"
          />
        </Card>

        <SectionTitle>Colour</SectionTitle>
        <Card style={styles.colors}>
          {COURSE_COLORS.map((c) => (
            <Pressable key={c} onPress={() => setColor(c)} accessibilityLabel={`Colour ${c}`} style={[styles.swatch, { backgroundColor: c }]}>
              {color === c && <SymbolView name="checkmark" size={16} tintColor="#fff" weight="bold" />}
            </Pressable>
          ))}
        </Card>

        <SectionTitle>Weekly goal</SectionTitle>
        <Card style={styles.stepperCard}>
          <View style={{ flex: 1 }}>
            <ThemedText style={{ fontSize: 17, fontWeight: 600 }}>
              {target} session{target === 1 ? '' : 's'} a week
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Any day. You&apos;ll be nudged if you fall behind.
            </ThemedText>
          </View>
          <Stepper value={target} min={1} max={14} onChange={setTarget} />
        </Card>

        {history.length > 0 && (
          <>
            <SectionTitle>Recent sessions</SectionTitle>
            <Card>
              {history.map((s, i) => (
                <Fragment key={s.id}>
                  {i > 0 && <Divider inset={Spacing.three} />}
                  <View style={styles.historyRow}>
                    <ThemedText style={{ flex: 1 }}>{formatDue(s.at, now)}</ThemedText>
                    <ThemedText themeColor="textSecondary">{formatMinutes(s.minutes)}</ThemedText>
                    <Pressable onPress={() => removeSession(s.id)} hitSlop={10} accessibilityLabel="Delete session">
                      <SymbolView name="minus.circle.fill" size={20} tintColor={theme.danger} />
                    </Pressable>
                  </View>
                </Fragment>
              ))}
            </Card>
          </>
        )}

        {existing && (
          <Button
            label={confirmDelete ? 'Tap again to delete course and its history' : 'Delete course'}
            color="danger"
            variant="soft"
            style={{ marginTop: Spacing.five }}
            onPress={async () => {
              if (!confirmDelete) return setConfirmDelete(true);
              await removeCourse(existing.id);
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
  nameInput: { fontSize: 18, fontWeight: 600, paddingHorizontal: Spacing.three, paddingVertical: 14 },
  colors: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', padding: Spacing.three, rowGap: 12 },
  swatch: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  stepperCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Spacing.three, paddingVertical: 12 },
});
