import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Chip, Stepper } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useData } from '@/data/DataProvider';
import { useTheme } from '@/hooks/use-theme';
import type { RunGoalKind } from '@/lib/types';
import { formatGoalAmount } from '@/running/stats';

const DEFAULTS: Record<Exclude<RunGoalKind, 'none'>, number> = { km: 15, runs: 3 };

export default function RunGoalSheet() {
  const theme = useTheme();
  const { settings, setRunGoal } = useData();
  const [kind, setKind] = useState<RunGoalKind>(settings.runGoalKind);
  const [value, setValue] = useState(settings.runGoalKind === 'none' ? DEFAULTS.km : settings.runGoalValue);

  function choose(k: RunGoalKind) {
    setKind(k);
    if (k !== 'none' && k !== kind) setValue(DEFAULTS[k]);
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ThemedText style={styles.title}>Weekly running goal</ThemedText>
      <View style={styles.chips}>
        <Chip label="Off" selected={kind === 'none'} onPress={() => choose('none')} />
        <Chip label="Kilometres" selected={kind === 'km'} onPress={() => choose('km')} />
        <Chip label="Number of runs" selected={kind === 'runs'} onPress={() => choose('runs')} />
      </View>

      {kind !== 'none' && (
        <View style={styles.amountRow}>
          <ThemedText style={styles.amount}>{formatGoalAmount(kind, value)}</ThemedText>
          <Stepper value={value} min={1} max={kind === 'km' ? 200 : 14} step={1} onChange={setValue} />
        </View>
      )}

      <ThemedText type="small" themeColor="textSecondary">
        {kind === 'none'
          ? 'Runs still water your plant, but there is no weekly target.'
          : 'Mon–Sun. You get an evening nudge when you fall behind, and if the goal is missed by Sunday night your plant wilts. A new goal starts counting from next week.'}
      </ThemedText>

      <Button
        label="Save"
        icon="checkmark"
        style={{ marginTop: Spacing.three }}
        onPress={async () => {
          await setRunGoal(kind, kind === 'none' ? 0 : value);
          router.back();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.four, gap: Spacing.three },
  title: { fontSize: 24, lineHeight: 30, fontWeight: 700 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  amount: { fontSize: 36, lineHeight: 44, fontWeight: 700 },
});
