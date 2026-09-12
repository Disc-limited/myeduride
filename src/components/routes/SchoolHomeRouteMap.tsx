// @ts-nocheck
'use client';

import { useState, useEffect, useRef } from 'react';
import { loadLeaflet } from '@/lib/leaflet-loader';
import {
  MapPin,
  Building,
  Home,
  Navigation,
  ExternalLink,
  Clock,
  Compass,
  PhoneCall
} from 'lucide-react';

export interface SchoolHomeRouteMapProps {
  school: {
    name: string;
    address?: string | null;
    lat: number;
    lng: number;
  };
  student: {
    name: string;
    className?: string | null;
    studentIdNumber?: string | null;
    houseAddress?: string | null;
    houseLandmark?: string | null;
    houseNotes?: string | null;
    lat: number;
    lng: number;
    parentPhone?: string | null;
  };
  distanceKm?: number | null;
  estimatedTransitMins?: number | null;
  heightClassName?: string;
}

export default function SchoolHomeRouteMap({
  school,
  student,
  distanceKm,
  estimatedTransitMins,
  heightClassName = 'h-[440px]',
}: SchoolHomeRouteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);

  // Compute Haversine distance if not passed
  const calculatedDistance = (() => {
    if (typeof distanceKm === 'number') return distanceKm;
    if (school?.lat && school?.lng && student?.lat && student?.lng) {
      const R = 6371; // km
      const dLat = ((student.lat - school.lat) * Math.PI) / 180;
      const dLon = ((student.lng - school.lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((school.lat * Math.PI) / 180) * Math.cos((student.lat * Math.PI) / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return Math.round(R * c * 100) / 100;
    }
    return 0;
  })();

  const estimatedMins = estimatedTransitMins || Math.max(5, Math.round((calculatedDistance / 25) * 60));
  const googleMapsDirectionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${school.lat},${school.lng}&destination=${student.lat},${student.lng}&travelmode=driving`;

  useEffect(() => {
    let isMounted = true;

    loadLeaflet()
      .then((L) => {
        if (!isMounted || !mapContainerRef.current) return;

        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }

        const centerLat = (school.lat + student.lat) / 2;
        const centerLng = (school.lng + student.lng) / 2;

        const map = L.map(mapContainerRef.current, {
          center: [centerLat, centerLng],
          zoom: 13,
          zoomControl: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        const markersGroup = L.featureGroup();

        // 1. School Origin Marker
        const schoolIcon = L.divIcon({
          className: 'school-route-marker',
          html: `<div style="background: linear-gradient(135deg, #065f46, #047857); color: white; width: 42px; height: 42px; border-radius: 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(0,0,0,0.35); border: 2.5px solid white;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>
          </div>`,
          iconSize: [42, 42],
          iconAnchor: [21, 42],
        });

        const schoolMarker = L.marker([school.lat, school.lng], { icon: schoolIcon }).addTo(map);
        schoolMarker.bindPopup(`
          <div style="font-family: inherit; font-size: 12px; line-height: 1.4; min-width: 220px;">
            <div style="display: flex; align-items: center; gap: 4px; color: #047857; font-weight: 900; font-size: 11px; text-transform: uppercase;">
              🏫 Route Origin (Campus)
            </div>
            <strong style="color: #0f172a; font-size: 13px; display: block; margin-top: 2px;">${school.name}</strong>
            <p style="margin: 3px 0 0 0; color: #475569;">📍 ${school.address || 'Campus Gate Grounds'}</p>
            <p style="margin: 3px 0 0 0; font-family: monospace; font-size: 10px; color: #64748b;">GPS: ${school.lat.toFixed(5)}, ${school.lng.toFixed(5)}</p>
          </div>
        `);
        markersGroup.addLayer(schoolMarker);

        // 2. Parent House Destination Marker
        const houseIcon = L.divIcon({
          className: 'house-route-marker',
          html: `<div style="background: linear-gradient(135deg, #0d9488, #0f766e); color: white; width: 42px; height: 42px; border-radius: 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(13,148,136,0.4); border: 2.5px solid white;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>`,
          iconSize: [42, 42],
          iconAnchor: [21, 42],
        });

        const houseMarker = L.marker([student.lat, student.lng], { icon: houseIcon }).addTo(map);
        houseMarker.bindPopup(`
          <div style="font-family: inherit; font-size: 12px; line-height: 1.4; min-width: 220px;">
            <div style="display: flex; align-items: center; gap: 4px; color: #0d9488; font-weight: 900; font-size: 11px; text-transform: uppercase;">
              🏠 Route Destination (Pinned Home)
            </div>
            <strong style="color: #0f172a; font-size: 13px; display: block; margin-top: 2px;">${student.name}</strong>
            <span style="color: #64748b; font-size: 11px;">${student.className || 'Student'} ${student.studentIdNumber ? `• ${student.studentIdNumber}` : ''}</span>
            <div style="margin: 4px 0; padding: 4px 8px; background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; font-weight: 800; font-size: 11px; color: #15803d;">
              📏 ${calculatedDistance} km from School (⏱️ ~${estimatedMins} mins)
            </div>
            <p style="margin: 3px 0 0 0; color: #334155;">📍 ${student.houseAddress || 'Designated Home Residence'}</p>
            ${student.houseLandmark ? `<p style="margin: 2px 0 0 0; color: #64748b; font-size: 11px;">🏢 Landmark: ${student.houseLandmark}</p>` : ''}
            ${student.parentPhone ? `<p style="margin: 2px 0 0 0; color: #047857; font-size: 11px; font-weight: 700;">📞 Parent: ${student.parentPhone}</p>` : ''}
            <p style="margin: 3px 0 0 0; font-family: monospace; font-size: 10px; color: #64748b;">GPS: ${student.lat.toFixed(5)}, ${student.lng.toFixed(5)}</p>
          </div>
        `);
        markersGroup.addLayer(houseMarker);

        // 3. Draw Connecting Transit Polyline
        const routeLine = L.polyline(
          [
            [school.lat, school.lng],
            [student.lat, student.lng],
          ],
          {
            color: '#059669',
            weight: 5,
            opacity: 0.85,
            dashArray: '10, 10',
          }
        ).addTo(map);

        routeLine.bindTooltip(`📏 ${calculatedDistance} km (${estimatedMins} mins)`, {
          permanent: true,
          direction: 'center',
          className: 'bg-emerald-950 text-emerald-300 text-xs font-mono font-bold px-2 py-1 rounded-lg border border-emerald-500/40 shadow-lg',
        });

        // Fit bounds with generous padding so both markers and the connecting line are fully visible
        map.fitBounds(markersGroup.getBounds(), { padding: [50, 50], maxZoom: 15 });

        mapInstanceRef.current = map;
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load SchoolHomeRouteMap:', err);
        setLoading(false);
      });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [school, student]);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-950 shadow-2xl flex flex-col">
      {/* Route Header Overview Strip */}
      <div className="px-4 py-3 bg-[#07172b] border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold text-emerald-400">
            <Building size={15} />
            <span className="truncate max-w-[150px] sm:max-w-[200px]">{school.name}</span>
          </div>
          <span className="text-slate-500 font-black">➔</span>
          <div className="flex items-center gap-1.5 font-bold text-teal-300">
            <Home size={15} />
            <span className="truncate max-w-[150px] sm:max-w-[200px]">{student.name}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-black text-xs border border-emerald-500/30 flex items-center gap-1">
            <Compass size={13} />
            <span>{calculatedDistance} km</span>
          </span>
          <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold text-xs border border-amber-500/30 flex items-center gap-1">
            <Clock size={13} />
            <span>~{estimatedMins} mins</span>
          </span>
          <a
            href={googleMapsDirectionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-extrabold text-xs flex items-center gap-1 shadow-sm transition-all"
          >
            <span>Google Maps</span>
            <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* Map Container */}
      <div className={`relative w-full ${heightClassName}`}>
        <div ref={mapContainerRef} className="w-full h-full" />
        {loading && (
          <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center text-slate-400 text-xs font-bold gap-2">
            <div className="w-4 h-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
            <span>Rendering Pinned Route Corridor...</span>
          </div>
        )}
      </div>

      {/* Coordinates Comparison Footer */}
      <div className="px-4 py-2.5 bg-[#051120] border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300 font-mono">
        <div className="flex items-center gap-1.5 truncate">
          <Building size={13} className="text-emerald-400 shrink-0" />
          <span className="text-slate-400">School Pin:</span>
          <span className="text-white font-bold">{school.lat.toFixed(5)}, {school.lng.toFixed(5)}</span>
        </div>
        <div className="flex items-center gap-1.5 truncate">
          <Home size={13} className="text-teal-400 shrink-0" />
          <span className="text-slate-400">Parent Pin:</span>
          <span className="text-white font-bold">{student.lat.toFixed(5)}, {student.lng.toFixed(5)}</span>
        </div>
      </div>
    </div>
  );
}
