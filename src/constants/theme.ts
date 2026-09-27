/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#1C1C1E',
    /** Soft grey page background; content sits on white `card`s. */
    background: '#F2F2F7',
    card: '#FFFFFF',
    backgroundElement: '#EEEEF2',
    backgroundSelected: '#E3E3E8',
    textSecondary: '#6C6C72',
    textTertiary: '#A1A1A8',
    accent: '#208AEF',
    accentSoft: '#E4F1FE',
    /** Single-series chart marks (validated against light and dark surfaces). */
    chart: '#208AEF',
    onAccent: '#ffffff',
    danger: '#E5484D',
    dangerSoft: '#FDECEC',
    warning: '#E38A00',
    success: '#30A46C',
    successSoft: '#E6F6EC',
    border: '#E5E5EA',
  },
  dark: {
    text: '#F5F5F7',
    background: '#000000',
    card: '#1C1C1E',
    backgroundElement: '#2C2C2E',
    backgroundSelected: '#3A3A3C',
    textSecondary: '#A1A1A8',
    textTertiary: '#6C6C72',
    accent: '#3B9EFF',
    accentSoft: '#12283F',
    chart: '#2F90F0',
    onAccent: '#ffffff',
    danger: '#FF6369',
    dangerSoft: '#3B1719',
    warning: '#FFA94D',
    success: '#3DD68C',
    successSoft: '#12301F',
    border: '#38383A',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
