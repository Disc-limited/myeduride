// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { ClipboardList, RefreshCw, Search, UserPlus, Sparkles, CheckCircle2, ShieldCheck, Clock, MapPin, Phone, Car, Users, ArrowRightLeft, Footprints } from 'lucide-react';
import { toast } from 'sonner';
import StudentAvatar from '@/components/shared/StudentAvatar';

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

export function CityManagerOperationsPanel() {
  const [data, setData] = useState<Operations>(empty);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [booking, setBooking] = useState<any>({ source: 'parent', schoolId: '', pickupAddress: '', pickupAt: '', notes: '' });
  const [dispatch, setDispatch] = useState<any>({ bookingId: '', escortApplicationId: '', schoolId: '', studentId: '', assignmentType: 'standard', notes: '' });
  
  // Selected Escort Assignment Map for Parent Requests
  const [selectedEscortsForParentBookings, setSelectedEscortsForParentBookings] = useState<Record<string, string>>({});
  const [processingBookingId, setProcessingBookingId] = useState<string | null>(null);

  // Escort Rosters Filters & In-Place Reassignment Modal State
  const [rosterSchoolFilter, setRosterSchoolFilter] = useState('all');
  const [rosterEscortFilter, setRosterEscortFilter] = useState('all');
  const [reassignModal, setReassignModal] = useState<{ open: boolean; assignment: any; targetEscortId: string; notes: string }>({
    open: false,
    assignment: null,
    targetEscortId: '',
    notes: '',
  });
  const [submittingReassign, setSubmittingReassign] = useState(false);

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
      const r = await fetch(`/api/city-manager/operations${query ? `?q=${encodeURIComponent(query)}` : ''}`);
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

  const handleApproveParentBooking = async (bookingId: string) => {
    const escortId = selectedEscortsForParentBookings[bookingId] || (data.escorts.length > 0 ? data.escorts[0].id : null);
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
          notes: 'Approved and assigned by City Manager for verified area escort pickup.',
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Approval failed');
      toast.success(d.message || 'Parent booking approved and assigned!');
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Approval failed');
    } finally {
      setProcessingBookingId(null);
    }
  };

  const active = data.assignments.filter((a) => a.status === 'active');
  const emergencyPool = data.escorts.filter((e) => e.emergency_pool_enabled && e.availability_status === 'available');
  const dispatchEscorts = ['emergency', 'deputy'].includes(dispatch.assignmentType) ? emergencyPool : data.escorts;
  const parentRequests = data.parent_requests || [];

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
                  <th className="py-2.5 px-3">Date / Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
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
                    <td className="py-3 px-3 text-right">
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* PARENT RIDE REQUESTS REVIEW QUEUE (SCHOOL ESCORT UNAVAILABLE)             */}
      {/* ========================================================================= */}
      <section className="rounded-3xl border border-amber-500/30 bg-[#0b1c30] p-6 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-amber-400" />
            <div>
              <h4 className="text-base font-black text-white">
                Parent Ride Requests Queue ({parentRequests.length})
              </h4>
              <p className="text-xs text-slate-400">
                Process: <strong>Parent Booking → City Manager Review → Escort Assignment → Approval → Parent Notification</strong>
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 font-black text-[10px] uppercase border border-amber-400/30">
            Area Escort Matching Active
          </span>
        </div>

        <div className="space-y-3">
          {parentRequests.map((req) => (
            <div
              key={req.booking_id}
              className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs text-slate-300"
            >
              <div className="space-y-1.5 min-w-[280px]">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-300 font-bold text-[10px] font-mono">
                    {req.booking_id}
                  </span>
                  <p className="text-sm font-black text-white">{req.child_name}</p>
                </div>
                <p className="text-[11px] text-slate-400">
                  School: <strong className="text-slate-200">{req.school_name || 'Designated School'}</strong>
                </p>
                <p className="text-[11px] text-slate-400">
                  📍 Area / Pickup Stop: <strong className="text-slate-200">{req.pickup_location}</strong>
                </p>
                <p className="text-[10px] text-amber-300">
                  Reason: <strong>{req.reason}</strong>
                </p>
              </div>

              <div className="min-w-[220px] space-y-1 text-[11px]">
                <p className="text-slate-400">
                  Parent: <strong className="text-white">{req.parent_name || 'Parent'}</strong> ({req.parent_phone})
                </p>
                <p className="text-slate-400">
                  Requested Date: <strong className="text-white">{req.pickup_date}</strong> at <strong className="text-white">{req.pickup_time}</strong>
                </p>
                <p className="text-emerald-400 font-bold">
                  Operating Zone: {req.operating_area}
                </p>
              </div>

              {/* Escort Selector & Approval Actions */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 min-w-[320px]">
                {req.status === 'CONFIRMED' ? (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs space-y-1 w-full">
                    <div className="flex items-center justify-between font-bold">
                      <span>✓ Assigned: {req.escort_name}</span>
                      <span className="font-mono bg-slate-900 px-2 py-0.5 rounded text-white">PIN: {req.security_pin}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono">{req.escort_phone} · {req.vehicle_plate}</p>
                  </div>
                ) : (
                  <>
                    <select
                      value={selectedEscortsForParentBookings[req.booking_id] || (data.escorts[0]?.id || '')}
                      onChange={(e) =>
                        setSelectedEscortsForParentBookings((prev) => ({
                          ...prev,
                          [req.booking_id]: e.target.value,
                        }))
                      }
                      className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none"
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
                      onClick={() => handleApproveParentBooking(req.booking_id)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer transition-all shadow-xs shrink-0 flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 size={14} />
                      {processingBookingId === req.booking_id ? 'Assigning...' : 'Assign & Approve'}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}

          {parentRequests.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-xs">
              No pending parent ride requests at this time. All requests have been reviewed and assigned.
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
    </div>
  );
}
