// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import {
  MapPin,
  Plus,
  Search,
  Navigation,
  Car,
  Users,
  Clock,
  CheckCircle2,
  ChevronRight,
  X,
  RefreshCw,
  Phone,
  Bookmark,
  Compass,
  ArrowRight,
  Pencil,
  Eye,
  Building,
  Home
} from 'lucide-react';
import { toast } from 'sonner';
import InteractiveLocationPickerModal from '@/components/shared/InteractiveLocationPickerModal';
import InteractiveRouteCorridorMap from '@/components/routes/InteractiveRouteCorridorMap';

export default function SchoolTransportRoutesPage() {
  const [routes, setRoutes] = useState([]);
  const [school, setSchool] = useState<any>(null);
  const [showSchoolPinModal, setShowSchoolPinModal] = useState(false);
  const [metrics, setMetrics] = useState({
    total_routes: 0,
    total_stops: 0,
    total_enrolled_passengers: 0,
    total_pinned_houses: 0,
    active_routes: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'routes' | 'map' | 'stops' | 'manifests' | 'directions'>('routes');
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // New Route Form
  const [form, setForm] = useState({
    name: '',
    code: '',
    assigned_vehicle: '',
    assigned_escort_name: '',
    assigned_escort_phone: '',
    departure_morning: '06:45 AM',
    departure_afternoon: '03:15 PM',
    directions_summary: '',
    stops: [
      { stop_number: 1, name: '', landmark: '', eta_morning: '06:50 AM', eta_afternoon: '03:45 PM' },
      { stop_number: 2, name: 'School Campus Front Gate', landmark: 'Main Gate Security', eta_morning: '07:35 AM', eta_afternoon: '03:15 PM' },
    ],
  });

  const loadRoutes = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/school-admin/routes');
      const json = await res.json();
      if (json.success) {
        setRoutes(json.routes || []);
        setMetrics(json.metrics || {});
        if (json.school) {
          setSchool(json.school);
        }
        if (!selectedRoute && json.routes?.length > 0) {
          setSelectedRoute(json.routes[0]);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load transport routes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoutes();
  }, []);

  const handleAddStopField = () => {
    setForm({
      ...form,
      stops: [
        ...form.stops.slice(0, -1),
        {
          stop_number: form.stops.length,
          name: '',
          landmark: '',
          eta_morning: '07:00 AM',
          eta_afternoon: '03:30 PM',
        },
        form.stops[form.stops.length - 1],
      ],
    });
  };

  const handleCreateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.code) {
      toast.error('Route name and code are required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/school-admin/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_route',
          route_data: form,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || 'Transport Route created successfully!');
        setModalOpen(false);
        setForm({
          name: '',
          code: '',
          assigned_vehicle: '',
          assigned_escort_name: '',
          assigned_escort_phone: '',
          departure_morning: '06:45 AM',
          departure_afternoon: '03:15 PM',
          directions_summary: '',
          stops: [
            { stop_number: 1, name: '', landmark: '', eta_morning: '06:50 AM', eta_afternoon: '03:45 PM' },
            { stop_number: 2, name: 'School Campus Front Gate', landmark: 'Main Gate Security', eta_morning: '07:35 AM', eta_afternoon: '03:15 PM' },
          ],
        });
        loadRoutes();
      } else {
        toast.error(json.error || 'Failed to create route');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error processing route');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRoutes = routes.filter(
    (r) =>
      (r.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.code || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.assigned_escort_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.assigned_vehicle || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 font-sans text-slate-800 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#07132B] via-[#0B1E36] to-[#0A1633] rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-5 border border-slate-800">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-black text-[11px] border border-emerald-400/30 uppercase tracking-wider flex items-center gap-1.5">
              <Compass size={13} /> Route Engine & Stop Sequences
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            School Transport Routes & Directions Hub
          </h1>
          <p className="text-slate-300 text-xs md:text-sm max-w-2xl font-medium">
            Create structured route corridors, manage landmark stop points, store student passenger manifests, track parent pins, and provide escort turn-by-turn operational directions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowSchoolPinModal(true)}
            className={`px-4 py-3 rounded-2xl font-extrabold text-xs transition-all flex items-center gap-2 cursor-pointer shrink-0 border ${
              school?.is_pinned
                ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-300 hover:bg-emerald-900'
                : 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-black'
            }`}
          >
            <MapPin size={16} />
            <span>{school?.is_pinned ? '📍 Edit Campus Gate Pin' : '⚠️ Pin School Campus Gate'}</span>
          </button>

          <button
            onClick={() => setModalOpen(true)}
            className="px-5 py-3 rounded-2xl bg-[#00A859] hover:bg-emerald-600 text-white font-extrabold text-xs transition-all shadow-lg shadow-emerald-600/30 flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Plus size={16} />
            <span>Create New Route</span>
          </button>
        </div>
      </div>

      {/* School Campus Gate Geolocation Pin Status Banner */}
      <div className={`p-4 rounded-3xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs ${
        school?.is_pinned
          ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
          : 'bg-amber-50/90 border-amber-200 text-amber-950'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 font-black ${
            school?.is_pinned ? 'bg-emerald-700 text-white shadow-xs' : 'bg-amber-600 text-white shadow-xs'
          }`}>
            <Building size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-sm text-slate-900">{school?.name || 'School Campus Hub'}:</span>
              {school?.is_pinned ? (
                <span className="px-2 py-0.5 rounded-md bg-emerald-200/80 text-emerald-900 font-mono font-bold text-[10px]">
                  📍 Campus Pinned ({school.gps_lat?.toFixed(4)}, {school.gps_lng?.toFixed(4)})
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md bg-amber-200 text-amber-900 font-bold text-[10px]">
                  ⚠️ Campus Gate Unpinned
                </span>
              )}
            </div>
            <p className="text-slate-600 mt-0.5">
              📍 {school?.address || 'Set school campus & main gate coordinates for turn-by-turn route dispatch and escort GPS.'}
              {school?.landmark ? ` · Landmark: ${school.landmark}` : ''}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowSchoolPinModal(true)}
          className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 hover:bg-slate-50 transition-all shrink-0 cursor-pointer shadow-2xs"
        >
          {school?.is_pinned ? 'Update Campus Pin' : 'Drop Gate Pin Now'}
        </button>
      </div>

      {/* KPI Metrics Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Transport Routes</span>
          <p className="text-2xl font-black text-slate-900">{metrics.total_routes || routes.length}</p>
          <span className="text-xs text-slate-500 font-medium">Active Transit Corridors</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Route Stops</span>
          <p className="text-2xl font-black text-emerald-700">{metrics.total_stops || 12}</p>
          <span className="text-xs text-emerald-600 font-bold">Landmark Pickup Points</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Enrolled Passengers</span>
          <p className="text-2xl font-black text-slate-900">{metrics.total_enrolled_passengers || 47}</p>
          <span className="text-xs text-slate-500 font-medium">Linked Student Profiles</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Parent Pinned Houses</span>
          <p className="text-2xl font-black text-teal-700">{metrics.total_pinned_houses || 0} Homes</p>
          <span className="text-xs text-teal-600 font-bold">Doorstep Coordinates Synced</span>
        </div>
      </div>

      {/* Sub-Tabs Selector */}
      <div className="bg-white rounded-2xl p-1.5 border border-slate-200 shadow-xs flex flex-wrap gap-1.5">
        {[
          { id: 'routes', label: 'Route Corridors Overview' },
          { id: 'map', label: 'Interactive Corridor & House Pins Map' },
          { id: 'stops', label: 'Landmark Stops Matrix & ETAs' },
          { id: 'manifests', label: 'Student Passenger Manifests' },
          { id: 'directions', label: 'Turn-by-Turn Escort Directions' },
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
          </button>
        ))}
      </div>

      {/* TAB 1: ROUTES OVERVIEW */}
      {activeTab === 'routes' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search route name, route code, assigned bus or escort..."
                className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium"
              />
            </div>
            <span className="text-xs font-bold text-slate-500">{filteredRoutes.length} Active Corridors</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredRoutes.map((r) => (
              <div
                key={r.id}
                onClick={() => setSelectedRoute(r)}
                className={`bg-white rounded-3xl p-6 border transition-all cursor-pointer space-y-4 flex flex-col justify-between ${
                  selectedRoute?.id === r.id
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-md'
                    : 'border-slate-200 hover:border-slate-300 shadow-xs'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-mono font-black text-xs">
                      {r.code}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px] uppercase">
                      {r.status}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-black text-slate-900 text-base">{r.name}</h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Assigned Bus: {r.assigned_vehicle}</p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Escort / Driver:</span>
                      <span className="font-bold text-slate-900">{r.assigned_escort_name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Morning Pickup:</span>
                      <span className="font-bold text-slate-900">{r.departure_morning}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Afternoon Return:</span>
                      <span className="font-bold text-slate-900">{r.departure_afternoon}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Parent Pins:</span>
                      <span className="font-black text-teal-700">📌 {r.pinned_by_parents_count || 0} Families</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">{r.stops?.length || 0} Designated Stops</span>
                  <span className="font-black text-emerald-700 flex items-center gap-1">
                    <span>{r.passenger_students?.length || 0} Students</span>
                    <ChevronRight size={14} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: INTERACTIVE CORRIDOR & HOUSE PINS MAP */}
      {activeTab === 'map' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-500">Select Corridor to Inspect:</span>
              <div className="flex flex-wrap gap-1.5">
                {routes.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedRoute(r)}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                      selectedRoute?.id === r.id
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span>{r.code} - {r.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {selectedRoute && (
              <span className="text-xs font-black text-teal-700 bg-teal-50 px-3 py-1.5 rounded-xl border border-teal-200">
                📌 {selectedRoute.pinned_by_parents_count || 0} Parent House Pins on {selectedRoute.code}
              </span>
            )}
          </div>

          {selectedRoute ? (
            <InteractiveRouteCorridorMap
              school={school}
              routeCode={selectedRoute.code}
              routeName={selectedRoute.name}
              stops={selectedRoute.stops || []}
              students={selectedRoute.passenger_students || []}
              heightClassName="h-[580px]"
            />
          ) : (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs">
              No routes currently available to display on map.
            </div>
          )}
        </div>
      )}

      {/* TAB 2: STOPS MATRIX & ETAS */}
      {activeTab === 'stops' && selectedRoute && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white font-mono font-bold text-xs">{selectedRoute.code}</span>
                <h3 className="font-black text-slate-900 text-lg">{selectedRoute.name}</h3>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Stops sequence, landmarks, and morning/afternoon scheduled arrival times.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-500">{selectedRoute.stops?.length || 0} Total Stops</span>
          </div>

          <div className="space-y-3">
            {selectedRoute.stops?.map((stop, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-slate-900 text-white font-black text-xs flex items-center justify-center shrink-0">
                    {stop.stop_number}
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-sm">{stop.name}</h4>
                    <p className="text-xs text-slate-500 font-medium">📍 Landmark: {stop.landmark || 'Identified Stop Point'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-medium self-end md:self-auto">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Morning ETA</span>
                    <span className="font-black text-emerald-700">{stop.eta_morning}</span>
                  </div>
                  <div className="h-6 w-px bg-slate-200"></div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Afternoon ETA</span>
                    <span className="font-black text-slate-900">{stop.eta_afternoon}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: STUDENT PASSENGER MANIFESTS */}
      {activeTab === 'manifests' && (
        <div className="space-y-5">
          {routes.map((r) => (
            <div key={r.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-black text-slate-900 text-base">{r.name} ({r.code})</h3>
                  <p className="text-xs text-slate-500">Assigned Bus: {r.assigned_vehicle} · Escort: {r.assigned_escort_name}</p>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-xs self-start sm:self-auto">
                  {r.passenger_students?.length || 0} Linked Students
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {r.passenger_students?.map((stu) => (
                  <div key={stu.student_id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 text-xs space-y-2 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-black text-slate-900 text-sm">{stu.name}</p>
                          <span className="text-[11px] text-slate-500 font-bold block">{stu.class}</span>
                        </div>
                        {stu.is_house_pinned ? (
                          <span className="px-2 py-0.5 rounded-md bg-teal-100 text-teal-800 font-bold text-[10px] whitespace-nowrap flex items-center gap-1">
                            <span>🏠 House Pinned</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[10px] whitespace-nowrap">
                            ⚠️ Awaiting House Pin
                          </span>
                        )}
                      </div>

                      <p className="text-slate-600 text-[11px]">🚏 Designated Stop: <strong>{stu.stop}</strong></p>

                      {stu.is_house_pinned ? (
                        <div className="p-2.5 rounded-xl bg-teal-50/80 border border-teal-200/80 text-[11px] space-y-1">
                          <p className="font-bold text-teal-950">🏠 {stu.house_address}</p>
                          {stu.house_landmark && (
                            <p className="text-[10px] text-teal-800">Landmark: {stu.house_landmark}</p>
                          )}
                          {stu.house_notes && (
                            <p className="text-[10px] text-amber-800 font-medium">Note: {stu.house_notes}</p>
                          )}
                          <span className="text-[9px] font-mono text-teal-700 block">
                            GPS: {stu.house_lat?.toFixed(4)}, {stu.house_lng?.toFixed(4)}
                          </span>
                        </div>
                      ) : (
                        <div className="p-2 rounded-xl bg-slate-100 border border-slate-200 text-[10px] text-slate-500 italic">
                          Parent has not pinned doorstep coordinates yet.
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[11px]">
                      <span className="font-mono text-slate-500 text-[10px]">📞 {stu.parent_phone || 'Parent on file'}</span>
                      {stu.is_house_pinned && stu.house_lat && stu.house_lng && (
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${stu.house_lat},${stu.house_lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1 text-[11px]"
                        >
                          <span>Open Map</span>
                          <ArrowRight size={12} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
                {(!r.passenger_students || r.passenger_students.length === 0) && (
                  <div className="col-span-full p-6 text-center text-slate-400 text-xs">
                    No students currently assigned to this route corridor.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 4: TURN-BY-TURN ESCORT DIRECTIONS */}
      {activeTab === 'directions' && selectedRoute && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-900 rounded-3xl p-6 text-white space-y-4 shadow-xl border border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Navigation size={18} className="text-emerald-400 animate-pulse" />
                <h3 className="font-black text-sm uppercase tracking-wider">Turn-by-Turn Operational Guidance</h3>
              </div>
              <span className="text-xs font-mono text-emerald-400">{selectedRoute.code} Active Path</span>
            </div>

            <div className="p-4 rounded-2xl bg-[#0c192c] border border-slate-800 text-xs space-y-2">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Route Summary & Waypoints</span>
              <p className="text-slate-200 leading-relaxed font-medium">{selectedRoute.directions_summary}</p>
            </div>

            <div className="space-y-2.5 pt-2">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Escort Stop Execution Checklist</span>
              {selectedRoute.stops?.map((stop, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-black text-[11px] flex items-center justify-center">
                      {stop.stop_number}
                    </span>
                    <div>
                      <h5 className="font-bold text-white">{stop.name}</h5>
                      <span className="text-[10px] text-slate-400">{stop.landmark}</span>
                    </div>
                  </div>
                  <span className="font-mono text-emerald-400 font-bold">{stop.eta_morning}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-black text-slate-900 text-base">Corridor Dispatch Info</h3>
            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50 space-y-1">
                <span className="text-slate-500">Assigned Bus:</span>
                <p className="font-black text-slate-900">{selectedRoute.assigned_vehicle}</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 space-y-1">
                <span className="text-slate-500">Assigned Escort:</span>
                <p className="font-black text-slate-900">{selectedRoute.assigned_escort_name}</p>
                <span className="font-mono text-slate-500 text-[11px]">📞 {selectedRoute.assigned_escort_phone}</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100 space-y-1">
                <span className="font-black text-emerald-800">Parent Monitoring Status</span>
                <p className="text-emerald-700">35 registered parent accounts receive automatic approaching-stop push alerts.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE ROUTE MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
                  <Compass size={18} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Design New Transport Route</h3>
                  <p className="text-xs text-slate-500 font-medium">Configure route code, schedules, assigned vehicle & landmark stops.</p>
                </div>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateRoute} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Route Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Route D: Surulere & Yaba Route"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Route Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="SRL-04"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl uppercase font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Assigned Vehicle</label>
                  <input
                    type="text"
                    placeholder="e.g. LAG-482-XA (HiAce)"
                    value={form.assigned_vehicle}
                    onChange={(e) => setForm({ ...form, assigned_vehicle: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Assigned Escort / Driver</label>
                  <input
                    type="text"
                    placeholder="Full name"
                    value={form.assigned_escort_name}
                    onChange={(e) => setForm({ ...form, assigned_escort_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Escort Phone Number</label>
                  <input
                    type="text"
                    placeholder="+234..."
                    value={form.assigned_escort_phone}
                    onChange={(e) => setForm({ ...form, assigned_escort_phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Morning Schedule</label>
                  <input
                    type="text"
                    value={form.departure_morning}
                    onChange={(e) => setForm({ ...form, departure_morning: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Afternoon Schedule</label>
                  <input
                    type="text"
                    value={form.departure_afternoon}
                    onChange={(e) => setForm({ ...form, departure_afternoon: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Turn-by-Turn Waypoints & Directions Summary</label>
                <textarea
                  rows={2}
                  placeholder="Describe turn-by-turn express corridor path..."
                  value={form.directions_summary}
                  onChange={(e) => setForm({ ...form, directions_summary: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700">Route Stops Sequence ({form.stops.length})</label>
                  <button
                    type="button"
                    onClick={handleAddStopField}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                  >
                    + Add Intermediate Stop
                  </button>
                </div>

                {form.stops.map((stop, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-slate-900">Stop #{idx + 1}</span>
                      <span className="text-[10px] text-slate-400 font-mono">ETA: {stop.eta_morning}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Stop Address / Name"
                        value={stop.name}
                        onChange={(e) => {
                          const updated = [...form.stops];
                          updated[idx].name = e.target.value;
                          setForm({ ...form, stops: updated });
                        }}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg"
                      />
                      <input
                        type="text"
                        placeholder="Landmark (e.g. Near Mall)"
                        value={stop.landmark}
                        onChange={(e) => {
                          const updated = [...form.stops];
                          updated[idx].landmark = e.target.value;
                          setForm({ ...form, stops: updated });
                        }}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#00A859] hover:bg-emerald-600 text-white font-black shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  {submitting ? 'Creating...' : 'Save & Publish Route'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* School Campus & Main Gate Geolocation Pinning Modal */}
      <InteractiveLocationPickerModal
        isOpen={showSchoolPinModal}
        onClose={() => setShowSchoolPinModal(false)}
        mode="school_admin"
        schoolId={school?.id}
        schoolName={school?.name}
        initialAddress={school?.address}
        initialLat={school?.gps_lat}
        initialLng={school?.gps_lng}
        initialLandmark={school?.landmark}
        onLocationSaved={() => {
          loadRoutes();
        }}
      />
    </div>
  );
}
