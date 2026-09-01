// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import {
  ShieldCheck,
  UserCheck,
  Phone,
  MessageCircle,
  Car,
  Compass,
  Clock,
  Sparkles,
  Navigation,
  CheckCircle2,
  Calendar,
  KeyRound,
  AlertTriangle,
  ArrowRight,
  RefreshCcw,
  Plus,
  X,
  Radio,
  MapPin,
  ChevronRight,
  Shield,
  Gauge,
  Layers,
  FileCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { photoSrc } from '@/lib/photo';
import StudentAvatar from '@/components/shared/StudentAvatar';
import SharedRideEscortView from '@/components/parent/SharedRideEscortView';
import SchoolEscortView from '@/components/parent/SchoolEscortView';
import LiveJourneyModal from '@/components/parent/LiveJourneyModal';

export type SafetyPillarTab = 'school_escort' | 'myeduride_escort' | 'shared_ride_escort' | 'edrive';

interface SafetyConnectViewProps {
  initialTab?: SafetyPillarTab;
  childrenList: any[];
  onClose?: () => void;
}

export default function SafetyConnectView({
  initialTab = 'school_escort',
  childrenList = [],
  onClose,
}: SafetyConnectViewProps) {
  const [activePillar, setActivePillar] = useState<SafetyPillarTab>(initialTab);
  const [selectedChildId, setSelectedChildId] = useState(childrenList[0]?.id || 'STU-001');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [liveRadarOpen, setLiveRadarOpen] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    operating_area: 'Victoria Island / Oniru / Lekki',
    pickup_date: new Date().toISOString().split('T')[0],
    pickup_time: '03:30 PM',
    pickup_location: '1044 Ademola Adetokunbo St, Victoria Island',
    reason: 'School Escort Unavailable / Urgent Leave',
  });
  const [submittingBooking, setSubmittingBooking] = useState(false);

  useEffect(() => {
    if (initialTab) {
      setActivePillar(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    loadSafetyData();
  }, [selectedChildId]);

  const loadSafetyData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/parent/safety-connect?child_id=${selectedChildId}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setData(json.safety_connect);
      } else {
        toast.error(json.error || 'Failed to load safety data');
      }
    } catch {
      toast.error('Network error loading safety connect');
    } finally {
      setLoading(false);
    }
  };

  const handleBookMyEduRide = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingBooking(true);
    try {
      const selectedChild = childrenList.find((c) => c.id === selectedChildId);
      const childName = selectedChild ? `${selectedChild.first_name} ${selectedChild.last_name}` : 'David James';

      const res = await fetch('/api/parent/safety-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'request_myeduride_ride',
          child_id: selectedChildId,
          child_name: childName,
          ...bookingForm,
        }),
      });

      const resJson = await res.json();
      if (res.ok && resJson.success) {
        toast.success('MyEduRide Ride Request Submitted!', {
          description: 'Your request has been sent to the City Manager for area escort assignment and approval.',
          duration: 6000,
        });
        setBookingModalOpen(false);
        setActivePillar('myeduride_escort');
        loadSafetyData();
      } else {
        toast.error(resJson.error || 'Booking failed');
      }
    } catch {
      toast.error('Error submitting booking');
    } finally {
      setSubmittingBooking(false);
    }
  };

  const selectedChildObj = childrenList.find((c) => c.id === selectedChildId) || childrenList[0] || {
    first_name: 'Student',
    last_name: '',
    class_name: 'Enrolled Class',
  };

  const activeBooking = data?.active_bookings?.[0];

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden font-sans">
      {/* Top Safety Connect Banner & Child Switcher */}
      <div className="p-5 sm:p-6 bg-gradient-to-r from-[#07132B] via-[#0B1E36] to-[#0A1633] text-white space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider border border-emerald-400/30 flex items-center gap-1">
                <ShieldCheck size={12} /> Safety Connect Command Center
              </span>
              <span className="text-xs text-slate-400 font-mono">Unified Mobility</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
              Safety &amp; Mobility Hub
            </h2>
            <p className="text-xs text-slate-300 font-medium">
              One clear safety area covering: <strong>School Escort → MyEduRide Escort → E-Drive</strong>
            </p>
          </div>

          {/* Child Switcher */}
          {childrenList.length > 0 && (
            <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-700/60">
              <span className="text-[11px] font-bold text-slate-400 pl-2">Child:</span>
              <select
                value={selectedChildId}
                onChange={(e) => setSelectedChildId(e.target.value)}
                className="bg-transparent text-white text-xs font-bold focus:outline-none pr-3 cursor-pointer"
              >
                {childrenList.map((c) => (
                  <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                    {c.first_name} {c.last_name} ({c.class_name || 'Student'})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 3-Pillar Seamless Tab Bar */}
        <div className="grid grid-cols-3 gap-2 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setActivePillar('school_escort')}
            className={`py-2.5 px-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activePillar === 'school_escort'
                ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <UserCheck size={15} />
            <span>School Escort</span>
          </button>

          <button
            type="button"
            onClick={() => setActivePillar('myeduride_escort')}
            className={`py-2.5 px-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activePillar === 'myeduride_escort'
                ? 'bg-amber-400 text-slate-950 font-black shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Sparkles size={15} />
            <span>MyEduRide Escort</span>
          </button>

          <button
            type="button"
            onClick={() => setActivePillar('edrive')}
            className={`py-2.5 px-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activePillar === 'edrive'
                ? 'bg-cyan-400 text-slate-950 font-black shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Navigation size={15} />
            <span>E-Drive Tracking</span>
          </button>
        </div>
      </div>

      {/* Pillar Body Content */}
      <div className="p-5 sm:p-6 bg-slate-50/50">
        {loading && !data ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-400">Loading Safety Connect Command Center...</p>
          </div>
        ) : (
          <>
            {/* ========================================================================= */}
            {/* PILLAR 1: SCHOOL ESCORT                                                   */}
            {/* ========================================================================= */}
            {activePillar === 'school_escort' && (
              <SchoolEscortView
                childrenList={childrenList}
                escortData={data?.school_escort}
                onSelectSafetyPillar={(p) => setActivePillar(p as SafetyPillarTab)}
              />
            )}

        {/* ========================================================================= */}
        {/* PILLAR 2: MYEDURIDE ESCORT (5-STAGE WORKFLOW & AREA ASSIGNMENT)             */}
        {/* ========================================================================= */}
        {activePillar === 'myeduride_escort' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* 5-Stage Operational Stepper Bar */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                  <Layers size={13} className="text-amber-500" /> Parent Booking &amp; Assignment Workflow
                </span>
                <span className="text-[11px] font-bold text-amber-800">
                  {activeBooking?.status === 'CONFIRMED' ? 'Stage 5/5: Confirmed' : activeBooking ? 'Stage 2/5: City Manager Review' : 'Ready to Request'}
                </span>
              </div>

              {/* Visual 5-Stage Progress Bar */}
              <div className="grid grid-cols-5 gap-1.5 text-center text-[10px] font-bold">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300">
                  1. Parent Booking
                </div>
                <div className={`p-2 rounded-xl border ${
                  activeBooking
                    ? 'bg-amber-100 text-amber-900 border-amber-300 font-black'
                    : 'bg-slate-100 text-slate-400 border-slate-200'
                }`}>
                  2. CM Review
                </div>
                <div className={`p-2 rounded-xl border ${
                  activeBooking?.status === 'CONFIRMED'
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : 'bg-slate-100 text-slate-400 border-slate-200'
                }`}>
                  3. Escort Assign
                </div>
                <div className={`p-2 rounded-xl border ${
                  activeBooking?.status === 'CONFIRMED'
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : 'bg-slate-100 text-slate-400 border-slate-200'
                }`}>
                  4. Approval
                </div>
                <div className={`p-2 rounded-xl border ${
                  activeBooking?.status === 'CONFIRMED'
                    ? 'bg-emerald-600 text-white font-black shadow-xs'
                    : 'bg-slate-100 text-slate-400 border-slate-200'
                }`}>
                  5. Notified
                </div>
              </div>
            </div>

            {/* Active / Pending Booking Status Card */}
            {activeBooking && (
              <div className={`bg-white p-5 rounded-3xl border shadow-2xs space-y-3 ${
                activeBooking.status === 'CONFIRMED' ? 'border-emerald-300' : 'border-amber-300'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase tracking-wider flex items-center gap-1 ${
                    activeBooking.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900 animate-pulse'
                  }`}>
                    <CheckCircle2 size={12} /> {activeBooking.stage_label || activeBooking.status}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">{activeBooking.booking_id}</span>
                </div>

                <div className={`p-4 rounded-2xl border space-y-3 text-xs ${
                  activeBooking.status === 'CONFIRMED' ? 'bg-emerald-50/60 border-emerald-100' : 'bg-amber-50/60 border-amber-100'
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="font-black text-slate-900 text-sm">{activeBooking.escort_name}</h4>
                      {activeBooking.escort_phone && (
                        <p className="text-slate-600 text-[11px] font-mono">{activeBooking.escort_phone} · {activeBooking.vehicle_plate}</p>
                      )}
                      <p className="text-[11px] text-slate-500 mt-0.5">Operating Area: <strong>{activeBooking.operating_area}</strong></p>
                    </div>

                    {/* Handover Security PIN Box */}
                    {activeBooking.security_pin ? (
                      <div className="p-3 rounded-2xl bg-slate-900 text-white text-center min-w-[140px] shadow-sm">
                        <span className="text-[9px] font-bold uppercase text-amber-400 tracking-wider block">Handover PIN</span>
                        <span className="text-xl font-black font-mono tracking-widest text-white">{activeBooking.security_pin}</span>
                        <span className="text-[8px] text-slate-400 block mt-0.5">Verify with escort</span>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-amber-200/60 text-amber-900 text-center min-w-[140px] text-[10px] font-bold">
                        PIN generated upon City Manager approval
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 text-[11px] text-slate-700">
                    <p>Date: <strong>{activeBooking.pickup_date}</strong> at <strong>{activeBooking.pickup_time}</strong></p>
                    <p>Pickup Stop: <strong>{activeBooking.pickup_location}</strong></p>
                    <p className="col-span-2 text-slate-500">Reason: {activeBooking.reason}</p>
                  </div>
                </div>
              </div>
            )}

            {/* City Manager Vetted Escorts Section */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-black text-slate-900">City Manager Approved Platform Escorts</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    When your School Escort is unavailable, the City Manager assigns the best available escort in your area.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setBookingModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-[#0B1E36] hover:bg-[#07132B] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
                >
                  <Plus size={14} /> Request Ride for {selectedChildObj.first_name}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data?.myeduride_escorts?.map((escort) => (
                  <div key={escort.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 text-xs">
                    <div className="flex items-center gap-3.5">
                      <StudentAvatar
                        photoUrl={escort.avatar_url}
                        fullName={escort.full_name}
                        size="md"
                        className="w-12 h-12 rounded-2xl shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-black text-slate-900 truncate">{escort.full_name}</p>
                          <span className="text-amber-500 font-bold">★ {escort.rating}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono">{escort.phone}</p>
                        <p className="text-[10px] text-emerald-700 font-bold">✓ {escort.approval_badge}</p>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white border border-slate-100 text-[11px] space-y-1">
                      <p className="text-slate-600">Operating Zone: <strong>{escort.operating_area}</strong></p>
                      <p className="text-slate-600">Assigned Vehicle: <strong>{escort.vehicle}</strong></p>
                      <p className="text-emerald-700 font-bold">Status: {escort.status}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setBookingForm((prev) => ({ ...prev, operating_area: escort.operating_area }));
                        setBookingModalOpen(true);
                      }}
                      className="w-full py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs cursor-pointer transition-all shadow-2xs text-center"
                    >
                      Request Ride in {escort.operating_area.split('/')[0]}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PILLAR: SHARED RIDE ESCORT                                                */}
        {/* ========================================================================= */}
        {activePillar === 'shared_ride_escort' && (
          <SharedRideEscortView
            childrenList={childrenList}
            onSelectSafetyPillar={(p) => setActivePillar(p as SafetyPillarTab)}
          />
        )}

        {/* ========================================================================= */}
        {/* PILLAR 3: E-DRIVE (LIVE TRACKING & MOBILITY TELEMETRY)                     */}
        {/* ========================================================================= */}
        {activePillar === 'edrive' && data?.edrive && (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* Live Telemetry KPI Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Transit State</span>
                <p className="text-sm font-black text-emerald-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> En Route to School
                </p>
                <span className="text-[10px] text-slate-500 font-mono">Trip #{data.edrive.trip_id}</span>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Estimated Arrival</span>
                <p className="text-xl font-black text-slate-900">{data.edrive.estimated_arrival_time}</p>
                <span className="text-[10px] text-emerald-700 font-bold">~{data.edrive.eta_minutes} mins remaining</span>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Vehicle Speed</span>
                <p className="text-xl font-black text-slate-900">{data.edrive.current_speed_kmh} <span className="text-xs font-normal">km/h</span></p>
                <span className="text-[10px] text-slate-500 font-medium">Limit: {data.edrive.speed_limit_kmh} km/h</span>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 shadow-2xs space-y-1">
                <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider flex items-center gap-1">
                  <Gauge size={12} /> Safety Score
                </span>
                <p className="text-xl font-black text-emerald-950">{data.edrive.safety_score}/100</p>
                <span className="text-[10px] text-emerald-700 font-bold">Optimal Safety Record</span>
              </div>
            </div>

            {/* Boarding Event & Corridor Waypoint Progress */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-4 text-xs">
              {data.edrive.child_boarding_event ? (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="font-black text-slate-900">
                      ✓ {selectedChildObj.first_name} Boarded at {data.edrive.child_boarding_event.boarded_at || '7:42 AM'}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Stop: {data.edrive.child_boarding_event.boarded_stop || 'School Gate'} · Verified by {data.edrive.child_boarding_event.scanned_by || 'Escort'}
                    </p>
                  </div>
                  <span className="px-2 py-1 rounded-md bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">
                    {data.edrive.child_boarding_event.verification_method || 'NIN / QR Verified'}
                  </span>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-slate-700">
                      ● {selectedChildObj.first_name} Boarding Status: Pending
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Child has not boarded the transit vehicle yet for this session.
                    </p>
                  </div>
                  <span className="px-2 py-1 rounded-md bg-amber-100 text-amber-900 font-mono text-[10px] font-bold">
                    Awaiting Scan
                  </span>
                </div>
              )}

              {/* Waypoint Timeline */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  Corridor Waypoint Progress
                </span>

                <div className="space-y-2.5">
                  {data.edrive.corridor_waypoints?.map((wp) => (
                    <div
                      key={wp.seq}
                      className={`p-3 rounded-2xl flex items-center justify-between text-xs transition-all ${
                        wp.status === 'COMPLETED'
                          ? 'bg-emerald-50/70 border border-emerald-200 text-emerald-950'
                          : wp.status === 'IN_PROGRESS'
                          ? 'bg-amber-50 border border-amber-300 text-amber-950 font-bold'
                          : 'bg-slate-50 border border-slate-100 text-slate-500'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                          wp.status === 'COMPLETED'
                            ? 'bg-emerald-600 text-white'
                            : wp.status === 'IN_PROGRESS'
                            ? 'bg-amber-500 text-white animate-pulse'
                            : 'bg-slate-200 text-slate-600'
                        }`}>
                          {wp.seq}
                        </span>
                        <div>
                          <p className="font-bold">{wp.name}</p>
                          <p className="text-[10px] opacity-75">{wp.status === 'COMPLETED' ? 'Passed' : wp.status === 'IN_PROGRESS' ? 'Transit in progress' : 'Scheduled Stop'}</p>
                        </div>
                      </div>

                      <span className="font-mono text-[11px] font-bold">{wp.time}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button: Launch Full Live Radar */}
              <button
                type="button"
                onClick={() => setLiveRadarOpen(true)}
                className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
              >
                <Radio className="w-4 h-4 animate-pulse" />
                <span>Open Live Radar GPS Tracking Map</span>
              </button>
            </div>
          </div>
        )}

        {/* Live Journey Fullscreen Radar Modal */}
        <LiveJourneyModal
          isOpen={liveRadarOpen}
          onClose={() => setLiveRadarOpen(false)}
          childName={selectedChildObj ? `${selectedChildObj.first_name} ${selectedChildObj.last_name}` : 'David James'}
          escortName="Officer John Okonkwo"
          escortCode="ESC-4089"
          vehicleModel="Toyota Hiace (Gold Shield)"
          licensePlate="LAG-894-XA"
          routeName="Ikeja - Maryland - Surulere Route"
          sessionId="demo-active-session"
        />
          </>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 5-STAGE PARENT RIDE REQUEST MODAL                                         */}
      {/* ========================================================================= */}
      {bookingModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs font-sans">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">Request MyEduRide Ride</h3>
                <p className="text-[11px] text-slate-500">Sent to City Manager for area escort assignment &amp; approval</p>
              </div>
              <button
                type="button"
                onClick={() => setBookingModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleBookMyEduRide} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Child</label>
                <input
                  type="text"
                  disabled
                  value={`${selectedChildObj.first_name} ${selectedChildObj.last_name}`}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-700"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Operating Zone / Municipal Area *</label>
                <select
                  value={bookingForm.operating_area}
                  onChange={(e) => setBookingForm({ ...bookingForm, operating_area: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                >
                  <option value="Victoria Island / Oniru / Lekki">Victoria Island / Oniru / Lekki Phase 1</option>
                  <option value="Ikeja / Maryland / GRA">Ikeja / Maryland / Ikeja GRA</option>
                  <option value="Surulere / Yaba">Surulere / Yaba / Stadium</option>
                  <option value="Ikoyi / Banana Island">Ikoyi / Parkview / Banana Island</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Pickup Date *</label>
                  <input
                    type="date"
                    required
                    value={bookingForm.pickup_date}
                    onChange={(e) => setBookingForm({ ...bookingForm, pickup_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Pickup Time *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 03:30 PM"
                    value={bookingForm.pickup_time}
                    onChange={(e) => setBookingForm({ ...bookingForm, pickup_time: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Pickup Address / Stop Location</label>
                <input
                  type="text"
                  placeholder="e.g. 1044 Ademola Adetokunbo St, Victoria Island"
                  value={bookingForm.pickup_location}
                  onChange={(e) => setBookingForm({ ...bookingForm, pickup_location: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Reason for Request</label>
                <select
                  value={bookingForm.reason}
                  onChange={(e) => setBookingForm({ ...bookingForm, reason: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="School Escort Unavailable / Urgent Leave">Regular School Escort Unavailable / On Leave</option>
                  <option value="After-School Activity Pickup">After-School Activity / Tutoring Pickup</option>
                  <option value="Emergency Transit Request">Emergency Transit Request</option>
                  <option value="Private Schedule Change">Private Schedule Change</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setBookingModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingBooking}
                  className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black cursor-pointer shadow-xs"
                >
                  {submittingBooking ? 'Submitting...' : 'Submit to City Manager'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
