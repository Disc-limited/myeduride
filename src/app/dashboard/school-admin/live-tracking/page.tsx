// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
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
  Eye
} from 'lucide-react';
import { toast } from 'sonner';

export default function LiveVehicleTrackingPage() {
  const [vehicles, setVehicles] = useState([
    {
      id: 'VH-01',
      plate: 'LAG-482-XA',
      model: 'Toyota HiAce Bus',
      driver: 'Babajide Adeleke',
      phone: '+234 803 291 8841',
      route: 'Route A - Victoria Island to Campus',
      speed: 42,
      lat: 6.4281,
      lng: 3.4219,
      status: 'moving',
      studentsOnboard: 14,
      capacity: 18,
      nextStop: 'Ademola Adetokunbo St (ETA: 4 mins)',
      lastPing: 'Just now',
    },
    {
      id: 'VH-02',
      plate: 'IKJ-904-KT',
      model: 'Ford Transit 15-Seater',
      driver: 'Emeka Chukwu',
      phone: '+234 812 449 1022',
      route: 'Route B - Lekki Phase 1 & 2',
      speed: 28,
      lat: 6.4474,
      lng: 3.4731,
      status: 'moving',
      studentsOnboard: 9,
      capacity: 15,
      nextStop: 'Admiralty Way Junction (ETA: 7 mins)',
      lastPing: '20s ago',
    },
    {
      id: 'VH-03',
      plate: 'APP-118-BC',
      model: 'Coaster Executive 28-Seater',
      driver: 'Oluwaseun Bakare',
      phone: '+234 809 332 5590',
      route: 'Route C - Ikeja GRA & Maryland',
      speed: 0,
      lat: 6.5872,
      lng: 3.3571,
      status: 'stopped',
      studentsOnboard: 22,
      capacity: 28,
      nextStop: 'Arrived at School Gate (Departure pending)',
      lastPing: '1 min ago',
    },
  ]);

  const [selectedVehicle, setSelectedVehicle] = useState(vehicles[0]);
  const [isSimulating, setIsSimulating] = useState(true);

  // Live telemetry pulse simulation
  useEffect(() => {
    if (!isSimulating) return;
    const interval = setInterval(() => {
      setVehicles((prev) =>
        prev.map((v) => {
          if (v.status === 'moving') {
            const jitterSpeed = Math.max(15, Math.min(65, v.speed + Math.floor(Math.random() * 7) - 3));
            return { ...v, speed: jitterSpeed, lastPing: 'Just now' };
          }
          return v;
        })
      );
    }, 4000);
    return () => clearInterval(interval);
  }, [isSimulating]);

  return (
    <div className="space-y-6 font-sans text-slate-800 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#07132B] via-[#0B1E36] to-[#0A1633] rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-black text-[11px] border border-emerald-400/30 uppercase tracking-wider flex items-center gap-1.5">
              <Radio size={13} className="animate-pulse" /> Live Telemetry Movement
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            Live Vehicle Movement & Fleet Tracking
          </h1>
          <p className="text-slate-300 text-xs md:text-sm max-w-2xl font-medium">
            Real-time GPS positioning, speed metrics, live route stops, and student passenger manifests for school vehicles and escorts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setIsSimulating(!isSimulating);
              toast.info(isSimulating ? 'Live updates paused' : 'Live updates resumed');
            }}
            className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all border border-white/20 flex items-center gap-2 cursor-pointer shadow-md"
          >
            <Activity size={14} className={isSimulating ? 'text-emerald-400' : 'text-slate-400'} />
            <span>{isSimulating ? 'Tracking Active' : 'Paused'}</span>
          </button>
        </div>
      </div>

      {/* Grid: Map View & Vehicle Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Interactive Map Canvas */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-xl relative min-h-[460px] flex flex-col justify-between">
            {/* Stylized Map Viewport Canvas */}
            <div className="absolute inset-0 bg-[#0c192c] bg-[radial-gradient(#1e3a5f_1px,transparent_1px)] [background-size:24px_24px] opacity-70"></div>

            {/* Map Header Overlay */}
            <div className="relative z-10 p-5 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-b from-slate-950/90 to-transparent">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></span>
                <span className="text-xs font-black text-white uppercase tracking-wider">Lagos Metropolitan School Zone</span>
              </div>
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                GPS Lat: {selectedVehicle.lat.toFixed(4)}, Lng: {selectedVehicle.lng.toFixed(4)}
              </span>
            </div>

            {/* Map Center Simulation Graphic */}
            <div className="relative z-10 p-8 flex flex-col items-center justify-center space-y-4 my-auto">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center animate-pulse">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg">
                      <Navigation size={22} className="transform rotate-45" />
                    </div>
                  </div>
                </div>
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-900 text-white text-[10px] font-black px-2 py-0.5 rounded-md border border-slate-700 shadow-md">
                  {selectedVehicle.plate} ({selectedVehicle.speed} km/h)
                </span>
              </div>
              <div className="text-center">
                <h4 className="text-white font-black text-sm">{selectedVehicle.model}</h4>
                <p className="text-slate-400 text-xs mt-0.5">{selectedVehicle.route}</p>
              </div>
            </div>

            {/* Map Bottom Telemetry Bar */}
            <div className="relative z-10 p-4 bg-slate-950/90 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Current Speed</span>
                  <span className="text-emerald-400 font-black text-sm">{selectedVehicle.speed} km/h</span>
                </div>
                <div className="h-6 w-px bg-slate-800"></div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Passengers</span>
                  <span className="text-white font-black text-sm">{selectedVehicle.studentsOnboard} / {selectedVehicle.capacity}</span>
                </div>
                <div className="h-6 w-px bg-slate-800"></div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Next Stop</span>
                  <span className="text-amber-300 font-bold">{selectedVehicle.nextStop}</span>
                </div>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Telemetry sync: {selectedVehicle.lastPing}</span>
            </div>
          </div>
        </div>

        {/* Right Col: Active Vehicles List & Driver Telemetry */}
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-base">Tracked School Fleet</h3>
              <span className="text-xs font-bold text-slate-500">{vehicles.length} Active</span>
            </div>

            <div className="space-y-3">
              {vehicles.map((v) => (
                <div
                  key={v.id}
                  onClick={() => setSelectedVehicle(v)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2.5 ${
                    selectedVehicle.id === v.id
                      ? 'bg-slate-50 border-emerald-500 shadow-xs ring-2 ring-emerald-500/20'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs">
                        <Car size={16} />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 text-xs">{v.plate}</h4>
                        <p className="text-[11px] text-slate-500">{v.model}</p>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full font-extrabold text-[10px] uppercase ${
                        v.status === 'moving' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {v.status === 'moving' ? `● ${v.speed} km/h` : 'Stopped'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white border border-slate-100 text-[11px] space-y-1">
                    <p className="font-bold text-slate-800 flex items-center justify-between">
                      <span>Driver: {v.driver}</span>
                      <span className="text-slate-500 font-mono">📞 {v.phone}</span>
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">{v.route}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
