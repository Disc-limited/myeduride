import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.myeduride.app',
  appName: 'MyEduRide',
  webDir: 'public',
  server: {
    // Live Cloud Server URL (updates automatically on git push)
    url: process.env.CAPACITOR_SERVER_URL || 'https://www.myeduride.com',
    cleartext: true,
    allowNavigation: [
      'myeduride.com',
      '*.myeduride.com',
      'www.myeduride.com',
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
