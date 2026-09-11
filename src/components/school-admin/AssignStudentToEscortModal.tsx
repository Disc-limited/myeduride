// @ts-nocheck
'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  X,
  MapPin,
  Car,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  Navigation,
  FileText,
  UserCheck,
  Zap,
  Info,
  Layers,
  ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';

interface AssignStudentToEscortModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultEscortType?: 'school_escort' | 'myeduride_escort';
  defaultEscortId?: string;
  defaultStudentId?: string;
}

export default function AssignStudentToEscortModal({
  isOpen,
  onClose,
  onSuccess,
  defaultEscortType = 'school_escort',
  defaultEscortId = '',
  defaultStudentId = '',
}: AssignStudentToEscortModalProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Escort type selection
  const [escortType, setEscortType] = useState<'school_escort' | 'myeduride_escort'>(defaultEscortType);
  const [selectedEscortId, setSelectedEscortId] = useState<string>(defaultEscortId);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(defaultStudentId);

  // Form options from backend
  const [pinnedStudents, setPinnedStudents] = useState<any[]>([]);
  const [unpinnedStudents, setUnpinnedStudents] = useState<any[]>([]);
  const [schoolEscorts, setSchoolEscorts] = useState<any[]>([]);
  const [myedurideEscorts, setMyedurideEscorts] = useState<any[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);

  // Trip details
  const [tripType, setTripType] = useState<'two_way' | 'morning_only' | 'afternoon_only'>('two_way');
  const [pickupTime, setPickupTime] = useState('07:00');
  const [dropoffTime, setDropoffTime] = useState('15:30');
  const [startDate, setStartDate] = useState('');
  const [notes, setNotes] = useState('');

  // Default start date to tomorrow
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setStartDate(tomorrow.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (defaultEscortType) setEscortType(defaultEscortType);
  }, [defaultEscortType]);

  useEffect(() => {
    if (defaultEscortId) setSelectedEscortId(defaultEscortId);
  }, [defaultEscortId]);

  useEffect(() => {
    if (defaultStudentId) setSelectedStudentId(defaultStudentId);
  }, [defaultStudentId]);

  // Load data on open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);

    fetch('/api/school-admin/escort/assign-student')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load assignment data');
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        if (data.success) {
          setPinnedStudents(data.pinned_students || []);
          setUnpinnedStudents(data.unpinned_students || []);
          setSchoolEscorts(data.school_escorts || []);
          setMyedurideEscorts(data.myeduride_escorts || []);
          setSchoolInfo(data.school || null);

          // If no escort selected, select first available
          if (!selectedEscortId) {
            if (escortType === 'school_escort' && data.school_escorts?.length > 0) {
              setSelectedEscortId(data.school_escorts[0].id);
            } else if (escortType === 'myeduride_escort' && data.myeduride_escorts?.length > 0) {
              setSelectedEscortId(data.myeduride_escorts[0].id);
            }
          }

          // If no student selected and pinned students exist, select the first pinned student
          if (!selectedStudentId && data.pinned_students?.length > 0) {
            setSelectedStudentId(data.pinned_students[0].id);
          }
        }
      })
      .catch((err) => {
        console.error('[AssignStudentModal] load error:', err);
        toast.error('Failed to load students and escorts roster.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // When escortType toggles, ensure selectedEscortId updates to an escort of that type
  useEffect(() => {
    if (escortType === 'school_escort') {
      if (!schoolEscorts.some((e) => e.id === selectedEscortId) && schoolEscorts.length > 0) {
        setSelectedEscortId(schoolEscorts[0].id);
      }
    } else {
      if (!myedurideEscorts.some((e) => e.id === selectedEscortId) && myedurideEscorts.length > 0) {
        setSelectedEscortId(myedurideEscorts[0].id);
      }
    }
  }, [escortType, schoolEscorts, myedurideEscorts]);

  // Selected student details
  const selectedStudent = useMemo(() => {
    return pinnedStudents.find((s) => s.id === selectedStudentId);
  }, [pinnedStudents, selectedStudentId]);

  // Calculate fare breakdown
  const fareEstimates = useMemo(() => {
    if (!selectedStudent) return { distance: 3.5, morning: 1525, afternoon: 1525, total: 3050 };
    const distance = Number(selectedStudent.estimated_distance_km) || 3.5;
    const baseFare = 1000;
    const perKmRate = 150;
    const morning = Math.round(baseFare + distance * perKmRate);
    const afternoon = Math.round(baseFare + distance * perKmRate);
    let total = morning + afternoon;
    if (tripType === 'morning_only') total = morning;
    if (tripType === 'afternoon_only') total = afternoon;
    return {
      distance,
      morning,
      afternoon,
      total,
    };
  }, [selectedStudent, tripType]);

  // Selected escort details
  const selectedEscort = useMemo(() => {
    const pool = escortType === 'school_escort' ? schoolEscorts : myedurideEscorts;
    return pool.find((e) => e.id === selectedEscortId);
  }, [escortType, schoolEscorts, myedurideEscorts, selectedEscortId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedStudentId) {
      return toast.error('Please select an eligible student.');
    }

    if (!selectedStudent) {
      return toast.error(
        'The selected student has not pinned their house address yet. Only students with pinned addresses can be assigned.'
      );
    }

    if (!selectedEscortId) {
      return toast.error('Please select an escort.');
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/school-admin/escort/assign-student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: selectedStudentId,
          escort_id: selectedEscortId,
          escort_type: escortType,
          trip_type: tripType,
          pickup_time: pickupTime,
          dropoff_time: dropoffTime,
          start_date: startDate,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to complete assignment');
      }

      toast.success(
        data.message || 'Student assigned to escort! City Manager notified for immediate clearance.'
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign student to escort');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200 font-sans">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 my-8 overflow-hidden">
        {/* MODAL HEADER */}
        <div className="bg-gradient-to-r from-[#07132B] via-[#0B1E36] to-[#0A1633] p-6 text-white flex items-start justify-between relative">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-black text-[10px] uppercase tracking-wider border border-emerald-400/30 flex items-center gap-1">
                <ShieldCheck size={12} /> School Operations Roster
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-black text-[10px] uppercase tracking-wider border border-amber-400/30">
                City Manager Approved Flow
              </span>
            </div>
            <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2 mt-1">
              <UserCheck className="text-emerald-400" size={22} />
              Assign Student to Escort
            </h2>
            <p className="text-xs text-slate-300 max-w-lg">
              Assign students to school staff or vetted MyEduRide escorts. Only students with parents&apos; pinned doorstep addresses can be assigned.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* BODY */}
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-500 font-bold">Loading verified escorts &amp; pinned students...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
            {/* ESCORT TYPE TOGGLE */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                1. Select Escort Category
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setEscortType('school_escort')}
                  className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all flex items-start gap-3 ${
                    escortType === 'school_escort'
                      ? 'border-emerald-600 bg-emerald-50/70 shadow-xs ring-2 ring-emerald-500/20'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/60'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      escortType === 'school_escort'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    <Layers size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-xs text-slate-900">School Escort</span>
                      {escortType === 'school_escort' && (
                        <CheckCircle2 size={13} className="text-emerald-600" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium leading-snug mt-0.5">
                      School-employed transport staff &amp; school bus coordinators ({schoolEscorts.length})
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setEscortType('myeduride_escort')}
                  className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all flex items-start gap-3 ${
                    escortType === 'myeduride_escort'
                      ? 'border-indigo-600 bg-indigo-50/70 shadow-xs ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/60'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      escortType === 'myeduride_escort'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-xs text-slate-900">MyEduRide Escort</span>
                      {escortType === 'myeduride_escort' && (
                        <CheckCircle2 size={13} className="text-indigo-600" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium leading-snug mt-0.5">
                      Vetted &amp; certified area escorts with live GPS tracking ({myedurideEscorts.length})
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* ESCORT SELECTOR */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                2. Select Assigned Escort ({escortType === 'school_escort' ? 'School Fleet' : 'MyEduRide Roster'})
              </label>
              <div className="relative">
                <select
                  value={selectedEscortId}
                  onChange={(e) => setSelectedEscortId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all appearance-none cursor-pointer"
                >
                  {escortType === 'school_escort' ? (
                    schoolEscorts.length > 0 ? (
                      schoolEscorts.map((esc) => (
                        <option key={esc.id} value={esc.id}>
                          {esc.full_name} · 📞 {esc.phone} · 🚌 {esc.vehicle_plate || 'Bus Assigned'} ({esc.status})
                        </option>
                      ))
                    ) : (
                      <option value="">No School Escorts registered yet</option>
                    )
                  ) : (
                    myedurideEscorts.length > 0 ? (
                      myedurideEscorts.map((esc) => (
                        <option key={esc.id} value={esc.id}>
                          {esc.full_name} · ⭐ {esc.rating} · 📍 {esc.operating_area || 'Zone Verified'} · 📞 {esc.phone}
                        </option>
                      ))
                    ) : (
                      <option value="">No vetted MyEduRide Escorts available in zone</option>
                    )
                  )}
                </select>
                <ChevronDown size={16} className="absolute right-4 top-3.5 text-slate-400 pointer-events-none" />
              </div>
              {selectedEscort && (
                <div className="px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
                  <span>
                    Escort: <strong className="text-slate-900">{selectedEscort.full_name}</strong> · Phone: <strong className="text-slate-900">{selectedEscort.phone}</strong>
                  </span>
                  <span className="font-mono text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">
                    {selectedEscort.status || 'Active'}
                  </span>
                </div>
              )}
            </div>

            {/* STRICT PINNED ADDRESS RULE - STUDENT SELECTION */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                  3. Select Student (Pinned Address Only)
                </label>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  {pinnedStudents.length} Eligible · {unpinnedStudents.length} Address Not Pinned
                </span>
              </div>

              {pinnedStudents.length === 0 ? (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 font-black">
                    <AlertTriangle size={16} className="text-amber-600" />
                    <span>No Students with Pinned House Addresses</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Escorts can only be assigned after parents have typed and pinned their house address on the map in the Parent Portal. Please notify parents to complete their address pinning.
                  </p>
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all appearance-none cursor-pointer"
                  >
                    <optgroup label="✅ Eligible Students (Parents Pinned House Address)">
                      {pinnedStudents.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.class_name || 'Student'}) — 📍 {s.house_address} ({s.estimated_distance_km} km)
                        </option>
                      ))}
                    </optgroup>

                    {unpinnedStudents.length > 0 && (
                      <optgroup label="⛔ Ineligible (Parent has NOT pinned address yet)" disabled>
                        {unpinnedStudents.map((s) => (
                          <option key={s.id} value={s.id} disabled>
                            {s.name} ({s.class_name || 'Student'}) — [Address Not Pinned]
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <ChevronDown size={16} className="absolute right-4 top-3.5 text-slate-400 pointer-events-none" />
                </div>
              )}

              {/* PINNED STUDENT DETAILS CARD */}
              {selectedStudent && (
                <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                      <strong className="text-emerald-950 font-black text-sm">{selectedStudent.name}</strong>
                      <span className="text-[10px] text-emerald-800 bg-emerald-200/60 px-2 py-0.5 rounded-md font-bold">
                        {selectedStudent.class_name}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-800 font-bold bg-white px-2 py-0.5 rounded border border-emerald-300">
                      📍 {Number(selectedStudent.house_lat).toFixed(4)}, {Number(selectedStudent.house_lng).toFixed(4)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-700 pt-1 border-t border-emerald-200/60">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Pinned Doorstep Address</span>
                      <strong className="text-slate-900">{selectedStudent.house_address}</strong>
                      {selectedStudent.house_landmark && (
                        <span className="block text-[10px] text-amber-800 font-semibold mt-0.5">
                          Landmark: {selectedStudent.house_landmark}
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Parent Contact</span>
                      <span className="text-slate-900 font-medium">
                        {selectedStudent.parent_name} · 📞 {selectedStudent.parent_phone}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* UNPINNED NOTICE (IF ANY) */}
              {unpinnedStudents.length > 0 && (
                <div className="px-3 py-2 rounded-xl bg-amber-50/60 border border-amber-200/60 text-[11px] text-amber-800 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Info size={14} className="text-amber-600 shrink-0" />
                    <span>{unpinnedStudents.length} student(s) currently awaiting parent address pinning.</span>
                  </span>
                  <span className="text-[10px] font-bold text-amber-900 underline">Parent Reminder Ready</span>
                </div>
              )}
            </div>

            {/* AUTOMATIC DOORSTEP DISTANCE & FARE DECK */}
            <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-3 shadow-md">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Navigation size={15} className="text-emerald-400" />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                    Distance &amp; Fare Engine (School ↔ Pinned Home)
                  </span>
                </div>
                <span className="font-mono text-emerald-400 font-black text-xs">
                  📏 {fareEstimates.distance} km
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700">
                  <span className="text-[10px] text-slate-400 block font-bold">Morning Trip</span>
                  <span className="font-mono font-black text-slate-100">
                    ₦{fareEstimates.morning.toLocaleString()}
                  </span>
                </div>
                <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700">
                  <span className="text-[10px] text-slate-400 block font-bold">Afternoon Trip</span>
                  <span className="font-mono font-black text-slate-100">
                    ₦{fareEstimates.afternoon.toLocaleString()}
                  </span>
                </div>
                <div className="bg-emerald-950/60 p-2 rounded-xl border border-emerald-500/40">
                  <span className="text-[10px] text-emerald-300 block font-bold">Daily Total</span>
                  <span className="font-mono font-black text-emerald-400 text-sm">
                    ₦{fareEstimates.total.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* TRIP SCHEDULE & TYPE CONFIGURATION */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
                  Trip Type
                </label>
                <select
                  value={tripType}
                  onChange={(e: any) => setTripType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="two_way">Two-way (Both Ways)</option>
                  <option value="morning_only">Morning Only</option>
                  <option value="afternoon_only">Afternoon Only</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block flex items-center gap-1">
                  <Clock size={12} /> Morning Pickup
                </label>
                <input
                  type="time"
                  value={pickupTime}
                  onChange={(e) => setPickupTime(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block flex items-center gap-1">
                  <Calendar size={12} /> Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* SPECIAL INSTRUCTIONS / NOTES */}
            <div className="space-y-1">
              <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
                Special Route &amp; Pickup Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="e.g. Escort should meet student at gated estate security post..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* IMMEDIATE CITY MANAGER NOTIFICATION BANNER */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 text-xs flex items-start gap-2.5">
              <Zap size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <strong className="block font-black text-slate-900 text-xs">
                  Immediate City Manager Operations Dispatch
                </strong>
                <p className="text-[11px] text-slate-600 leading-snug">
                  Once submitted, this assignment will instantly appear in the City Manager Operations Queue for immediate clearance. Parents and escorts receive instant automated notifications upon City Manager verification.
                </p>
              </div>
            </div>

            {/* ACTIONS */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !selectedStudentId || pinnedStudents.length === 0}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-black text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Assigning &amp; Dispatching to CM...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    <span>Confirm &amp; Submit for CM Clearance</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
