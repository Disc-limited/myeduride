'use client';

import { useState } from 'react';
import { X, AlertCircle, Ban, Loader2, CheckCircle2, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import StudentAvatar from '@/components/shared/StudentAvatar';
import { CancellationReason } from '@/lib/types/trip-cancellation-types';
import { createClient } from '@/lib/supabase/client';

interface CancelTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  child: {
    id: string;
    first_name: string;
    last_name: string;
    photo_url?: string | null;
    school?: { name?: string; primary_color?: string };
    class?: { name?: string };
    escort_name?: string;
  } | null;
  onTripCanceled?: (childId: string, reason: string) => void;
}

const COMMON_REASONS: Array<{ key: CancellationReason; label: string; icon: string }> = [
  { key: 'illness', label: 'Illness / Not Feeling Well', icon: '🤒' },
  { key: 'family_travel', label: 'Family Travel / Out of Town', icon: '✈️' },
  { key: 'medical_appointment', label: 'Doctor / Medical Visit', icon: '🏥' },
  { key: 'personal', label: 'Personal / Family Day', icon: '🏠' },
  { key: 'school_event', label: 'School Closed / Pupil Holiday', icon: '🏫' },
  { key: 'other', label: 'Other Reason', icon: '✏️' },
];

export default function CancelTripModal({
  isOpen,
  onClose,
  child,
  onTripCanceled,
}: CancelTripModalProps) {
  const [selectedReason, setSelectedReason] = useState<CancellationReason>('illness');
  const [customReasonText, setCustomReasonText] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !child) return null;

  const fullName = `${child.first_name || ''} ${child.last_name || ''}`.trim() || 'Student';
  const assignedEscort = child.escort_name || 'Assigned Driver';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const chosenReasonLabel =
      selectedReason === 'other' && customReasonText.trim()
        ? customReasonText.trim()
        : COMMON_REASONS.find((r) => r.key === selectedReason)?.label || 'Family Reason';

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/parent/trip-cancellation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          child_id: child.id,
          reason: chosenReasonLabel,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to cancel trip.');
      }

      // Direct client WebSocket broadcast to ensure instant receipt on escort dashboard
      try {
        const supabase = createClient();
        const clientChannels: string[] = [
          `student_trip:${child.id}`,
          `city_manager:operations`,
        ];
        if (data.escort_id) clientChannels.push(`escort:${data.escort_id}`);
        if (data.escort_user_id) clientChannels.push(`escort:${data.escort_user_id}`);
        if (data.school_id) clientChannels.push(`school_escorts:${data.school_id}`);

        clientChannels.forEach((chName) => {
          const ch = supabase.channel(chName);
          ch.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              ch.send({
                type: 'broadcast',
                event: 'student_trip_canceled',
                payload: {
                  event: 'student_trip_canceled',
                  student_id: child.id,
                  student_name: fullName,
                  reason: chosenReasonLabel,
                  notes: notes.trim() || undefined,
                  canceled_at: new Date().toISOString(),
                },
              }).then(() => {
                setTimeout(() => supabase.removeChannel(ch), 800);
              }).catch(() => {});
            }
          });
        });
      } catch (wsErr) {
        console.warn('[CancelTripModal] client broadcast note:', wsErr);
      }

      toast.success(`Trip canceled for ${fullName}`, {
        description: `Escort ${assignedEscort} and City Operations have been notified immediately.`,
      });

      onTripCanceled?.(child.id, chosenReasonLabel);
      onClose();
    } catch (err: any) {
      console.error('[CancelTripModal] Error:', err);
      toast.error(err.message || 'Could not cancel trip. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-100 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
              <Ban className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 leading-tight">
                Not Going to School Today
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Immediate cancellation &amp; escort dispatch notice
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Student Context Card */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <StudentAvatar
              photoUrl={child.photo_url}
              firstName={child.first_name}
              lastName={child.last_name}
              size="md"
            />
            <div className="min-w-0">
              <h4 className="font-extrabold text-slate-900 text-sm truncate">{fullName}</h4>
              <p className="text-xs text-slate-500 truncate">
                {child.school?.name || 'School Campus'} · {child.class?.name || 'Standard'}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Escort</span>
            <span className="text-xs font-bold text-slate-800">{assignedEscort}</span>
          </div>
        </div>

        {/* Notice Info Banner */}
        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200/70 text-amber-900 flex items-start gap-2.5 text-xs">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="leading-snug">
            <strong>Instant Delivery:</strong> As soon as you confirm, your assigned escort and city operations manager will receive a high-priority alert and this stop will be automatically removed from today&apos;s morning route.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Reason Selection */}
          <div className="space-y-2">
            <label className="block font-extrabold text-slate-800 uppercase tracking-wider text-[10px]">
              Select Reason for Absence
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {COMMON_REASONS.map((r) => {
                const isSelected = selectedReason === r.key;
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setSelectedReason(r.key)}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-rose-50 border-rose-300 text-rose-900 font-extrabold shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-medium'
                    }`}
                  >
                    <span className="text-base">{r.icon}</span>
                    <span className="truncate flex-1">{r.label}</span>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-rose-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom text if 'other' is chosen */}
          {selectedReason === 'other' && (
            <div className="space-y-1 animate-in fade-in">
              <label className="block font-bold text-slate-700 text-[11px]">
                Specify Reason
              </label>
              <input
                type="text"
                required
                value={customReasonText}
                onChange={(e) => setCustomReasonText(e.target.value)}
                placeholder="E.g. Doctor's note, family emergency..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-800 text-xs"
              />
            </div>
          )}

          {/* Optional notes */}
          <div className="space-y-1">
            <label className="block font-bold text-slate-700 text-[11px]">
              Additional Note for Escort &amp; School <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="E.g. Please resume tomorrow morning as usual..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-800 text-xs resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold transition-all shadow-md shadow-rose-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Notifying Escort &amp; City Manager…</span>
                </>
              ) : (
                <>
                  <Ban className="w-4 h-4" />
                  <span>Confirm: Not Going Today</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
