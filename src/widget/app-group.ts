/** The App Group as written in app.json. Sideloading tools may rename it when re-signing. */
export const BASE_APP_GROUP = 'group.com.jophy.todolist';
export const BASE_BUNDLE_ID = 'com.jophy.todolist';

/** Pulls `group.*` identifiers out of a provisioning profile (a signed plist, read as Latin-1 text). */
export function groupsInProfile(profileText: string): string[] {
  const match = /<key>com\.apple\.security\.application-groups<\/key>\s*<array>([\s\S]*?)<\/array>/.exec(profileText);
  if (!match) return [];
  return [...match[1].matchAll(/<string>\s*(group\.[^<\s]+)\s*<\/string>/g)].map((m) => m[1]);
}

/**
 * Every App Group the shared snapshot might live in, best guess first:
 * the groups the signing profile actually grants (AltStore renames them, e.g. `group.com.jophy.todolist.TEAMID`),
 * then one derived from a renamed bundle id, then the original.
 */
export function appGroupCandidates(profileGroups: string[], bundleId: string | null): string[] {
  // Take every granted group as-is: sideloaders don't agree on a naming scheme.
  const out = [...profileGroups];
  if (bundleId && bundleId !== BASE_BUNDLE_ID) {
    if (bundleId.startsWith(`${BASE_BUNDLE_ID}.`)) out.push(BASE_APP_GROUP + bundleId.slice(BASE_BUNDLE_ID.length));
    out.push(`group.${bundleId}`);
  }
  out.push(BASE_APP_GROUP);
  return [...new Set(out)];
}

export function latin1(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return s;
}
