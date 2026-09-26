import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        {subtitle ? (
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.headerEyebrow}>
            {subtitle}
          </ThemedText>
        ) : null}
        <ThemedText style={styles.headerTitle}>{title}</ThemedText>
      </View>
      {right}
    </View>
  );
}

/** Small uppercase label above a card. */
export function SectionTitle({ children, color = 'textSecondary', right }: { children: ReactNode; color?: ThemeColor; right?: ReactNode }) {
  return (
    <View style={styles.sectionTitleRow}>
      <ThemedText type="smallBold" themeColor={color} style={styles.sectionTitle}>
        {children}
      </ThemedText>
      {right}
    </View>
  );
}

export function IconButton({
  name,
  onPress,
  color = 'accent',
  size = 28,
  label,
}: {
  name: SymbolViewProps['name'];
  onPress: () => void;
  color?: ThemeColor;
  size?: number;
  label: string;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={label}>
      {({ pressed }) => <SymbolView name={name} size={size} tintColor={theme[color]} style={{ opacity: pressed ? 0.5 : 1 }} />}
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: SymbolViewProps['name'];
}) {
  const theme = useTheme();
  const fg = selected ? theme.onAccent : theme.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: selected ? theme.accent : theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
      ]}>
      {icon && <SymbolView name={icon} size={14} tintColor={fg} />}
      <ThemedText type="small" style={{ color: fg }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function Button({
  label,
  onPress,
  color = 'accent',
  variant = 'filled',
  icon,
  style,
  disabled,
}: {
  label: string;
  onPress: () => void;
  color?: ThemeColor;
  variant?: 'filled' | 'soft' | 'plain';
  icon?: SymbolViewProps['name'];
  style?: ViewStyle;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const bg = variant === 'filled' ? theme[color] : variant === 'soft' ? theme.backgroundElement : 'transparent';
  const fg = variant === 'filled' ? theme.onAccent : theme[color];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [styles.button, { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }, style]}>
      {icon && <SymbolView name={icon} size={16} tintColor={fg} />}
      <ThemedText type="smallBold" style={{ color: fg, textAlign: 'center', fontSize: 16 }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle | ViewStyle[] }) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.card }, style]}>{children}</View>;
}

/** Thin divider between rows inside a card; `inset` lines it up with row text. */
export function Divider({ inset = 0 }: { inset?: number }) {
  const theme = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.border, marginLeft: inset }} />;
}

export function ProgressBar({ value, color, height = 8 }: { value: number; color: string; height?: number }) {
  const theme = useTheme();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: theme.backgroundElement, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height: '100%', borderRadius: height, backgroundColor: color }} />
    </View>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: SymbolViewProps['name']; title: string; body: string; action?: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.accentSoft }]}>
        <SymbolView name={icon} size={30} tintColor={theme.accent} />
      </View>
      <ThemedText type="smallBold" style={{ fontSize: 17 }}>
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
        {body}
      </ThemedText>
      {action}
    </View>
  );
}

export function Stepper({ value, min, max, step = 1, onChange }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  const theme = useTheme();
  const btn = (icon: 'minus' | 'plus', next: number, disabled: boolean) => (
    <Pressable
      onPress={() => onChange(next)}
      disabled={disabled}
      hitSlop={6}
      accessibilityLabel={icon === 'plus' ? 'Increase' : 'Decrease'}
      style={({ pressed }) => [styles.stepBtn, { backgroundColor: theme.backgroundElement, opacity: disabled ? 0.35 : pressed ? 0.6 : 1 }]}>
      <SymbolView name={icon} size={16} tintColor={theme.text} weight="semibold" />
    </Pressable>
  );
  return (
    <View style={styles.stepper}>
      {btn('minus', Math.max(min, value - step), value <= min)}
      {btn('plus', Math.min(max, value + step), value >= max)}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
  },
  headerEyebrow: { textTransform: 'uppercase', fontSize: 12, letterSpacing: 0.6 },
  headerTitle: { fontSize: 32, lineHeight: 38, fontWeight: 700 },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.four,
    marginBottom: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  sectionTitle: { textTransform: 'uppercase', fontSize: 12, letterSpacing: 0.6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  button: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingVertical: 13,
    paddingHorizontal: Spacing.three,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { borderRadius: 16, overflow: 'hidden' },
  empty: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.five, paddingHorizontal: Spacing.four },
  stepper: { flexDirection: 'row', gap: 8 },
  stepBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.one },
});
