import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import Supercluster, { type PointFeature } from 'supercluster';

export interface SpatialClusterPoint<T = Record<string, any>> {
  id: string | number;
  lat: number;
  lng: number;
  kind?: 'home' | 'school' | 'stop' | 'escort' | 'vehicle' | 'other';
  label?: string;
  data?: T;
}

export interface UseSpatialClusterOptions<T = Record<string, any>> {
  points: SpatialClusterPoint<T>[];
  radius?: number; // Cluster radius in pixels (default: 50)
  maxZoom?: number; // Max zoom to cluster points on (default: 16)
  minPoints?: number; // Minimum points to form a cluster (default: 2)
}

export interface ClusterFeature<T = Record<string, any>> {
  type: 'Feature';
  id?: number | string;
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  properties: {
    cluster: boolean;
    cluster_id?: number;
    point_count?: number;
    point_count_abbreviated?: string;
    id?: string | number;
    kind?: string;
    label?: string;
    data?: T;
    [key: string]: any;
  };
}

/**
 * High-performance client-side spatial clustering hook based on Supercluster (QuadTree / K-D Tree).
 * Clusters large batches of pins in browser memory at 60 FPS with zero database roundtrips.
 */
export function useSpatialCluster<T = Record<string, any>>({
  points,
  radius = 50,
  maxZoom = 16,
  minPoints = 2,
}: UseSpatialClusterOptions<T>) {
  const clusterIndexRef = useRef<Supercluster<any, any> | null>(null);
  const [version, setVersion] = useState(0);

  // Re-build index whenever points change
  useEffect(() => {
    if (!points || points.length === 0) {
      clusterIndexRef.current = null;
      setVersion((v) => v + 1);
      return;
    }

    const validFeatures: PointFeature<any>[] = [];

    for (const p of points) {
      if (p.lat == null || p.lng == null) continue;
      const lat = Number(p.lat);
      const lng = Number(p.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      validFeatures.push({
        type: 'Feature',
        properties: {
          id: p.id,
          kind: p.kind || 'home',
          label: p.label || '',
          data: p.data || {},
        },
        geometry: {
          type: 'Point',
          coordinates: [lng, lat], // GeoJSON order: [longitude, latitude]
        },
      });
    }

    const SuperclusterConstructor =
      ((Supercluster as any)?.default || Supercluster) as unknown as typeof Supercluster;

    const index = new SuperclusterConstructor({
      radius,
      maxZoom,
      minPoints,
    });

    index.load(validFeatures);
    clusterIndexRef.current = index;
    setVersion((v) => v + 1);
  }, [points, radius, maxZoom, minPoints]);

  /**
   * Returns clusters & points visible within the current Leaflet bounding box [west, south, east, north]
   */
  const getClusters = useCallback(
    (bbox: [number, number, number, number], zoom: number): ClusterFeature<T>[] => {
      if (!clusterIndexRef.current) return [];
      const roundedZoom = Math.min(Math.max(0, Math.floor(zoom)), 19);
      try {
        return clusterIndexRef.current.getClusters(bbox, roundedZoom) as ClusterFeature<T>[];
      } catch (err) {
        console.warn('[useSpatialCluster] getClusters error:', err);
        return [];
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version]
  );

  /**
   * Returns the zoom level required to expand a given cluster
   */
  const getClusterExpansionZoom = useCallback(
    (clusterId: number): number => {
      if (!clusterIndexRef.current) return 16;
      try {
        return clusterIndexRef.current.getClusterExpansionZoom(clusterId);
      } catch {
        return 16;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version]
  );

  /**
   * Returns the individual points inside a cluster (useful for popups/drawers)
   */
  const getClusterLeaves = useCallback(
    (clusterId: number, limit: number = 20, offset: number = 0): ClusterFeature<T>[] => {
      if (!clusterIndexRef.current) return [];
      try {
        return clusterIndexRef.current.getLeaves(clusterId, limit, offset) as ClusterFeature<T>[];
      } catch {
        return [];
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version]
  );

  return {
    getClusters,
    getClusterExpansionZoom,
    getClusterLeaves,
    isReady: clusterIndexRef.current !== null,
    totalPoints: points?.length || 0,
  };
}
