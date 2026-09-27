import { Platform } from 'react-native';

import type { WidgetSnapshot } from './snapshot';

/** Must match the entitlement in app.json and `appGroup` in targets/widget/TodoWidget.swift. */
export const APP_GROUP = 'group.com.jophy.todolist';

type Storage = { set(key: string, value: string): void };
type StorageModule = { new (group: string): Storage; reloadWidget(name?: string): void };

let storage: Storage | null | undefined;
let StorageClass: StorageModule | null = null;

/** The native module only exists in the installed app, not in Expo Go. */
function getStorage(): Storage | null {
  if (storage !== undefined) return storage;
  storage = null;
  if (Platform.OS !== 'ios') return storage;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    StorageClass = require('@bacons/apple-targets').ExtensionStorage as StorageModule;
    storage = new StorageClass(APP_GROUP);
  } catch {
    storage = null;
  }
  return storage;
}

/** Writes the snapshot for the lock-screen widget and asks iOS to redraw it. */
export function syncWidget(snapshot: WidgetSnapshot) {
  const s = getStorage();
  if (!s || !StorageClass) return;
  try {
    s.set('snapshot', JSON.stringify(snapshot));
    StorageClass.reloadWidget();
  } catch (e) {
    console.warn('Widget update failed', e);
  }
}
