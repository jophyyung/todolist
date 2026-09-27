import * as Application from 'expo-application';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { appGroupCandidates, groupsInProfile, latin1 } from './app-group';
import type { WidgetSnapshot } from './snapshot';

type Storage = { set(key: string, value: string): void };
type StorageModule = { new (group: string): Storage; reloadWidget(name?: string): void };

let StorageClass: StorageModule | null | undefined;
let groups: string[] | undefined;
/** Groups granted by the signing profile, for the diagnostics row in Settings. */
let profileGroups: string[] = [];

/** The native module only exists in the installed app, not in Expo Go. */
function getStorageClass(): StorageModule | null {
  if (StorageClass !== undefined) return StorageClass;
  StorageClass = null;
  if (Platform.OS !== 'ios') return StorageClass;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    StorageClass = require('@bacons/apple-targets').ExtensionStorage as StorageModule;
  } catch {
    StorageClass = null;
  }
  return StorageClass;
}

/** Sideloading renames the App Group, so read the real one from the signing profile in the app bundle. */
function resolveGroups(): string[] {
  if (groups) return groups;
  try {
    const profile = new File(Paths.bundle, 'embedded.mobileprovision');
    if (profile.exists) profileGroups = groupsInProfile(latin1(profile.bytesSync()));
  } catch {
    profileGroups = [];
  }
  groups = appGroupCandidates(profileGroups, Application.applicationId);
  return groups;
}

export function widgetDiagnostics(): { groups: string[]; fromProfile: string[]; available: boolean } {
  return { groups: resolveGroups(), fromProfile: profileGroups, available: getStorageClass() != null };
}

/**
 * Writes the snapshot for the lock-screen widget and asks iOS to redraw it. It goes to every
 * candidate group; the widget reads whichever one it can actually access.
 */
export function syncWidget(snapshot: WidgetSnapshot) {
  const Cls = getStorageClass();
  if (!Cls) return;
  const json = JSON.stringify(snapshot);
  for (const group of resolveGroups()) {
    try {
      new Cls(group).set('snapshot', json);
    } catch (e) {
      console.warn(`Widget update failed for ${group}`, e);
    }
  }
  try {
    Cls.reloadWidget();
  } catch (e) {
    console.warn('Widget reload failed', e);
  }
}
