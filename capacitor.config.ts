import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.myeduride.app',
  appName: 'MyEduRide',
  webDir: 'public',
  server: {
    // Over USB cable with adb reverse, http://localhost:3000 connects directly to your computer dev server
    url: process.env.CAPACITOR_SERVER_URL || 'https://myeduride.com',
    cleartext: true,
    allowNavigation: [
      'myeduride.com',
      '*.myeduride.com',
      'localhost',
      'localhost:*',
      '127.0.0.1:*',
      '10.0.2.2:*',
      '192.168.*.*'
    ],
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK',
    },
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
  ios: {
    contentInset: 'always',
    allowsLinkPreview: false,
    scrollEnabled: true,
  },
};

export default config;
