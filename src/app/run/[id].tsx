import DateTimePicker from '@react-native-community/datetimepicker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, Divider, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useData } from '@/data/DataProvider';
import { useTheme } from '@/hooks/use-theme';
import { formatDuration, formatPace, paceOf, parseDuration, parseKm } from '@/running/stats';

const QUICK_KM = [3, 5, 8, 10, 21.1];

export default function RunScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { runs, addRun, editRun, removeRun } = useData();
  const existing = id === 'new' ? undefined : runs.find((r) => r.id === Number(id));

  const [km, setKm] = useState(existing ? String(existing.distanceM / 1000) : '');
  const [time, setTime] = useState(existing ? formatDuration(existing.durationS) : '');
  const [at, setAt] = useState(() => existing?.at ?? Date.now());
  const [note, setNote] = useState(existing?.note ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const distanceM = parseKm(km);
  const durationS = parseDuration(time);
  const canSave = distanceM != null && durationS != null;
  const pace = canSave ? paceOf({ distanceM, durationS }) : null;

  async function save() {
    if (!canSave) return;
    const input = { distanceM, durationS, at, note: note.trim() };
    if (existing) await editRun(existing.id, input);
    else await addRun(input);
    router.back();
  }

  const input = [styles.input, { color: theme.text }];

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: theme.background }}>
      <Stack.Screen
        options={{
          title: existing ? 'Edit Run' : 'Log a Run',
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
          <View style={styles.field}>
            <ThemedText style={styles.fieldLabel}>Distance</ThemedText>
            <TextInput
              value={km}
              onChangeText={setKm}
              placeholder="5.0"
              placeholderTextColor={theme.textTertiary}
              keyboardType="decimal-pad"
              style={input}
              autoFocus={!existing}
            />
            <ThemedText themeColor="textSecondary">km</ThemedText>
          </View>
          <Divider inset={Spacing.three} />
          <View style={styles.field}>
            <ThemedText style={styles.fieldLabel}>Time</ThemedText>
            <TextInput
              value={time}
              onChangeText={setTime}
              placeholder="28:30"
              placeholderTextColor={theme.textTertiary}
              keyboardType="numbers-and-punctuation"
              style={input}
            />
            <ThemedText themeColor="textSecondary">min:sec</ThemedText>
          </View>
        </Card>
        <View style={[styles.chips, { marginTop: Spacing.two }]}>
          {QUICK_KM.map((k) => (
            <Chip key={k} label={k === 21.1 ? 'Half' : `${k} km`} selected={parseKm(km) === k * 1000} onPress={() => setKm(String(k))} />
          ))}
        </View>

        <Card style={styles.paceCard}>
          <ThemedText type="small" themeColor="textSecondary">
            PACE
          </ThemedText>
          <ThemedText style={styles.pace}>{formatPace(pace)}</ThemedText>
          {!canSave && (km || time) ? (
            <ThemedText type="small" style={{ color: theme.warning }}>
              {distanceM == null ? 'Enter a distance like 5.2' : 'Enter time as 28:30 or 1:05:00, or just minutes'}
            </ThemedText>
          ) : null}
        </Card>

        <SectionTitle>When</SectionTitle>
        <Card style={styles.whenCard}>
          <ThemedText>Date & time</ThemedText>
          <DateTimePicker
            value={new Date(at)}
            mode="datetime"
            display="compact"
            maximumDate={new Date()}
            onValueChange={(_e, d) => setAt(d.getTime())}
          />
        </Card>

        <SectionTitle>Note</SectionTitle>
        <Card>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="How did it feel? Route, weather…"
            placeholderTextColor={theme.textTertiary}
            style={[styles.note, { color: theme.text }]}
            multiline
          />
        </Card>

        <Button label={existing ? 'Save changes' : 'Save run'} icon="checkmark" disabled={!canSave} onPress={save} style={{ marginTop: Spacing.four }} />
        {existing && (
          <Button
            label={confirmDelete ? 'Tap again to delete' : 'Delete run'}
            color="danger"
            variant="soft"
            style={{ marginTop: Spacing.three }}
            onPress={async () => {
              if (!confirmDelete) return setConfirmDelete(true);
              await removeRun(existing.id);
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
  field: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Spacing.three },
  fieldLabel: { width: 76, fontWeight: 600 },
  input: { flex: 1, fontSize: 22, fontWeight: 700, paddingVertical: 14, textAlign: 'right' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  paceCard: { padding: Spacing.three, gap: 2, marginTop: Spacing.three, alignItems: 'center' },
  pace: { fontSize: 28, lineHeight: 34, fontWeight: 700 },
  whenCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.three },
  note: { fontSize: 16, minHeight: 64, paddingHorizontal: Spacing.three, paddingVertical: 12, textAlignVertical: 'top' },
});
