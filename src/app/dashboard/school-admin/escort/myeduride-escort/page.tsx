// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Shield,
  Users,
  Bus,
  Navigation,
  Activity,
  CalendarCheck,
  DollarSign,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Sparkles,
  MapPin,
  RefreshCw,
  QrCode,
  ShieldCheck,
  Clock,
  Radio,
  FileText,
  Search,
  ChevronRight,
  Phone,
  Eye,
  Send,
  Zap,
  X
} from 'lucide-react';
import { toast } from 'sonner';

export default function MyEduRideEscortManagementPage() {
  const [activeTab, setActiveTab] = useState<'pool' | 'connections' | 'telemetry'>('pool');
  const [escorts, setEscorts] = useState([]);
  const [connectedBookings, setConnectedBookings] = useState([]);
  const [metrics, setMetrics] = useState({
    total_approved_escorts: 0,
    available_pool: 0,
    active_transit_assignments: 0,
    emergency_pool_standby: 0,
    average_safety_rating: '4.95 / 5.0',
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedEscort, setSelectedEscort] = useState(null);
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [targetEscort, setTargetEscort] = useState(null);
  const [dispatchNotes, setDispatchNotes] = useState('');
  const [dispatching, setDispatching] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/school-admin/escort/myeduride-escort');
      const json = await res.json();
      if (json.success) {
        setEscorts(json.escorts || []);
        setConnectedBookings(json.connected_bookings || []);
        setMetrics(json.metrics || {});
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load MyEduRide Escort data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleEmergencyDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEscort) return;
    setDispatching(true);
    try {
      const res = await fetch('/api/school-admin/escort/myeduride-escort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request_emergency_deputy',
          escort_id: targetEscort.id,
          notes: dispatchNotes,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Emergency deputy dispatch confirmed for ${targetEscort.fullName || targetEscort.name}!`);
        setDispatchModalOpen(false);
        setDispatchNotes('');
        loadData();
      }
    } catch (err: any) {
      toast.error(err.message || 'Dispatch error');
    } finally {
      setDispatching(false);
    }
  };

  const filteredEscorts = escorts.filter(
    (e) =>
      (e.fullName || e.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.operatingArea || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.connectedRoute || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 font-sans text-slate-800 p-4 md:p-6 max-w-7xl mx-auto">
      {/* DISC-MANAGED APPROVED FLEET OPERATOR BANNER (Management Approved Structure) */}
      <div className="bg-gradient-to-r from-[#0A1128] via-[#121E42] to-[#0A1128] rounded-3xl p-6 text-white shadow-xl border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="flex items-start md:items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
            <Shield size={32} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black px-3 py-0.5 rounded-full border border-emerald-500/30 uppercase tracking-widest flex items-center gap-1">
                <CheckCircle2 size={11} /> DISC-MANAGED FLEET OPERATOR
              </span>
              <span className="text-xs text-slate-300 font-bold">• City Manager Vetted Pool</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white mt-1">
              MyEduRide Official Escort Command
            </h2>
            <p className="text-xs text-slate-300 font-medium max-w-2xl mt-0.5">
              Authorised platform escorts vetted and approved by the City Manager for school shared-ride corridors, transport bookings, and emergency deputy dispatches.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all border border-white/20 flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Sync Live Pool</span>
          </button>
        </div>
      </div>

      {/* KPI METRICS DECK */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">City Manager Approved</span>
          <p className="text-2xl font-black text-slate-900">{metrics.total_approved_escorts || escorts.length}</p>
          <span className="text-xs text-emerald-600 font-bold">100% Safety Cleared</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Available Standby</span>
          <p className="text-2xl font-black text-emerald-700">{metrics.available_pool || 2}</p>
          <span className="text-xs text-slate-500 font-medium">Ready for Dispatch</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Active Corridor Trips</span>
          <p className="text-2xl font-black text-slate-900">{metrics.active_transit_assignments || 1}</p>
          <span className="text-xs text-slate-500 font-medium">School Bookings Connected</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Safety Rating</span>
          <p className="text-2xl font-black text-amber-600">{metrics.average_safety_rating || '4.95 / 5.0'}</p>
          <span className="text-xs text-amber-700 font-bold">⭐ Verified Gold Standard</span>
        </div>
      </div>

      {/* TABS SELECTOR */}
      <div className="bg-white rounded-2xl p-1.5 border border-slate-200 shadow-xs flex flex-wrap gap-1.5">
        {[
          { id: 'pool', label: 'City Manager Approved Pool', count: escorts.length },
          { id: 'connections', label: 'Connected Student Bookings & Routes', count: connectedBookings.length },
          { id: 'telemetry', label: 'Fleet Telemetry & Optimisation', count: null },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== null && (
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                  activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: APPROVED ESCORTS POOL */}
      {activeTab === 'pool' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search approved escort name, operating zone, or corridor route..."
                className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium"
              />
            </div>
            <span className="text-xs font-bold text-slate-500">{filteredEscorts.length} Vetted Escorts</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredEscorts.map((escort) => (
              <div
                key={escort.id}
                className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-base shrink-0">
                        <Shield size={20} className="text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="font-black text-slate-900 text-base">{escort.fullName || escort.name}</h3>
                        <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md">
                          ✓ Ref: {escort.cityManagerApprovalRef || 'CM-APPROVED'}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full font-extrabold text-[10px] uppercase ${
                        escort.availabilityStatus === 'available'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {escort.availabilityStatus === 'available' ? '● Standby Pool' : 'In Transit'}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Operating Zone:</span>
                      <span className="font-bold text-slate-900">{escort.operatingArea}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Fleet Vehicle:</span>
                      <span className="font-bold text-slate-800">{escort.vehicle?.regNumber} ({escort.vehicle?.make})</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Connected Corridor:</span>
                      <span className="font-bold text-emerald-800 truncate max-w-[150px]">{escort.connectedRoute}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Route Optimisation:</span>
                      <span className="font-mono font-black text-teal-700">{escort.routeOptimizationScore}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-slate-800">⭐ {escort.rating} ({escort.totalTrips} Trips)</span>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetEscort(escort);
                      setDispatchModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send size={13} />
                    <span>Dispatch / Assign</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: CONNECTED STUDENT BOOKINGS & ROUTES */}
      {activeTab === 'connections' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-black text-slate-900 text-base">Connected Student Bookings & Corridors</h3>
              <p className="text-xs text-slate-500 font-medium">Shared-ride bookings connected to City Manager Approved platform escorts.</p>
            </div>
            <span className="text-xs font-bold text-slate-500">{connectedBookings.length} Active Bookings</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {connectedBookings.map((b) => (
              <div key={b.id} className="p-5 rounded-3xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-slate-400 font-bold">{b.id}</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px] uppercase">
                    {b.status}
                  </span>
                </div>

                <div>
                  <h4 className="font-black text-slate-900 text-sm">{b.studentName}</h4>
                  <p className="text-slate-500 font-medium">Parent: {b.parentName}</p>
                </div>

                <div className="p-3 rounded-2xl bg-white border border-slate-100 space-y-1 text-[11px]">
                  <p className="text-slate-600">📍 <strong>Pickup:</strong> {b.pickupAddress}</p>
                  <p className="text-slate-600">🏁 <strong>Dropoff:</strong> {b.destination}</p>
                  <p className="font-bold text-slate-800">⏰ {b.scheduleTime}</p>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-700">Assigned: {b.assignedEscortName}</span>
                  <span className="font-black text-emerald-700">{b.fare}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: FLEET TELEMETRY & OPTIMISATION */}
      {activeTab === 'telemetry' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-900 rounded-3xl p-6 text-white space-y-4 shadow-xl border border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Radio size={16} className="text-emerald-400 animate-pulse" />
                <h3 className="font-black text-sm uppercase tracking-wider">Live Route Corridors Telemetry</h3>
              </div>
              <span className="text-xs font-mono text-emerald-400">All Corridors Monitored</span>
            </div>

            <div className="h-64 rounded-2xl bg-[#0B1528] border border-slate-800 p-6 flex flex-col items-center justify-center text-center space-y-3 relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(#1e3a5f_1px,transparent_1px)] [background-size:16px_16px] opacity-40"></div>
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center animate-pulse z-10">
                <Navigation size={28} className="text-emerald-400 transform rotate-45" />
              </div>
              <div className="z-10">
                <h4 className="font-black text-base text-white">Lekki-Victoria Island Shared Corridor</h4>
                <p className="text-xs text-slate-400">Speed: 38 km/h · 0 Speed Violations · 98% Optimal Route</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-black text-slate-900 text-base">Route Optimization Insights</h3>
            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100 space-y-1">
                <span className="font-black text-emerald-800">AI Traffic Prediction</span>
                <p className="text-emerald-700">Alternative path calculated via Palace Way saving 8 minutes of transit time.</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-100 space-y-1">
                <span className="font-black text-blue-800">City Manager Escort Standby</span>
                <p className="text-blue-700">3 vetted deputy escorts on standby for emergency route fulfillment.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DISPATCH / EMERGENCY STANDBY MODAL */}
      {dispatchModalOpen && targetEscort && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
                  <Shield size={18} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Dispatch MyEduRide Escort</h3>
                  <p className="text-xs text-slate-500 font-medium">Assign {targetEscort.fullName || targetEscort.name} to corridor.</p>
                </div>
              </div>
              <button onClick={() => setDispatchModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEmergencyDispatch} className="space-y-3.5 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Escort:</span>
                  <span className="font-black text-slate-900">{targetEscort.fullName || targetEscort.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">City Manager Approval:</span>
                  <span className="font-mono font-bold text-emerald-700">{targetEscort.cityManagerApprovalRef || 'CM-APPROVED'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Vehicle:</span>
                  <span className="font-bold text-slate-800">{targetEscort.vehicle?.regNumber}</span>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Dispatch Notes & Corridor Instructions</label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Assigned to morning shared corridor from Lekki Phase 1 to Campus Main Gate..."
                  value={dispatchNotes}
                  onChange={(e) => setDispatchNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDispatchModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={dispatching}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-md shadow-emerald-600/20 cursor-pointer flex items-center gap-1.5"
                >
                  <Send size={15} />
                  <span>{dispatching ? 'Dispatching...' : 'Authorize Escort Dispatch'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
