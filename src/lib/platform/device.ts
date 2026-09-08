/**
 * MyEduRide Isomorphic Platform Device Helper
 * Safe across Web SSR, Web Browser, and Capacitor Native (Android & iOS).
 */

export type PlatformType = 'android' | 'ios' | 'web';

/**
 * Returns true if running inside a Capacitor native app wrapper (Android or iOS).
 */
export function isNativePlatform(): boolean {
  if (typeof window === 'undefined') return false;
  // Check Capacitor global or userAgent markers
  const cap = (window as any).Capacitor;
  if (cap && typeof cap.isNativePlatform === 'function') {
    return cap.isNativePlatform();
  }
  return false;
}

/**
 * Returns the exact running platform: 'android', 'ios', or 'web'
 */
export function getPlatform(): PlatformType {
  if (typeof window === 'undefined') return 'web';
  const cap = (window as any).Capacitor;
  if (cap && typeof cap.getPlatform === 'function') {
    const p = cap.getPlatform();
    if (p === 'android') return 'android';
    if (p === 'ios') return 'ios';
  }
  
  // User agent fallback
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'android';
  if (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) return 'ios';
  return 'web';
}

/**
 * Configures the mobile status bar and safe areas dynamically on mobile launch.
 */
export async function initializeNativeAppShell(): Promise<void> {
  if (!isNativePlatform()) return;

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setOverlaysWebView({ overlay: true });
  } catch (err) {
    console.warn('[Platform] Could not initialize StatusBar:', err);
  }
}
