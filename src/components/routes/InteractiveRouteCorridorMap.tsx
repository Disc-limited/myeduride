// @ts-nocheck
'use client';

import { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Building,
  Home,
  Bus,
  Layers,
  Phone,
  Clock,
  Navigation,
  ExternalLink,
  Users,
  Compass,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { loadLeaflet } from '@/lib/leaflet-loader';

interface StudentHousePin {
  student_id: string;
  name: string;
  photo_url?: string | null;
  class?: string;
  parent_phone?: string | null;
  house_address?: string | null;
  house_lat?: number | null;
  house_lng?: number | null;
  house_landmark?: string | null;
  house_notes?: string | null;
  is_house_pinned?: boolean;
}

interface RouteStop {
  stop_number: number;
  name: string;
  landmark?: string | null;
  gps_lat?: number | null;
  gps_lng?: number | null;
  eta_morning?: string | null;
  eta_afternoon?: string | null;
}

interface SchoolLocation {
  id?: string;
  name?: string;
  address?: string | null;
  gps_lat?: number | null;
  gps_lng?: number | null;
  landmark?: string | null;
  is_pinned?: boolean;
}

interface InteractiveRouteCorridorMapProps {
  school?: SchoolLocation | null;
  routeCode?: string;
  routeName?: string;
  stops?: RouteStop[];
  students?: StudentHousePin[];
  heightClassName?: string;
  showNavigationButton?: boolean;
}

export default function InteractiveRouteCorridorMap({
  school,
  routeCode = 'ROUTE',
  routeName = 'School Transit Corridor',
  stops = [],
  students = [],
  heightClassName = 'h-[500px]',
  showNavigationButton = false,
}: InteractiveRouteCorridorMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'houses' | 'stops'>('all');
  const [selectedPin, setSelectedPin] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const pinnedStudents = students.filter((s) => s.house_lat != null && s.house_lng != null);

  useEffect(() => {
    let isMounted = true;

    loadLeaflet()
      .then((L) => {
        if (!isMounted || !mapContainerRef.current) return;

        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }

        // Center map on School, first stop, first student, or Lagos
        const defaultCenterLat =
          school?.gps_lat ||
          stops.find((s) => s.gps_lat)?.gps_lat ||
          pinnedStudents[0]?.house_lat ||
          6.4474;
        const defaultCenterLng =
          school?.gps_lng ||
          stops.find((s) => s.gps_lng)?.gps_lng ||
          pinnedStudents[0]?.house_lng ||
          3.4731;

        const map = L.map(mapContainerRef.current, {
          center: [defaultCenterLat, defaultCenterLng],
          zoom: 13,
          zoomControl: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        const markersGroup = L.featureGroup();
        const polylinePoints: [number, number][] = [];

        // 1. Render School Pin
        if (school && school.gps_lat && school.gps_lng) {
          const schoolIcon = L.divIcon({
            className: 'school-marker',
            html: `<div style="background: linear-gradient(135deg, #064e3b, #047857); color: white; width: 40px; height: 40px; border-radius: 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(0,0,0,0.35); border: 2.5px solid white; font-weight: 900;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg></div>`,
            iconSize: [40, 40],
            iconAnchor: [20, 40],
          });

          const schoolMarker = L.marker([school.gps_lat, school.gps_lng], { icon: schoolIcon }).addTo(map);
          schoolMarker.bindPopup(`
            <div style="font-family: inherit; font-size: 12px; line-height: 1.4;">
              <strong style="color: #064e3b; font-size: 13px; display: block;">🏫 ${school.name || 'School Campus'}</strong>
              <p style="margin: 3px 0 0 0; color: #475569;">📍 ${school.address || 'Campus Main Gate'}</p>
              ${school.landmark ? `<span style="font-size: 11px; color: #047857;">Landmark: ${school.landmark}</span>` : ''}
            </div>
          `);
          schoolMarker.on('click', () => {
            setSelectedPin({ type: 'school', data: school });
          });
          markersGroup.addLayer(schoolMarker);
          polylinePoints.push([school.gps_lat, school.gps_lng]);
        }

        // 2. Render Route Stops
        if (activeFilter !== 'houses') {
          stops.forEach((stop, idx) => {
            if (stop.gps_lat && stop.gps_lng) {
              const stopIcon = L.divIcon({
                className: 'stop-marker',
                html: `<div style="background: #0f172a; color: white; width: 32px; height: 32px; border-radius: 10px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.25); border: 2px solid white; font-weight: 800; font-size: 12px;">${stop.stop_number || idx + 1}</div>`,
                iconSize: [32, 32],
                iconAnchor: [16, 32],
              });

              const stopMarker = L.marker([stop.gps_lat, stop.gps_lng], { icon: stopIcon }).addTo(map);
              stopMarker.bindPopup(`
                <div style="font-family: inherit; font-size: 12px; line-height: 1.4;">
                  <strong style="color: #0f172a; font-size: 13px; display: block;">🚏 Stop #${stop.stop_number}: ${stop.name}</strong>
                  <p style="margin: 3px 0 0 0; color: #64748b;">📍 Landmark: ${stop.landmark || 'Identified Stop'}</p>
                  <p style="margin: 2px 0 0 0; color: #047857; font-weight: 700;">⏰ ETA: ${stop.eta_morning || 'Scheduled'}</p>
                </div>
              `);
              stopMarker.on('click', () => {
                setSelectedPin({ type: 'stop', data: stop });
              });
              markersGroup.addLayer(stopMarker);
              polylinePoints.push([stop.gps_lat, stop.gps_lng]);
            }
          });
        }

        // 3. Render Student House Pins
        if (activeFilter !== 'stops') {
          pinnedStudents.forEach((stu) => {
            if (stu.house_lat && stu.house_lng) {
              const houseIcon = L.divIcon({
                className: 'house-marker',
                html: `<div style="background: linear-gradient(135deg, #0d9488, #0f766e); color: white; width: 34px; height: 34px; border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(13,148,136,0.4); border: 2px solid white;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>`,
                iconSize: [34, 34],
                iconAnchor: [17, 34],
              });

              const houseMarker = L.marker([stu.house_lat, stu.house_lng], { icon: houseIcon }).addTo(map);
              const navLink = `https://www.google.com/maps/dir/?api=1&destination=${stu.house_lat},${stu.house_lng}`;

              houseMarker.bindPopup(`
                <div style="font-family: inherit; font-size: 12px; line-height: 1.4;">
                  <strong style="color: #0f766e; font-size: 13px; display: block;">🏠 ${stu.name}</strong>
                  <span style="display: block; color: #64748b; font-size: 11px;">${stu.class || 'Student'}</span>
                  <p style="margin: 3px 0 0 0; color: #334155;">📍 ${stu.house_address || 'Home Pickup'}</p>
                  ${stu.house_landmark ? `<p style="margin: 2px 0 0 0; color: #64748b; font-size: 11px;">Landmark: ${stu.house_landmark}</p>` : ''}
                  ${stu.parent_phone ? `<p style="margin: 2px 0 0 0; color: #047857; font-size: 11px; font-weight: 700;">📞 ${stu.parent_phone}</p>` : ''}
                  <a href="${navLink}" target="_blank" rel="noopener noreferrer" style="display: inline-block; margin-top: 5px; padding: 4px 8px; background: #0f766e; color: white; border-radius: 6px; text-decoration: none; font-weight: 700; font-size: 10px;">
                    🗺️ Open Navigation
                  </a>
                </div>
              `);
              houseMarker.on('click', () => {
                setSelectedPin({ type: 'student', data: stu });
              });
              markersGroup.addLayer(houseMarker);
            }
          });
        }

        // Draw connecting route corridor polyline
        if (polylinePoints.length > 1) {
          L.polyline(polylinePoints, {
            color: '#047857',
            weight: 4,
            opacity: 0.75,
            dashArray: '8, 8',
          }).addTo(map);
        }

        // Fit map bounds to encompass all pins
        if (markersGroup.getLayers().length > 0) {
          map.fitBounds(markersGroup.getBounds(), { padding: [40, 40], maxZoom: 15 });
        }

        mapInstanceRef.current = map;
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load corridor map:', err);
        setLoading(false);
      });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [school, stops, students, activeFilter]);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden font-sans space-y-3">
      {/* Map Control Bar */}
      <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black">
            <Compass size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white font-mono font-bold text-xs">{routeCode}</span>
              <h4 className="font-black text-slate-900 text-sm">{routeName}</h4>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Corridor overview showing school campus, transit stops, and parent house pins.
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeFilter === 'all' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All ({pinnedStudents.length + stops.length + (school?.is_pinned ? 1 : 0)})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('houses')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
              activeFilter === 'houses' ? 'bg-teal-700 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Home size={12} />
            <span>Houses ({pinnedStudents.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('stops')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
              activeFilter === 'stops' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Bus size={12} />
            <span>Stops ({stops.length})</span>
          </button>
        </div>
      </div>

      {/* Interactive Map Viewport */}
      <div className={`relative w-full ${heightClassName} bg-slate-100`}>
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Top Legend Badge */}
        <div className="absolute top-3 left-3 z-10 bg-white/95 backdrop-blur-xs p-2.5 rounded-2xl border border-slate-200/80 shadow-md text-xs space-y-1.5 max-w-xs">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Map Legend</span>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-md bg-emerald-700 flex items-center justify-center text-white text-[9px] font-black">🏫</span>
            <span className="font-bold text-slate-800 text-[11px]">{school?.name || 'School Gate Hub'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-md bg-slate-900 flex items-center justify-center text-white text-[9px] font-bold">1</span>
            <span className="text-slate-600 text-[11px]">Designated Corridor Stops</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-md bg-teal-600 flex items-center justify-center text-white text-[9px] font-black">🏠</span>
            <span className="text-teal-700 font-bold text-[11px]">Parent Pinned Child Houses ({pinnedStudents.length})</span>
          </div>
        </div>

        {/* Selected Pin Drawer / Popover */}
        {selectedPin && (
          <div className="absolute bottom-3 left-3 right-3 z-10 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-xl max-w-md ml-auto">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 inline-block">
                  {selectedPin.type === 'school' ? 'School Campus Terminal' : selectedPin.type === 'student' ? 'Parent Pinned House' : 'Designated Stop'}
                </span>
                <h4 className="font-black text-slate-900 text-sm">{selectedPin.data.name}</h4>
                <p className="text-xs text-slate-600">
                  📍 {selectedPin.data.house_address || selectedPin.data.address || selectedPin.data.landmark || 'Identified Point'}
                </p>
                {selectedPin.data.house_notes && (
                  <p className="text-[11px] text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100">
                    ℹ️ Escort Note: {selectedPin.data.house_notes}
                  </p>
                )}
                {selectedPin.data.parent_phone && (
                  <p className="text-xs font-mono font-bold text-emerald-700">📞 Parent: {selectedPin.data.parent_phone}</p>
                )}
              </div>

              {selectedPin.type === 'student' && selectedPin.data.house_lat && selectedPin.data.house_lng && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${selectedPin.data.house_lat},${selectedPin.data.house_lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shrink-0 flex items-center gap-1 shadow-xs transition-all"
                >
                  <Navigation size={12} />
                  <span>Navigate</span>
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
