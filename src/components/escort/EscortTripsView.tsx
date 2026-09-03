// @ts-nocheck
'use client';

import { useState } from 'react';
import {
  Car,
  MapPin,
  Clock,
  CheckCircle2,
  Users,
  QrCode,
  ShieldCheck,
  AlertTriangle,
  Play,
  RotateCcw,
  Sparkles,
  Phone,
  Search,
  ChevronRight,
  Shield,
  Navigation
} from 'lucide-react';
import { toast } from 'sonner';

interface EscortTripsViewProps {
  liveDashboardData: any;
  onRefreshData: () => void;
  onOpenVerificationModal: (student?: any) => void;
  onOpenIncidentModal: () => void;
}

export default function EscortTripsView({
  liveDashboardData,
  onRefreshData,
  onOpenVerificationModal,
  onOpenIncidentModal,
}: EscortTripsViewProps) {
  const [activeTab, setActiveTab] = useState<'morning' | 'afternoon'>('morning');
  const [tripStarted, setTripStarted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const route = liveDashboardData?.route || {};
  const vehicle = liveDashboardData?.vehicle || {};
  const studentsList = activeTab === 'morning' ? (liveDashboardData?.students?.manifest || []) : (liveDashboardData?.students?.manifest || []);
  const stops = route.stops || [];

  const handleStartTrip = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/escorts/dashboard-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start_trip', trip_type: activeTab }),
      });
      const data = await res.json();
      if (res.ok) {
        setTripStarted(true);
        toast.success(`${activeTab === 'morning' ? 'Morning Pickup' : 'Afternoon Drop-off'} Trip Started! Live tracking active.`);
        onRefreshData();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to start trip');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompleteTrip = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/escorts/dashboard-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete_trip', trip_type: activeTab }),
      });
      const data = await res.json();
      if (res.ok) {
        setTripStarted(false);
        toast.success(`Trip completed successfully! Attendance and custody logs archived.`);
        onRefreshData();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete trip');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStudentStatusChange = async (studentId: string, nextStatus: string) => {
    try {
      const res = await fetch('/api/escorts/dashboard-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_student_status', student_id: studentId, status: nextStatus }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Student status updated to ${nextStatus.replace(/_/g, ' ')}`);
        onRefreshData();
      }
    } catch (err: any) {
      toast.error(err.message || 'Status update failed');
    }
  };

  const filteredStudents = studentsList.filter((s: any) => {
    if (!searchQuery.trim()) return true;
    return `${s.name} ${s.student_id_number} ${s.class_name}`.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-6">
      {/* 1. ROUTE & TRIP HEADER CONSOLE */}
      <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wider">
                {route.code || 'RT-01'}
              </span>
              <h2 className="text-lg md:text-xl font-black text-slate-900">{route.name || 'Transit Route'}</h2>
            </div>
            <p className="text-xs text-slate-500 font-medium flex items-center gap-2">
              <span>Vehicle: <strong className="text-slate-800 font-bold">{vehicle.vehicle_name || vehicle.name || 'HiAce Bus'}</strong> ({vehicle.plate_number || vehicle.regNumber || 'LAG-104-ED'})</span>
              <span>•</span>
              <span>Capacity: <strong className="text-slate-800 font-bold">{vehicle.capacity || 14} Seats</strong></span>
            </p>
          </div>

          {/* Trip Mode Switcher & Start Button */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-slate-100 p-1 rounded-2xl flex items-center gap-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTab('morning')}
                className={`px-3 py-1.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer ${
                  activeTab === 'morning' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                🌅 Morning Pickup
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('afternoon')}
                className={`px-3 py-1.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer ${
                  activeTab === 'afternoon' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                🏫 Afternoon Drop-off
              </button>
            </div>

            {!tripStarted ? (
              <button
                type="button"
                onClick={handleStartTrip}
                disabled={isProcessing}
                className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                <Play size={14} className="fill-white" />
                <span>Start {activeTab === 'morning' ? 'Pickup' : 'Drop-off'} Trip</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCompleteTrip}
                disabled={isProcessing}
                className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-md flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span>Complete Trip</span>
              </button>
            )}
          </div>
        </div>

        {/* Route Stops Timeline */}
        <div className="pt-3 border-t border-slate-100">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-2">
            Scheduled Stops ({stops.length})
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {stops.map((stop: any, i: number) => (
              <div key={stop.id || i} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px] flex items-center justify-center shrink-0">
                    {i + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="font-extrabold text-slate-900 text-xs truncate">{stop.stop_name}</p>
                    <p className="text-[10px] text-slate-500 font-medium">
                      {activeTab === 'morning' ? `Pickup: ${stop.pickup_time || '07:15 AM'}` : `Drop-off: ${stop.dropoff_time || '02:45 PM'}`}
                    </p>
                  </div>
                </div>
                <Navigation size={14} className="text-slate-400 shrink-0 ml-2" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 2. PASSENGER MANIFEST & ONBOARDING CONTROLS */}
      <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-base text-slate-900">Passenger Roster &amp; Status</h3>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-xs">
              {filteredStudents.length} Students
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search students..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
            <button
              type="button"
              onClick={onOpenIncidentModal}
              className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-extrabold text-xs flex items-center gap-1 cursor-pointer transition-all shrink-0"
            >
              <AlertTriangle size={13} />
              <span>Report Incident</span>
            </button>
          </div>
        </div>

        {/* Student Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredStudents.map((st: any) => {
            const isPicked = st.status === 'ON_BOARD' || st.status === 'PICKED_UP' || st.status === 'PICKED';
            const isDropped = st.status === 'DROPPED_OFF';

            return (
              <div key={st.id} className="p-4 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200 flex flex-col justify-between gap-3 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={st.photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                      alt={st.name}
                      className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-xs shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
                      }}
                    />
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-xs leading-tight">{st.name}</h4>
                      <p className="text-[10px] text-slate-500 font-mono">S/ID: {st.student_id_number}</p>
                      <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md bg-slate-200/80 text-slate-700 font-bold text-[9px]">
                        {st.class_name || 'Class'}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold shrink-0 ${
                      isDropped
                        ? 'bg-blue-100 text-blue-800'
                        : isPicked
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {isDropped ? 'Dropped Off' : isPicked ? 'On Board' : 'Scheduled'}
                  </span>
                </div>

                <div className="text-[10px] text-slate-600 bg-white p-2.5 rounded-xl border border-slate-100 space-y-1">
                  <p className="flex items-center gap-1.5">
                    <MapPin size={12} className="text-slate-400" />
                    <span>Stop: {st.pickup_address || 'Designated Stop'}</span>
                  </p>

                  {/* House Pin & Direct Turn-by-Turn Navigation */}
                  {st.house_lat && st.house_lng ? (
                    <div className="pt-1.5 mt-1 border-t border-slate-100 space-y-1">
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0 flex-1">
                          <span className="font-extrabold text-teal-800 block truncate">
                            🏠 {st.house_address || 'Doorstep Pinned'}
                          </span>
                          {st.house_landmark && (
                            <p className="text-[9px] text-slate-500 truncate">Landmark: {st.house_landmark}</p>
                          )}
                          {st.house_notes && (
                            <p className="text-[9px] text-amber-800 font-medium truncate">Note: {st.house_notes}</p>
                          )}
                        </div>
                        {st.google_maps_nav_url ? (
                          <a
                            href={st.google_maps_nav_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-extrabold text-[9px] flex items-center gap-1 shrink-0 shadow-2xs"
                          >
                            <Navigation size={10} />
                            <span>Navigate</span>
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[9px] text-slate-400 italic">No house doorstep pinned by parent yet.</p>
                  )}

                  <p className="flex items-center gap-1.5 text-slate-500 font-medium pt-1">
                    <Phone size={12} className="text-slate-400" />
                    <span>Guardian: {st.parent_phone || '0803 123 4567'}</span>
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => onOpenVerificationModal(st)}
                    className="flex-1 py-1.5 px-2 rounded-xl bg-white hover:bg-slate-200 text-slate-800 font-extrabold text-[11px] border border-slate-200 flex items-center justify-center gap-1 cursor-pointer transition-all shadow-2xs"
                  >
                    <QrCode size={13} className="text-emerald-600" />
                    <span>Verify ID</span>
                  </button>

                  {!isPicked ? (
                    <button
                      type="button"
                      onClick={() => handleStudentStatusChange(st.id, 'ON_BOARD')}
                      className="flex-1 py-1.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] flex items-center justify-center gap-1 cursor-pointer transition-all shadow-xs"
                    >
                      <CheckCircle2 size={13} />
                      <span>Board Student</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleStudentStatusChange(st.id, 'DROPPED_OFF')}
                      className="flex-1 py-1.5 px-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[11px] flex items-center justify-center gap-1 cursor-pointer transition-all shadow-xs"
                    >
                      <ShieldCheck size={13} />
                      <span>Confirm Drop-off</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {filteredStudents.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-400 text-xs">
              No students found matching current search.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
