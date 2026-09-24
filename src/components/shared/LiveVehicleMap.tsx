'use client';

import { useState, useEffect, useRef } from 'react';
import { loadLeaflet } from '@/lib/leaflet-loader';
import { VehicleMotionAnimator, MotionPoint } from '@/lib/navigation/vehicle-motion-engine';
import { LatLngPoint } from '@/lib/navigation/road-router';

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
  routeCoordinates?: Array<{ lat: number; lng: number }>;
  followVehicle?: boolean;
  emptyMessage?: string;
  centerPinKind?: 'home' | 'school' | 'stop';
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

function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);

  const brng = toDeg(Math.atan2(y, x));
  return Math.round((brng + 360) % 360);
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
  routeCoordinates,
  followVehicle = true,
  emptyMessage = 'Waiting for live GPS coordinates…',
  centerPinKind,
  hideAttribution = true,
  showZoom = true,
}: LiveVehicleMapProps) {
  const [isMapReady, setIsMapReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const pinsGroupRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const vehicleLayerRef = useRef<any>(null);
  const vehicleMarkerRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const lastCenterKeyRef = useRef<string>('');
  const hasInitialFitRef = useRef<boolean>(false);
  const prevCoordRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastCalculatedBearingRef = useRef<number>(0);
  const animatorRef = useRef<VehicleMotionAnimator | null>(null);
  const followVehicleRef = useRef<boolean>(followVehicle);
  const lastPanTimeRef = useRef<number>(0);

  useEffect(() => {
    followVehicleRef.current = followVehicle;
  }, [followVehicle]);

  // Init map once
  useEffect(() => {
    let cancelled = false;

    if (typeof document !== 'undefined' && !document.getElementById('live-vehicle-map-styles')) {
      const style = document.createElement('style');
      style.id = 'live-vehicle-map-styles';
      style.textContent = `
        @keyframes liveVehiclePing {
          75%, 100% {
            transform: scale(1.6);
            opacity: 0;
          }
        }
        .live-vehicle-marker {
          will-change: transform;
          overflow: visible !important;
        }
        .live-vehicle-inner-icon {
          will-change: transform;
        }
      `;
      document.head.appendChild(style);
    }

    loadLeaflet()
      .then((L) => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        leafletRef.current = L;

        const schoolOrHomePin = pins.find((p) => p.kind === 'school' && p.lat != null) || pins.find((p) => p.lat != null);
        const focalSeed = centerPinKind ? pins.find((p) => p.kind === centerPinKind && p.lat != null) : null;
        const seedLat =
          vehicleLat != null
            ? Number(vehicleLat)
            : (focalSeed?.lat != null ? Number(focalSeed.lat) : (schoolOrHomePin?.lat ?? 6.5655));
        const seedLng =
          vehicleLng != null
            ? Number(vehicleLng)
            : (focalSeed?.lng != null ? Number(focalSeed.lng) : (schoolOrHomePin?.lng ?? 3.2931));

        const map = L.map(containerRef.current, {
          center: [seedLat, seedLng],
          zoom: 14,
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

        // Separate layer groups in order: Route Polyline -> Static stops -> Live Vehicle (topmost)
        routeLayerRef.current = L.layerGroup().addTo(map);
        pinsGroupRef.current = L.layerGroup().addTo(map);
        vehicleLayerRef.current = L.layerGroup().addTo(map);
        mapRef.current = map;

        const animator = new VehicleMotionAnimator((pos: MotionPoint) => {
          if (!vehicleMarkerRef.current) return;
          vehicleMarkerRef.current.setLatLng([pos.lat, pos.lng]);
          const markerEl = vehicleMarkerRef.current.getElement();
          if (markerEl) {
            const innerIcon = markerEl.querySelector('.live-vehicle-inner-icon') as HTMLElement | null;
            if (innerIcon) {
              innerIcon.style.transform = `rotate(${pos.heading}deg)`;
            }
          }
          if (followVehicleRef.current && mapRef.current) {
            const now = performance.now();
            if (now - lastPanTimeRef.current > 350) {
              lastPanTimeRef.current = now;
              mapRef.current.panTo([pos.lat, pos.lng], { animate: true, duration: 0.35 });
            }
          }
        });
        animatorRef.current = animator;

        setIsMapReady(true);

        // Force size recalc after layout
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
      setIsMapReady(false);
      if (animatorRef.current) {
        animatorRef.current.stop();
        animatorRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      vehicleMarkerRef.current = null;
      pinsGroupRef.current = null;
      routeLayerRef.current = null;
      vehicleLayerRef.current = null;
      tileLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // LAYER 1: Static Route Pins (School, Homes, Stops)
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const group = pinsGroupRef.current;
    if (!L || !map || !group) return;

    group.clearLayers();

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
            <div style="background:${color};color:#fff;width:30px;height:30px;border-radius:9999px;border:2.5px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;font:800 8.5px/1 sans-serif;">
              ${pinShort(pin.kind)}
            </div>
            ${
              pin.label
                ? `<div style="margin-top:2px;background:#0f172a;color:#fff;font:700 9.5px/1.2 sans-serif;padding:2px 7px;border-radius:5px;white-space:nowrap;border:1px solid #334155;box-shadow:0 2px 6px rgba(0,0,0,0.25);">${pin.label}</div>`
                : ''
            }
          </div>
        `,
        iconSize: [36, 50],
        iconAnchor: [18, 50],
      });
      L.marker([lat, lng], { icon }).addTo(group);
    });

    // Dynamic centering when not actively following vehicle
    if (!followVehicleRef.current || vehicleLat == null) {
      if (centerPinKind) {
        const focal = pins.find((p) => p.kind === centerPinKind && p.lat != null && p.lng != null);
        if (focal) {
          map.setView([Number(focal.lat), Number(focal.lng)], 16);
          return;
        }
      }

      if (bounds.length >= 2) {
        try {
          map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
        } catch {
          /* ignore */
        }
      } else if (bounds.length === 1) {
        map.setView(bounds[0], 15);
      }
    }
  }, [isMapReady, pins, centerPinKind]);

  // LAYER 2: Bolt Active Route Polyline Path (Signature Vibrant Green Corridor)
  useEffect(() => {
    const L = leafletRef.current;
    const group = routeLayerRef.current;
    if (!L || !group) return;

    group.clearLayers();

    const points: [number, number][] = [];

    // Priority 1: Explicit routeCoordinates passed (validate geographic relevance to vehicle/pins)
    if (routeCoordinates && routeCoordinates.length >= 2) {
      const refLat = vehicleLat != null ? Number(vehicleLat) : (pins[0]?.lat != null ? Number(pins[0].lat) : null);
      const refLng = vehicleLng != null ? Number(vehicleLng) : (pins[0]?.lng != null ? Number(pins[0].lng) : null);

      let isGeographicallyRelevant = true;
      if (refLat != null && refLng != null) {
        // Ensure at least one coordinate is within 8km
        isGeographicallyRelevant = routeCoordinates.some((pt) => {
          if (pt.lat == null || pt.lng == null) return false;
          const dLat = (Number(pt.lat) - refLat) * 111.1;
          const dLng = (Number(pt.lng) - refLng) * 111.1 * Math.cos((refLat * Math.PI) / 180);
          return Math.hypot(dLat, dLng) <= 8;
        });
      }

      if (isGeographicallyRelevant) {
        routeCoordinates.forEach((pt) => {
          if (pt.lat != null && pt.lng != null && Number.isFinite(Number(pt.lat)) && Number.isFinite(Number(pt.lng))) {
            points.push([Number(pt.lat), Number(pt.lng)]);
          }
        });
      }
    }

    // Priority 2: Construct active navigation route connecting vehicle to pins
    if (points.length < 2) {
      points.length = 0;

      // Start path from live vehicle location
      if (
        vehicleLat != null &&
        vehicleLng != null &&
        Number.isFinite(Number(vehicleLat)) &&
        Number.isFinite(Number(vehicleLng))
      ) {
        points.push([Number(vehicleLat), Number(vehicleLng)]);
      }

      const homePins = pins.filter((p) => p.kind === 'home' || p.kind === 'stop');
      const schoolPins = pins.filter((p) => p.kind === 'school');
      const otherPins = pins.filter((p) => p.kind !== 'home' && p.kind !== 'stop' && p.kind !== 'school');

      [...homePins, ...schoolPins, ...otherPins].forEach((p) => {
        if (p.lat != null && p.lng != null && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))) {
          points.push([Number(p.lat), Number(p.lng)]);
        }
      });
    }

    // Priority 3: Fallback active road line running right through the vehicle on the street
    if (points.length < 2 && vehicleLat != null && vehicleLng != null && Number.isFinite(Number(vehicleLat))) {
      const vLat = Number(vehicleLat);
      const vLng = Number(vehicleLng);
      const brng = Number(vehicleHeading) || lastCalculatedBearingRef.current || 35;
      const rad = (brng * Math.PI) / 180;
      const backDist = 250; // 250m trail behind
      const fwdDist = 800;  // 800m route line ahead
      const backLat = vLat - (backDist * Math.cos(rad)) / 111320;
      const backLng = vLng - (backDist * Math.sin(rad)) / (111320 * Math.cos((vLat * Math.PI) / 180));
      const fwdLat = vLat + (fwdDist * Math.cos(rad)) / 111320;
      const fwdLng = vLng + (fwdDist * Math.sin(rad)) / (111320 * Math.cos((vLat * Math.PI) / 180));

      points.length = 0;
      points.push([backLat, backLng]);
      points.push([vLat, vLng]);
      points.push([fwdLat, fwdLng]);
    }

    if (points.length >= 2) {
      const latLngPoints: LatLngPoint[] = points.map(([pLat, pLng]) => ({ lat: pLat, lng: pLng }));
      animatorRef.current?.setRoute(
        latLngPoints,
        vehicleLat != null && vehicleLng != null
          ? { lat: Number(vehicleLat), lng: Number(vehicleLng) }
          : undefined
      );

      // 1. Soft glowing emerald route halo (signature Bolt style)
      L.polyline(points, {
        color: '#34D186',
        weight: 10,
        opacity: 0.38,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(group);

      // 2. Crisp high-visibility Bolt transit path directly under vehicle
      L.polyline(points, {
        color: '#00D665',
        weight: 5,
        opacity: 0.98,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(group);
    }
  }, [isMapReady, pins, routeCoordinates, vehicleLat, vehicleLng, vehicleHeading]);

  // LAYER 3: Dynamic Live Bolt Vehicle Marker with Auto-Road Bearing & GPU Gliding
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const group = vehicleLayerRef.current;
    if (!L || !map || !group) return;

    const hasValidCoord =
      vehicleLat != null &&
      vehicleLng != null &&
      Number.isFinite(Number(vehicleLat)) &&
      Number.isFinite(Number(vehicleLng));

    if (!hasValidCoord) {
      if (vehicleMarkerRef.current) {
        group.removeLayer(vehicleMarkerRef.current);
        vehicleMarkerRef.current = null;
      }
      return;
    }

    const lat = Number(vehicleLat);
    const lng = Number(vehicleLng);

    // Calculate dynamic road bearing if vehicle is moving
    let heading = Number(vehicleHeading) || 0;
    const prev = prevCoordRef.current;
    if (prev) {
      const distM = Math.hypot(
        (lat - prev.lat) * 111320,
        (lng - prev.lng) * 111320 * Math.cos((lat * Math.PI) / 180)
      );
      if (distM >= 1.2) {
        const calculated = calculateBearing(prev.lat, prev.lng, lat, lng);
        if (Number.isFinite(calculated)) {
          lastCalculatedBearingRef.current = calculated;
          if (!heading || heading === 0) {
            heading = calculated;
          }
        }
      } else if (!heading || heading === 0) {
        heading = lastCalculatedBearingRef.current;
      }
    }
    prevCoordRef.current = { lat, lng };

    const speedText =
      vehicleSpeedKmh != null && Number.isFinite(Number(vehicleSpeedKmh)) && Number(vehicleSpeedKmh) > 1
        ? ` • ${Math.round(Number(vehicleSpeedKmh))} km/h`
        : '';
    const labelText = `${vehicleLabel || 'Vehicle'}${speedText}`;

    /**
     * Authentic Bolt Top-Down 3D Vehicle Icon:
     * - Embedded directly on the road corridor, scaled to 22x40px to match standard street lane width
     * - Dark obsidian chassis with metallic silver contours (#0F172A & #1E293B)
     * - Aerodynamic curved windshield & tinted glass panels
     * - Twin LED projector headlights with ambient forward road beam
     * - Twin ruby-red taillights
     * - Centered directly on [lat, lng] (iconAnchor: [11, 20])
     * - Compact micro badge positioned neatly below without covering adjacent streets
     */
    const createVehicleIcon = (h: number, lbl: string) => {
      return L.divIcon({
        className: 'live-vehicle-marker',
        html: `
          <div style="position:relative;width:22px;height:40px;display:flex;align-items:center;justify-content:center;pointer-events:none;">
            <!-- Rotating Car Body (embedded directly on the road path) -->
            <div class="live-vehicle-inner-icon" style="position:absolute;width:22px;height:40px;display:flex;align-items:center;justify-content:center;transform:rotate(${h}deg);transform-origin:50% 50%;">
              <svg width="22" height="40" viewBox="0 0 40 72" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 5px rgba(0,0,0,0.45));">
                <defs>
                  <!-- Dual Forward Headlight Road Beam -->
                  <linearGradient id="boltHeadlightBeam" x1="0%" y1="100%" x2="0%" y2="0%">
                    <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.4"/>
                    <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
                  </linearGradient>
                  <!-- Crisp Pearl White / Platinum Metallic Car Body (Bolt/Uber style) -->
                  <linearGradient id="boltCarBody" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#FFFFFF"/>
                    <stop offset="30%" stop-color="#F8FAFC"/>
                    <stop offset="70%" stop-color="#E2E8F0"/>
                    <stop offset="100%" stop-color="#CBD5E1"/>
                  </linearGradient>
                  <!-- Tinted Glass Reflection -->
                  <linearGradient id="boltGlassGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#1E293B"/>
                    <stop offset="100%" stop-color="#090D16"/>
                  </linearGradient>
                  <!-- Windshield Cyan Sheen -->
                  <linearGradient id="boltSheen" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.45"/>
                    <stop offset="100%" stop-color="#38BDF8" stop-opacity="0.05"/>
                  </linearGradient>
                </defs>

                <!-- Forward Headlight Illuminations onto Asphalt -->
                <polygon points="10,12 2,0 16,0" fill="url(#boltHeadlightBeam)"/>
                <polygon points="30,12 24,0 38,0" fill="url(#boltHeadlightBeam)"/>

                <!-- Rubber Tires -->
                <rect x="3" y="16" width="3.5" height="11" rx="1.75" fill="#0A0E17"/>
                <rect x="33.5" y="16" width="3.5" height="11" rx="1.75" fill="#0A0E17"/>
                <rect x="3" y="47" width="3.5" height="11" rx="1.75" fill="#0A0E17"/>
                <rect x="33.5" y="47" width="3.5" height="11" rx="1.75" fill="#0A0E17"/>

                <!-- Side-view Mirrors (Pearl White with dark outline) -->
                <path d="M5 23 C2.5 22 2.5 26 5 27 Z" fill="#F8FAFC" stroke="#475569" stroke-width="0.6"/>
                <path d="M35 23 C37.5 22 37.5 26 35 27 Z" fill="#F8FAFC" stroke="#475569" stroke-width="0.6"/>

                <!-- Aerodynamic Sedan Chassis (Pearl White with Charcoal definition for maximum road visibility) -->
                <path d="M20 9 C13 9 9 14 8 22 C7 31 7 46 8 57 C9 64 13 67 20 67 C27 67 31 64 32 57 C33 46 33 31 32 22 C31 14 27 9 20 9 Z" fill="url(#boltCarBody)" stroke="#334155" stroke-width="1.3"/>

                <!-- Subtle Hood Crease Lines -->
                <path d="M15 13 C17 11 23 11 25 13" stroke="#CBD5E1" stroke-width="0.8" fill="none"/>

                <!-- Bolt Emerald Identity Accent Line along sides -->
                <path d="M9 26 C9 40 9 48 10 54" stroke="#00D665" stroke-width="1.2" opacity="0.95" stroke-linecap="round"/>
                <path d="M31 26 C31 40 31 48 30 54" stroke="#00D665" stroke-width="1.2" opacity="0.95" stroke-linecap="round"/>

                <!-- Front Windshield (Deep Tinted Glass with Sheen) -->
                <path d="M12 20 C15 17 25 17 28 20 L27 30 C23 28 17 28 13 30 Z" fill="url(#boltGlassGradient)"/>
                <path d="M13 21 C16 18 24 18 27 21 L26 25 C22 24 18 24 14 25 Z" fill="url(#boltSheen)"/>

                <!-- Panoramic Tinted Glass Roof Panel -->
                <path d="M13.5 31 C17 29.5 23 29.5 26.5 31 L26 47 C23 48 17 48 14 47 Z" fill="#0F172A" stroke="#1E293B" stroke-width="0.5"/>
                <line x1="15" y1="38" x2="25" y2="38" stroke="#334155" stroke-width="0.8"/>

                <!-- Rear Windshield -->
                <path d="M14 49 C17 48 23 48 26 49 L27 55 C23 57 17 57 13 55 Z" fill="url(#boltGlassGradient)"/>

                <!-- Front LED Projector Headlights -->
                <ellipse cx="11.5" cy="11.5" rx="2.5" ry="1.5" fill="#FFFFFF"/>
                <ellipse cx="28.5" cy="11.5" rx="2.5" ry="1.5" fill="#FFFFFF"/>
                <ellipse cx="11.5" cy="11.5" rx="1.2" ry="0.8" fill="#FDE047"/>
                <ellipse cx="28.5" cy="11.5" rx="1.2" ry="0.8" fill="#FDE047"/>

                <!-- Rear LED Taillights (Vivid Ruby Red) -->
                <rect x="10" y="65" width="4.5" height="1.8" rx="0.9" fill="#EF4444"/>
                <rect x="25.5" y="65" width="4.5" height="1.8" rx="0.9" fill="#EF4444"/>
              </svg>
            </div>

            <!-- Compact Micro License/Speed Badge (Unobtrusive, fits within lane width) -->
            <div class="live-vehicle-label" style="position:absolute;top:100%;left:50%;transform:translateX(-50%);margin-top:2px;background:rgba(15,23,42,0.88);color:#fff;font:800 7.5px/1 sans-serif;padding:1.5px 5px;border-radius:4px;white-space:nowrap;border:1px solid rgba(52,209,134,0.45);box-shadow:0 2px 4px rgba(0,0,0,0.3);letter-spacing:0.2px;">
              ${lbl}
            </div>
          </div>
        `,
        iconSize: [22, 40],
        iconAnchor: [11, 20],
      });
    };

    if (!vehicleMarkerRef.current) {
      // First mount of the vehicle marker
      vehicleMarkerRef.current = L.marker([lat, lng], {
        icon: createVehicleIcon(heading, labelText),
        zIndexOffset: 950,
      }).addTo(group);

      if (!hasInitialFitRef.current) {
        hasInitialFitRef.current = true;
        map.setView([lat, lng], 15);
      }
    } else {
      // In-place label update without tearing down the marker DOM
      const markerEl = vehicleMarkerRef.current.getElement();
      if (markerEl) {
        const labelEl = markerEl.querySelector('.live-vehicle-label') as HTMLElement | null;
        if (labelEl && labelEl.textContent !== labelText) {
          labelEl.textContent = labelText;
        }
      }
    }

    // Continuous 60FPS motion interpolation along the road network
    animatorRef.current?.updateTargetPosition(
      { lat, lng },
      Number(vehicleSpeedKmh) || 0,
      heading
    );
  }, [
    isMapReady,
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
