import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Haptics } from '@capacitor/haptics';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

export const isNative = Capacitor.isNativePlatform();

/** Short vibration. Android WebView ignores navigator.vibrate, so native builds go through the Haptics plugin. */
export function buzz(ms: number){
  if (isNative){ Haptics.vibrate({ duration: ms }).catch(() => {}); return; }
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {}
}

export interface BackHandler {
  /** Return true if the back press was handled (closed a card, paused…). */
  onBack(): boolean;
  /** The app went to the background. */
  onBackground(): void;
}

/** Native-only setup: edge-to-edge status bar, splash hand-off and the Android back button. */
export async function initNative(h: BackHandler){
  if (!isNative) return;
  try {
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setStyle({ style: Style.Dark });
  } catch (e) {}
  CapApp.addListener('backButton', () => { if (!h.onBack()) CapApp.minimizeApp(); });
  CapApp.addListener('appStateChange', ({ isActive }) => { if (!isActive) h.onBackground(); });
  SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {});
}
