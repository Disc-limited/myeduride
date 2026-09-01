'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TelemetryPoint } from '@/lib/types/tracking-types';

export type GeolocationPermissionState = 'prompt' | 'granted' | 'denied' | 'unavailable';

interface UseEscortTelemetryOptions {
  sessionId?: string;
  schoolId?: string;
  vehicleId?: string;
  isActive: boolean;
  currentStopIndex?: number;
  onPositionUpdate?: (point: TelemetryPoint) => void;
  onError?: (errorMessage: string, code?: number) => void;
}

export function useEscortTelemetryTracker({
  sessionId,
  schoolId,
  vehicleId,
  isActive,
  currentStopIndex = 0,
  onPositionUpdate,
  onError,
}: UseEscortTelemetryOptions) {
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [permissionState, setPermissionState] = useState<GeolocationPermissionState>('prompt');
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState(0);
  const [currentHeading, setCurrentHeading] = useState(0);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [lastPingAt, setLastPingAt] = useState<string | null>(null);
  const [pingCount, setPingCount] = useState(0);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);

  const watchIdRef = useRef<number | null>(null);
  const lastBroadcastTimeRef = useRef<number>(0);
  const lastDbSyncTimeRef = useRef<number>(0);
  const lastErrorMessageRef = useRef<string | null>(null);
  const wakeLockRef = useRef<any>(null);

  // Ref-stabilized callbacks to prevent unnecessary effect teardown / re-execution loops
  const onPositionUpdateRef = useRef(onPositionUpdate);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onPositionUpdateRef.current = onPositionUpdate;
  }, [onPositionUpdate]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const supabase = createClient();

  // Battery status listener
  useEffect(() => {
    if (typeof window !== 'undefined' && 'getBattery' in navigator) {
      (navigator as any)
        .getBattery()
        .then((battery: any) => {
          setBatteryLevel(Math.round(battery.level * 100));
          battery.addEventListener('levelchange', () => {
            setBatteryLevel(Math.round(battery.level * 100));
          });
        })
        .catch(() => {});
    }
  }, []);

  // Screen Wake Lock handler to prevent phone from sleeping while navigating
  const requestWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator && (navigator as any).wakeLock) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch (e) {
      // Wake lock not supported or denied
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  }, []);

  // Manual retry trigger
  const retryLocationAccess = useCallback(() => {
    lastErrorMessageRef.current = null;
    setPermissionState('prompt');
    setRetryTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!isActive || !sessionId) {
      setIsBroadcasting(false);
      releaseWakeLock();
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setPermissionState('unavailable');
      if (lastErrorMessageRef.current !== 'unavailable') {
        lastErrorMessageRef.current = 'unavailable';
        onErrorRef.current?.('Geolocation is not supported by your browser.', 0);
      }
      return;
    }

    // Query browser permission status if supported (Chrome, Edge, Firefox)
    if ('permissions' in navigator && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((permissionStatus) => {
          setPermissionState(permissionStatus.state as GeolocationPermissionState);
          permissionStatus.onchange = () => {
            setPermissionState(permissionStatus.state as GeolocationPermissionState);
            if (permissionStatus.state === 'granted') {
              lastErrorMessageRef.current = null;
            }
          };
        })
        .catch(() => {
          // Permissions API query not supported on some WebKit/Safari versions
        });
    }

    requestWakeLock();
    setIsBroadcasting(true);

    // Setup Supabase Realtime Broadcast Channels
    const sessionChannel = supabase.channel(`tracking:session_${sessionId}`, {
      config: { broadcast: { self: false } },
    });
    sessionChannel.subscribe();

    const schoolChannel = schoolId
      ? supabase.channel(`tracking:school_${schoolId}`, { config: { broadcast: { self: false } } }).subscribe()
      : null;

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        setPermissionState('granted');
        lastErrorMessageRef.current = null;

        const now = Date.now();
        const accuracy = pos.coords.accuracy;
        const speedKmh = pos.coords.speed !== null && pos.coords.speed >= 0 ? pos.coords.speed * 3.6 : 0;
        const heading = pos.coords.heading || 0;

        // Discard erratic jitter (e.g. accuracy worse than 45m)
        if (accuracy > 45) {
          return;
        }

        // Adaptive ping throttle: 3.5s when driving (> 8 km/h), 8s when stationary
        const minThrottleMs = speedKmh > 8 ? 3500 : 8000;
        if (now - lastBroadcastTimeRef.current < minThrottleMs) {
          return;
        }
        lastBroadcastTimeRef.current = now;

        const telemetryPoint: TelemetryPoint = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          speedKmh: Math.round(speedKmh * 10) / 10,
          heading: Math.round(heading),
          accuracyMeters: Math.round(accuracy),
          batteryLevel: batteryLevel ?? undefined,
          timestamp: new Date().toISOString(),
        };

        setCurrentSpeedKmh(telemetryPoint.speedKmh);
        setCurrentHeading(telemetryPoint.heading);
        setGpsAccuracy(telemetryPoint.accuracyMeters || 0);
        setLastPingAt(telemetryPoint.timestamp);
        setPingCount((prev) => prev + 1);
        onPositionUpdateRef.current?.(telemetryPoint);

        // 1. Fast Ephemeral WebSocket Broadcast (Sub-second latency)
        sessionChannel.send({
          type: 'broadcast',
          event: 'telemetry_ping',
          payload: {
            ...telemetryPoint,
            sessionId,
            vehicleId,
            currentStopIndex,
          },
        });

        if (schoolChannel) {
          schoolChannel.send({
            type: 'broadcast',
            event: 'fleet_vehicle_ping',
            payload: {
              ...telemetryPoint,
              sessionId,
              vehicleId,
              currentStopIndex,
            },
          });
        }

        // 2. Periodic Database Sync (every ~16 seconds)
        if (now - lastDbSyncTimeRef.current > 16000) {
          lastDbSyncTimeRef.current = now;
          try {
            await supabase
              .from('vehicle_active_sessions')
              .update({
                current_lat: telemetryPoint.lat,
                current_lng: telemetryPoint.lng,
                current_speed_kmh: telemetryPoint.speedKmh,
                current_heading: telemetryPoint.heading,
                current_stop_index: currentStopIndex,
                gps_accuracy_meters: telemetryPoint.accuracyMeters,
                battery_level: batteryLevel,
                last_ping_at: telemetryPoint.timestamp,
              })
              .eq('id', sessionId);
          } catch (dbErr) {
            console.error('Failed to sync telemetry to DB:', dbErr);
          }
        }
      },
      (error) => {
        // Handle Error States Gracefully
        if (error.code === 1) {
          // PERMISSION_DENIED: Instantly stop watching to prevent repeated errors / battery drain
          setPermissionState('denied');
          if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
          }
        } else if (error.code === 2) {
          // POSITION_UNAVAILABLE
          setPermissionState('unavailable');
        }

        // Deduplicate error notifications
        const errKey = `${error.code}:${error.message}`;
        if (lastErrorMessageRef.current !== errKey) {
          lastErrorMessageRef.current = errKey;
          onErrorRef.current?.(error.message, error.code);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 2000,
      }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      releaseWakeLock();
      sessionChannel.unsubscribe();
      schoolChannel?.unsubscribe();
      setIsBroadcasting(false);
    };
  }, [
    isActive,
    sessionId,
    schoolId,
    vehicleId,
    currentStopIndex,
    batteryLevel,
    retryTrigger,
    requestWakeLock,
    releaseWakeLock,
  ]);

  return {
    isBroadcasting,
    permissionState,
    hasPermissionError: permissionState === 'denied' || permissionState === 'unavailable',
    currentSpeedKmh,
    currentHeading,
    gpsAccuracy,
    lastPingAt,
    pingCount,
    batteryLevel,
    retryLocationAccess,
  };
}
