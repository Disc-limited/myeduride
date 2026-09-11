// @ts-nocheck
'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Navigation,
  Car,
  ShieldCheck,
  MapPin,
  Clock,
  Search,
  RefreshCw,
  Phone,
  AlertTriangle,
  Users,
  Activity,
  Compass,
  Radio,
  Eye,
  Bus,
  ExternalLink,
  ChevronRight,
  BatteryCharging,
  Layers,
  Sparkles,
  CheckCircle2,
  Maximize2
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { loadLeaflet } from '@/lib/leaflet-loader';

interface StudentManifestItem {
  id: string;
  name: string;
  className: string;
  houseAddress: string;
  houseLat: number | null;
  houseLng: number | null;
  status: 'assigned' | 'picked_up' | 'dropped_off';
  parentPhone: string | null;
  photoUrl: string | null;
}

interface EscortTelemetryItem {
  escortId: string;
  escortName: string;
  escortPhone: string;
  escortPhoto: string | null;
  escortType: 'school_escort' | 'myeduride_escort';
  vehiclePlate: string;
  vehicleModel: string;
  routeName: string;
  routeCode: string;
  operationalStatus: string;
  isActive: boolean;
  activeTripType: 'morning_pickup' | 'afternoon_dropoff' | 'transit' | 'standby';
  currentLat: number;
  currentLng: number;
  speedKmh: number;
  heading: number;
  batteryLevel: number | null;
  gpsAccuracyMeters: number | null;
  lastPingAt: string;
  lastPingHuman: string;
  studentsCount: number;
  studentsPickedCount: number;
  students: StudentManifestItem[];
}

export default function LiveEscortMovementTrackingPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeEscorts, setActiveEscorts] = useState<EscortTelemetryItem[]>([]);
  const [standbyEscorts, setStandbyEscorts] = useState<EscortTelemetryItem[]>([]);
  const [allAssignedEscorts, setAllAssignedEscorts] = useState<EscortTelemetryItem[]>([]);
  const [schoolData, setSchoolData] = useState<any>(null);
  const [summaryData, setSummaryData] = useState<any>(null);

  const [selectedEscort, setSelectedEscort] = useState<EscortTelemetryItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tabFilter, setTabFilter] = useState<'active' | 'standby' | 'all'>('active');
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Map refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersGroupRef = useRef<any>(null);
  const leafletInstanceRef = useRef<any>(null);

  const supabase = createClient();

  // 1. Fetch live escorts assigned to this school
  const fetchEscortTracking = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch('/api/school-admin/tracking/escorts', {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = await res.json();
      if (res.ok) {
        setActiveEscorts(data.active_escorts || []);
        setStandbyEscorts(data.standby_escorts || []);
        setAllAssignedEscorts(data.all_assigned_escorts || []);
        setSchoolData(data.school || null);
        setSummaryData(data.summary || null);

        // Auto-select first active escort if none selected
        if (!selectedEscort) {
          if (data.active_escorts && data.active_escorts.length > 0) {
            setSelectedEscort(data.active_escorts[0]);
          } else if (data.all_assigned_escorts && data.all_assigned_escorts.length > 0) {
            setSelectedEscort(data.all_assigned_escorts[0]);
          }
        } else {
          // Update selected escort with newest telemetry
          const updated = (data.all_assigned_escorts || []).find(
            (e: any) => e.escortId === selectedEscort.escortId
          );
          if (updated) setSelectedEscort(updated);
        }
      } else {
        toast.error(data.error || 'Failed to load live escort telemetry');
      }
    } catch (err) {
      console.warn('[live-tracking] fetch notice:', err);
    } finally {
      setLoading(false);
      if (isManual) {
        setTimeout(() => setRefreshing(false), 500);
      }
    }
  };

  useEffect(() => {
    fetchEscortTracking();
  }, []);

  // 2. Periodic polling every 8s
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchEscortTracking();
    }, 8000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedEscort?.escortId]);

  // 3. Listen to Supabase Realtime fleet ping channel for this school
  useEffect(() => {
    if (!schoolData?.id) return;

    const channel = supabase
      .channel(`tracking:school_${schoolData.id}`)
      .on('broadcast', { event: 'fleet_vehicle_ping' }, ({ payload }) => {
        if (!payload) return;
        setActiveEscorts((prev) =>
          prev.map((e) =>
            e.escortId === payload.sessionId || e.vehiclePlate === payload.vehiclePlate
              ? {
                  ...e,
                  currentLat: payload.lat ?? e.currentLat,
                  currentLng: payload.lng ?? e.currentLng,
                  speedKmh: payload.speedKmh ?? e.speedKmh,
                  heading: payload.heading ?? e.heading,
                  batteryLevel: payload.batteryLevel ?? e.batteryLevel,
                  lastPingHuman: 'Just now',
                }
              : e
          )
        );
      })
      .on('broadcast', { event: 'telemetry_ping' }, ({ payload }) => {
        if (!payload) return;
        setActiveEscorts((prev) =>
          prev.map((e) =>
            e.escortId === payload.sessionId
              ? {
                  ...e,
                  currentLat: payload.lat ?? e.currentLat,
                  currentLng: payload.lng ?? e.currentLng,
                  speedKmh: payload.speedKmh ?? e.speedKmh,
                  heading: payload.heading ?? e.heading,
                  batteryLevel: payload.batteryLevel ?? e.batteryLevel,
                  lastPingHuman: 'Just now',
                }
              : e
          )
        );
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [schoolData?.id]);

  // 4. Initialize Leaflet Map
  useEffect(() => {
    let isMounted = true;

    loadLeaflet()
      .then((L) => {
        if (!isMounted || !mapContainerRef.current) return;
        leafletInstanceRef.current = L;

        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }

        const centerLat = schoolData?.gps_lat || selectedEscort?.currentLat || 6.4474;
        const centerLng = schoolData?.gps_lng || selectedEscort?.currentLng || 3.4731;

        const map = L.map(mapContainerRef.current, {
          center: [centerLat, centerLng],
          zoom: 13,
          zoomControl: false,
        });

        // Add Zoom Control at top right
        L.control.zoom({ position: 'topright' }).addTo(map);

        const tileUrl =
          mapType === 'satellite'
            ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

        const attribution =
          mapType === 'satellite'
            ? '© Esri — DigitalGlobe, Earthstar Geographics'
            : '© OpenStreetMap contributors, © CARTO';

        L.tileLayer(tileUrl, { attribution, maxZoom: 19 }).addTo(map);

        const markersGroup = L.layerGroup().addTo(map);
        markersGroupRef.current = markersGroup;
        mapInstanceRef.current = map;

        renderMapMarkers();
      })
      .catch((err) => {
        console.warn('Could not load Leaflet map:', err);
      });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [schoolData?.id, mapType]);

  // 5. Render Markers on Map
  const renderMapMarkers = () => {
    const L = leafletInstanceRef.current;
    const map = mapInstanceRef.current;
    const group = markersGroupRef.current;
    if (!L || !map || !group) return;

    group.clearLayers();

    const boundsPoints: [number, number][] = [];

    // A. School Campus Gate Marker
    if (schoolData?.gps_lat && schoolData?.gps_lng) {
      boundsPoints.push([Number(schoolData.gps_lat), Number(schoolData.gps_lng)]);
      const schoolIcon = L.divIcon({
        className: 'custom-school-marker',
        html: `
          <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -100%);">
            <div style="background:#1d4ed8; color:#ffffff; width:38px; height:38px; border-radius:50%; border:3px solid #ffffff; box-shadow:0 10px 15px -3px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; font-weight:900; font-size:12px;">
              SCH
            </div>
            <div style="background:#0f172a; color:#ffffff; font-size:10px; font-weight:800; padding:2px 8px; border-radius:6px; margin-top:3px; white-space:nowrap; border:1px solid #334155;">
              ${schoolData.name || 'Campus Gate'}
            </div>
          </div>
        `,
        iconSize: [40, 56],
        iconAnchor: [20, 56],
      });

      L.marker([Number(schoolData.gps_lat), Number(schoolData.gps_lng)], { icon: schoolIcon })
        .addTo(group)
        .bindPopup(`<b>${schoolData.name || 'School Campus'}</b><br/>${schoolData.address || 'Central Gate Node'}`);
    }

    // B. Active Escort Vehicles
    activeEscorts.forEach((escort) => {
      if (escort.currentLat == null || escort.currentLng == null) return;
      boundsPoints.push([escort.currentLat, escort.currentLng]);

      const isSelected = selectedEscort?.escortId === escort.escortId;
      const markerColor = isSelected ? '#10b981' : '#0284c7';

      const vehicleIcon = L.divIcon({
        className: 'custom-escort-marker',
        html: `
          <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -50%); cursor:pointer;">
            <div style="position:relative; width:44px; height:44px; display:flex; align-items:center; justify-content:center;">
              <div style="position:absolute; inset:0; border-radius:50%; background:${markerColor}; opacity:0.3; animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
              <div style="position:relative; background:${markerColor}; color:#ffffff; width:36px; height:36px; border-radius:12px; border:2.5px solid #ffffff; box-shadow:0 8px 16px -2px rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; transform: rotate(${escort.heading || 0}deg);">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                </svg>
              </div>
            </div>
            <div style="background:#020617; color:#ffffff; font-size:10px; font-weight:900; padding:2px 8px; border-radius:6px; margin-top:2px; white-space:nowrap; border:1px solid #1e293b; box-shadow:0 4px 6px rgba(0,0,0,0.3); display:flex; align-items:center; gap:4px;">
              <span>${escort.vehiclePlate}</span>
              <span style="color:#34d399;">• ${escort.speedKmh} km/h</span>
            </div>
          </div>
        `,
        iconSize: [50, 60],
        iconAnchor: [25, 30],
      });

      const marker = L.marker([escort.currentLat, escort.currentLng], { icon: vehicleIcon })
        .addTo(group)
        .on('click', () => setSelectedEscort(escort));

      marker.bindPopup(`
        <div style="font-family:sans-serif; padding:4px;">
          <h4 style="margin:0 0 4px; font-weight:800; font-size:13px; color:#0f172a;">${escort.escortName}</h4>
          <p style="margin:0; font-size:11px; color:#475569;"><b>Vehicle:</b> ${escort.vehiclePlate} (${escort.vehicleModel})</p>
          <p style="margin:2px 0 0; font-size:11px; color:#475569;"><b>Speed:</b> ${escort.speedKmh} km/h | <b>Heading:</b> ${escort.heading}°</p>
          <p style="margin:2px 0 0; font-size:11px; color:#475569;"><b>Route:</b> ${escort.routeName}</p>
          <p style="margin:2px 0 0; font-size:11px; color:#10b981; font-weight:700;"><b>Status:</b> ${escort.operationalStatus}</p>
        </div>
      `);

      // C. If selected, draw polyline from school to escort and plot student stop pins
      if (isSelected && schoolData?.gps_lat && schoolData?.gps_lng) {
        L.polyline(
          [
            [Number(schoolData.gps_lat), Number(schoolData.gps_lng)],
            [escort.currentLat, escort.currentLng],
          ],
          {
            color: '#10b981',
            weight: 4,
            dashArray: '8, 8',
            opacity: 0.8,
          }
        ).addTo(group);

        // Plot assigned students' pinned home locations
        escort.students.forEach((stu) => {
          if (stu.houseLat != null && stu.houseLng != null) {
            boundsPoints.push([stu.houseLat, stu.houseLng]);
            const studentIcon = L.divIcon({
              className: 'custom-student-marker',
              html: `
                <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -100%);">
                  <div style="background:#f59e0b; color:#ffffff; width:26px; height:26px; border-radius:50%; border:2px solid #ffffff; box-shadow:0 4px 6px rgba(0,0,0,0.2); display:flex; align-items:center; justify-content:center; font-size:11px;">
                    🏠
                  </div>
                  <div style="background:#0f172a; color:#ffffff; font-size:9px; font-weight:800; padding:1px 5px; border-radius:4px; margin-top:2px; white-space:nowrap;">
                    ${stu.name}
                  </div>
                </div>
              `,
              iconSize: [30, 42],
              iconAnchor: [15, 42],
            });

            L.marker([stu.houseLat, stu.houseLng], { icon: studentIcon })
              .addTo(group)
              .bindPopup(`<b>${stu.name}</b><br/>Class: ${stu.className}<br/>Address: ${stu.houseAddress || 'Pinned Location'}`);
          }
        });
      }
    });

    // Auto-fit map to fit school and active escorts if bounds available
    if (boundsPoints.length > 1) {
      map.fitBounds(boundsPoints, { padding: [50, 50], maxZoom: 15 });
    }
  };

  useEffect(() => {
    renderMapMarkers();
  }, [activeEscorts, selectedEscort?.escortId]);

  // Center on selected escort
  const handleRecenterOnEscort = (escort: EscortTelemetryItem) => {
    setSelectedEscort(escort);
    if (mapInstanceRef.current && escort.currentLat && escort.currentLng) {
      mapInstanceRef.current.flyTo([escort.currentLat, escort.currentLng], 15, {
        duration: 1.2,
      });
    }
  };

  // Filter escorts based on tab and search
  const displayedEscorts = useMemo(() => {
    let list: EscortTelemetryItem[] = [];
    if (tabFilter === 'active') list = activeEscorts;
    else if (tabFilter === 'standby') list = standbyEscorts;
    else list = allAssignedEscorts;

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (e) =>
        e.escortName.toLowerCase().includes(q) ||
        e.vehiclePlate.toLowerCase().includes(q) ||
        e.routeName.toLowerCase().includes(q) ||
        e.escortPhone.includes(q)
    );
  }, [tabFilter, activeEscorts, standbyEscorts, allAssignedEscorts, searchQuery]);

  return (
    <div className="space-y-6 font-sans text-slate-800 p-4 md:p-6 max-w-7xl mx-auto">
      
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-[#07132B] via-[#0B1E36] to-[#0A1633] rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-black text-[11px] border border-emerald-400/30 uppercase tracking-wider flex items-center gap-1.5">
              <Radio size={13} className="animate-pulse text-emerald-400" /> Real-Time Fleet Movement
            </span>
            <span className="text-xs text-slate-400 font-bold">
              • Strictly Assigned to {schoolData?.name || 'Your School'}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            Live Escort Movement & Route Tracking
          </h1>
          <p className="text-slate-300 text-xs md:text-sm max-w-2xl font-medium">
            Monitor real-time GPS coordinates, vehicle speed, heading, and onboard student passenger manifests for escorts currently active on duty.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchEscortTracking(true)}
            disabled={refreshing}
            className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all border border-white/20 flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin text-emerald-400' : 'text-slate-300'} />
            <span>{refreshing ? 'Refreshing...' : 'Sync Fleet'}</span>
          </button>

          <button
            onClick={() => {
              setAutoRefresh(!autoRefresh);
              toast.info(autoRefresh ? 'Live auto-refresh paused' : 'Live auto-refresh resumed (8s)');
            }}
            className={`px-4 py-2.5 rounded-2xl font-bold text-xs transition-all border flex items-center gap-2 cursor-pointer shadow-md ${
              autoRefresh
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <Activity size={14} className={autoRefresh ? 'animate-pulse text-emerald-400' : ''} />
            <span>{autoRefresh ? 'Live Radar On' : 'Radar Paused'}</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
            <Bus className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Active Escorts on Road
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-black text-slate-900 leading-none">
                {summaryData?.activeEscortsCount ?? activeEscorts.length}
              </span>
              <span className="text-xs text-emerald-600 font-bold">On Active Duty</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Students in Transit
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-black text-slate-900 leading-none">
                {summaryData?.studentsInTransitCount ?? 0}
              </span>
              <span className="text-xs text-blue-600 font-bold">Safely Boarded</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center shrink-0">
            <Compass className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Average Fleet Speed
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-black text-slate-900 leading-none">
                {summaryData?.averageSpeedKmh ?? 0}
              </span>
              <span className="text-xs text-purple-600 font-bold">km/h Metro Safe</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Standby / Off-Duty
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-black text-amber-700 leading-none">
                {summaryData?.standbyEscortsCount ?? standbyEscorts.length}
              </span>
              <span className="text-xs text-amber-600 font-bold">Assigned to School</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Live Tracking Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left 8 Cols: Interactive Map & Live Movement Radar */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-xl relative min-h-[500px] flex flex-col justify-between">
            
            {/* Map Top Bar */}
            <div className="relative z-10 p-4 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-b from-slate-950/95 to-transparent">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></span>
                <div>
                  <span className="text-xs font-black text-white uppercase tracking-wider block">
                    {schoolData?.name || 'School Campus'} Metro Tracking Zone
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {activeEscorts.length} active escort{activeEscorts.length === 1 ? '' : 's'} on road
                  </span>
                </div>
              </div>

              {/* Map Style Controls */}
              <div className="flex items-center gap-2">
                <div className="flex bg-slate-800 p-0.5 rounded-xl text-xs font-bold border border-slate-700">
                  <button
                    type="button"
                    onClick={() => setMapType('roadmap')}
                    className={`px-3 py-1 rounded-lg transition-colors ${
                      mapType === 'roadmap' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Roadmap
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapType('satellite')}
                    className={`px-3 py-1 rounded-lg transition-colors ${
                      mapType === 'satellite' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Satellite
                  </button>
                </div>

                {selectedEscort && (
                  <button
                    type="button"
                    onClick={() => handleRecenterOnEscort(selectedEscort)}
                    className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Navigation size={12} className="text-emerald-400" />
                    <span>Focus Vehicle</span>
                  </button>
                )}
              </div>
            </div>

            {/* Leaflet Map Canvas Viewport */}
            <div ref={mapContainerRef} className="w-full h-[440px] relative z-0 bg-slate-950" />

            {/* Map Bottom Telemetry Bar */}
            {selectedEscort ? (
              <div className="relative z-10 p-4 bg-slate-950/95 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Current Speed</span>
                    <span className="text-emerald-400 font-black text-sm">
                      {selectedEscort.speedKmh} km/h
                    </span>
                  </div>
                  <div className="h-6 w-px bg-slate-800"></div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Heading</span>
                    <span className="text-white font-black text-sm">
                      {selectedEscort.heading}° Compass
                    </span>
                  </div>
                  <div className="h-6 w-px bg-slate-800"></div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Assigned Passengers</span>
                    <span className="text-white font-black text-sm">
                      {selectedEscort.studentsCount} Students ({selectedEscort.studentsPickedCount} Onboard)
                    </span>
                  </div>
                  <div className="h-6 w-px bg-slate-800"></div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Vehicle</span>
                    <span className="text-amber-300 font-bold truncate max-w-[140px] block">
                      {selectedEscort.vehiclePlate}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Last ping: {selectedEscort.lastPingHuman}
                  </span>
                </div>
              </div>
            ) : (
              <div className="relative z-10 p-4 bg-slate-950/95 border-t border-slate-800 text-xs text-slate-400 text-center">
                Select an escort from the fleet roster to inspect live telemetry.
              </div>
            )}
          </div>

          {/* Quick Active Escort Selection Bar */}
          {activeEscorts.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {activeEscorts.map((escort) => {
                const isSel = selectedEscort?.escortId === escort.escortId;
                return (
                  <button
                    key={escort.escortId}
                    type="button"
                    onClick={() => handleRecenterOnEscort(escort)}
                    className={`p-3 rounded-2xl text-left border transition-all cursor-pointer flex items-center justify-between ${
                      isSel
                        ? 'bg-slate-900 text-white border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                        : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                        <span className="font-extrabold text-xs truncate block">{escort.escortName}</span>
                      </div>
                      <span className={`text-[11px] truncate block ${isSel ? 'text-slate-300' : 'text-slate-500'}`}>
                        {escort.vehiclePlate} • {escort.speedKmh} km/h
                      </span>
                    </div>
                    <span className="text-emerald-400 font-black text-xs shrink-0">
                      {escort.studentsCount} 👤
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 4 Cols: Fleet Roster & Detailed Escort Telemetry Drawer */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Roster Container */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-slate-900 text-base">Assigned Escorts</h3>
                <p className="text-xs text-slate-500">Filtered strictly to this school</p>
              </div>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {displayedEscorts.length} Total
              </span>
            </div>

            {/* Filter Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-2xl text-xs font-bold gap-1">
              <button
                type="button"
                onClick={() => setTabFilter('active')}
                className={`flex-1 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  tabFilter === 'active' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Active ({activeEscorts.length})
              </button>
              <button
                type="button"
                onClick={() => setTabFilter('standby')}
                className={`flex-1 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  tabFilter === 'standby' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Standby ({standbyEscorts.length})
              </button>
              <button
                type="button"
                onClick={() => setTabFilter('all')}
                className={`flex-1 py-1.5 rounded-xl transition-all ${
                  tabFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                All ({allAssignedEscorts.length})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search escort, vehicle, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            {/* Escorts List */}
            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
              {loading ? (
                <div className="py-8 text-center text-slate-400 text-xs">Loading escort movement data...</div>
              ) : displayedEscorts.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                    <Car size={18} />
                  </div>
                  <p className="text-xs font-bold text-slate-600">
                    {tabFilter === 'active'
                      ? 'No escorts currently on active trips'
                      : 'No escorts found matching filter'}
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    {tabFilter === 'active'
                      ? 'Assigned escorts will appear automatically on this radar as soon as they activate pickup mode.'
                      : 'Check escort assignments or register personnel in the Escorts directory.'}
                  </p>
                </div>
              ) : (
                displayedEscorts.map((escort) => {
                  const isSelected = selectedEscort?.escortId === escort.escortId;
                  return (
                    <div
                      key={escort.escortId}
                      onClick={() => handleRecenterOnEscort(escort)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                        isSelected
                          ? 'bg-slate-50 border-emerald-500 shadow-xs ring-2 ring-emerald-500/20'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs text-white ${
                              escort.isActive ? 'bg-emerald-600' : 'bg-slate-800'
                            }`}
                          >
                            <Car size={16} />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                              <span>{escort.escortName}</span>
                              <span
                                className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded-md ${
                                  escort.escortType === 'school_escort'
                                    ? 'bg-purple-100 text-purple-700'
                                    : 'bg-blue-100 text-blue-700'
                                }`}
                              >
                                {escort.escortType === 'school_escort' ? 'School Escort' : 'MyEduRide'}
                              </span>
                            </h4>
                            <p className="text-[11px] text-slate-500">
                              {escort.vehiclePlate} • {escort.vehicleModel}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full font-extrabold text-[10px] uppercase ${
                            escort.isActive
                              ? 'bg-emerald-100 text-emerald-800 flex items-center gap-1'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {escort.isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />}
                          {escort.isActive ? `${escort.speedKmh} km/h` : 'Standby'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                        <span className="truncate max-w-[160px]">📍 {escort.routeName}</span>
                        <span className="font-bold text-slate-700">
                          {escort.studentsCount} Students Assigned
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Detailed Selected Escort Telemetry & Manifest */}
          {selectedEscort && (
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider">
                  Escort Inspection & Passenger Manifest
                </h4>
                <a
                  href={`tel:${selectedEscort.escortPhone}`}
                  className="px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center gap-1.5 border border-emerald-200 transition-colors"
                >
                  <Phone size={12} />
                  <span>Call Escort</span>
                </a>
              </div>

              {/* Bio Details */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-md">
                  {selectedEscort.escortName.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h4 className="font-extrabold text-slate-900 text-sm truncate">{selectedEscort.escortName}</h4>
                  <p className="text-xs text-slate-500 truncate">📞 {selectedEscort.escortPhone}</p>
                  <p className="text-[11px] text-emerald-700 font-bold">
                    Vehicle: {selectedEscort.vehiclePlate} ({selectedEscort.vehicleModel})
                  </p>
                </div>
              </div>

              {/* Realtime Metrics */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Speed</span>
                  <span className="font-black text-slate-900 text-sm">{selectedEscort.speedKmh} km/h</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Heading</span>
                  <span className="font-black text-slate-900 text-sm">{selectedEscort.heading}°</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Battery</span>
                  <span className="font-black text-emerald-700 text-sm">{selectedEscort.batteryLevel ?? 90}%</span>
                </div>
              </div>

              {/* Passenger Manifest */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-slate-900">
                    Assigned Student Manifest ({selectedEscort.students.length})
                  </span>
                  <span className="text-[10px] text-slate-500">Home Doorsteps</span>
                </div>

                <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                  {selectedEscort.students.length === 0 ? (
                    <div className="p-3 text-center text-slate-400 text-xs bg-slate-50 rounded-xl">
                      No students currently assigned to this escort.
                    </div>
                  ) : (
                    selectedEscort.students.map((stu) => (
                      <div
                        key={stu.id}
                        className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <span className="font-bold text-slate-800 block truncate">{stu.name}</span>
                          <span className="text-[10px] text-slate-500 block truncate">
                            {stu.className} • {stu.houseAddress || 'Address on file'}
                          </span>
                        </div>
                        {stu.parentPhone && (
                          <a
                            href={`tel:${stu.parentPhone}`}
                            className="p-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-emerald-700 shrink-0"
                            title="Call Parent"
                          >
                            <Phone size={12} />
                          </a>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
