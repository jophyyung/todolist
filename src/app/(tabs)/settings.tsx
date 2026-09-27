import DateTimePicker from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, Divider, ScreenHeader, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useData } from '@/data/DataProvider';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { atTime, formatReminder } from '@/lib/dates';
import { widgetDiagnostics } from '@/widget/sync';

const REMINDER_OPTIONS = [0, 15, 60, 1440];

export default function SettingsScreen() {
  const theme = useTheme();
  const { settings, updateSettings, notificationsAllowed, requestNotifications, tasks, courses, sessions } = useData();
  const [pending, setPending] = useState<number | null>(null);
  const [testSent, setTestSent] = useState(false);
  const [widget] = useState(widgetDiagnostics);
  const now = useNow(60 * 60_000);

  useEffect(() => {
    // Give the debounced rescheduler a moment before counting.
    const id = setTimeout(() => Notifications.getAllScheduledNotificationsAsync().then((n) => setPending(n.length)), 800);
    return () => clearTimeout(id);
  }, [tasks, courses, sessions, settings, notificationsAllowed]);

  async function sendTest() {
    if (!(await requestNotifications())) return;
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Test reminder', body: 'Notifications are working. This is how reminders look on your lock screen.' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 10 },
    });
    setTestSent(true);
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title="Settings" />
        <View style={styles.inner}>
          <SectionTitle>Notifications</SectionTitle>
          <Card>
            <Row
              icon="bell.fill"
              iconBg={notificationsAllowed ? theme.success : theme.danger}
              title={notificationsAllowed ? 'Notifications on' : 'Notifications off'}
              subtitle={
                notificationsAllowed
                  ? pending != null
                    ? `${pending} reminder${pending === 1 ? '' : 's'} scheduled`
                    : undefined
                  : 'If nothing happens, turn them on in the iPhone Settings app'
              }
              right={!notificationsAllowed ? <Button label="Turn on" onPress={requestNotifications} style={styles.smallButton} /> : null}
            />
            <Divider inset={60} />
            <Row
              icon="paperplane.fill"
              iconBg={theme.accent}
              title={testSent ? 'Sent. Lock your phone now' : 'Send a test'}
              subtitle="Arrives in 10 seconds"
              onPress={sendTest}
            />
          </Card>

          <SectionTitle>Daily reminders</SectionTitle>
          <Card>
            <Row
              icon="sun.max.fill"
              iconBg={theme.warning}
              title="Morning summary"
              subtitle="Today's to-dos and courses to study"
              right={
                <DateTimePicker
                  value={new Date(atTime(now, settings.digestHour, settings.digestMinute))}
                  mode="time"
                  display="compact"
                  minuteInterval={5}
                  onValueChange={(_e, d) => updateSettings({ digestHour: d.getHours(), digestMinute: d.getMinutes() })}
                />
              }
            />
            <Divider inset={60} />
            <Row
              icon="graduationcap.fill"
              iconBg="#8E4EC6"
              title="Study nudge"
              subtitle="Only if you're behind on a course"
              right={
                <DateTimePicker
                  value={new Date(atTime(now, settings.studyHour, settings.studyMinute))}
                  mode="time"
                  display="compact"
                  minuteInterval={5}
                  onValueChange={(_e, d) => updateSettings({ studyHour: d.getHours(), studyMinute: d.getMinutes() })}
                />
              }
            />
            <Divider inset={60} />
            <Row
              icon="leaf.fill"
              iconBg="#30A46C"
              title="Plant reminder"
              subtitle="Only if nothing's been done yet today"
              right={
                <DateTimePicker
                  value={new Date(atTime(now, settings.plantHour, settings.plantMinute))}
                  mode="time"
                  display="compact"
                  minuteInterval={5}
                  onValueChange={(_e, d) => updateSettings({ plantHour: d.getHours(), plantMinute: d.getMinutes() })}
                />
              }
            />
          </Card>

          <SectionTitle>Default reminders for new tasks</SectionTitle>
          <Card style={styles.padded}>
            <View style={styles.chips}>
              {REMINDER_OPTIONS.map((m) => {
                const on = settings.defaultReminders.includes(m);
                return (
                  <Chip
                    key={m}
                    label={formatReminder(m)}
                    icon={on ? 'bell.fill' : undefined}
                    selected={on}
                    onPress={() =>
                      updateSettings({
                        defaultReminders: on ? settings.defaultReminders.filter((x) => x !== m) : [...settings.defaultReminders, m],
                      })
                    }
                  />
                );
              })}
            </View>
          </Card>

          <SectionTitle>Lock-screen widget</SectionTitle>
          <Card style={[styles.padded, { gap: 4 }]}>
            {!widget.available ? (
              <ThemedText type="small" themeColor="textSecondary">
                Only works in the installed app (not in Expo Go).
              </ThemedText>
            ) : (
              <>
                <ThemedText type="small">
                  {widget.fromProfile.length
                    ? `Shared storage: ${widget.fromProfile.join(', ')}`
                    : 'No shared storage found in the app signature. The widget may stay empty.'}
                </ThemedText>
                <ThemedText type="small" themeColor="textTertiary" style={{ fontSize: 12 }}>
                  Writing to: {widget.groups.join(', ')}
                </ThemedText>
              </>
            )}
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  icon,
  iconBg,
  title,
  subtitle,
  right,
  onPress,
}: {
  icon: 'bell.fill' | 'paperplane.fill' | 'sun.max.fill' | 'graduationcap.fill' | 'leaf.fill';
  iconBg: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const content = (pressed = false) => (
    <View style={[styles.row, pressed && { backgroundColor: theme.backgroundSelected }]}>
      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
        <SymbolView name={icon} size={16} tintColor="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <ThemedText style={onPress ? { color: theme.accent } : undefined}>{title}</ThemedText>
        {subtitle ? (
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 13 }}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {right}
    </View>
  );
  if (!onPress) return content();
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {({ pressed }) => content(pressed)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 120 },
  inner: { paddingHorizontal: Spacing.three },
  padded: { padding: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: Spacing.three, paddingVertical: 12 },
  rowIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  smallButton: { paddingVertical: 8, paddingHorizontal: 14 },
});
