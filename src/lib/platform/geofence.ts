/**
 * MyEduRide Geofence & Proximity Detection Engine
 * Handles perimeter boundaries for school campus gates and student homes.
 */

export interface GeofenceZone {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  metadata?: Record<string, any>;
}

export type GeofenceTransition = 'ENTER' | 'EXIT';

export interface GeofenceEvent {
  zone: GeofenceZone;
  transition: GeofenceTransition;
  distanceMeters: number;
  timestamp: number;
}

/**
 * Calculates great-circle distance between two points in meters using Haversine formula
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export class GeofenceEngine {
  private zones: Map<string, GeofenceZone> = new Map();
  private insideState: Map<string, boolean> = new Map();
  private listeners: Set<(event: GeofenceEvent) => void> = new Set();

  public registerZone(zone: GeofenceZone): void {
    this.zones.set(zone.id, zone);
    if (!this.insideState.has(zone.id)) {
      this.insideState.set(zone.id, false);
    }
  }

  public removeZone(zoneId: string): void {
    this.zones.delete(zoneId);
    this.insideState.delete(zoneId);
  }

  public onTransition(listener: (event: GeofenceEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public updateCurrentLocation(currentLat: number, currentLon: number): void {
    const now = Date.now();

    for (const [zoneId, zone] of this.zones.entries()) {
      const distance = calculateHaversineDistance(
        currentLat,
        currentLon,
        zone.latitude,
        zone.longitude
      );

      const wasInside = this.insideState.get(zoneId) || false;
      const isInside = distance <= zone.radiusMeters;

      if (!wasInside && isInside) {
        this.insideState.set(zoneId, true);
        const event: GeofenceEvent = {
          zone,
          transition: 'ENTER',
          distanceMeters: distance,
          timestamp: now,
        };
        this.emit(event);
      } else if (wasInside && !isInside) {
        this.insideState.set(zoneId, false);
        const event: GeofenceEvent = {
          zone,
          transition: 'EXIT',
          distanceMeters: distance,
          timestamp: now,
        };
        this.emit(event);
      }
    }
  }

  private emit(event: GeofenceEvent) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[GeofenceEngine] Listener error:', err);
      }
    }
  }
}

export const globalGeofenceEngine = new GeofenceEngine();
