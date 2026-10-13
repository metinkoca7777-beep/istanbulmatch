import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Permanent once the app is published on Google Play.
  appId: 'com.kolomp.istanbulmatch',
  appName: 'İstanbul Match',
  webDir: 'dist',
  backgroundColor: '#0c1832',
  android: {
    // Game assets are all local; no mixed content or remote debugging in release.
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#0c1832',
      showSpinner: false,
    },
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK',
      backgroundColor: '#00000000',
    },
  },
};

export default config;
