'use client';

import { useEffect, useRef } from 'react';
import { loadLeaflet } from '@/lib/leaflet-loader';

export type LiveMapPin = {
  lat: number;
  lng: number;
  label?: string;
  kind?: 'home' | 'school' | 'stop' | 'other';
};

export type LiveVehicleMapProps = {
  className?: string;
  heightClassName?: string;
  mapType?: 'roadmap' | 'satellite';
  vehicleLat?: number | null;
  vehicleLng?: number | null;
  vehicleHeading?: number | null;
  vehicleLabel?: string;
  vehicleSpeedKmh?: number | null;
  pins?: LiveMapPin[];
  followVehicle?: boolean;
  emptyMessage?: string;
  /** Hide OSM/Leaflet footer attribution for a clean map chrome (default true). */
  hideAttribution?: boolean;
  showZoom?: boolean;
};

function pinColor(kind?: LiveMapPin['kind']) {
  if (kind === 'home') return '#10b981';
  if (kind === 'school') return '#4f46e5';
  if (kind === 'stop') return '#f59e0b';
  return '#64748b';
}

function pinShort(kind?: LiveMapPin['kind']) {
  if (kind === 'home') return 'HOME';
  if (kind === 'school') return 'SCH';
  if (kind === 'stop') return 'STOP';
  return 'PIN';
}

/**
 * Shared Leaflet map for live vehicle tracking (parent + school + escort surfaces).
 */
