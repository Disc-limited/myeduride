// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { ClipboardList, RefreshCw, Search, UserPlus, Sparkles, CheckCircle2, ShieldCheck, Clock, MapPin, Phone, Car, Users, ArrowRightLeft, Footprints, AlertTriangle, Zap, CheckCheck, Info, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import StudentAvatar from '@/components/shared/StudentAvatar';
import InteractiveLocationPickerModal from '@/components/shared/InteractiveLocationPickerModal';

type Operations = {
  schools: any[];
  escorts: any[];
  bookings: any[];
  assignments: any[];
  walk_home_records?: any[];
  audit: any[];
  students: any[];
  parent_requests?: any[];
  deputising_records?: any[];
};

const empty: Operations = {
  schools: [],
  escorts: [],
  bookings: [],
  assignments: [],
  walk_home_records: [],
  audit: [],
  students: [],
  parent_requests: [],
  deputising_records: [],
};

const BOOKING_PAGE_SIZE = 5;

export function CityManagerOperationsPanel() {
  const [data, setData] = useState<Operations>(empty);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'requests' | 'active' | 'cleared' | 'deputising' | 'walk_home'>('all');
  const [pinningRequest, setPinningRequest] = useState<any>(null);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [booking, setBooking] = useState<any>({ source: 'parent', schoolId: '', pickupAddress: '', pickupAt: '', tripType: 'both', notes: '' });
  const [dispatch, setDispatch] = useState<any>({ bookingId: '', escortApplicationId: '', schoolId: '', studentId: '', assignmentType: 'standard', notes: '' });
  
  // Selected Escort Assignment Map for Parent Requests
  const [selectedEscortsForParentBookings, setSelectedEscortsForParentBookings] = useState<Record<string, string>>({});
  const [processingBookingId, setProcessingBookingId] = useState<string | null>(null);
  const [batchApproving, setBatchApproving] = useState(false);
  const [bookingPage, setBookingPage] = useState(1);

  // Escort Rosters Filters & In-Place Reassignment Modal State
  const [rosterSchoolFilter, setRosterSchoolFilter] = useState('all');
  const [rosterEscortFilter, setRosterEscortFilter] = useState('all');
  const [reassignModal, setReassignModal] = useState<{
    open: boolean;
    assignment: any | null;
    targetEscortId: string;
    notes: string;
  }>({
    open: false,
    assignment: null,
    targetEscortId: '',
    notes: '',
  });
  const [submittingReassign, setSubmittingReassign] = useState(false);

  // Accountant-Approved Parent Discounted Fee State (Requirement G)
  const [discountModal, setDiscountModal] = useState<{
    open: boolean;
    booking: any | null;
    originalFare: number;
    discountedFare: string;
    discountAmount: string;
    accountantApprovalRef: string;
    accountantName: string;
    discountReason: string;
    tripType: 'both' | 'morning_only' | 'afternoon_only';
    submitting: boolean;
  }>({
    open: false,
    booking: null,
    originalFare: 3500,
    discountedFare: '2500',
    discountAmount: '',
    accountantApprovalRef: '',
    accountantName: 'City Manager',
    discountReason: 'Fare correction',
    tripType: 'both',
    submitting: false,
  });

  const openFareEditor = (req: any) => {
    const studentName = req.child_name
      || (req.student ? `${req.student.first_name || ''} ${req.student.last_name || ''}`.trim() : '')
      || 'Student';
    const schoolName = req.school_name
      || (typeof req.school === 'object' ? req.school?.name : req.school)
      || 'School Campus';
    const standard = Number(req.standard_daily_fare || req.daily_fare || req.actual_amount_collected || 0);
    const current = Number(req.actual_amount_collected || req.daily_fare || standard);
    const savings = standard > current ? standard - current : 0;
    const initialTripType: 'both' | 'morning_only' | 'afternoon_only' =
      req.trip_type === 'morning_only' || req.trip_type === 'afternoon_only'
        ? req.trip_type
        : req.tripType === 'morning_only' || req.tripType === 'afternoon_only'
          ? req.tripType
          : 'both';

    setDiscountModal({
      open: true,
      booking: {
        ...req,
        child_name: studentName,
        school_name: schoolName,
        booking_id: req.booking_id || req.bookingId || null,
        assignment_id: req.assignment_id || req.id || null,
        child_id: req.child_id || req.student_id || req.student?.id || null,
        trip_type: initialTripType,
      },
      originalFare: standard,
      discountedFare: String(current || standard),
      discountAmount: savings > 0 ? String(savings) : '',
      accountantApprovalRef: req.accountant_approval_ref || '',
      accountantName: req.accountant_name || 'City Manager',
      discountReason: req.discount_details?.discountReason || (initialTripType !== 'both' ? `One-way ${initialTripType === 'morning_only' ? 'morning' : 'afternoon'} trip` : 'Fare correction'),
      tripType: initialTripType,
      submitting: false,
    });
  };

  const handleSaveFareCorrection = async () => {
    const dFare = Number(discountModal.discountedFare);
    if (isNaN(dFare) || dFare <= 0) {
      toast.error('Enter a valid daily fare amount');
      return;
    }

    setDiscountModal((prev) => ({ ...prev, submitting: true }));
    try {
      const res = await fetch('/api/city-manager/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'correct_fare',
          bookingId: discountModal.booking?.booking_id,
          assignmentId: discountModal.booking?.assignment_id,
          studentId: discountModal.booking?.child_id,
          originalFare: discountModal.originalFare,
          tripType: discountModal.tripType,
          correctedFare: dFare,
          accountantApprovalRef: discountModal.accountantApprovalRef.trim(),
          accountantName: discountModal.accountantName.trim(),
          discountReason: discountModal.discountReason.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save fare');

      toast.success(json.message || `Fare updated to ₦${dFare.toLocaleString()}/day`);
      setDiscountModal((prev) => ({ ...prev, open: false, submitting: false }));
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Error saving fare');
    } finally {
      setDiscountModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  const applyDiscountAmount = (amountStr: string) => {
    const amount = Number(amountStr);
    const nextFare = Number.isFinite(amount) && amount > 0
      ? Math.max(0, discountModal.originalFare - amount)
      : discountModal.originalFare;
    setDiscountModal((prev) => ({
      ...prev,
      discountAmount: amountStr,
      discountedFare: String(nextFare),
    }));
  };

  // Emergency Deputising State
  const [showDeputiseModal, setShowDeputiseModal] = useState(false);
  const [submittingDeputy, setSubmittingDeputy] = useState(false);
  const [completingDeputyId, setCompletingDeputyId] = useState<string | null>(null);
  const [deputiseForm, setDeputiseForm] = useState({
    school_id: '',
    school_name: '',
    route_name: '',
    original_escort_name: '',
    original_escort_phone: '',
    deputy_escort_id: '',
    deputy_escort_name: '',
    deputy_escort_phone: '',
    emergency_reason: 'School bus mechanical breakdown / delay',
    student_names: '',
    notes: '',
  });

  const load = async (query = search) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/city-manager/operations?view=full${query ? `&q=${encodeURIComponent(query)}` : ''}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setData(d);
    } catch (e: any) {
      toast.error(e.message || 'Could not load City Manager operations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(''); }, []);

  const applyStudent = (student: any) => {
    setSelectedStudent(student);
    setBooking((v: any) => ({ ...v, schoolId: student.school_id }));
    setDispatch((v: any) => ({ ...v, schoolId: student.school_id, studentId: student.id }));
  };

  const createBooking = async () => {
    if (!booking.schoolId) return toast.error('Select a school or student first.');
    const r = await fetch('/api/city-manager/operations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'booking', ...booking, studentId: selectedStudent?.id || null }),
    });
    const d = await r.json();
    if (!r.ok) return toast.error(d.error);
    toast.success('Booking recorded and ready for dispatch.');
    await load();
  };

  const dispatchEscort = async (replacesAssignmentId?: string) => {
    if (!dispatch.escortApplicationId || !dispatch.schoolId) return toast.error('Choose an approved escort and school.');
    const r = await fetch('/api/city-manager/operations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: replacesAssignmentId ? 'reassign' : 'assign', ...dispatch, replacesAssignmentId }),
    });
    const d = await r.json();
    if (!r.ok) return toast.error(d.error);
    toast.success(replacesAssignmentId ? 'Escort reassigned; all parties notified.' : 'Escort assigned; parent, school and escort notified.');
    await load();
  };

  const handleApproveParentBooking = async (bookingId: string, customEscortId?: string) => {
    const escortId = customEscortId || selectedEscortsForParentBookings[bookingId] || (data.escorts.length > 0 ? data.escorts[0].id : null);
    if (!escortId) {
      toast.error('No approved escort available to assign. Please ensure an approved escort exists in the database.');
      return;
    }
    setProcessingBookingId(bookingId);
    try {
      const r = await fetch('/api/city-manager/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve_parent_booking',
          booking_id: bookingId,
          escort_id: escortId,
          notes: 'Approved and cleared by City Manager for verified route corridor transit.',
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Approval failed');
      toast.success(d.message || 'Escort assignment cleared! Parents, school, and escort notified.');
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Approval failed');
    } finally {
      setProcessingBookingId(null);
    }
  };

  const handleBatchApprove = async () => {
    setBatchApproving(true);
    try {
      const pendingSchoolBookings = (data.parent_requests || [])
        .filter((r: any) => r.status !== 'CONFIRMED' && r.source === 'school')
        .map((r: any) => r.booking_id);

      const r = await fetch('/api/city-manager/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'batch_approve_school_assignments',
          booking_ids: pendingSchoolBookings,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Batch approval failed');
      toast.success(d.message || 'All pending school assignments cleared!');
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Batch approval error');
    } finally {
      setBatchApproving(false);
    }
  };

  const active = data.assignments.filter((a) => a.status === 'active');
  const emergencyPool = data.escorts.filter((e) => e.emergency_pool_enabled && e.availability_status === 'available');
  const dispatchEscorts = ['emergency', 'deputy'].includes(dispatch.assignmentType) ? emergencyPool : data.escorts;
  const parentRequests = data.parent_requests || [];
  const bookingTotalPages = Math.max(1, Math.ceil(parentRequests.length / BOOKING_PAGE_SIZE));
  const paginatedRequests = parentRequests.slice(
    (bookingPage - 1) * BOOKING_PAGE_SIZE,
    bookingPage * BOOKING_PAGE_SIZE
  );
  const bookingPageNumbers = (() => {
    if (bookingTotalPages <= 7) return Array.from({ length: bookingTotalPages }, (_, i) => i + 1);
    const start = Math.max(1, Math.min(bookingPage - 2, bookingTotalPages - 4));
    return Array.from({ length: 5 }, (_, i) => start + i).filter((page) => page >= 1 && page <= bookingTotalPages);
  })();

  useEffect(() => {
    if (bookingPage > bookingTotalPages) setBookingPage(bookingTotalPages);
  }, [bookingPage, bookingTotalPages]);

  const handleExecuteReassign = async () => {
    if (!reassignModal.assignment || !reassignModal.targetEscortId) {
      return toast.error('Please select an escort to reassign.');
    }
    setSubmittingReassign(true);
    try {
      const r = await fetch('/api/city-manager/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reassign',
          escortApplicationId: reassignModal.targetEscortId,
          schoolId: reassignModal.assignment.school_id || reassignModal.assignment.school?.id,
          studentId: reassignModal.assignment.student_id || reassignModal.assignment.student?.id,
          replacesAssignmentId: reassignModal.assignment.id,
          notes: reassignModal.notes || 'Reassigned by City Manager',
        }),
      });
      const res = await r.json();
      if (!r.ok) throw new Error(res.error || 'Reassignment failed');
      toast.success('Escort reassigned successfully! Synced to School Admin and Escort.');
      setReassignModal({ open: false, assignment: null, targetEscortId: '', notes: '' });
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reassign escort');
    } finally {
      setSubmittingReassign(false);
    }
  };

  const filteredAssignments = (data.assignments || []).filter((a: any) => {
    const status = String(a.status || '').toLowerCase();
    if (['cancelled', 'canceled', 'reassigned', 'completed', 'inactive'].includes(status)) return false;
    const schoolId = a.school_id || a.school?.id;
    const escortId = a.escort_application_id || a.escort?.id;
    const matchSchool = rosterSchoolFilter === 'all' || schoolId === rosterSchoolFilter;
    const matchEscort = rosterEscortFilter === 'all' || escortId === rosterEscortFilter;
    return matchSchool && matchEscort;
  });

  const confirmDispatch = async (assignmentId: string) => {
    const r = await fetch('/api/city-manager/operations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm_assignment', assignmentId }),
    });
    const d = await r.json();
    if (!r.ok) return toast.error(d.error);
    toast.success('Emergency dispatch confirmed; parent, school and escort notified.');
    await load();
  };

  const togglePool = async (escort: any) => {
    const r = await fetch('/api/city-manager/operations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'set_availability',
        escortApplicationId: escort.id,
        availabilityStatus: escort.emergency_pool_enabled ? 'offline' : 'available',
        emergencyPoolEnabled: !escort.emergency_pool_enabled,
      }),
    });
    const d = await r.json();
    if (!r.ok) return toast.error(d.error);
    await load();
  };

  const handleCreateEmergencyDeputy = async () => {
    if (!deputiseForm.school_id || !deputiseForm.original_escort_name || !deputiseForm.deputy_escort_id) {
      return toast.error('Please select school, original escort, and deputy escort.');
    }
    setSubmittingDeputy(true);
    try {
      const studentNamesList = deputiseForm.student_names
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const r = await fetch('/api/city-manager/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_emergency_deputy',
          school_id: deputiseForm.school_id,
          school_name: deputiseForm.school_name || 'Gracefield International School',
          route_id: 'rt-lekki-01',
          route_name: deputiseForm.route_name || 'Lekki Phase 1 Corridor',
          original_escort_id: 'ESC-SCH-01',
          original_escort_name: deputiseForm.original_escort_name,
          original_escort_phone: deputiseForm.original_escort_phone,
          deputy_escort_id: deputiseForm.deputy_escort_id,
          deputy_escort_name: deputiseForm.deputy_escort_name,
          deputy_escort_phone: deputiseForm.deputy_escort_phone,
          deputy_vehicle_plate: 'SUR-440-XA (Toyota Sienna 2022)',
          student_names: studentNamesList.length > 0 ? studentNamesList : ['David James', 'Esther Paul'],
          student_ids: ['STU-001', 'STU-002'],
          emergency_reason: deputiseForm.emergency_reason,
          notes: deputiseForm.notes,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to dispatch deputy');
      toast.success(d.message || 'Emergency deputy assigned and custody record logged!');
      setShowDeputiseModal(false);
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to dispatch emergency deputy');
    } finally {
      setSubmittingDeputy(false);
    }
  };

  const handleCompleteDeputisingHandover = async (recordId: string) => {
    setCompletingDeputyId(recordId);
    try {
      const r = await fetch('/api/city-manager/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete_deputy_handover',
          record_id: recordId,
          notes: 'Handover verified and recorded in safety ledger.',
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to complete handover');
      toast.success(d.message || 'Handover completed and custody record archived.');
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete handover');
    } finally {
      setCompletingDeputyId(null);
    }
  };

  return (
    <div className="space-y-5 font-sans">
      {/* Top Banner */}
      <div className="rounded-3xl border border-slate-800 bg-gradient-to-r from-[#07132B] via-[#0B1E36] to-[#0A1633] p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider border border-emerald-400/30 flex items-center gap-1">
                <ShieldCheck size={12} /> City Manager Command Portal
              </span>
              <span className="text-xs text-slate-400 font-mono">Area Dispatch Authority</span>
            </div>
            <h3 className="text-xl font-black text-white mt-1">Transport Bookings &amp; Area Escort Dispatch</h3>
            <p className="text-xs text-slate-300 font-medium">
              Review parent ride requests, identify available area escorts, and execute 5-stage approved assignments.
            </p>
          </div>
          <button
            onClick={() => load()}
            className="rounded-xl bg-slate-800 hover:bg-slate-700 p-2.5 text-slate-200 cursor-pointer transition-all"
            title="Refresh operations"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="mt-5 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {loading
            ? Array.from({ length: 5 }).map((_, idx) => (
                <div key={`ops-skel-${idx}`} className="rounded-2xl bg-slate-900/90 border border-slate-800 p-3.5 h-24 animate-pulse" />
              ))
            : (
            <>
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-3.5 text-xs text-slate-400">
            Approved Escorts
            <strong className="mt-1 block text-2xl text-emerald-400 font-black">{data.escorts.length}</strong>
          </div>
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-3.5 text-xs text-slate-400">
            Parent Ride Requests
            <strong className="mt-1 block text-2xl text-amber-400 font-black">{parentRequests.length}</strong>
          </div>
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-3.5 text-xs text-slate-400">
            Active Assignments
            <strong className="mt-1 block text-2xl text-cyan-400 font-black">{active.length}</strong>
          </div>
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-3.5 text-xs text-slate-400">
            Emergency Pool
            <strong className="mt-1 block text-2xl text-purple-400 font-black">{emergencyPool.length}</strong>
          </div>
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-3.5 text-xs text-slate-400">
            Walk-Home Today
            <strong className="mt-1 block text-2xl text-blue-400 font-black">{(data.walk_home_records || []).length}</strong>
          </div>
            </>
              )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ASSIGNED STUDENTS TO ESCORT ROSTER & REAL-TIME REASSIGNMENT               */}
      {/* ========================================================================= */}
      <section className="rounded-3xl border border-cyan-500/30 bg-[#0b1c30] p-6 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-cyan-400" />
            <div>
              <h4 className="text-base font-black text-white">
                Assigned Students & Escort Rosters ({filteredAssignments.length})
              </h4>
              <p className="text-xs text-slate-400">
                Live oversight of all student-to-escort assignments across schools with instant City Manager reassignments.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">Filter School</label>
              <select
                value={rosterSchoolFilter}
                onChange={(e) => setRosterSchoolFilter(e.target.value)}
                className="rounded-xl bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-white"
              >
                <option value="all">All Schools ({data.schools.length})</option>
                {data.schools.map((sc) => (
                  <option key={sc.id} value={sc.id}>{sc.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">Filter Escort</label>
              <select
                value={rosterEscortFilter}
                onChange={(e) => setRosterEscortFilter(e.target.value)}
                className="rounded-xl bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-white"
              >
                <option value="all">All Escorts ({data.escorts.length})</option>
                {data.escorts.map((esc) => (
                  <option key={esc.id} value={esc.id}>{esc.full_name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {filteredAssignments.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-400 text-xs">
            No student escort assignments found matching the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] font-bold">
                  <th className="py-2.5 px-3">Student</th>
                  <th className="py-2.5 px-3">School</th>
                  <th className="py-2.5 px-3">Assigned Escort</th>
                  <th className="py-2.5 px-3">Vehicle & Phone</th>
                  <th className="py-2.5 px-3">Daily Fare</th>
                  <th className="py-2.5 px-3">Date / Status</th>
                  <th className="py-2.5 px-3 text-right sticky right-0 bg-[#0b1c30]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredAssignments.map((a: any) => (
                  <tr key={a.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <StudentAvatar
                          name={a.student ? `${a.student.first_name} ${a.student.last_name}` : 'Student'}
                          photoUrl={a.student?.photo_url}
                          size="sm"
                        />
                        <div>
                          <p className="font-black text-white">
                            {a.student ? `${a.student.first_name} ${a.student.last_name}` : 'Unknown Student'}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {a.student?.student_id_number || a.student_id?.slice(0, 8)} · {typeof a.student?.class === 'object' ? (a.student?.class?.name || 'Class N/A') : (a.student?.class || a.student?.class_name || 'Class N/A')}
                          </p>
                          {a.trip_type === 'morning_only' ? (
                            <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-400/30">
                              🌅 Morning Only (1-Way)
                            </span>
                          ) : a.trip_type === 'afternoon_only' ? (
                            <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-black bg-orange-500/20 text-orange-300 border border-orange-400/30">
                              🌇 Afternoon Only (1-Way)
                            </span>
                          ) : (
                            <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                              🔄 Complete Trip
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-200">
                        {typeof a.school === 'object' ? (a.school?.name || 'Assigned School') : (a.school || a.school_name || 'Assigned School')}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {a.escort ? (
                        <div>
                          <p className="font-bold text-cyan-300">{a.escort.full_name}</p>
                          <p className="text-[10px] text-slate-400">Escort ID: {a.escort.id.slice(0, 8)}</p>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <div className="space-y-0.5">
                        <p className="font-mono text-amber-300 text-[11px]">{a.escort?.vehicle_plate || 'Plate Pending'}</p>
                        <p className="text-[10px] text-slate-400">{a.escort?.phone || 'No phone'}</p>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      {a.is_discounted ? (
                        <div>
                          <p className="text-[10px] text-slate-500 line-through">
                            ₦{Number(a.standard_daily_fare || a.daily_fare || 0).toLocaleString()}
                          </p>
                          <p className="font-black text-amber-300">
                            ₦{Number(a.actual_amount_collected || a.daily_fare || 0).toLocaleString()}
                          </p>
                          <p className="text-[9px] text-amber-400/80 font-bold">Discounted</p>
                        </div>
                      ) : (
                        <p className="font-black text-emerald-300">
                          ₦{Number(a.daily_fare || 0).toLocaleString()}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <div className="space-y-0.5">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          a.status === 'active' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {a.status || 'Active'}
                        </span>
                        <p className="text-[10px] text-slate-500">
                          {a.service_date ? new Date(a.service_date).toLocaleDateString() : 'Today'}
                        </p>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right sticky right-0 bg-[#0b1c30]/95 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const match = parentRequests.find((r: any) =>
                              r.assignment_id === a.id ||
                              (a.booking_id && r.booking_id === a.booking_id) ||
                              (a.student_id && r.child_id === a.student_id)
                            );
                            openFareEditor({
                              ...a,
                              ...(match || {}),
                              booking_id: match?.booking_id || a.booking_id || null,
                              assignment_id: match?.assignment_id || a.id,
                              child_id: match?.child_id || a.student_id,
                              child_name: match?.child_name,
                              school_name: match?.school_name,
                              daily_fare: match?.daily_fare ?? a.daily_fare,
                              standard_daily_fare: match?.standard_daily_fare ?? a.standard_daily_fare,
                              actual_amount_collected: match?.actual_amount_collected ?? a.actual_amount_collected,
                              is_discounted: match?.is_discounted ?? a.is_discounted,
                              accountant_approval_ref: match?.accountant_approval_ref || a.accountant_approval_ref,
                              accountant_name: match?.accountant_name || a.accountant_name,
                              discount_details: match?.discount_details || a.discount_details,
                              trip_type: match?.trip_type || a.trip_type,
                            });
                          }}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/50 text-indigo-200 font-bold text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                        >
                          <Pencil size={13} />
                          Edit Price
                        </button>
                        <button
                          onClick={() => setReassignModal({
                            open: true,
                            assignment: a,
                            targetEscortId: a.escort?.id || (data.escorts[0]?.id || ''),
                            notes: '',
                          })}
                          className="px-3 py-1.5 rounded-xl bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/50 text-cyan-200 font-bold text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                        >
                          <ArrowRightLeft size={13} />
                          Reassign Escort
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* STUDENT ESCORT REQUESTS & CORRIDOR BOOKINGS REVIEW QUEUE                  */}
      {/* ========================================================================= */}
      <section className="rounded-3xl border border-amber-500/30 bg-[#0b1c30] p-6 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
              <Sparkles size={20} />
            </div>
            <div>
              <h4 className="text-base font-black text-white">
                Student Escort Requests &amp; Corridor Bookings Queue ({parentRequests.length})
              </h4>
              <p className="text-xs text-slate-400">
                School Assigned Students &amp; Parent Requests · Automatic Doorstep Distance &amp; Trip Fare Engine
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {parentRequests.some((r: any) => r.status !== 'CONFIRMED' && r.source === 'school') && (
              <button
                type="button"
                disabled={batchApproving}
                onClick={handleBatchApprove}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs cursor-pointer transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
              >
                <Zap size={14} className="fill-slate-950" />
                <span>{batchApproving ? 'Approving All...' : '⚡ Approve All Pending School Assignments'}</span>
              </button>
            )}
            <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 font-black text-[10px] uppercase border border-amber-400/30">
              City Manager Approval Active
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {paginatedRequests.map((req) => (
            <div
              key={req.booking_id}
              className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(220px,0.85fr)_minmax(260px,0.95fr)] gap-4 text-xs text-slate-300 shadow-sm"
            >
              {/* STUDENT & ORIGIN INFO */}
              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-300 font-bold text-[10px] font-mono break-all">
                    {req.booking_id}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                      req.source === 'school'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                    }`}
                  >
                    {req.source === 'school' ? '🏫 School Assigned' : '👤 Parent Request'}
                  </span>
                  {req.escort_type && (
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                      req.escort_type === 'school_escort'
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                        : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                    }`}>
                      {req.escort_type === 'school_escort' ? '🏫 School Escort' : '✨ MyEduRide Escort'}
                    </span>
                  )}
                  {req.trip_type === 'morning_only' ? (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-400/30">
                      🌅 One-Way (Morning Only)
                    </span>
                  ) : req.trip_type === 'afternoon_only' ? (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-orange-500/20 text-orange-300 border border-orange-400/30">
                      🌇 One-Way (Afternoon Only)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                      🔄 Complete Trip
                    </span>
                  )}
                  {(req.house_lat ?? req.lat) != null && (req.house_lng ?? req.lng) != null ? (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      📍 Pinned ({Number(req.house_lat ?? req.lat).toFixed(4)}, {Number(req.house_lng ?? req.lng).toFixed(4)})
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPinningRequest(req)}
                      className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 flex items-center gap-1 cursor-pointer transition-all"
                      title="Click to drop doorstep pin on map"
                    >
                      <span>📍 Address Not Pinned</span>
                      <span className="underline text-amber-200">Pin Now</span>
                    </button>
                  )}
                </div>
                <p className="text-sm font-black text-white break-words">{req.child_name}</p>
                <p className="text-[11px] text-slate-400">
                  School: <strong className="text-slate-200">{req.school_name || 'Designated Campus'}</strong>
                </p>
                <p className="text-[11px] text-slate-400 break-words">
                  📍 Doorstep Stop: <strong className="text-slate-200">{req.pickup_location}</strong>
                </p>
                {req.landmark && (
                  <p className="text-[10px] text-amber-300/90 font-medium">
                    Landmark: <span className="text-slate-200">{req.landmark}</span>
                  </p>
                )}
                <p className="text-[10px] text-slate-400">
                  Time: <strong>{req.pickup_date}</strong> at <strong>{req.pickup_time}</strong>
                </p>
              </div>

              {/* DISTANCE & FARE BREAKDOWN DECK */}
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 min-w-0">
                <div className="flex items-center justify-between text-[11px] gap-2">
                  <span className="text-slate-400 font-bold">Doorstep Distance:</span>
                  <span className="font-mono font-black text-emerald-400">
                    📏 {req.distance_km || 4.2} km
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                  <div className="bg-slate-900 p-1.5 rounded-lg text-center">
                    <span className="text-slate-500 block">Morning Trip</span>
                    <span className="font-bold text-slate-200">₦{Number(req.morning_fare || 0).toLocaleString()}</span>
                  </div>
                  <div className="bg-slate-900 p-1.5 rounded-lg text-center">
                    <span className="text-slate-500 block">Afternoon Trip</span>
                    <span className="font-bold text-slate-200">₦{Number(req.afternoon_fare || 0).toLocaleString()}</span>
                  </div>
                </div>
                {typeof req.service_charge === 'number' ? (
                  <p className="text-[9px] text-slate-500 leading-snug">
                    ₦300 / 0.5 km · ₦30 / 0.1 km · 6% service ₦{Number(req.service_charge).toLocaleString()} per trip
                  </p>
                ) : null}
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800 gap-2">
                  <span className="text-emerald-300 font-bold">Daily Total:</span>
                  <div className="text-right">
                    {req.is_discounted ? (
                      <div>
                        <span className="text-[10px] text-slate-400 line-through mr-1">
                          ₦{Number(req.standard_daily_fare || req.daily_fare || 2000).toLocaleString()}
                        </span>
                        <span className="font-black text-amber-400 text-xs">
                          ₦{Number(req.actual_amount_collected || req.daily_fare).toLocaleString()}
                        </span>
                        {req.accountant_approval_ref ? (
                          <span className="block text-[8px] text-emerald-400 font-bold">
                            ✓ Ref: {req.accountant_approval_ref}
                          </span>
                        ) : (
                          <span className="block text-[8px] text-amber-300 font-bold">Discount applied</span>
                        )}
                      </div>
                    ) : (
                      <span className="font-black text-emerald-400 text-xs">
                        ₦{Number(req.daily_fare || 2000).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => openFareEditor(req)}
                  className="w-full mt-1.5 py-1 px-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 hover:text-white border border-indigo-500/30 text-[10px] font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer"
                >
                  <Pencil size={10} />
                  <span>{req.is_discounted ? 'Edit Fare / Discount' : 'Correct Fare / Discount'}</span>
                </button>
              </div>

              {/* ACTION COLUMN */}
              <div className="rounded-xl border border-slate-700/80 bg-slate-950/70 p-3 space-y-2 min-w-0">
                <p className="text-[10px] uppercase tracking-wider font-black text-slate-400">Action</p>
                {req.status === 'CONFIRMED' ? (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs space-y-2">
                    <div className="flex flex-wrap items-center gap-2 font-bold">
                      <span className="break-words min-w-0 flex-1">✓ Cleared: {req.escort_name}</span>
                      <span className="font-mono bg-slate-900 px-2 py-0.5 rounded text-amber-300 border border-amber-400/30 shrink-0">
                        PIN: {req.security_pin || 'VERIFIED'}
                      </span>
                    </div>
                    {req.escort_phone && (
                      <p className="text-[10px] text-slate-400 font-mono break-all">
                        📞 {req.escort_phone} · 🚗 {req.vehicle_plate || 'Fleet Verified'}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setReassignModal({
                          open: true,
                          assignment: {
                            id: req.assignment_id || req.booking_id,
                            booking_id: req.booking_id,
                            school_id: req.school_id,
                            student_id: req.child_id,
                            student: { first_name: req.child_name, last_name: '' },
                            escort: { full_name: req.escort_name },
                          },
                          targetEscortId: '',
                          notes: 'Emergency operational reassignment by City Manager',
                        });
                      }}
                      className="w-full mt-1 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-black text-[11px] border border-amber-400/30 cursor-pointer transition-all flex items-center justify-center gap-1.5"
                    >
                      <AlertTriangle size={12} />
                      <span>Emergency Reassign Escort</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {req.escort_name && req.escort_name !== 'Awaiting City Manager Assignment' && (
                      <p className="text-[10px] text-emerald-400 font-bold break-words">
                        School Nominated: {req.escort_name}
                      </p>
                    )}
                    <select
                      value={
                        selectedEscortsForParentBookings[req.booking_id] ||
                        req.escort_id ||
                        (data.escorts[0]?.id || '')
                      }
                      onChange={(e) =>
                        setSelectedEscortsForParentBookings((prev) => ({
                          ...prev,
                          [req.booking_id]: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none"
                    >
                      {data.escorts.length === 0 ? (
                        <option value="">No Approved Escorts in Database</option>
                      ) : (
                        data.escorts.map((esc: any) => (
                          <option key={esc.id} value={esc.id}>
                            {esc.full_name} ({esc.operating_area || 'Standard Zone'})
                          </option>
                        ))
                      )}
                    </select>

                    <button
                      type="button"
                      disabled={processingBookingId === req.booking_id}
                      onClick={() =>
                        handleApproveParentBooking(
                          req.booking_id,
                          selectedEscortsForParentBookings[req.booking_id] || req.escort_id
                        )
                      }
                      className="w-full px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs cursor-pointer transition-all shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <CheckCircle2 size={14} />
                      <span>{processingBookingId === req.booking_id ? 'Clearing...' : 'Approve & Clear'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {parentRequests.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-xs">
              No pending student escort requests at this time. All requests have been reviewed, cleared, and synchronized.
            </div>
          )}

          {parentRequests.length > BOOKING_PAGE_SIZE && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
              <p className="text-[11px] text-slate-400 font-medium">
                Showing {(bookingPage - 1) * BOOKING_PAGE_SIZE + 1}–
                {Math.min(bookingPage * BOOKING_PAGE_SIZE, parentRequests.length)} of {parentRequests.length} requests
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={bookingPage <= 1}
                  onClick={() => setBookingPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-[11px] font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 cursor-pointer"
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                {bookingPageNumbers.map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setBookingPage(page)}
                    className={`min-w-[32px] px-2 py-1.5 rounded-lg text-[11px] font-black border cursor-pointer ${
                      page === bookingPage
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={bookingPage >= bookingTotalPages}
                  onClick={() => setBookingPage((p) => Math.min(bookingTotalPages, p + 1))}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-[11px] font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 cursor-pointer"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Manual Transport Booking & Student Search */}
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-800 bg-[#0b1c30] p-5">
          <h4 className="text-sm font-bold text-white">Find a student</h4>
          <p className="mb-3 text-xs text-slate-400">Search individual students and see their school and class.</p>
          <div className="flex gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load(search)}
              placeholder="Student name or ID"
              className="min-w-0 flex-1 rounded-xl bg-slate-900 px-3 py-2 text-xs text-white"
            />
            <button onClick={() => load(search)} className="rounded-xl bg-emerald-600 px-3 text-white cursor-pointer">
              <Search size={15} />
            </button>
          </div>
          {selectedStudent && (
            <p className="mt-3 rounded-lg bg-emerald-500/10 p-2 text-xs text-emerald-300">
              Selected: {selectedStudent.first_name} {selectedStudent.last_name}
            </p>
          )}
          <div className="mt-3 max-h-40 space-y-2 overflow-auto">
            {data.students.map((s) => (
              <button
                key={s.id}
                onClick={() => applyStudent(s)}
                className="block w-full rounded-lg bg-slate-900 p-2 text-left text-xs hover:bg-slate-800 cursor-pointer"
              >
                <b className="text-white">{s.first_name} {s.last_name}</b>
                <span className="ml-2 text-slate-400">{s.school?.name} · {s.class?.grade || ''} {s.class?.name || ''}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-[#0b1c30] p-5">
          <h4 className="text-sm font-bold text-white">Receive transport booking</h4>
          <div className="mt-3 grid gap-2">
            <select
              value={booking.schoolId}
              onChange={(e) => setBooking({ ...booking, schoolId: e.target.value })}
              className="rounded-xl bg-slate-900 p-2 text-xs text-white"
            >
              <option value="">Select school</option>
              {data.schools.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <select
              value={booking.source}
              onChange={(e) => setBooking({ ...booking, source: e.target.value })}
              className="rounded-xl bg-slate-900 p-2 text-xs text-white"
            >
              <option value="parent">Parent</option>
              <option value="sales">Sales</option>
              <option value="business_development">Business Development</option>
              <option value="school">School</option>
            </select>
            <select
              value={booking.tripType || 'both'}
              onChange={(e) => setBooking({ ...booking, tripType: e.target.value })}
              className="rounded-xl bg-slate-900 p-2 text-xs text-white font-bold"
            >
              <option value="both">🔄 Complete Trip (Morning &amp; Afternoon)</option>
              <option value="morning_only">🌅 One-Way: Morning Pickup Only</option>
              <option value="afternoon_only">🌇 One-Way: Afternoon Drop-off Only</option>
            </select>
            <input
              value={booking.pickupAddress}
              onChange={(e) => setBooking({ ...booking, pickupAddress: e.target.value })}
              placeholder="Pickup address / area"
              className="rounded-xl bg-slate-900 p-2 text-xs text-white"
            />
            <button onClick={createBooking} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white cursor-pointer">
              Record booking
            </button>
          </div>
        </section>
      </div>

      {/* ========================================================================= */}
      {/* EMERGENCY DEPUTISING & ACTIVE CUSTODY HUB                                 */}
      {/* ========================================================================= */}
      <section className="rounded-3xl border border-red-500/30 bg-[#0b1c30] p-6 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-red-400" />
            <div>
              <h4 className="text-sm font-black text-white flex items-center gap-2">
                Emergency Deputising Management
                <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[10px] font-extrabold border border-red-500/30">
                  {(data.deputising_records || []).filter((r: any) => r.status === 'ACTIVE_DEPUTY').length} Active Deputised
                </span>
              </h4>
              <p className="text-xs text-slate-400">
                Assign City Manager approved backup escorts to deputise during emergencies. Every transfer is recorded with immutable custody timestamps.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowDeputiseModal(true)}
            className="rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-xs px-4 py-2.5 shadow-md flex items-center gap-2 cursor-pointer transition-all shrink-0"
          >
            <UserPlus size={14} /> Dispatch Emergency Deputy
          </button>
        </div>

        {/* Active Deputised Operations */}
        {(data.deputising_records || []).filter((r: any) => r.status === 'ACTIVE_DEPUTY').length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6 text-center text-xs text-slate-400">
            <ShieldCheck className="mx-auto h-8 w-8 text-slate-600 mb-2" />
            No active emergency deputising operations right now. All standard escorts are on scheduled duty.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {(data.deputising_records || [])
              .filter((r: any) => r.status === 'ACTIVE_DEPUTY')
              .map((rec: any) => (
                <div
                  key={rec.id}
                  className="rounded-2xl border border-red-500/40 bg-gradient-to-br from-slate-900 via-slate-900/90 to-red-950/20 p-4.5 space-y-3 shadow-lg"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[10px] font-bold border border-red-500/40 animate-pulse">
                        ● LIVE EMERGENCY DEPUTY
                      </span>
                      <h5 className="text-sm font-extrabold text-white mt-1">{rec.school_name}</h5>
                      <span className="text-[11px] text-slate-400 font-mono">{rec.route_name}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-1 rounded-lg">
                      {rec.id}
                    </span>
                  </div>

                  {/* Substitution Flow Box */}
                  <div className="rounded-xl bg-slate-950/80 border border-slate-800/80 p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Original Escort:</span>
                      <span className="text-slate-200 line-through font-medium">{rec.original_escort_name}</span>
                    </div>
                    <div className="flex items-center justify-between text-red-300 font-bold">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 size={12} className="text-emerald-400" /> Appointed Deputy:
                      </span>
                      <span className="text-white">{rec.deputy_escort_name}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400 text-[11px]">
                      <span>Vehicle / Phone:</span>
                      <span className="text-slate-300 font-mono">{rec.deputy_vehicle_plate} · {rec.deputy_escort_phone}</span>
                    </div>
                  </div>

                  {/* Reason & Students in Custody */}
                  <div className="space-y-1.5 text-xs">
                    <div className="text-slate-300">
                      <span className="text-slate-400 font-semibold">Emergency Reason: </span>
                      {rec.emergency_reason}
                    </div>
                    <div className="text-slate-300">
                      <span className="text-slate-400 font-semibold">Students in Custody ({rec.student_names?.length || 0}): </span>
                      <span className="text-emerald-300 font-medium">{rec.student_names?.join(', ')}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock size={11} className="text-amber-400" /> Active since: {new Date(rec.time_window_start).toLocaleTimeString()}
                    </div>
                  </div>

                  {/* Handover Complete Button */}
                  <button
                    onClick={() => handleCompleteDeputisingHandover(rec.id)}
                    disabled={completingDeputyId === rec.id}
                    className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold text-xs py-2.5 shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <CheckCircle2 size={14} />
                    {completingDeputyId === rec.id ? 'Recording Handover...' : 'Complete Handover & Close Custody Window'}
                  </button>
                </div>
              ))}
          </div>
        )}
      </section>

      {/* Approved Escort Pool */}
      <section className="rounded-2xl border border-slate-800 bg-[#0b1c30] p-5">
        <h4 className="text-sm font-bold text-white">Available Emergency Escort Pool ({emergencyPool.length})</h4>
        <p className="mt-1 text-xs text-slate-400">Only approved escorts marked available can handle emergency pickup or deputising.</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {data.escorts.map((escort) => (
            <div key={escort.id} className="flex items-center justify-between rounded-lg bg-slate-900 p-3 text-xs">
              <span>
                <b className="text-white">{escort.full_name}</b>
                <span className="ml-2 text-slate-400">{escort.operating_area || "Area not set"} · {escort.availability_status}</span>
              </span>
              <button
                onClick={() => togglePool(escort)}
                className="rounded-lg bg-slate-800 hover:bg-slate-700 px-2 py-1 text-slate-200 cursor-pointer"
              >
                {escort.emergency_pool_enabled ? "Remove from pool" : "Add to pool"}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* IMMUTABLE STUDENT CUSTODY & ACCOUNTABILITY LEDGER                          */}
      {/* ========================================================================= */}
      <section className="rounded-2xl border border-slate-800 bg-[#0b1c30] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList size={16} className="text-cyan-400" />
            <div>
              <h4 className="text-sm font-bold text-white">Student Custody &amp; Accountability Ledger</h4>
              <p className="text-xs text-slate-400">Permanent historical record of who was responsible for which students at that particular time.</p>
            </div>
          </div>
          <span className="text-xs font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-800/60 px-2.5 py-1 rounded-lg">
            {(data.deputising_records || []).length} Custody Events
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] font-bold">
                <th className="py-2.5 px-3">Time Window</th>
                <th className="py-2.5 px-3">School &amp; Route</th>
                <th className="py-2.5 px-3">Responsible Deputy Escort</th>
                <th className="py-2.5 px-3">Original Escort</th>
                <th className="py-2.5 px-3">Students in Custody</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {(data.deputising_records || []).map((row: any) => (
                <tr key={row.id} className="hover:bg-slate-900/60 transition-colors">
                  <td className="py-3 px-3 font-mono text-slate-300">
                    <div>{new Date(row.time_window_start).toLocaleDateString()}</div>
                    <div className="text-[10px] text-slate-400">
                      {new Date(row.time_window_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {row.time_window_end ? ` → ${new Date(row.time_window_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ' (Active)'}
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-bold text-white">{row.school_name}</div>
                    <div className="text-[10px] text-slate-400">{row.route_name}</div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-bold text-emerald-400 flex items-center gap-1">
                      <ShieldCheck size={12} /> {row.deputy_escort_name}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">{row.deputy_vehicle_plate}</div>
                  </td>
                  <td className="py-3 px-3 text-slate-300">
                    <div>{row.original_escort_name}</div>
                    <div className="text-[10px] text-slate-400">{row.emergency_reason}</div>
                  </td>
                  <td className="py-3 px-3 text-slate-200">
                    <div className="font-medium text-slate-200">{row.student_names?.join(', ') || 'Roster linked'}</div>
                    <div className="text-[10px] text-slate-400">Auth: {row.assigned_by_name}</div>
                  </td>
                  <td className="py-3 px-3">
                    {row.status === 'ACTIVE_DEPUTY' ? (
                      <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[10px] font-black border border-red-500/40 animate-pulse">
                        ACTIVE CUSTODY
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/40">
                        HANDOVER CLOSED
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* WALK-HOME STUDENTS LIVE OPERATIONS LEDGER                                 */}
      {/* ========================================================================= */}
      <section className="rounded-3xl border border-blue-500/30 bg-[#0b1c30] p-6 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Footprints size={20} className="text-blue-400" />
            <div>
              <h4 className="text-base font-black text-white">
                Walk-Home Students Live Operations Ledger ({(data.walk_home_records || []).length})
              </h4>
              <p className="text-xs text-slate-400">
                Verified pedestrian departures scanned at the school gate today. Parents receive real-time notifications immediately upon release.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 font-black text-[10px] uppercase border border-blue-400/30">
            Pedestrian Gate Tracking Active
          </span>
        </div>

        {(data.walk_home_records || []).length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-400 text-xs">
            No walk-home student departures recorded today yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] font-bold">
                  <th className="py-2.5 px-3">Student</th>
                  <th className="py-2.5 px-3">School</th>
                  <th className="py-2.5 px-3">Gate Verification Method</th>
                  <th className="py-2.5 px-3">Departure Timestamp</th>
                  <th className="py-2.5 px-3">Status / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {(data.walk_home_records || []).map((w: any) => (
                  <tr key={w.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-3">
                      <div>
                        <p className="font-black text-white">
                          {typeof w.student_name === 'string' ? w.student_name : (w.student ? `${w.student.first_name || ''} ${w.student.last_name || ''}`.trim() : 'Unknown Student')}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {w.student_number || w.student?.student_id_number || 'N/A'} · {typeof w.student_class === 'object' ? (w.student_class?.name || 'Class N/A') : (w.student_class || w.student?.class?.name || 'Class N/A')}
                        </p>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-200">
                        {typeof w.school_name === 'object' ? (w.school_name?.name || 'Assigned School') : (w.school_name || w.school?.name || 'Assigned School')}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/30 font-mono text-[11px]">
                        <Footprints size={12} />
                        {w.verification_method || 'walk_home_gate_scan'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-300">
                      {w.scanned_at ? new Date(w.scanned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Today'}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/40">
                        {w.status || 'Walk Home Recorded'}
                      </span>
                      {w.notes && <p className="text-[10px] text-slate-400 mt-0.5">{w.notes}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* MODAL: DISPATCH EMERGENCY DEPUTY                                          */}
      {/* ========================================================================= */}
      {showDeputiseModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0b1c30] border border-slate-700 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-red-400" />
                <h3 className="text-base font-extrabold text-white">Dispatch Emergency Deputy Escort</h3>
              </div>
              <button
                onClick={() => setShowDeputiseModal(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Select an available City Manager approved escort to deputise for an active route. This action creates a legal responsibility entry in the child safety ledger.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Target School</label>
                <select
                  value={deputiseForm.school_id}
                  onChange={(e) => {
                    const s = data.schools.find((sc) => sc.id === e.target.value);
                    setDeputiseForm({ ...deputiseForm, school_id: e.target.value, school_name: s?.name || '' });
                  }}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white"
                >
                  <option value="">Select School</option>
                  {data.schools.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Route Name</label>
                  <input
                    value={deputiseForm.route_name}
                    onChange={(e) => setDeputiseForm({ ...deputiseForm, route_name: e.target.value })}
                    placeholder="e.g. Lekki Express Corridor"
                    className="w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Original Escort Name</label>
                  <input
                    value={deputiseForm.original_escort_name}
                    onChange={(e) => setDeputiseForm({ ...deputiseForm, original_escort_name: e.target.value })}
                    placeholder="e.g. Current Assigned Escort"
                    className="w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Appointed Deputy Escort (From Emergency Pool)
                </label>
                <select
                  value={deputiseForm.deputy_escort_id}
                  onChange={(e) => {
                    const selected = emergencyPool.find((esc) => esc.id === e.target.value);
                    setDeputiseForm({
                      ...deputiseForm,
                      deputy_escort_id: e.target.value,
                      deputy_escort_name: selected?.full_name || '',
                      deputy_escort_phone: selected?.phone || '',
                    });
                  }}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white"
                >
                  <option value="">Select Available Deputy Escort</option>
                  {emergencyPool.map((esc) => (
                    <option key={esc.id} value={esc.id}>
                      {esc.full_name} ({esc.operating_area || 'Verified Area'}) — Available
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Emergency Reason</label>
                <select
                  value={deputiseForm.emergency_reason}
                  onChange={(e) => setDeputiseForm({ ...deputiseForm, emergency_reason: e.target.value })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white"
                >
                  <option value="School bus mechanical breakdown / delay">School bus mechanical breakdown / delay</option>
                  <option value="Escort medical emergency / hospital triage">Escort medical emergency / hospital triage</option>
                  <option value="Traffic gridlock emergency substitution">Traffic gridlock emergency substitution</option>
                  <option value="Unscheduled escort absence / urgent family leave">Unscheduled escort absence / urgent family leave</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Students Under Care</label>
                <input
                  value={deputiseForm.student_names}
                  onChange={(e) => setDeputiseForm({ ...deputiseForm, student_names: e.target.value })}
                  placeholder="e.g. Student Name(s)"
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Operational Handover Notes</label>
                <textarea
                  value={deputiseForm.notes}
                  onChange={(e) => setDeputiseForm({ ...deputiseForm, notes: e.target.value })}
                  placeholder="Additional instructions, security clearance notes..."
                  rows={2}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowDeputiseModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateEmergencyDeputy}
                disabled={submittingDeputy}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-lg cursor-pointer"
              >
                <ShieldCheck size={14} />
                {submittingDeputy ? 'Dispatching & Recording...' : 'Confirm & Dispatch Deputy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REASSIGN ESCORT                                                    */}
      {/* ========================================================================= */}
      {reassignModal.open && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0b1c30] border border-cyan-700/60 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-extrabold text-white">Reassign Escort for Student</h3>
              </div>
              <button
                onClick={() => setReassignModal({ open: false, assignment: null, targetEscortId: '', notes: '' })}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Student:</span>
                <span className="font-bold text-white">
                  {reassignModal.assignment?.student
                    ? `${reassignModal.assignment.student.first_name} ${reassignModal.assignment.student.last_name}`
                    : 'Unknown Student'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">School:</span>
                <span className="font-bold text-white">{reassignModal.assignment?.school?.name || 'Assigned School'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Current Escort:</span>
                <span className="font-bold text-amber-300">{reassignModal.assignment?.escort?.full_name || 'None'}</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Select Replacement Escort
                </label>
                <select
                  value={reassignModal.targetEscortId}
                  onChange={(e) => setReassignModal({ ...reassignModal, targetEscortId: e.target.value })}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white"
                >
                  <option value="">Select Escort</option>
                  {data.escorts.map((esc) => (
                    <option key={esc.id} value={esc.id}>
                      {esc.full_name} ({esc.vehicle_plate || 'No Plate'}) — {esc.operating_area || 'Standard Zone'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Reason / Reassignment Notes
                </label>
                <textarea
                  value={reassignModal.notes}
                  onChange={(e) => setReassignModal({ ...reassignModal, notes: e.target.value })}
                  placeholder="e.g. Escort unavailable, parent request, emergency substitution..."
                  rows={2}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setReassignModal({ open: false, assignment: null, targetEscortId: '', notes: '' })}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteReassign}
                disabled={submittingReassign}
                className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-lg cursor-pointer"
              >
                <ArrowRightLeft size={14} />
                {submittingReassign ? 'Reassigning...' : 'Confirm Reassignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FARE CORRECTION / OPTIONAL DISCOUNT */}
      {discountModal.open && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0b1c30] border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                  <Pencil size={18} />
                </div>
                <div>
                  <h3 className="font-black text-white text-sm">Correct Fare / Apply Discount</h3>
                  <p className="text-[11px] text-slate-400">Edit the collected daily fare. Discount is optional.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDiscountModal({ ...discountModal, open: false })}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Student:</span>
                <span className="font-bold text-white">{discountModal.booking?.child_name || 'Student'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">School:</span>
                <span className="font-semibold text-slate-300">{discountModal.booking?.school_name || 'School Campus'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Standard Daily Fare:</span>
                <span className="font-mono font-bold text-slate-300">₦{discountModal.originalFare.toLocaleString()}</span>
              </div>
            </div>

            {/* TRIP COVERAGE / PROVISION SELECTOR */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Trip Coverage / Service Provision *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDiscountModal((prev) => ({
                      ...prev,
                      tripType: 'both',
                      discountReason: prev.discountReason.replace(/One-way (morning|afternoon) trip/gi, '').trim() || 'Fare adjustment',
                    }));
                  }}
                  className={`p-2.5 rounded-xl border text-left flex flex-col justify-between gap-1 transition-all cursor-pointer ${
                    discountModal.tripType === 'both'
                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500 shadow-sm'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="font-bold text-xs flex items-center gap-1.5">
                    🔄 Complete Trip
                  </span>
                  <span className="text-[10px] opacity-75">Round Trip (Morning &amp; Afternoon)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const halfStandard = Math.round(discountModal.originalFare / 2);
                    setDiscountModal((prev) => {
                      const shouldSuggestHalf = Number(prev.discountedFare) === prev.originalFare;
                      return {
                        ...prev,
                        tripType: 'morning_only',
                        discountedFare: shouldSuggestHalf ? String(halfStandard) : prev.discountedFare,
                        discountAmount: shouldSuggestHalf ? String(halfStandard) : prev.discountAmount,
                        discountReason: 'One-way morning trip',
                      };
                    });
                  }}
                  className={`p-2.5 rounded-xl border text-left flex flex-col justify-between gap-1 transition-all cursor-pointer ${
                    discountModal.tripType === 'morning_only'
                      ? 'border-amber-500 bg-amber-500/20 text-amber-200 ring-1 ring-amber-500 shadow-sm'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="font-bold text-xs flex items-center gap-1.5">
                    🌅 Morning Only
                  </span>
                  <span className="text-[10px] opacity-75">One-Way to School (Pickup Only)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const halfStandard = Math.round(discountModal.originalFare / 2);
                    setDiscountModal((prev) => {
                      const shouldSuggestHalf = Number(prev.discountedFare) === prev.originalFare;
                      return {
                        ...prev,
                        tripType: 'afternoon_only',
                        discountedFare: shouldSuggestHalf ? String(halfStandard) : prev.discountedFare,
                        discountAmount: shouldSuggestHalf ? String(halfStandard) : prev.discountAmount,
                        discountReason: 'One-way afternoon trip',
                      };
                    });
                  }}
                  className={`p-2.5 rounded-xl border text-left flex flex-col justify-between gap-1 transition-all cursor-pointer ${
                    discountModal.tripType === 'afternoon_only'
                      ? 'border-orange-500 bg-orange-500/20 text-orange-200 ring-1 ring-orange-500 shadow-sm'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="font-bold text-xs flex items-center gap-1.5">
                    🌇 Afternoon Only
                  </span>
                  <span className="text-[10px] opacity-75">One-Way from School (Drop-off Only)</span>
                </button>
              </div>

              {discountModal.tripType !== 'both' && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-[11px] flex flex-wrap items-center justify-between gap-2">
                  <span>
                    ⚡ Single trip provision ({discountModal.tripType === 'morning_only' ? 'Morning Pickup Only' : 'Afternoon Drop-off Only'}).
                    Standard 1-way baseline: ₦{Math.round(discountModal.originalFare / 2).toLocaleString()}.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const half = Math.round(discountModal.originalFare / 2);
                      setDiscountModal((prev) => ({
                        ...prev,
                        discountedFare: String(half),
                        discountAmount: String(prev.originalFare - half),
                      }));
                    }}
                    className="text-[10px] underline font-extrabold text-white hover:text-amber-200 cursor-pointer"
                  >
                    Set to ₦{Math.round(discountModal.originalFare / 2).toLocaleString()}
                  </button>
                </div>
              )}
            </div>

            {/* SEGMENT FARE PREVIEW DECK */}
            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/90 p-2.5 rounded-2xl border border-slate-800">
              <div className="text-center p-2 rounded-xl bg-slate-950/70 border border-slate-800/80">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Morning Segment</span>
                <span className={`font-mono font-black text-xs ${discountModal.tripType === 'afternoon_only' ? 'text-slate-600 line-through' : 'text-emerald-400'}`}>
                  {discountModal.tripType === 'afternoon_only'
                    ? '₦0 (Excluded)'
                    : `₦${(discountModal.tripType === 'morning_only' ? Number(discountModal.discountedFare || 0) : Math.round(Number(discountModal.discountedFare || 0) / 2)).toLocaleString()}`}
                </span>
              </div>
              <div className="text-center p-2 rounded-xl bg-slate-950/70 border border-slate-800/80">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Afternoon Segment</span>
                <span className={`font-mono font-black text-xs ${discountModal.tripType === 'morning_only' ? 'text-slate-600 line-through' : 'text-emerald-400'}`}>
                  {discountModal.tripType === 'morning_only'
                    ? '₦0 (Excluded)'
                    : `₦${(discountModal.tripType === 'afternoon_only' ? Number(discountModal.discountedFare || 0) : Number(discountModal.discountedFare || 0) - Math.round(Number(discountModal.discountedFare || 0) / 2)).toLocaleString()}`}
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Daily Fare to Collect *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-bold text-slate-400">₦</span>
                  <input
                    type="number"
                    min={1}
                    value={discountModal.discountedFare}
                    onChange={(e) => {
                      const val = e.target.value;
                      const fare = Number(val);
                      const savings = Number.isFinite(fare) && fare < discountModal.originalFare
                        ? discountModal.originalFare - fare
                        : 0;
                      setDiscountModal({
                        ...discountModal,
                        discountedFare: val,
                        discountAmount: savings > 0 ? String(savings) : '',
                      });
                    }}
                    placeholder={String(discountModal.originalFare || 3500)}
                    className="w-full pl-8 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Discount Amount (optional)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-bold text-slate-400">₦</span>
                  <input
                    type="number"
                    min={0}
                    value={discountModal.discountAmount}
                    onChange={(e) => applyDiscountAmount(e.target.value)}
                    placeholder="0"
                    className="w-full pl-8 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Enter a discount to auto-reduce the collected fare from the standard amount.
                </span>
                {Number(discountModal.discountedFare) > 0 && Number(discountModal.discountedFare) < discountModal.originalFare && (
                  <div className="mt-1 flex items-center justify-between text-[11px] text-emerald-400 font-bold px-1">
                    <span>Discount: ₦{(discountModal.originalFare - Number(discountModal.discountedFare)).toLocaleString()}</span>
                    <span>({Math.round(((discountModal.originalFare - Number(discountModal.discountedFare)) / discountModal.originalFare) * 100)}% off)</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Accountant / Bursar Reference (optional)
                </label>
                <input
                  type="text"
                  value={discountModal.accountantApprovalRef}
                  onChange={(e) => setDiscountModal({ ...discountModal, accountantApprovalRef: e.target.value })}
                  placeholder="e.g. ACC-DISC-2026-081"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono uppercase text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Officer Name (optional)
                </label>
                <input
                  type="text"
                  value={discountModal.accountantName}
                  onChange={(e) => setDiscountModal({ ...discountModal, accountantName: e.target.value })}
                  placeholder="e.g. City Manager"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Correction / Discount Notes
                </label>
                <textarea
                  value={discountModal.discountReason}
                  onChange={(e) => setDiscountModal({ ...discountModal, discountReason: e.target.value })}
                  placeholder="e.g. Fare correction for wrong distance, or bursar concession..."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300 flex items-start gap-2">
              <Info size={14} className="shrink-0 mt-0.5" />
              <span>Saved daily fare (₦{Number(discountModal.discountedFare || 0).toLocaleString()}) will appear on bookings, assignments, and the escort manifest.</span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDiscountModal({ ...discountModal, open: false })}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveFareCorrection}
                disabled={discountModal.submitting}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center gap-1.5 shadow-lg cursor-pointer"
              >
                <Pencil size={13} />
                <span>{discountModal.submitting ? 'Saving...' : 'Save Fare Correction'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive House Location Pinning Modal for City Manager */}
      <InteractiveLocationPickerModal
        isOpen={Boolean(pinningRequest)}
        onClose={() => setPinningRequest(null)}
        mode="parent"
        child={
          pinningRequest
            ? {
                id: pinningRequest.student_id,
                name: pinningRequest.child_name,
                class_name: pinningRequest.class_name,
              }
            : null
        }
        initialAddress={pinningRequest?.pickup_location || pinningRequest?.house_address}
        initialLat={pinningRequest?.house_lat ?? pinningRequest?.lat}
        initialLng={pinningRequest?.house_lng ?? pinningRequest?.lng}
        initialLandmark={pinningRequest?.landmark}
        onLocationSaved={() => {
          fetchData();
          setPinningRequest(null);
        }}
      />
    </div>
  );
}
