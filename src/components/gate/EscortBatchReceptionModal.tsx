// @ts-nocheck
'use client';

import { useState } from 'react';
import {
  Shield,
  ShieldCheck,
  CheckCircle2,
  Users,
  Car,
  AlertTriangle,
  X,
  RefreshCw,
  Phone,
  CheckSquare,
  Square,
  Sparkles,
  Zap,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';

interface EscortBatchReceptionModalProps {
  schoolId: string;
  batchData: {
    escort: {
      id: string;
      user_id?: string;
      name: string;
      phone?: string;
      photo_url?: string | null;
      vehicle_plate?: string;
      vehicle_name?: string;
      route_name?: string;
      route_code?: string;
      today_trip_status?: string;
      ready_for_pickup?: boolean;
    };
    students: Array<{
      id: string;
      name: string;
      student_id_number: string;
      photo_url?: string | null;
      class_name: string;
      pickup_address?: string;
      today_status: {
        has_arrival: boolean;
        arrival_time?: string | null;
        has_departure: boolean;
        departure_time?: string | null;
      };
    }>;
    batch_metrics?: {
      total_assigned: number;
      already_checked_in: number;
      already_checked_out: number;
      pending_arrival: number;
      pending_departure: number;
    };
    suggested_mode?: 'arrival' | 'departure';
  };
  onClose: () => void;
  onSuccess: () => void;
}

export default function EscortBatchReceptionModal({
  schoolId,
  batchData,
  onClose,
  onSuccess,
}: EscortBatchReceptionModalProps) {
  const escort = batchData.escort || {};
  const students = batchData.students || [];

  const [mode, setMode] = useState<'arrival' | 'departure'>(batchData.suggested_mode || 'arrival');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    // Default select all students who have not yet had their status recorded for this mode
    const initial = new Set<string>();
    students.forEach((s) => {
      const alreadyDone = mode === 'arrival' ? s.today_status.has_arrival : s.today_status.has_departure;
      if (!alreadyDone) initial.add(s.id);
    });
    return initial.size > 0 ? initial : new Set(students.map((s) => s.id));
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOverridePrompt, setShowOverridePrompt] = useState(false);
  const [overrideReason, setOverrideReason] = useState('All students in bus physically accounted for by gate officer visual inspection');

  const handleToggleSelectAll = () => {
    if (selectedIds.size === students.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(students.map((s) => s.id)));
    }
  };

  const handleToggleStudent = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleExecuteBatch = async (isOverride = false) => {
    const idsToProcess = isOverride ? students.map((s) => s.id) : Array.from(selectedIds);
    if (idsToProcess.length === 0) {
      toast.error('Please select at least one student to process');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/gate/escort-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_id: schoolId,
          escort_id: escort.id,
          escort_name: escort.name,
          vehicle_plate: escort.vehicle_plate,
          student_ids: idsToProcess,
          mode,
          is_override: isOverride,
          override_reason: isOverride ? overrideReason : undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to process batch reception');
      }

      toast.success(
        json.message ||
          `${idsToProcess.length} students ${
            mode === 'arrival' ? 'signed in' : 'signed out'
          } successfully!`
      );
      setShowOverridePrompt(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Batch operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingCount = students.filter((s) =>
    mode === 'arrival' ? !s.today_status.has_arrival : !s.today_status.has_departure
  ).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 md:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-2xl border border-slate-200 shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* 1. ESCORT HEADER BAR */}
        <div className="bg-slate-900 text-white p-5 md:p-6 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <X size={18} />
          </button>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <img
                src={
                  escort.photo_url ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
                }
                alt={escort.name}
                className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-400 shadow-md shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
                }}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider">
                    {escort.route_code || 'RT-01'}
                  </span>
                  <h3 className="font-black text-white text-base md:text-lg leading-tight truncate">
                    {escort.name}
                  </h3>
                </div>
                <p className="text-xs text-slate-300 font-medium flex items-center gap-2 mt-0.5">
                  <span className="flex items-center gap-1 font-bold text-slate-200">
                    <Car size={13} className="text-emerald-400" />
                    {escort.vehicle_plate || 'Transit Bus'}
                  </span>
                  <span>•</span>
                  <span className="truncate text-slate-400">{escort.route_name || 'Assigned Route'}</span>
                </p>
                {escort.phone && (
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                    <Phone size={10} />
                    <span>{escort.phone}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Mode Switcher */}
            <div className="bg-slate-800/80 p-1 rounded-2xl flex items-center gap-1 border border-slate-700 shrink-0">
              <button
                type="button"
                onClick={() => setMode('arrival')}
                className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
                  mode === 'arrival'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🌅 Morning Sign-In
              </button>
              <button
                type="button"
                onClick={() => setMode('departure')}
                className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
                  mode === 'departure'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🏫 Afternoon Sign-Out
              </button>
            </div>
          </div>
        </div>

        {/* 2. CONTROL TOOLBAR */}
        <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-extrabold text-xs flex items-center gap-1.5 hover:bg-slate-100 transition-all cursor-pointer shadow-2xs"
            >
              {selectedIds.size === students.length ? (
                <>
                  <CheckSquare size={14} className="text-emerald-600" />
                  <span>Deselect All</span>
                </>
              ) : (
                <>
                  <Square size={14} className="text-slate-400" />
                  <span>Select All ({students.length})</span>
                </>
              )}
            </button>
            <span className="text-xs font-bold text-slate-500">
              Selected: <strong className="text-slate-900">{selectedIds.size}</strong> of {students.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-full text-[11px] font-black ${
                pendingCount === 0
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {pendingCount === 0 ? '✓ All Processed' : `${pendingCount} Pending Gate ${mode === 'arrival' ? 'Entry' : 'Exit'}`}
            </span>
          </div>
        </div>

        {/* 3. ROSTER LIST */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-2">
          {students.map((st) => {
            const isSelected = selectedIds.has(st.id);
            const isCompleted =
              mode === 'arrival' ? st.today_status.has_arrival : st.today_status.has_departure;
            const completedTime =
              mode === 'arrival' ? st.today_status.arrival_time : st.today_status.departure_time;

            return (
              <div
                key={st.id}
                onClick={() => handleToggleStudent(st.id)}
                className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-50/50 border-emerald-300 shadow-2xs'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0 text-emerald-600">
                    {isSelected ? <CheckSquare size={18} /> : <Square size={18} className="text-slate-400" />}
                  </div>

                  <img
                    src={
                      st.photo_url ||
                      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
                    }
                    alt={st.name}
                    className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
                    }}
                  />

                  <div className="min-w-0">
                    <p className="font-extrabold text-slate-900 text-xs leading-tight truncate">{st.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono">
                      ID: {st.student_id_number} · <span className="font-bold text-slate-700">{st.class_name}</span>
                    </p>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  {isCompleted ? (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center gap-1">
                      <CheckCircle2 size={11} />
                      <span>{mode === 'arrival' ? 'Signed In' : 'Signed Out'} {completedTime && `(${completedTime})`}</span>
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                      Pending
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {students.length === 0 && (
            <div className="py-12 text-center text-slate-400 text-xs">
              No students assigned to this escort for this school today.
            </div>
          )}
        </div>

        {/* 4. HEADCOUNT OVERRIDE SUB-PANEL */}
        {showOverridePrompt && (
          <div className="p-4 bg-amber-50 border-t border-amber-200 space-y-2">
            <div className="flex items-center gap-2 text-amber-900 font-extrabold text-xs">
              <AlertTriangle size={15} className="text-amber-600" />
              <span>Headcount Override: Receive Entire Manifest at Once</span>
            </div>
            <p className="text-[11px] text-amber-800">
              Confirm that all <strong>{students.length} students</strong> in {escort.name}&apos;s bus are physically present.
              This bypasses individual card scans and signs in all students in one atomic step.
            </p>
            <input
              type="text"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Reason for headcount override..."
              className="w-full bg-white border border-amber-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none"
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowOverridePrompt(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/60 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleExecuteBatch(true)}
                disabled={isSubmitting}
                className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? <RefreshCw size={13} className="animate-spin" /> : <Zap size={13} />}
                <span>Confirm Headcount Override</span>
              </button>
            </div>
          </div>
        )}

        {/* 5. FOOTER ACTION BAR */}
        <div className="p-4 md:p-5 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setShowOverridePrompt(!showOverridePrompt)}
            className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Zap size={14} className="text-amber-600" />
            <span>Complete Headcount Override</span>
          </button>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => handleExecuteBatch(false)}
              disabled={isSubmitting || selectedIds.size === 0}
              className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl font-black text-xs text-white shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 ${
                mode === 'arrival'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Processing Batch...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  <span>
                    {mode === 'arrival'
                      ? `Sign In Selected (${selectedIds.size}) Students`
                      : `Sign Out Selected (${selectedIds.size}) Students`}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
