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
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'active' | 'completed'>('all');

  const route = liveDashboardData?.route || {};
  const vehicle = liveDashboardData?.vehicle || {};
  const escort = liveDashboardData?.escort || {};
  const earnings = liveDashboardData?.earnings_summary || {};
  const isReady = Boolean(escort?.ready_for_pickup);

  const studentsList = liveDashboardData?.students?.manifest || [];
  const stops = route.stops || [];

  const handleToggleReady = async () => {
    setIsProcessing(true);
    try {
      const nextState = !isReady;
      const res = await fetch('/api/escorts/dashboard-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_ready_for_pickup', ready: nextState }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(nextState ? 'Ready for Pickup activated! Students roster queued.' : 'Pickup mode set to standby.');
        onRefreshData();
      } else {
        toast.error(data.error || 'Failed to update ready status');
      }
    } catch {
      toast.error('Network error updating pickup status');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartTrip = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/escorts/dashboard-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start_trip', trip_type: activeTab }),
      });
      if (res.ok) {
        setTripStarted(true);
        toast.success(`${activeTab === 'morning' ? 'Morning Home Pickup' : 'Afternoon School Drop-off'} Trip Started! Live tracking active.`);
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

  // Dedicated custody sign in/out transitions
  const handleCustodyAction = async (studentId: string, actionName: string, label: string) => {
    try {
      const res = await fetch('/api/escorts/dashboard-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: actionName, student_id: studentId }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || `${label} confirmed successfully!`);
        onRefreshData();
      } else {
        toast.error(data.error || `Failed to confirm ${label.toLowerCase()}`);
      }
    } catch {
      toast.error('Network error updating custody status');
    }
  };

  // Filter students based on search and stage
  const filteredStudents = studentsList.filter((s: any) => {
    const matchesSearch = !searchQuery.trim() || `${s.name} ${s.student_id_number} ${s.class_name} ${s.school_name}`.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (statusFilter === 'all') return true;

    if (activeTab === 'morning') {
      if (statusFilter === 'pending') return s.morning_status === 'PENDING_HOME_PICKUP';
      if (statusFilter === 'active') return s.morning_status === 'PICKED_UP_FROM_HOME';
      if (statusFilter === 'completed') return s.morning_status === 'DROPPED_OFF_AT_SCHOOL';
    } else {
      if (statusFilter === 'pending') return s.afternoon_status === 'PENDING_SCHOOL_PICKUP';
      if (statusFilter === 'active') return s.afternoon_status === 'PICKED_UP_FROM_GATE';
      if (statusFilter === 'completed') return s.afternoon_status === 'SAFE_AT_HOME';
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* 1. ROUTE & TRIP HEADER CONSOLE */}
      <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wider">
                {route.code || 'RT-01'}
              </span>
              <h2 className="text-lg md:text-xl font-black text-slate-900">{route.name || 'Transit Route'}</h2>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">
                {liveDashboardData?.school?.name || 'Assigned School Fleet'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium flex flex-wrap items-center gap-2">
              <span>Vehicle: <strong className="text-slate-800 font-bold">{vehicle.vehicle_name || vehicle.name || 'HiAce Bus'}</strong> ({vehicle.plate_number || vehicle.regNumber || 'LAG-104-ED'})</span>
              <span>•</span>
              <span>Capacity: <strong className="text-slate-800 font-bold">{vehicle.capacity || 14} Seats</strong></span>
              <span>•</span>
              <span>CM Approved Earnings: <strong className="text-emerald-700 font-black">{earnings.formatted_total_daily_earnings || '₦0'}</strong></span>
            </p>
          </div>

          {/* Quick "I am ready for pick up" button & Mode Switcher */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleToggleReady}
              disabled={isProcessing}
              className={`px-4 py-2 rounded-2xl font-black text-xs transition-all flex items-center gap-2 shadow-xs cursor-pointer border ${
                isReady
                  ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
                  : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 animate-pulse'
              }`}
              title="Click to signal to parents and City Manager that you are ready for pickup"
            >
              <Sparkles size={14} />
              <span>{isReady ? '✓ READY FOR PICK UP' : 'I AM READY FOR PICK UP'}</span>
            </button>

            <div className="bg-slate-100 p-1 rounded-2xl flex items-center gap-1 border border-slate-200">
              <button
                type="button"
                onClick={() => { setActiveTab('morning'); setStatusFilter('all'); }}
                className={`px-3 py-1.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer ${
                  activeTab === 'morning' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                🌅 Morning: Home ➔ School
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('afternoon'); setStatusFilter('all'); }}
                className={`px-3 py-1.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer ${
                  activeTab === 'afternoon' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                🏫 Afternoon: School ➔ Home
              </button>
            </div>

            {!tripStarted ? (
              <button
                type="button"
                onClick={handleStartTrip}
                disabled={isProcessing}
                className="px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                <Play size={14} className="fill-white" />
                <span>Start {activeTab === 'morning' ? 'Morning' : 'Afternoon'} Run</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCompleteTrip}
                disabled={isProcessing}
                className="px-4 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-md flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span>Complete Route</span>
              </button>
            )}
          </div>
        </div>

        {/* Route Stops Timeline */}
        <div className="pt-3 border-t border-slate-100">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-2">
            Scheduled Stops ({stops.length}) · {activeTab === 'morning' ? 'Ascending Pickup Order' : 'Reverse Drop-off Order'}
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

      {/* 2. PASSENGER MANIFEST & CUSTODY PIPELINE */}
      <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base text-slate-900">
                {activeTab === 'morning' ? 'Morning Pickup & Sign-In Manifest' : 'Afternoon Reverse Drop-Off Manifest'}
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-xs">
                {filteredStudents.length} Students
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeTab === 'morning'
                ? 'Step 1: Pick up from home doorstep ➔ Step 2: Safe sign-in drop off at school gate'
                : 'Step 1: Sign out from school gate ➔ Step 2: Safe home delivery at doorstep'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-56">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search student or school..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2 py-1 rounded-lg ${statusFilter === 'all' ? 'bg-white shadow-2xs text-slate-900' : 'text-slate-500'}`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('pending')}
                className={`px-2 py-1 rounded-lg ${statusFilter === 'pending' ? 'bg-white shadow-2xs text-slate-900' : 'text-slate-500'}`}
              >
                Pending
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`px-2 py-1 rounded-lg ${statusFilter === 'active' ? 'bg-white shadow-2xs text-slate-900' : 'text-slate-500'}`}
              >
                In Transit
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('completed')}
                className={`px-2 py-1 rounded-lg ${statusFilter === 'completed' ? 'bg-white shadow-2xs text-slate-900' : 'text-slate-500'}`}
              >
                Delivered
              </button>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStudents.map((st: any) => {
            const isMorning = activeTab === 'morning';
            const isCmApproved = st.city_manager_approved;

            // Morning Custody Stage
            const morningPicked = st.morning_status === 'PICKED_UP_FROM_HOME' || st.morning_status === 'DROPPED_OFF_AT_SCHOOL';
            const morningDelivered = st.morning_status === 'DROPPED_OFF_AT_SCHOOL';

            // Afternoon Custody Stage
            const afternoonPicked = st.afternoon_status === 'PICKED_UP_FROM_GATE' || st.afternoon_status === 'SAFE_AT_HOME';
            const afternoonDelivered = st.afternoon_status === 'SAFE_AT_HOME';

            return (
              <div key={st.id} className="p-4 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200 flex flex-col justify-between gap-3 transition-all">
                {/* Top: Photo, Student Name, School & City Manager Approval */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={st.photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                      alt={st.name}
                      className="w-12 h-12 rounded-2xl object-cover border-2 border-white shadow-xs shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
                      }}
                    />
                    <div className="min-w-0">
                      <h4 className="font-black text-slate-900 text-xs leading-tight truncate">{st.name}</h4>
                      <p className="text-[10px] text-slate-500 font-mono truncate">{st.school_name || 'Assigned School'}</p>
                      <div className="flex flex-wrap items-center gap-1 mt-0.5">
                        <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-bold text-[9px]">
                          {st.class_name || 'Class'}
                        </span>
                        {isCmApproved ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[9px]" title="Approved by City Manager">
                            <ShieldCheck size={10} /> CM Approved
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-extrabold text-[9px]" title="Pending City Manager review">
                            <Clock size={10} /> Pending CM
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Pricing Badge */}
                  <div className="text-right shrink-0">
                    <span className="text-[9px] uppercase font-extrabold text-slate-400 block">CM Fare</span>
                    <span className="font-black text-emerald-700 text-xs">
                      {isMorning ? st.formatted_morning_fare || '₦1,750' : st.formatted_afternoon_fare || '₦1,750'}
                    </span>
                    <span className="text-[8px] text-slate-400 block">
                      ({st.formatted_daily_fare || '₦3,500'}/day)
                    </span>
                  </div>
                </div>

                {/* Address & Doorstep Pin Navigation */}
                <div className="text-[10px] text-slate-600 bg-white p-2.5 rounded-xl border border-slate-100 space-y-1.5">
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1 text-slate-700 font-bold">
                        <MapPin size={11} className="text-emerald-600 shrink-0" />
                        <span className="truncate">{st.house_address || st.pickup_address || 'Designated Pickup Stop'}</span>
                      </p>
                      {st.house_landmark && (
                        <p className="text-[9px] text-slate-500 pl-4 truncate">Landmark: {st.house_landmark}</p>
                      )}
                    </div>
                    {st.house_lat && st.house_lng && (
                      <a
                        href={st.google_maps_nav_url || `https://www.google.com/maps/dir/?api=1&destination=${st.house_lat},${st.house_lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-extrabold text-[9px] flex items-center gap-1 shrink-0 shadow-2xs"
                      >
                        <Navigation size={10} />
                        <span>Navigate</span>
                      </a>
                    )}
                  </div>

                  <p className="flex items-center justify-between text-slate-500 pt-1 border-t border-slate-100 font-medium">
                    <span className="flex items-center gap-1">
                      <Phone size={10} className="text-slate-400" />
                      <span>{st.parent_name || 'Guardian'}: {st.parent_phone || '0803 123 4567'}</span>
                    </span>
                    <a href={`tel:${st.parent_phone || '08031234567'}`} className="text-emerald-700 font-bold hover:underline">
                      Call
                    </a>
                  </p>
                </div>

                {/* 3. CUSTODY TRANSITION PIPELINE (Morning Pick & Drop vs Afternoon Reverse) */}
                <div className="space-y-2 pt-1 border-t border-slate-200">
                  {isMorning ? (
                    // MORNING: Step 1 (Home Pickup) -> Step 2 (School Dropoff)
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                        <span>Morning Route Status</span>
                        <span className={morningDelivered ? 'text-emerald-700' : morningPicked ? 'text-blue-700' : 'text-amber-700'}>
                          {morningDelivered ? '✓ Delivered at School' : morningPicked ? '● On Board Transit' : '○ Waiting at Home'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {/* Step 1: Pick up from home */}
                        <button
                          type="button"
                          onClick={() => handleCustodyAction(st.id, 'morning_home_pickup', 'Home Pickup')}
                          disabled={morningPicked}
                          className={`py-1.5 px-2 rounded-xl text-[11px] font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                            morningPicked
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 cursor-default opacity-80'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                          }`}
                        >
                          <CheckCircle2 size={12} />
                          <span>{morningPicked ? '1. Picked at Home' : '1. Home Pickup'}</span>
                        </button>

                        {/* Step 2: Drop off at school */}
                        <button
                          type="button"
                          onClick={() => handleCustodyAction(st.id, 'morning_school_dropoff', 'School Gate Delivery')}
                          disabled={!morningPicked || morningDelivered}
                          className={`py-1.5 px-2 rounded-xl text-[11px] font-extrabold flex items-center justify-center gap-1 transition-all ${
                            morningDelivered
                              ? 'bg-blue-50 text-blue-800 border border-blue-200 cursor-default opacity-80'
                              : morningPicked
                              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer'
                              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          <ShieldCheck size={12} />
                          <span>{morningDelivered ? '2. School Signed In' : '2. School Drop-Off'}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    // AFTERNOON REVERSE: Step 1 (School Gate Pickup) -> Step 2 (Home Safe Delivery)
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                        <span>Afternoon Reverse Status</span>
                        <span className={afternoonDelivered ? 'text-emerald-700' : afternoonPicked ? 'text-purple-700' : 'text-amber-700'}>
                          {afternoonDelivered ? '✓ Safe at Home' : afternoonPicked ? '● In Transit Home' : '○ Waiting at Gate'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {/* Step 1: Pick up from school gate */}
                        <button
                          type="button"
                          onClick={() => handleCustodyAction(st.id, 'afternoon_school_pickup', 'School Gate Pickup')}
                          disabled={afternoonPicked}
                          className={`py-1.5 px-2 rounded-xl text-[11px] font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                            afternoonPicked
                              ? 'bg-purple-50 text-purple-800 border border-purple-200 cursor-default opacity-80'
                              : 'bg-purple-600 hover:bg-purple-700 text-white shadow-xs'
                          }`}
                        >
                          <CheckCircle2 size={12} />
                          <span>{afternoonPicked ? '1. School Signed Out' : '1. School Pickup'}</span>
                        </button>

                        {/* Step 2: Safe home delivery */}
                        <button
                          type="button"
                          onClick={() => handleCustodyAction(st.id, 'afternoon_home_dropoff', 'Safe Home Delivery')}
                          disabled={!afternoonPicked || afternoonDelivered}
                          className={`py-1.5 px-2 rounded-xl text-[11px] font-extrabold flex items-center justify-center gap-1 transition-all ${
                            afternoonDelivered
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 cursor-default opacity-80'
                              : afternoonPicked
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer'
                              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          <ShieldCheck size={12} />
                          <span>{afternoonDelivered ? '2. Delivered Home' : '2. Home Drop-Off'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ID Verification Modal Trigger */}
                  <button
                    type="button"
                    onClick={() => onOpenVerificationModal(st)}
                    className="w-full py-1.5 px-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-extrabold text-[10px] border border-slate-200 flex items-center justify-center gap-1 cursor-pointer transition-all shadow-2xs"
                  >
                    <QrCode size={12} className="text-emerald-600" />
                    <span>Scan / Verify Passcode ID</span>
                  </button>
                </div>
              </div>
            );
          })}

          {filteredStudents.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-400 text-xs">
              No students found matching your criteria.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

