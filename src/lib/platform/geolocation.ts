/**
 * MyEduRide Cross-Platform Geolocation Service
 * Automatically switches between Capacitor Native GPS and HTML5 navigator.geolocation.
 */

import { isNativePlatform } from './device';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number | null;
  speed?: number | null;
  heading?: number | null;
  timestamp: number;
}

export interface LocationWatchOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  /** Transit tracking profile */
  profile?: 'TRANSIT_ACTIVE' | 'STANDBY';
}

/**
 * Gets the current device GPS coordinates once.
 */
export async function getCurrentPosition(
  options?: LocationWatchOptions
): Promise<LocationCoordinates> {
  const highAccuracy = options?.enableHighAccuracy ?? true;

  if (typeof window !== 'undefined' && isNativePlatform()) {
    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: highAccuracy,
        timeout: options?.timeout || 15000,
        maximumAge: options?.maximumAge || 0,
      });

      return {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        altitude: pos.coords.altitude,
        speed: pos.coords.speed,
        heading: pos.coords.heading,
        timestamp: pos.timestamp,
      };
    } catch (err) {
      console.warn('[Geolocation] Native geolocation failed, trying web fallback:', err);
    }
  }

  // Web HTML5 fallback
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return reject(new Error('Geolocation is not supported on this device'));
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
          timestamp: pos.timestamp,
        });
      },
      (err) => reject(err),
      {
        enableHighAccuracy: highAccuracy,
        timeout: options?.timeout || 15000,
        maximumAge: options?.maximumAge || 0,
      }
    );
  });
}

/**
 * Watches continuous device GPS location with auto-clean subscription.
 */
export async function watchPosition(
  callback: (coords: LocationCoordinates) => void,
  onError?: (error: any) => void,
  options?: LocationWatchOptions
): Promise<() => void> {
  const highAccuracy = options?.enableHighAccuracy ?? (options?.profile === 'TRANSIT_ACTIVE');

  if (typeof window !== 'undefined' && isNativePlatform()) {
    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      const watchId = await Geolocation.watchPosition(
        {
          enableHighAccuracy: highAccuracy,
          timeout: options?.timeout || 15000,
          maximumAge: options?.maximumAge || 1000,
        },
        (pos, err) => {
          if (err) {
            if (onError) onError(err);
            return;
          }
          if (pos) {
            callback({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              altitude: pos.coords.altitude,
              speed: pos.coords.speed,
              heading: pos.coords.heading,
              timestamp: pos.timestamp,
            });
          }
        }
      );

      return () => {
        Geolocation.clearWatch({ id: watchId }).catch(() => {});
      };
    } catch (err) {
      console.warn('[Geolocation] Native watch failed, falling back to web:', err);
    }
  }

  // Web Fallback
  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        callback({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
          timestamp: pos.timestamp,
        });
      },
      (err) => {
        if (onError) onError(err);
      },
      {
        enableHighAccuracy: highAccuracy,
        timeout: options?.timeout || 15000,
        maximumAge: options?.maximumAge || 1000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }

  return () => {};
}
