// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { X, Car, UserCheck, Search, CheckCircle2, Shield, Calendar, Users, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface AssignParentPickupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  parent: any;
  schoolId: string;
}

export default function AssignParentPickupModal({
  isOpen,
  onClose,
  onSuccess,
  parent,
  schoolId,
}: AssignParentPickupModalProps) {
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [relationship, setRelationship] = useState<string>('Parent');
  const [isDailyDismissal, setIsDailyDismissal] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Additional student search
  const [showAllStudentsSearch, setShowAllStudentsSearch] = useState(false);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');

  useEffect(() => {
    if (!isOpen || !parent) return;
    if (parent.children?.length > 0) {
      setSelectedStudentId(parent.children[0].student_id);
      setShowAllStudentsSearch(false);
    } else {
      setSelectedStudentId('');
      setShowAllStudentsSearch(true);
    }
    setRelationship('Parent');
    setIsDailyDismissal(true);
    setNotes('');
  }, [isOpen, parent]);

  useEffect(() => {
    if (!isOpen || !parent) return;
    if (showAllStudentsSearch && allStudents.length === 0 && schoolId) {
      setLoadingStudents(true);
      fetch(`/api/school-admin/students?school_id=${schoolId}`)
        .then((r) => {
          if (!r.ok) throw new Error('Students fetch failed');
          return r.json();
        })
        .then((data) => {
          if (data.students) {
            setAllStudents(data.students);
          }
        })
        .catch((err) => {
          console.warn('[AssignParentPickupModal] Error loading school students:', err);
        })
        .finally(() => setLoadingStudents(false));
    }
  }, [isOpen, parent, showAllStudentsSearch, allStudents.length, schoolId]);

  if (!isOpen || !parent) return null;

  const filteredAllStudents = allStudents.filter((s) => {
    const q = studentSearchQuery.trim().toLowerCase();
    if (!q) return true;
    return `${s.first_name} ${s.last_name} ${s.student_id_number || ''}`.toLowerCase().includes(q);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) {
      return toast.error('Please select a student to assign pickup');
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/school-admin/parents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign_pickup',
          school_id: schoolId,
          student_id: selectedStudentId,
          parent_name: parent.name,
          parent_phone: parent.phone,
          parent_user_id: parent.id || null,
          relationship,
          is_daily_dismissal: isDailyDismissal,
          notes: notes || `Assigned via Parent Directory to ${parent.name}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to assign pickup');

      toast.success(
        isDailyDismissal
          ? `✓ ${parent.name} assigned for today's pickup! Synced to Central Pickup Control.`
          : `✓ ${parent.name} linked as authorized pickup contact with gate clearance!`
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign parent as pickup');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl space-y-5 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <Car size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">Assign Parent as Student Pickup</h3>
              <p className="text-xs text-slate-500 font-medium">Link parent authorization & dispatch for pickup</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Selected Parent Card */}
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-900 text-sm">{parent.name}</span>
              {parent.has_login && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  App Account @{parent.username}
                </span>
              )}
            </div>
            <p className="text-slate-500 font-mono text-[11px]">{parent.phone || 'No phone on file'}</p>
          </div>
          <span className="px-2.5 py-1 rounded-xl bg-slate-200/70 text-slate-700 font-bold text-[11px] shrink-0">
            {parent.children?.length || 0} Linked Children
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Student Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-bold uppercase text-slate-500">
                Select Student for Pickup
              </label>
              <button
                type="button"
                onClick={() => setShowAllStudentsSearch(!showAllStudentsSearch)}
                className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
              >
                {showAllStudentsSearch ? '← Back to linked children' : '+ Choose another student'}
              </button>
            </div>

            {!showAllStudentsSearch ? (
              <div className="space-y-1.5">
                {parent.children?.length > 0 ? (
                  parent.children.map((child: any) => (
                    <label
                      key={child.student_id}
                      className={`p-3 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                        selectedStudentId === child.student_id
                          ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="student_choice"
                          value={child.student_id}
                          checked={selectedStudentId === child.student_id}
                          onChange={() => setSelectedStudentId(child.student_id)}
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                        <div>
                          <p className="font-extrabold text-slate-900 text-xs">{child.student_name}</p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            {child.class_name || 'Class not assigned'} · ID: {child.student_id_number || 'N/A'}
                          </p>
                        </div>
                      </div>
                      {selectedStudentId === child.student_id && (
                        <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                      )}
                    </label>
                  ))
                ) : (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs">
                    No children linked to this parent profile yet. Click &quot;Choose another student&quot; above to link.
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={studentSearchQuery}
                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                    placeholder="Search student by name or ID..."
                    className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                {loadingStudents ? (
                  <div className="p-4 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                    <Loader2 size={14} className="animate-spin" /> Loading school students...
                  </div>
                ) : (
                  <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 rounded-xl bg-white border border-slate-200">
                    {filteredAllStudents.slice(0, 30).map((s) => (
                      <div
                        key={s.id}
                        onClick={() => setSelectedStudentId(s.id)}
                        className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                          selectedStudentId === s.id ? 'bg-emerald-50 text-emerald-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div>
                          <p className="font-bold text-xs">{s.first_name} {s.last_name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {s.class?.name || s.class_name || 'Class'} · {s.student_id_number || 'N/A'}
                          </p>
                        </div>
                        {selectedStudentId === s.id && <CheckCircle2 size={14} className="text-emerald-600" />}
                      </div>
                    ))}
                    {filteredAllStudents.length === 0 && (
                      <div className="p-4 text-center text-slate-400 text-xs">No students match your search</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Relationship Selector */}
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
              Parent Relationship to Child
            </label>
            <select
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="Parent">Parent / Primary Guardian</option>
              <option value="Mother">Mother</option>
              <option value="Father">Father</option>
              <option value="Guardian">Legal Guardian</option>
              <option value="Aunt">Aunt</option>
              <option value="Uncle">Uncle</option>
            </select>
          </div>

          {/* Action Choice: Today's Dismissal vs Permanent Authorization */}
          <div className="p-3.5 bg-emerald-50/60 rounded-2xl border border-emerald-200/80 space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isDailyDismissal}
                onChange={(e) => setIsDailyDismissal(e.target.checked)}
                className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <span className="font-extrabold text-slate-900 text-xs">
                  Assign for Today&apos;s Dismissal (Central Pickup Control)
                </span>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                  Immediately places this child into the School Admin Live Ready/Assigned Queue for today so gate officers and escorts are notified.
                </p>
              </div>
            </label>
          </div>

          {/* Optional Notes */}
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
              Operational Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. In-person pickup, waiting at gate entrance..."
              className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedStudentId}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <Car size={14} />
              {submitting ? 'Assigning...' : 'Confirm Pickup Assignment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
