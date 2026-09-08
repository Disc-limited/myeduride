/**
 * MyEduRide Cross-Platform Haptics Engine
 * Provides tactical feedback for Gate check-in, Scan success, Warnings, and Escort Alerts.
 */

import { isNativePlatform } from './device';

export type HapticNotificationType = 'SUCCESS' | 'WARNING' | 'ERROR';
export type HapticImpactStyle = 'LIGHT' | 'MEDIUM' | 'HEAVY';

export async function triggerHapticNotification(type: HapticNotificationType = 'SUCCESS'): Promise<void> {
  if (typeof window === 'undefined') return;

  if (isNativePlatform()) {
    try {
      const { Haptics, NotificationType } = await import('@capacitor/haptics');
      const capType =
        type === 'SUCCESS'
          ? NotificationType.Success
          : type === 'WARNING'
          ? NotificationType.Warning
          : NotificationType.Error;
      await Haptics.notification({ type: capType });
      return;
    } catch (err) {
      console.warn('[Haptics] Native haptics failed, falling back to vibrate:', err);
    }
  }

  // Web fallback using navigator.vibrate
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    if (type === 'SUCCESS') {
      navigator.vibrate([40, 60, 40]);
    } else if (type === 'WARNING') {
      navigator.vibrate([100, 50, 100]);
    } else {
      navigator.vibrate([200, 100, 200, 100, 200]);
    }
  }
}

export async function triggerHapticImpact(style: HapticImpactStyle = 'MEDIUM'): Promise<void> {
  if (typeof window === 'undefined') return;

  if (isNativePlatform()) {
    try {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
      const capStyle =
        style === 'LIGHT'
          ? ImpactStyle.Light
          : style === 'HEAVY'
          ? ImpactStyle.Heavy
          : ImpactStyle.Medium;
      await Haptics.impact({ style: capStyle });
      return;
    } catch (err) {
      console.warn('[Haptics] Native impact failed, falling back:', err);
    }
  }

  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(style === 'LIGHT' ? 20 : style === 'HEAVY' ? 60 : 35);
  }
}
