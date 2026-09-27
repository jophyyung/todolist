import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { DataProvider } from '@/data/DataProvider';
import { DATABASE_NAME, migrateDbIfNeeded } from '@/db/database';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded}>
          <DataProvider>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="task/[id]" options={{ presentation: 'modal', title: 'Task' }} />
              <Stack.Screen name="plant" options={{ title: 'Your plant', headerBackTitle: 'Today' }} />
              <Stack.Screen name="course/[id]" options={{ presentation: 'modal', title: 'Course' }} />
              <Stack.Screen name="run/[id]" options={{ presentation: 'modal', title: 'Run' }} />
              <Stack.Screen
                name="run-goal"
                options={{
                  presentation: 'formSheet',
                  sheetAllowedDetents: [0.55],
                  sheetGrabberVisible: true,
                  sheetCornerRadius: 24,
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="log/[courseId]"
                options={{
                  presentation: 'formSheet',
                  sheetAllowedDetents: [0.5],
                  sheetGrabberVisible: true,
                  sheetCornerRadius: 24,
                  headerShown: false,
                }}
              />
            </Stack>
          </DataProvider>
        </SQLiteProvider>
        <AnimatedSplashOverlay />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
