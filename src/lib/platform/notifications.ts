/**
 * MyEduRide Cross-Platform Push Notification Bridge
 * Registers APNs / FCM tokens in native mobile environments,
 * and maintains compatibility with Web Push (VAPID).
 */

import { isNativePlatform } from './device';

export interface MobilePushRegistration {
  token: string;
  platform: 'android' | 'ios';
}

export async function requestMobilePushPermissions(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  if (isNativePlatform()) {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      const status = await PushNotifications.checkPermissions();
      if (status.receive === 'granted') return true;

      const requested = await PushNotifications.requestPermissions();
      return requested.receive === 'granted';
    } catch (err) {
      console.error('[Push] Failed to check/request native permissions:', err);
      return false;
    }
  }

  // Web Push permissions
  if ('Notification' in window) {
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  }

  return false;
}

export async function registerMobilePushNotifications(
  onTokenReceived?: (token: string) => void
): Promise<void> {
  if (!isNativePlatform()) return;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const granted = await requestMobilePushPermissions();
    if (!granted) {
      console.warn('[Push] Push permissions denied by user');
      return;
    }

    await PushNotifications.register();

    // Token listener
    await PushNotifications.addListener('registration', (token) => {
      console.log('[Push] Native Push Registration Token:', token.value);
      if (onTokenReceived) {
        onTokenReceived(token.value);
      }
      // Proactively post token to server endpoint if desired
      fetch('/api/user/push-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token.value,
          platform: (window as any).Capacitor?.getPlatform?.() || 'mobile',
        }),
      }).catch(() => {});
    });

    // Error listener
    await PushNotifications.addListener('registrationError', (error) => {
      console.error('[Push] Native Push Registration Error:', error);
    });

    // Foreground notification listener
    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[Push] Notification received in foreground:', notification);
    });

    // Action performance listener
    await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('[Push] Notification action performed:', notification);
    });
  } catch (err) {
    console.error('[Push] Native registration setup failed:', err);
  }
}
