'use client';

import { useState, useEffect } from 'react';
import {
  Bus,
  Navigation,
  Radio,
  MapPin,
  Clock,
  Users,
  ShieldCheck,
  AlertTriangle,
  Search,
  Filter,
  ArrowRight,
  Maximize2,
  RefreshCw,
  Phone,
  CheckCircle2,
  Sparkles,
  Zap,
  Activity
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface FleetVehicle {
  id: string;
  vehicleReg: string;
  vehicleModel: string;
  driverName: string;
  driverPhone: string;
  escortName: string;
  routeName: string;
  status: 'on_schedule' | 'delayed' | 'at_gate' | 'completed' | 'offline';
  speedKmh: number;
  heading: number;
  batteryLevel: number;
  currentStopName: string;
  nextStopName: string;
  totalStudents: number;
  pickedCount: number;
  etaToGateMinutes: number;
  lastPing: string;
  lat: number;
  lng: number;
}

interface FleetLiveTrackingViewProps {
  schoolId?: string;
  schoolName?: string;
  vehicles?: FleetVehicle[];
}

const DEFAULT_FLEET: FleetVehicle[] = [
  {
    id: 'veh-01',
    vehicleReg: 'LAG-412-XA',
    vehicleModel: 'Toyota Coaster (30-Seater)',
    driverName: 'Mr. Babatunde Lawal',
    driverPhone: '+234 803 111 2233',
    escortName: 'Officer John Okonkwo',
    routeName: 'Route 1: Ikeja - Maryland - Surulere',
    status: 'on_schedule',
    speedKmh: 38,
    heading: 42,
    batteryLevel: 88,
    currentStopName: 'Maryland Mall Stop',
    nextStopName: 'Anthony Village Bus Stop',
    totalStudents: 22,
    pickedCount: 18,
    etaToGateMinutes: 12,
    lastPing: '3s ago',
    lat: 6.5744,
    lng: 3.3662,
  },
  {
    id: 'veh-02',
    vehicleReg: 'LAG-894-XB',
    vehicleModel: 'Toyota Hiace (18-Seater)',
    driverName: 'Mr. Emeka Obi',
    driverPhone: '+234 802 444 5566',
    escortName: 'Officer Fatima Bello',
    routeName: 'Route 2: Lekki Phase 1 - Ikoyi - Campus',
    status: 'delayed',
    speedKmh: 14,
    heading: 120,
    batteryLevel: 74,
    currentStopName: 'Admiralty Way Traffic',
    nextStopName: 'Falomo Bridge Roundabout',
    totalStudents: 16,
    pickedCount: 12,
    etaToGateMinutes: 24,
    lastPing: '2s ago',
    lat: 6.4474,
    lng: 3.4723,
  },
  {
    id: 'veh-03',
    vehicleReg: 'LAG-205-XC',
    vehicleModel: 'Toyota Hiace (18-Seater)',
    driverName: 'Mr. Segun Adeyemi',
    driverPhone: '+234 809 777 8899',
    escortName: 'Officer Chinedu Eze',
    routeName: 'Route 3: Gbagada - Ogudu - School Gate',
    status: 'at_gate',
    speedKmh: 0,
    heading: 0,
    batteryLevel: 92,
    currentStopName: 'School Main Gate',
    nextStopName: 'Arrival Verification Point',
    totalStudents: 14,
    pickedCount: 14,
    etaToGateMinutes: 0,
    lastPing: 'Just now',
    lat: 6.5244,
    lng: 3.3792,
  },
  {
    id: 'veh-04',
    vehicleReg: 'LAG-731-XD',
    vehicleModel: 'Nissan Civilian (24-Seater)',
    driverName: 'Mr. Joshua Adams',
    driverPhone: '+234 814 333 4455',
    escortName: 'Officer Blessing Danjuma',
    routeName: 'Route 4: Yaba - Magodo Express',
    status: 'on_schedule',
    speedKmh: 44,
    heading: 210,
    batteryLevel: 81,
    currentStopName: 'Magodo Phase 2 Gate',
    nextStopName: 'CMD Road Junction',
    totalStudents: 18,
    pickedCount: 15,
    etaToGateMinutes: 16,
    lastPing: '5s ago',
    lat: 6.6122,
    lng: 3.3854,
  },
];

export default function FleetLiveTrackingView({
  schoolId,
  schoolName = 'EduRide Academy',
  vehicles = DEFAULT_FLEET,
}: FleetLiveTrackingViewProps) {
  const [fleetList, setFleetList] = useState<FleetVehicle[]>(vehicles);
  const [selectedVehicle, setSelectedVehicle] = useState<FleetVehicle | null>(vehicles[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'on_schedule' | 'delayed' | 'at_gate'>('all');
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');

  const supabase = createClient();

  // Listen to School Fleet Broadcast
  useEffect(() => {
    if (!schoolId) return;

    const channel = supabase
      .channel(`tracking:school_${schoolId}`)
      .on('broadcast', { event: 'fleet_vehicle_ping' }, ({ payload }) => {
        setFleetList((prev) =>
          prev.map((v) =>
            v.id === payload.vehicleId || v.vehicleReg === payload.vehicleReg
              ? {
                  ...v,
                  speedKmh: payload.speedKmh ?? v.speedKmh,
                  heading: payload.heading ?? v.heading,
                  batteryLevel: payload.batteryLevel ?? v.batteryLevel,
                  lat: payload.lat ?? v.lat,
                  lng: payload.lng ?? v.lng,
                  lastPing: 'Just now',
                }
              : v
          )
        );
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [schoolId]);

  const filteredVehicles = fleetList.filter((v) => {
    const matchesSearch =
      v.vehicleReg.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.routeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.escortName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalInTransit = fleetList.reduce((acc, curr) => acc + curr.pickedCount, 0);
  const onScheduleCount = fleetList.filter((v) => v.status === 'on_schedule' || v.status === 'at_gate').length;
  const onTimePercentage = Math.round((onScheduleCount / fleetList.length) * 100);

  return (
    <div className="space-y-6 font-sans text-slate-800">
      
      {/* Top Banner / Fleet Health Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
            <Bus className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Active Fleet on Road
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-black text-slate-900 leading-none">{fleetList.length}</span>
              <span className="text-xs text-slate-500 font-bold">Vehicles Active</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              In-Transit Students
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-black text-slate-900 leading-none">{totalInTransit}</span>
              <span className="text-xs text-emerald-600 font-bold">Safely Boarded</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              On-Time Performance
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-black text-slate-900 leading-none">{onTimePercentage}%</span>
              <span className="text-xs text-emerald-600 font-bold">Within Target</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Traffic Delays Logged
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-black text-amber-700 leading-none">
                {fleetList.filter((v) => v.status === 'delayed').length}
              </span>
              <span className="text-xs text-amber-600 font-bold">Route Alert</span>
            </div>
          </div>
        </div>

      </div>

      {/* Main Grid: Multi-Vehicle Radar Map (8 Cols) + Fleet List Drawer (4 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left: Multi-Vehicle Bird's Eye Fleet Map (8 Cols) */}
        <div className="lg:col-span-8 bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
          
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-slate-900 text-base">
                  Live Fleet Radar Overview
                </h3>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  REALTIME TELEMETRY
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Monitoring active school shuttle routes across Lagos metro area
              </p>
            </div>

            {/* Map Type Toggle */}
            <div className="flex bg-slate-100 p-0.5 rounded-xl text-xs font-bold border border-slate-200">
              <button
                type="button"
                onClick={() => setMapType('roadmap')}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  mapType === 'roadmap' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Roadmap
              </button>
              <button
                type="button"
                onClick={() => setMapType('satellite')}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  mapType === 'satellite' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Satellite
              </button>
            </div>
          </div>

          {/* Map Canvas */}
          <div className="relative h-[360px] sm:h-[420px] rounded-2xl overflow-hidden border border-slate-200 bg-slate-900">
            {/* Map Background Tiles */}
            <div
              className={`absolute inset-0 bg-cover bg-center transition-opacity duration-300 ${
                mapType === 'satellite' ? 'opacity-75' : 'opacity-90'
              }`}
              style={{
                backgroundImage:
                  mapType === 'satellite'
                    ? "linear-gradient(rgba(15, 23, 42, 0.4), rgba(15, 23, 42, 0.4)), url('https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80')"
                    : "linear-gradient(rgba(15, 23, 42, 0.15), rgba(15, 23, 42, 0.15)), url('/images/background%20image.png')",
              }}
            />

            {/* Multi-Route Polylines Overlay */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" preserveAspectRatio="none">
              {/* Route 1: Emerald Line */}
              <path d="M 40,290 C 140,220 220,320 380,180 S 520,110 580,60" fill="none" stroke="#10b981" strokeWidth="6" strokeLinecap="round" opacity="0.8" />
              {/* Route 2: Blue Line */}
              <path d="M 120,380 C 200,340 310,260 410,210 S 500,160 580,60" fill="none" stroke="#3b82f6" strokeWidth="6" strokeLinecap="round" opacity="0.8" />
              {/* Route 3: Purple Line */}
              <path d="M 520,350 C 480,270 490,200 530,140 S 560,90 580,60" fill="none" stroke="#a855f7" strokeWidth="6" strokeLinecap="round" opacity="0.8" />
            </svg>

            {/* School Campus Central Destination Node */}
            <div className="absolute right-[6%] top-[8%] z-20 flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-blue-600 border-3 border-white shadow-2xl flex items-center justify-center text-white text-xs font-black">
                SCH
              </div>
              <span className="text-[10px] font-black text-slate-900 bg-white/95 px-2 py-0.5 rounded-md shadow-md mt-1">
                {schoolName} Campus
              </span>
            </div>

            {/* Render Active Buses on Canvas */}
            {fleetList.map((veh, idx) => {
              const leftPerc = [28, 48, 85, 62][idx % 4];
              const topPerc = [55, 68, 18, 42][idx % 4];
              const isSelected = selectedVehicle?.id === veh.id;

              return (
                <div
                  key={veh.id}
                  onClick={() => setSelectedVehicle(veh)}
                  className={`absolute z-30 transition-all duration-700 ease-out flex flex-col items-center -translate-x-1/2 -translate-y-1/2 cursor-pointer group`}
                  style={{ left: `${leftPerc}%`, top: `${topPerc}%` }}
                >
                  {/* Ping Waves */}
                  <div className={`absolute -inset-3 rounded-full ${veh.status === 'delayed' ? 'bg-amber-400/40' : 'bg-emerald-400/40'} animate-ping`} />

                  {/* Bus Icon Marker */}
                  <div
                    className={`relative w-10 h-10 rounded-xl ${
                      veh.status === 'delayed'
                        ? 'bg-amber-500'
                        : veh.status === 'at_gate'
                        ? 'bg-blue-600'
                        : 'bg-emerald-600'
                    } text-white border-2 border-white shadow-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110 ${
                      isSelected ? 'ring-3 ring-white scale-110' : ''
                    }`}
                  >
                    <Bus className="w-5 h-5" />
                  </div>

                  {/* Vehicle Label Badge */}
                  <div className="mt-1 flex items-center gap-1 bg-slate-950/90 border border-slate-700 text-white px-2 py-0.5 rounded-full text-[9px] font-black shadow-lg whitespace-nowrap">
                    <span>{veh.vehicleReg}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-emerald-400">{veh.speedKmh} km/h</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Active Route Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-xs">
            {fleetList.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedVehicle(v)}
                className={`p-2 rounded-xl text-left border transition-all ${
                  selectedVehicle?.id === v.id
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <p className="font-extrabold truncate">{v.vehicleReg}</p>
                <p className={`text-[10px] truncate ${selectedVehicle?.id === v.id ? 'text-slate-300' : 'text-slate-500'}`}>
                  {v.pickedCount} Students • {v.etaToGateMinutes === 0 ? 'At Gate' : `ETA ${v.etaToGateMinutes}m`}
                </p>
              </button>
            ))}
          </div>

        </div>

        {/* Right: Selected Vehicle Telemetry Drawer (4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between">
          
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
                Vehicle Telemetry Inspection
              </h4>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                Pinging
              </span>
            </div>

            {selectedVehicle ? (
              <div className="space-y-3.5 mt-3">
                {/* Vehicle Header Details */}
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center font-black text-sm shadow-md">
                    <Bus className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-extrabold text-slate-900 text-sm truncate">
                      {selectedVehicle.vehicleReg}
                    </h4>
                    <p className="text-xs text-slate-500 truncate">{selectedVehicle.vehicleModel}</p>
                  </div>
                </div>

                {/* Telemetry Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Current Speed</span>
                    <span className="font-extrabold text-slate-900 text-sm">{selectedVehicle.speedKmh} km/h</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Gate ETA</span>
                    <span className="font-extrabold text-emerald-700 text-sm">
                      {selectedVehicle.etaToGateMinutes === 0 ? 'Arrived' : `~ ${selectedVehicle.etaToGateMinutes} mins`}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Boarded Count</span>
                    <span className="font-extrabold text-slate-900 text-sm">
                      {selectedVehicle.pickedCount} / {selectedVehicle.totalStudents}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Battery Level</span>
                    <span className="font-extrabold text-slate-900 text-sm">{selectedVehicle.batteryLevel}%</span>
                  </div>
                </div>

                {/* Route & Escort Assignment */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Route:</span>
                    <span className="font-bold text-slate-900 text-right truncate max-w-[170px]">{selectedVehicle.routeName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Escort Officer:</span>
                    <span className="font-bold text-slate-900">{selectedVehicle.escortName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Driver:</span>
                    <span className="font-bold text-slate-900">{selectedVehicle.driverName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Next Stop:</span>
                    <span className="font-extrabold text-emerald-800">{selectedVehicle.nextStopName}</span>
                  </div>
                </div>

                {/* Direct Action Contacts */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <a
                    href={`tel:${selectedVehicle.driverPhone}`}
                    className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-600/20"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call Driver</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => alert(`Broadcasting route advisory notice to ${selectedVehicle.escortName}...`)}
                    className="py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Radio className="w-3.5 h-3.5 text-slate-500" />
                    <span>Send Notice</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400">
                <Bus className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p>Select any vehicle from the map to inspect live telemetry.</p>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Realtime WebSocket Stream Active</span>
            <span className="font-mono text-slate-600">3s sync</span>
          </div>

        </div>

      </div>

    </div>
  );
}
