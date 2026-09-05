// @ts-nocheck
'use client';

import { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Search,
  Navigation,
  Check,
  X,
  Compass,
  Building,
  Home,
  Users,
  AlertCircle,
  Loader2,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { loadLeaflet } from '@/lib/leaflet-loader';

export interface LocationPickerProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'parent' | 'school_admin';
  initialLat?: number | null;
  initialLng?: number | null;
  initialAddress?: string | null;
  initialLandmark?: string | null;
  initialNotes?: string | null;
  // Parent mode specific
  child?: { id: string; name: string; class_name?: string } | null;
  childrenList?: Array<{ id: string; name: string; class_name?: string }>;
  // School Admin mode specific
  schoolId?: string;
  schoolName?: string;
  onLocationSaved?: (savedData: any) => void;
}

export default function InteractiveLocationPickerModal({
  isOpen,
  onClose,
  mode,
  initialLat,
  initialLng,
  initialAddress,
  initialLandmark,
  initialNotes,
  child,
  childrenList = [],
  schoolId,
  schoolName,
  onLocationSaved,
}: LocationPickerProps) {
  // Default coordinates: Lagos, Nigeria (approx center)
  const defaultLat = initialLat || 6.4474;
  const defaultLng = initialLng || 3.4731;

  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: defaultLat,
    lng: defaultLng,
  });

  const [address, setAddress] = useState(initialAddress || '');
  const [landmark, setLandmark] = useState(initialLandmark || '');
  const [notes, setNotes] = useState(initialNotes || '');
  const [applyToAll, setApplyToAll] = useState(false);
  const [selectedChildId, setSelectedChildId] = useState(child?.id || (childrenList[0]?.id || ''));

  const [loadingMap, setLoadingMap] = useState(true);
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [saving, setSaving] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerInstanceRef = useRef<any>(null);

  // Sync state when props change
  useEffect(() => {
    if (initialLat && initialLng) {
      setCoords({ lat: Number(initialLat), lng: Number(initialLng) });
    }
    if (initialAddress) setAddress(initialAddress);
    if (initialLandmark) setLandmark(initialLandmark);
    if (initialNotes) setNotes(initialNotes);
    if (child?.id) setSelectedChildId(child.id);
  }, [initialLat, initialLng, initialAddress, initialLandmark, initialNotes, child]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    loadLeaflet()
      .then((L) => {
        if (!isMounted || !mapContainerRef.current) return;

        // Cleanup existing map if any
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }

        const map = L.map(mapContainerRef.current, {
          center: [coords.lat, coords.lng],
          zoom: 15,
          zoomControl: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        // Custom Pin Marker
        const iconHtml = mode === 'school_admin'
          ? `<div style="background-color: #047857; color: white; width: 34px; height: 34px; border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3); border: 2px solid white;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg></div>`
          : `<div style="background-color: #0f766e; color: white; width: 34px; height: 34px; border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3); border: 2px solid white;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>`;

        const customIcon = L.divIcon({
          className: 'custom-pin-marker',
          html: iconHtml,
          iconSize: [34, 34],
          iconAnchor: [17, 34],
          popupAnchor: [0, -34],
        });

        const marker = L.marker([coords.lat, coords.lng], {
          draggable: true,
          icon: customIcon,
        }).addTo(map);

        markerInstanceRef.current = marker;
        mapInstanceRef.current = map;

        // Marker drag event
        marker.on('dragend', (e: any) => {
          const newPos = e.target.getLatLng();
          setCoords({ lat: newPos.lat, lng: newPos.lng });
          reverseGeocode(newPos.lat, newPos.lng);
        });

        // Map click event
        map.on('click', (e: any) => {
          marker.setLatLng(e.latlng);
          setCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
          reverseGeocode(e.latlng.lat, e.latlng.lng);
        });

        // Trigger resize after render
        setTimeout(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        }, 200);

        setLoadingMap(false);
      })
      .catch((err) => {
        console.error('Failed to initialize map:', err);
        setLoadingMap(false);
      });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen]);

  // Reverse Geocoding with OpenStreetMap Nominatim
  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      setGeocoding(true);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.display_name) {
          // Format compact address
          const addr = data.address;
          const road = addr?.road || addr?.suburb || addr?.neighbourhood || '';
          const city = addr?.city || addr?.town || addr?.state || '';
          const shortAddress = road && city ? `${road}, ${city}` : data.display_name.split(',').slice(0, 3).join(',').trim();
          setAddress(shortAddress);
          if (!landmark && addr?.amenity) {
            setLandmark(addr.amenity);
          }
        }
      }
    } catch (e) {
      console.warn('Reverse geocode notice:', e);
    } finally {
      setGeocoding(false);
    }
  };

  const [mapLayer, setMapLayer] = useState<'street' | 'satellite'>('street');
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const tileLayerRef = useRef<any>(null);
  const accuracyCircleRef = useRef<any>(null);

  // Search Address or Raw Coordinates Geocoding
  const handleAddressSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) return;

    // 1. Check if user entered direct coordinates (e.g. "6.4521, 3.4211")
    const coordMatch = address.trim().match(/^(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)$/);
    if (coordMatch) {
      const parsedLat = parseFloat(coordMatch[1]);
      const parsedLng = parseFloat(coordMatch[3]);
      if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
        setCoords({ lat: parsedLat, lng: parsedLng });
        if (mapInstanceRef.current && markerInstanceRef.current) {
          mapInstanceRef.current.setView([parsedLat, parsedLng], 18);
          markerInstanceRef.current.setLatLng([parsedLat, parsedLng]);
        }
        reverseGeocode(parsedLat, parsedLng);
        toast.success(`Jumped to coordinates (${parsedLat.toFixed(5)}, ${parsedLng.toFixed(5)})`);
        return;
      }
    }

    // 2. Query Geocoding Service
    try {
      setGeocoding(true);
      const cleanAddress = address.trim().replace(/,\s*(nigeria|lagos)$/i, '');
      const query = encodeURIComponent(`${cleanAddress}, Nigeria`);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=3`);
      if (res.ok) {
        const results = await res.json();
        if (results && results.length > 0) {
          const first = results[0];
          const newLat = parseFloat(first.lat);
          const newLng = parseFloat(first.lon);

          setCoords({ lat: newLat, lng: newLng });

          if (mapInstanceRef.current && markerInstanceRef.current) {
            mapInstanceRef.current.setView([newLat, newLng], 17);
            markerInstanceRef.current.setLatLng([newLat, newLng]);
          }
          reverseGeocode(newLat, newLng);
          toast.success('Map updated to search location');
        } else {
          toast.error('Location not found by name. Try dragging the pin directly on the map.');
        }
      }
    } catch (err) {
      toast.error('Search service currently unreachable');
    } finally {
      setGeocoding(false);
    }
  };

  // Toggle Map Layer (Street vs HD Satellite)
  const toggleMapLayer = () => {
    if (!mapInstanceRef.current) return;
    const newLayer = mapLayer === 'street' ? 'satellite' : 'street';
    setMapLayer(newLayer);

    const L = (window as any).L;
    if (!L) return;

    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }

    const tileUrl = newLayer === 'satellite'
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    const attribution = newLayer === 'satellite'
      ? 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
      : '&copy; OpenStreetMap contributors';

    const newTileLayer = L.tileLayer(tileUrl, { attribution, maxZoom: 19 }).addTo(mapInstanceRef.current);
    tileLayerRef.current = newTileLayer;

    toast.info(newLayer === 'satellite' ? 'Switched to HD Satellite View (Building & Gate Aerials)' : 'Switched to Standard Street Map');
  };

  // Use Browser High-Precision Geolocation
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = pos.coords.accuracy;

        setCoords({ lat, lng });
        setGpsAccuracy(accuracy);

        if (mapInstanceRef.current && markerInstanceRef.current) {
          mapInstanceRef.current.setView([lat, lng], 18);
          markerInstanceRef.current.setLatLng([lat, lng]);

          const L = (window as any).L;
          if (L) {
            if (accuracyCircleRef.current) {
              mapInstanceRef.current.removeLayer(accuracyCircleRef.current);
            }
            const circle = L.circle([lat, lng], {
              radius: accuracy,
              color: '#0284c7',
              fillColor: '#0284c7',
              fillOpacity: 0.15,
              weight: 1.5,
            }).addTo(mapInstanceRef.current);
            accuracyCircleRef.current = circle;
          }
        }
        reverseGeocode(lat, lng);
        setLocating(false);
        toast.success(`Pin placed at current location! (Accuracy: ±${Math.round(accuracy)}m)`);
      },
      (err) => {
        setLocating(false);
        toast.error('Could not obtain location. Ensure location permissions are granted.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // Save Pin Handler
  const handleSave = async () => {
    if (!address.trim()) {
      toast.error('Please provide a street address for this pin');
      return;
    }

    setSaving(true);
    try {
      if (mode === 'parent') {
        const payload = {
          student_id: selectedChildId,
          apply_to_all_children: applyToAll,
          house_address: address.trim(),
          house_lat: coords.lat,
          house_lng: coords.lng,
          house_landmark: landmark.trim() || null,
          house_notes: notes.trim() || null,
        };

        const res = await fetch('/api/parent/house-location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || 'Failed to save child house location');
        }

        toast.success(data.message || 'Child house location pinned successfully!');
        onClose();
        try {
          if (onLocationSaved) onLocationSaved(data);
        } catch (e) {
          console.error('onLocationSaved callback error:', e);
        }
      } else {
        // School Admin Mode
        const payload = {
          school_id: schoolId,
          gps_lat: coords.lat,
          gps_lng: coords.lng,
          address: address.trim(),
          landmark: landmark.trim() || null,
        };

        const res = await fetch('/api/school-admin/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || 'Failed to save school location');
        }

        toast.success('School campus main gate pinned successfully!');
        onClose();
        try {
          if (onLocationSaved) onLocationSaved(data);
        } catch (e) {
          console.error('onLocationSaved callback error:', e);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Error saving location pin');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs font-sans">
      <div className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black ${
                mode === 'school_admin' ? 'bg-emerald-100 text-emerald-800' : 'bg-teal-100 text-teal-800'
              }`}
            >
              {mode === 'school_admin' ? <Building size={20} /> : <Home size={20} />}
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">
                {mode === 'school_admin' ? 'Pin School Campus & Main Gate' : 'Pin Child Pickup House Location'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {mode === 'school_admin'
                  ? 'Set the exact arrival hub for transport routes and escort dispatch.'
                  : 'Coordinates will automatically sync with school admin, city manager, and escort route manifests.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-200/80 text-slate-700 hover:bg-slate-300 flex items-center justify-center transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Sibling / Child Selection (Parent Mode) */}
          {mode === 'parent' && (
            <div className="p-4 rounded-2xl bg-teal-50/60 border border-teal-100 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-black text-teal-900 flex items-center gap-1.5">
                  <Users size={14} className="text-teal-700" />
                  Select Student / Children
                </span>
                {childrenList.length > 1 && (
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-teal-800">
                    <input
                      type="checkbox"
                      checked={applyToAll}
                      onChange={(e) => setApplyToAll(e.target.checked)}
                      className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4 cursor-pointer"
                    />
                    <span>Apply this pin to all my {childrenList.length} children</span>
                  </label>
                )}
              </div>

              {!applyToAll && childrenList.length > 1 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {childrenList.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedChildId(c.id)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 ${
                        selectedChildId === c.id
                          ? 'bg-teal-700 text-white shadow-xs'
                          : 'bg-white border border-teal-200 text-teal-900 hover:bg-teal-100'
                      }`}
                    >
                      <span>{c.name}</span>
                      {c.class_name && <span className="text-[10px] opacity-75">({c.class_name})</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Search / Geocode Input */}
          <form onSubmit={handleAddressSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Search street name, area, or landmark..."
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>
            <button
              type="submit"
              disabled={geocoding || !address.trim()}
              className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-50 transition-all shrink-0 flex items-center gap-1.5"
            >
              {geocoding ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              <span>Search</span>
            </button>
            <button
              type="button"
              onClick={handleDetectLocation}
              disabled={locating}
              title="Use current GPS device location"
              className="px-3.5 py-2.5 rounded-xl bg-teal-50 text-teal-800 border border-teal-200 text-xs font-bold hover:bg-teal-100 disabled:opacity-50 transition-all shrink-0 flex items-center gap-1.5"
            >
              {locating ? <Loader2 size={14} className="animate-spin text-teal-700" /> : <Navigation size={14} />}
              <span className="hidden sm:inline">Use My Location</span>
            </button>
          </form>

          {/* Map Viewport */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-inner bg-slate-100 h-64 sm:h-72">
            <div ref={mapContainerRef} className="w-full h-full z-0" />

            {/* Satellite / Street Map Switcher */}
            <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleMapLayer}
                className={`px-3 py-1.5 rounded-xl font-extrabold text-[11px] backdrop-blur-md shadow-md transition-all flex items-center gap-1.5 cursor-pointer ${
                  mapLayer === 'satellite'
                    ? 'bg-amber-400 text-slate-950 border border-amber-300'
                    : 'bg-slate-900/90 text-white border border-slate-700 hover:bg-slate-800'
                }`}
              >
                <Compass size={13} />
                <span>{mapLayer === 'satellite' ? '🗺️ Street Map' : '🛰️ Satellite Aerial View'}</span>
              </button>
            </div>

            {/* GPS Accuracy Badge */}
            {gpsAccuracy !== null && (
              <div className="absolute top-2.5 left-2.5 z-10 px-2.5 py-1 rounded-xl bg-emerald-500 text-slate-950 font-black text-[10px] backdrop-blur-md shadow-md flex items-center gap-1">
                🎯 GPS Precision: ±{Math.round(gpsAccuracy)}m
              </div>
            )}

            {/* Coordinate Overlay & Target Guide */}
            <div className="absolute bottom-2.5 left-2.5 right-2.5 z-10 pointer-events-auto flex flex-wrap items-center justify-between gap-2 bg-slate-900/90 backdrop-blur-md text-white px-3 py-2 rounded-xl text-[11px] font-mono border border-slate-700">
              <span className="flex items-center gap-1 text-emerald-400 font-bold">
                <MapPin size={13} />
                <span className="hidden sm:inline">Drag pin or click map to adjust</span>
              </span>

              <div className="flex items-center gap-2 text-[10px]">
                <label className="text-slate-400 font-bold">Lat:</label>
                <input
                  type="number"
                  step="0.00001"
                  value={coords.lat}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) {
                      setCoords((prev) => ({ ...prev, lat: val }));
                      if (mapInstanceRef.current && markerInstanceRef.current) {
                        mapInstanceRef.current.setView([val, coords.lng]);
                        markerInstanceRef.current.setLatLng([val, coords.lng]);
                      }
                    }
                  }}
                  className="w-20 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-emerald-300 font-bold"
                />
                <label className="text-slate-400 font-bold">Lng:</label>
                <input
                  type="number"
                  step="0.00001"
                  value={coords.lng}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) {
                      setCoords((prev) => ({ ...prev, lng: val }));
                      if (mapInstanceRef.current && markerInstanceRef.current) {
                        mapInstanceRef.current.setView([coords.lat, val]);
                        markerInstanceRef.current.setLatLng([coords.lat, val]);
                      }
                    }
                  }}
                  className="w-20 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-emerald-300 font-bold"
                />
              </div>
            </div>
          </div>

          {/* Landmark & Instructions Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Landmark / Nearest Junction</label>
              <input
                type="text"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="e.g. Opposite Central Mosque, Blue gate"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                {mode === 'school_admin' ? 'Gate Security Notes' : 'Escort Driver Instructions'}
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Call parent 5 mins before arrival"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white font-bold text-xs text-slate-700 hover:bg-slate-100 transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !address.trim()}
            className={`px-5 py-2.5 rounded-xl font-black text-xs text-white transition-all shadow-md flex items-center gap-2 ${
              mode === 'school_admin'
                ? 'bg-emerald-700 hover:bg-emerald-800'
                : 'bg-teal-700 hover:bg-teal-800'
            } disabled:opacity-50`}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            <span>
              {mode === 'school_admin'
                ? 'Save School Campus Pin'
                : applyToAll
                ? 'Save Pin for All Children'
                : 'Save Child House Pin'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
