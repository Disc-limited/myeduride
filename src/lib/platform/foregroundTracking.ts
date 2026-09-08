/**
 * MyEduRide Native Foreground Tracking & Persistent Notification Service
 * Bridges Capacitor Web layer to Android Native TrackingForegroundService.
 */

import { isNativePlatform, getPlatform } from './device';
import type { PluginListenerHandle } from '@capacitor/core';

export interface LocationUpdatePayload {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number;
  speedKmh: number;
  heading: number;
  altitude?: number | null;
  timestamp: number;
}

export interface ForegroundTrackingOptions {
  title?: string;
  text?: string;
  subText?: string;
}

interface ForegroundTrackingPluginInterface {
  startTracking(options?: ForegroundTrackingOptions): Promise<{ success: boolean; status: string }>;
  stopTracking(): Promise<{ success: boolean; status: string }>;
  isTracking(): Promise<{ active: boolean }>;
  updateNotification(options: { text: string }): Promise<void>;
  addListener(
    eventName: 'locationUpdate',
    listenerFunc: (data: LocationUpdatePayload) => void
  ): Promise<PluginListenerHandle>;
}

let cachedPlugin: ForegroundTrackingPluginInterface | null = null;

async function getPlugin(): Promise<ForegroundTrackingPluginInterface | null> {
  if (typeof window === 'undefined') return null;
  if (!isNativePlatform() || getPlatform() !== 'android') return null;

  if (cachedPlugin) return cachedPlugin;

  try {
    const { registerPlugin } = await import('@capacitor/core');
    cachedPlugin = registerPlugin<ForegroundTrackingPluginInterface>('ForegroundTracking');
    return cachedPlugin;
  } catch (err) {
    console.warn('[ForegroundTracking] Could not register plugin:', err);
    return null;
  }
}

/**
 * Checks if native Android foreground tracking is available on the current device.
 */
export function isForegroundServiceSupported(): boolean {
  return isNativePlatform() && getPlatform() === 'android';
}

/**
 * Starts the native Android Foreground Service with a persistent notification
 * and continuous high-accuracy hardware GPS tracking.
 */
export async function startForegroundTracking(
  options?: ForegroundTrackingOptions
): Promise<boolean> {
  const plugin = await getPlugin();
  if (!plugin) return false;

  try {
    const res = await plugin.startTracking({
      title: options?.title || 'MyEduRide Transit Active',
      text: options?.text || 'Live GPS telemetry & student safety route active',
      subText: options?.subText || 'Real-time Vehicle Tracking',
    });
    return res?.success ?? true;
  } catch (err) {
    console.error('[ForegroundTracking] Failed to start foreground service:', err);
    return false;
  }
}

/**
 * Stops the native Android Foreground Service, releases WakeLock, and removes the persistent notification.
 */
export async function stopForegroundTracking(): Promise<boolean> {
  const plugin = await getPlugin();
  if (!plugin) return false;

  try {
    const res = await plugin.stopTracking();
    return res?.success ?? true;
  } catch (err) {
    console.warn('[ForegroundTracking] Failed to stop foreground service:', err);
    return false;
  }
}

/**
 * Checks if the foreground tracking service is currently running.
 */
export async function isForegroundTrackingActive(): Promise<boolean> {
  const plugin = await getPlugin();
  if (!plugin) return false;

  try {
    const res = await plugin.isTracking();
    return !!res?.active;
  } catch {
    return false;
  }
}

/**
 * Updates the text message in the ongoing persistent notification.
 */
export async function updateForegroundNotification(text: string): Promise<void> {
  const plugin = await getPlugin();
  if (!plugin) return;

  try {
    await plugin.updateNotification({ text });
  } catch (err) {
    // Non-critical, ignore
  }
}

/**
 * Subscribes to native location updates emitted by TrackingForegroundService.
 */
export async function addForegroundLocationListener(
  callback: (data: LocationUpdatePayload) => void
): Promise<(() => void) | null> {
  const plugin = await getPlugin();
  if (!plugin) return null;

  try {
    const handle = await plugin.addListener('locationUpdate', callback);
    return () => {
      handle.remove();
    };
  } catch (err) {
    console.warn('[ForegroundTracking] Failed to add listener:', err);
    return null;
  }
}
