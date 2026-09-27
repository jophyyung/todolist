/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'TodoWidget',
  displayName: 'To-Do',
  deploymentTarget: '17.0',
  colors: {
    $accent: '#208AEF',
    $widgetBackground: { light: '#FFFFFF', dark: '#1C1C1E' },
  },
  entitlements: {
    // Shared with the app (see app.json) so the widget can read the task snapshot.
    'com.apple.security.application-groups': config.ios.entitlements['com.apple.security.application-groups'],
  },
});