export default function LiveVehicleMap({
  className = '',
  heightClassName = 'h-[340px] sm:h-[420px]',
  mapType = 'roadmap',
  vehicleLat = null,
  vehicleLng = null,
  vehicleHeading = 0,
  vehicleLabel = 'Vehicle',
  vehicleSpeedKmh = null,
  pins = [],
  followVehicle = true,
  emptyMessage = 'Waiting for live GPS coordinates…',
  hideAttribution = true,
  showZoom = true,
}: LiveVehicleMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const markersRef = useRef<any>(null);
  const vehicleMarkerRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const lastCenterKeyRef = useRef<string>('');

  // Init map once
  useEffect(() => {
    let cancelled = false;

    if (typeof document !== 'undefined' && !document.getElementById('live-vehicle-map-ping-keyframes')) {
      const style = document.createElement('style');
      style.id = 'live-vehicle-map-ping-keyframes';
      style.textContent = `@keyframes ping{75%,100%{transform:scale(1.6);opacity:0}}`;
      document.head.appendChild(style);
    }

    loadLeaflet()
      .then((L) => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        leafletRef.current = L;

        const seedLat =
          vehicleLat != null
            ? Number(vehicleLat)
            : pins.find((p) => p.lat != null)?.lat ?? 6.5244;
        const seedLng =
          vehicleLng != null
            ? Number(vehicleLng)
            : pins.find((p) => p.lng != null)?.lng ?? 3.3792;

        const map = L.map(containerRef.current, {
          center: [seedLat, seedLng],
          zoom: 13,
          zoomControl: false,
          attributionControl: !hideAttribution,
        });
        if (showZoom) {
          L.control.zoom({ position: 'topright' }).addTo(map);
        }

        const tileUrl =
          mapType === 'satellite'
            ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

        tileLayerRef.current = L.tileLayer(tileUrl, {
          attribution: hideAttribution
            ? ''
            : mapType === 'satellite'
              ? '© Esri'
              : '© OpenStreetMap',
          maxZoom: 19,
        }).addTo(map);
        markersRef.current = L.layerGroup().addTo(map);
        mapRef.current = map;

        // Force size recalc after layout (parent cards often mount at 0 height briefly)
        requestAnimationFrame(() => {
          try {
            map.invalidateSize();
          } catch {
            /* ignore */
          }
        });
        setTimeout(() => {
          try {
            map.invalidateSize();
          } catch {
            /* ignore */
          }
        }, 250);
      })
      .catch((err) => {
        console.warn('[LiveVehicleMap] Leaflet load failed:', err);
      });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      vehicleMarkerRef.current = null;
      markersRef.current = null;
      tileLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once; mapType/pins handled below
  }, []);

  // Swap basemap when mapType changes
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }

    const tileUrl =
      mapType === 'satellite'
        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    tileLayerRef.current = L.tileLayer(tileUrl, {
      attribution: hideAttribution
        ? ''
        : mapType === 'satellite'
          ? '© Esri'
          : '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);
  }, [mapType, hideAttribution]);

  // Draw static pins + vehicle marker
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const group = markersRef.current;
    if (!L || !map || !group) return;

    group.clearLayers();
    vehicleMarkerRef.current = null;

    const bounds: [number, number][] = [];

    pins.forEach((pin) => {
      if (pin.lat == null || pin.lng == null) return;
      const lat = Number(pin.lat);
      const lng = Number(pin.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      bounds.push([lat, lng]);

      const color = pinColor(pin.kind);
      const icon = L.divIcon({
        className: 'live-vehicle-static-pin',
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);">
            <div style="background:${color};color:#fff;width:34px;height:34px;border-radius:9999px;border:3px solid #fff;box-shadow:0 8px 16px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center;font:800 9px/1 sans-serif;">
              ${pinShort(pin.kind)}
            </div>
            ${
              pin.label
                ? `<div style="margin-top:3px;background:#0f172a;color:#fff;font:800 10px/1.2 sans-serif;padding:2px 8px;border-radius:6px;white-space:nowrap;border:1px solid #334155;">${pin.label}</div>`
                : ''
            }
          </div>
        `,
        iconSize: [40, 56],
        iconAnchor: [20, 56],
      });
      L.marker([lat, lng], { icon }).addTo(group);
    });

    const hasVehicle =
      vehicleLat != null &&
      vehicleLng != null &&
      Number.isFinite(Number(vehicleLat)) &&
      Number.isFinite(Number(vehicleLng));

    if (hasVehicle) {
      const lat = Number(vehicleLat);
      const lng = Number(vehicleLng);
      bounds.push([lat, lng]);

      const heading = Number(vehicleHeading) || 0;
      const speedText =
        vehicleSpeedKmh != null && Number.isFinite(Number(vehicleSpeedKmh))
          ? ` • ${Math.round(Number(vehicleSpeedKmh))} km/h`
          : '';

      const icon = L.divIcon({
        className: 'live-vehicle-marker',
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-50%);">
            <div style="position:relative;width:48px;height:48px;display:flex;align-items:center;justify-content:center;">
              <div style="position:absolute;inset:0;border-radius:50%;background:#0ea5e9;opacity:.28;animation:ping 1.4s cubic-bezier(0,0,.2,1) infinite;"></div>
              <div style="position:relative;background:#0284c7;color:#fff;width:38px;height:38px;border-radius:12px;border:2.5px solid #fff;box-shadow:0 8px 16px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;transform:rotate(${heading}deg);">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                </svg>
              </div>
            </div>
            <div style="margin-top:2px;background:#020617;color:#fff;font:900 10px/1.2 sans-serif;padding:2px 8px;border-radius:6px;white-space:nowrap;border:1px solid #1e293b;box-shadow:0 4px 6px rgba(0,0,0,.25);">
              ${vehicleLabel || 'Vehicle'}${speedText}
            </div>
          </div>
        `,
        iconSize: [56, 64],
        iconAnchor: [28, 32],
      });

      vehicleMarkerRef.current = L.marker([lat, lng], { icon, zIndexOffset: 900 }).addTo(group);

      if (followVehicle) {
        const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
        if (lastCenterKeyRef.current !== key) {
          lastCenterKeyRef.current = key;
          map.panTo([lat, lng], { animate: true, duration: 0.6 });
        }
      }
    }

    if (bounds.length >= 2) {
      try {
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
      } catch {
        /* ignore */
      }
    } else if (bounds.length === 1 && !followVehicle) {
      map.setView(bounds[0], 14);
    }
  }, [
    pins,
    vehicleLat,
    vehicleLng,
    vehicleHeading,
    vehicleLabel,
    vehicleSpeedKmh,
    followVehicle,
  ]);

  const hasAnyCoord =
    (vehicleLat != null && vehicleLng != null) ||
    pins.some((p) => p.lat != null && p.lng != null);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-inner ${heightClassName} ${className}`}
    >
      <div
        ref={containerRef}
        className="absolute inset-0 z-0 [&_.leaflet-control-attribution]:hidden [&_.leaflet-bottom]:!hidden"
      />
      {!hasAnyCoord && (
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-10 flex justify-center">
          <div className="rounded-xl bg-slate-900/85 px-3 py-1.5 text-center text-[11px] font-medium text-white shadow-lg backdrop-blur-sm">
            {emptyMessage}
          </div>
        </div>
      )}
    </div>
  );
}
