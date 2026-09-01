'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TelemetryPoint } from '@/lib/types/tracking-types';

interface UseEscortTelemetryOptions {
  sessionId?: string;
  schoolId?: string;
  vehicleId?: string;
  isActive: boolean;
  currentStopIndex?: number;
  onPositionUpdate?: (point: TelemetryPoint) => void;
  onError?: (errorMessage: string) => void;
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
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState(0);
  const [currentHeading, setCurrentHeading] = useState(0);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [lastPingAt, setLastPingAt] = useState<string | null>(null);
  const [pingCount, setPingCount] = useState(0);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const lastBroadcastTimeRef = useRef<number>(0);
  const lastDbSyncTimeRef = useRef<number>(0);
  const wakeLockRef = useRef<any>(null);
  const supabase = createClient();

  // Battery status listener
  useEffect(() => {
    if (typeof window !== 'undefined' && 'getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setBatteryLevel(Math.round(battery.level * 100));
        battery.addEventListener('levelchange', () => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
      }).catch(() => {});
    }
  }, []);

  // Screen Wake Lock handler to prevent phone from going to sleep while navigating
  const requestWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator && (navigator as any).wakeLock) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch (e) {
      console.warn('Screen WakeLock request skipped or failed:', e);
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
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

    if (!('geolocation' in navigator)) {
      onError?.('Geolocation is not supported by this browser.');
      return;
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
        const now = Date.now();
        const accuracy = pos.coords.accuracy;
        const speedKmh = pos.coords.speed !== null && pos.coords.speed >= 0 ? pos.coords.speed * 3.6 : 0;
        const heading = pos.coords.heading || 0;

        // Discard erratic jitter (e.g. accuracy worse than 40m)
        if (accuracy > 40) {
          console.warn('GPS reading discarded due to low accuracy (>40m):', accuracy);
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
        onPositionUpdate?.(telemetryPoint);

        // 1. Fast Ephemeral WebSocket Broadcast (Sub-second latency to Parent & School Admin)
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

        // 2. Periodic Database Sync (every ~16 seconds) to prevent DB write contention
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
        console.error('Geolocation watch error:', error);
        onError?.(error.message);
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
    onPositionUpdate,
    onError,
    requestWakeLock,
    releaseWakeLock,
  ]);

  return {
    isBroadcasting,
    currentSpeedKmh,
    currentHeading,
    gpsAccuracy,
    lastPingAt,
    pingCount,
    batteryLevel,
  };
}
