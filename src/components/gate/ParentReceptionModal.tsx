'use client';

import { useState, useEffect } from 'react';
import {
  X,
  User,
  ShieldCheck,
  Phone,
  CheckCircle2,
  Clock,
  Car,
  FileText,
  AlertTriangle,
  Send,
  Building2,
  Users,
  LogIn,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import StudentAvatar from '@/components/shared/StudentAvatar';
import { triggerHapticNotification } from '@/lib/platform/haptics';

export interface ParentReceptionData {
  type: 'parent';
  parent: {
    id: string;
    full_name: string;
    username?: string;
    phone?: string;
    photo_url?: string;
  };
  school_location?: {
    name?: string;
    gps_coords?: string;
  };
  linked_children: Array<{
    id: string;
    first_name: string;
    last_name: string;
    student_id: string;
    class_name: string;
    photo_url?: string;
    relationship?: string;
    present_today?: boolean;
    arrival_time?: string;
    ready_for_pickup?: boolean;
    in_extra_lesson?: boolean;
    extra_lesson_end_time?: string;
    extra_lesson_reason?: string;
  }>;
}

interface ParentReceptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ParentReceptionData | null;
  schoolId: string;
  staffList?: Array<{ id: string; user_id?: string; name: string; role_label?: string }>;
  onSuccess?: () => void;
}

export default function ParentReceptionModal({
  isOpen,
  onClose,
  data,
  schoolId,
  staffList = [],
  onSuccess,
}: ParentReceptionModalProps) {
  const [activeTab, setActiveTab] = useState<'students' | 'visit'>('students');
  const [studentMode, setStudentMode] = useState<'dropoff' | 'pickup'>('pickup');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Visit form state
  const [purposeType, setPurposeType] = useState('academic_consultation');
  const [customPurpose, setCustomPurpose] = useState('');
  const [hostStaffId, setHostStaffId] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [visitNotes, setVisitNotes] = useState('');

  const children = data?.linked_children || [];

  // Pre-select all children by default when data loads
  useEffect(() => {
    if (data?.linked_children && data.linked_children.length > 0) {
      setSelectedStudentIds(data.linked_children.map((c) => c.id));
    } else {
      setSelectedStudentIds([]);
    }
  }, [data]);

  if (!isOpen || !data) return null;

  const toggleSelectStudent = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAllStudents = () => {
    setSelectedStudentIds(children.map((c) => c.id));
  };

  const deselectAllStudents = () => {
    setSelectedStudentIds([]);
  };

  // Compute final purpose text
  const getResolvedPurpose = () => {
    const purposeLabels: Record<string, string> = {
      academic_consultation: 'Academic Consultation / Meet Teacher',
      fee_payment: 'School Fees Payment & Accounts Inquiry',
      principal_meeting: 'Meeting with School Principal / Administration',
      item_dropoff: 'Drop off Lunch, Uniform, or Medicine',
      pta_event: 'PTA Meeting or School Community Event',
      pastoral_disciplinary: 'Pastoral Care or Disciplinary Consultation',
      other: customPurpose.trim() || 'General School Visit',
    };

    if (purposeType === 'other') {
      return customPurpose.trim() || 'Official School Visit';
    }
    return customPurpose.trim()
      ? `${purposeLabels[purposeType]} (${customPurpose.trim()})`
      : purposeLabels[purposeType];
  };

  // Submit Student Drop-off or Pickup
  const handleStudentSubmit = async () => {
    if (selectedStudentIds.length === 0) {
      toast.error('Please select at least one student');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/gate/parent-reception', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: studentMode === 'dropoff' ? 'student_dropoff' : 'student_pickup',
          school_id: schoolId,
          parent_id: data.parent.id,
          parent_name: data.parent.full_name,
          parent_phone: data.parent.phone,
          student_ids: selectedStudentIds,
        }),
      });

      const resJson = await res.json();
      if (!res.ok) throw new Error(resJson.error || 'Operation failed');

      triggerHapticNotification('SUCCESS').catch(() => {});
      toast.success(
        studentMode === 'dropoff'
          ? `✓ Drop-off complete: ${selectedStudentIds.length} student(s) checked in`
          : `✓ Release complete: ${selectedStudentIds.length} student(s) signed out to parent`
      );

      onSuccess?.();
      onClose();
    } catch (err: any) {
      triggerHapticNotification('ERROR').catch(() => {});
      toast.error(err.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Campus Visit
  const handleVisitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedPurpose = getResolvedPurpose();

    if (!resolvedPurpose) {
      toast.error('Please specify the purpose of visit');
      return;
    }

    const hostStaff = staffList.find((s) => (s.user_id || s.id) === hostStaffId);

    setSubmitting(true);
    try {
      const res = await fetch('/api/gate/parent-reception', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'register_visit',
          school_id: schoolId,
          parent_id: data.parent.id,
          parent_name: data.parent.full_name,
          parent_phone: data.parent.phone,
          purpose_of_visit: resolvedPurpose,
          person_to_see: hostStaff?.name || 'General Administration',
          host_user_id: hostStaff?.user_id || (hostStaffId ? hostStaffId : null),
          vehicle_plate: vehiclePlate.trim() || null,
          notes: visitNotes.trim() || null,
        }),
      });

      const resJson = await res.json();
      if (!res.ok) throw new Error(resJson.error || 'Failed to register visit');

      triggerHapticNotification('SUCCESS').catch(() => {});
      toast.success(`✓ Parent visit registered: ${data.parent.full_name} granted campus entry.`);

      onSuccess?.();
      onClose();
    } catch (err: any) {
      triggerHapticNotification('ERROR').catch(() => {});
      toast.error(err.message || 'Failed to register visit');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden font-sans">
        {/* ===================================================================== */}
        {/* MODAL HEADER: PARENT IDENTITY HUD */}
        {/* ===================================================================== */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <StudentAvatar
              photoUrl={data.parent.photo_url}
              firstName={data.parent.full_name.split(' ')[0] || 'Parent'}
              lastName={data.parent.full_name.split(' ')[1] || ''}
              size="md"
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-slate-900 text-base tracking-tight">
                  {data.parent.full_name}
                </h3>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-300">
                  <ShieldCheck size={12} className="text-emerald-700" />
                  VERIFIED PARENT PASS
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 font-medium mt-0.5">
                {data.parent.phone && (
                  <span className="flex items-center gap-1">
                    <Phone size={11} className="text-slate-400" />
                    <span>{data.parent.phone}</span>
                  </span>
                )}
                <span>•</span>
                <span>{children.length} Attached Child(ren)</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* ===================================================================== */}
        {/* OPERATIONAL MODE TABS */}
        {/* ===================================================================== */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 p-1 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('students')}
            className={`flex-1 py-2.5 px-3 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'students'
                ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users size={16} className={activeTab === 'students' ? 'text-emerald-600' : ''} />
            <span>🎒 Student Drop-off &amp; Pick-up ({children.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('visit')}
            className={`flex-1 py-2.5 px-3 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'visit'
                ? 'bg-white text-blue-800 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 size={16} className={activeTab === 'visit' ? 'text-blue-600' : ''} />
            <span>🏛️ Campus Visit / Other Purpose</span>
          </button>
        </div>

        {/* ===================================================================== */}
        {/* TAB 1: STUDENT DROP-OFF & PICKUP (RELEASE) */}
        {/* ===================================================================== */}
        {activeTab === 'students' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {/* Mode Switcher: Morning Drop-off vs Afternoon Pickup */}
            <div className="flex items-center justify-between gap-3 bg-slate-100 p-1.5 rounded-2xl">
              <button
                type="button"
                onClick={() => setStudentMode('dropoff')}
                className={`flex-1 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  studentMode === 'dropoff'
                    ? 'bg-emerald-600 text-white shadow-sm font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LogIn size={15} />
                <span>Morning Drop-off (Arrival)</span>
              </button>

              <button
                type="button"
                onClick={() => setStudentMode('pickup')}
                className={`flex-1 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  studentMode === 'pickup'
                    ? 'bg-emerald-700 text-white shadow-sm font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LogOut size={15} />
                <span>Afternoon Pickup (Release)</span>
              </button>
            </div>

            {/* Selection Controls */}
            <div className="flex items-center justify-between text-xs px-1">
              <span className="font-bold text-slate-700">
                Attached Children ({selectedStudentIds.length}/{children.length} selected):
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllStudents}
                  className="text-emerald-700 font-bold hover:underline cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={deselectAllStudents}
                  className="text-slate-500 font-semibold hover:underline cursor-pointer"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Children Cards Manifest */}
            {children.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
                <p className="text-xs font-bold text-slate-600">No linked students found in this school.</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Please verify school enrollment or link student profile to this parent account.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                {children.map((child) => {
                  const isSelected = selectedStudentIds.includes(child.id);
                  return (
                    <div
                      key={child.id}
                      onClick={() => toggleSelectStudent(child.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-500/20'
                          : 'bg-white border-slate-200/80 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <StudentAvatar
                          photoUrl={child.photo_url}
                          firstName={child.first_name}
                          lastName={child.last_name}
                          size="sm"
                        />
                        <div>
                          <p className="text-xs font-extrabold text-slate-900 leading-tight">
                            {child.first_name} {child.last_name}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {child.class_name} • <span className="font-mono">{child.student_id}</span>
                          </p>
                        </div>
                      </div>

                      {/* Status Badges */}
                      <div className="text-right shrink-0">
                        {studentMode === 'dropoff' ? (
                          child.present_today ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300">
                              Already In School
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold border border-blue-200">
                              Ready for Drop-off
                            </span>
                          )
                        ) : child.in_extra_lesson ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-300">
                            In Extra Lesson ({child.extra_lesson_end_time || 'Later'})
                          </span>
                        ) : child.ready_for_pickup ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300 animate-pulse">
                            Ready for Pickup
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                            Standard Dismissal
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Overrides / Security Note */}
            <div className="bg-amber-50 rounded-2xl p-3 border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2 leading-relaxed">
              <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
              <span>
                {studentMode === 'dropoff'
                  ? 'Morning drop-off logs attendance immediately and confirms parent custody handover at the gate.'
                  : 'Afternoon pickup releases student(s) directly to verified parent, safely overriding school bus/escort transit queues.'}
              </span>
            </div>

            {/* Submit Action Button */}
            <button
              type="button"
              disabled={submitting || selectedStudentIds.length === 0}
              onClick={handleStudentSubmit}
              className="w-full py-3 px-4 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 size={16} />
              <span>
                {submitting
                  ? 'Processing Gate Handover…'
                  : studentMode === 'dropoff'
                  ? `✓ Check In Selected Student(s) (${selectedStudentIds.length})`
                  : `✓ Sign Out & Release to Parent (${selectedStudentIds.length})`}
              </span>
            </button>
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 2: CAMPUS VISIT & OTHER PURPOSE */}
        {/* ===================================================================== */}
        {activeTab === 'visit' && (
          <form onSubmit={handleVisitSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-3 text-xs text-blue-900 leading-snug">
              <p className="font-bold">Official Campus Visitor Registration</p>
              <p className="text-[11px] text-blue-800 mt-0.5">
                Registering this visit alerts the school administration and notifies the host staff member in real-time.
              </p>
            </div>

            {/* Purpose of Visit Dropdown */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">
                Purpose of Campus Visit <span className="text-red-500">*</span>
              </label>
              <select
                value={purposeType}
                onChange={(e) => setPurposeType(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="academic_consultation">Academic Consultation / Meet Teacher</option>
                <option value="fee_payment">School Fees Payment &amp; Accounts Inquiry</option>
                <option value="principal_meeting">Meeting with School Principal / Administration</option>
                <option value="item_dropoff">Drop off Lunch, Uniform, or Medicine</option>
                <option value="pta_event">PTA Meeting or School Community Event</option>
                <option value="pastoral_disciplinary">Pastoral Care or Disciplinary Consultation</option>
                <option value="other">Other Official Purpose (Specify below)</option>
              </select>
            </div>

            {/* Custom details / Notes input */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">
                Specific Reason / Meeting Details <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={customPurpose}
                onChange={(e) => setCustomPurpose(e.target.value)}
                placeholder="e.g. Reviewing Term 2 science project with class teacher"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* Staff to Visit Dropdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  Staff Member to Visit <span className="text-slate-400 font-normal">(Host)</span>
                </label>
                <select
                  value={hostStaffId}
                  onChange={(e) => setHostStaffId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">General Administration / Front Desk</option>
                  {staffList.map((st) => (
                    <option key={st.id} value={st.user_id || st.id}>
                      {st.name} {st.role_label ? `(${st.role_label})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Vehicle Registration Plate */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  Vehicle Plate <span className="text-slate-400 font-normal">(If Driving In)</span>
                </label>
                <input
                  type="text"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  placeholder="e.g. LAG-894-XA"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-mono uppercase text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            {/* Submit Visit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-50 mt-2"
            >
              <Send size={15} />
              <span>{submitting ? 'Registering Entry…' : '🏛️ Register Parent Visit & Alert School'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
