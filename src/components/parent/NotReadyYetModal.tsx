'use client';

import { useState } from 'react';
import { X, Clock, AlertCircle, CheckCircle2, Loader2, Sparkles, UserCheck, ArrowRight, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import StudentAvatar from '@/components/shared/StudentAvatar';
import { createClient } from '@/lib/supabase/client';

interface NotReadyYetModalProps {
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
  onTripShifted?: (childId: string, delayMins: number, shiftedTime: string) => void;
}

const DELAY_OPTIONS = [
  { minutes: 10, label: '+10 Mins', subtitle: 'Quick touch-up' },
  { minutes: 15, label: '+15 Mins', subtitle: 'Recommended (Smart Shift)', isDefault: true },
  { minutes: 20, label: '+20 Mins', subtitle: 'Breakfast / dressing' },
  { minutes: 30, label: '+30 Mins', subtitle: 'Extended delay' },
];

const PRESET_REASONS = [
  { label: 'Finishing breakfast / snack', icon: '🥣' },
  { label: 'Putting on school uniform & shoes', icon: '👔' },
  { label: 'Packing school bag & homework', icon: '🎒' },
  { label: 'Family rush / sibling getting ready', icon: '⏳' },
  { label: 'Almost at doorstep / gate', icon: '🚪' },
];

export default function NotReadyYetModal({
  isOpen,
  onClose,
  child,
  onTripShifted,
}: NotReadyYetModalProps) {
  const [selectedDelay, setSelectedDelay] = useState<number>(15);
  const [selectedReason, setSelectedReason] = useState<string>('Finishing breakfast / snack');
  const [customNote, setCustomNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !child) return null;

  const fullName = `${child.first_name || ''} ${child.last_name || ''}`.trim() || 'Student';
  const assignedEscort = child.escort_name || 'Assigned Escort';

  // Calculate projected new pickup time
  const now = new Date();
  const shiftedDate = new Date(now.getTime() + selectedDelay * 60 * 1000);
  const formattedShiftedTime = shiftedDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/parent/trip-not-ready', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          child_id: child.id,
          delay_minutes: selectedDelay,
          reason: selectedReason,
          notes: customNote.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update readiness status.');
      }

      // Direct client WebSocket broadcast for immediate instant receipt
      try {
        const supabase = createClient();
        const clientChannels: string[] = [
          `student_trip:${child.id}`,
          `city_manager:operations`,
        ];
        if (data.escort_id) clientChannels.push(`escort:${data.escort_id}`);
        if (data.escort_user_id) clientChannels.push(`escort:${data.escort_user_id}`);

        clientChannels.forEach((chName) => {
          const ch = supabase.channel(chName);
          ch.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              ch.send({
                type: 'broadcast',
                event: 'student_not_ready',
                payload: {
                  event: 'student_not_ready',
                  student_id: child.id,
                  student_name: fullName,
                  delay_minutes: selectedDelay,
                  reason: selectedReason,
                  notes: customNote.trim() || undefined,
                  shifted_pickup_time: data.shifted_pickup_time || formattedShiftedTime,
                  timestamp: new Date().toISOString(),
                },
              });
            }
          });
        });
      } catch (broadcastErr) {
        console.warn('[NotReadyYetModal] client broadcast note:', broadcastErr);
      }

      toast.success(`Pickup Shifted: ${fullName}`, {
        description: `Escort notified immediately. Next ready student will be picked first; ${fullName} shifted to ~${data.shifted_pickup_time || formattedShiftedTime}.`,
        duration: 9000,
      });

      onTripShifted?.(child.id, selectedDelay, data.shifted_pickup_time || formattedShiftedTime);
      onClose();
    } catch (err: any) {
      toast.error('Failed to shift pickup time', {
        description: err.message || 'Please check your connection and try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-start justify-between bg-gradient-to-r from-amber-50/70 via-white to-amber-50/30">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-200/60 shadow-xs shrink-0">
              <Clock className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full">
                  Smart Route Shift
                </span>
                <span className="text-xs text-slate-400">• Saves Transit Time</span>
              </div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
                Child Not Ready Yet?
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Child Identity Banner */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-3">
            <StudentAvatar
              photoUrl={child.photo_url}
              firstName={child.first_name}
              lastName={child.last_name}
              size="md"
              accentColor={child.school?.primary_color || '#059669'}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-slate-900 text-sm truncate">{fullName}</h3>
                <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                  {child.class?.name || 'Student'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 truncate flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Assigned Escort: <strong className="text-slate-700 font-semibold">{assignedEscort}</strong></span>
              </p>
            </div>
          </div>

          {/* Time Delay Buttons */}
          <div className="space-y-2">
            <label className="block text-xs font-black uppercase tracking-wider text-slate-600">
              Select Time Needed to Be Ready
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {DELAY_OPTIONS.map((opt) => {
                const isSelected = selectedDelay === opt.minutes;
                return (
                  <button
                    key={opt.minutes}
                    type="button"
                    onClick={() => setSelectedDelay(opt.minutes)}
                    className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                      isSelected
                        ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20 ring-2 ring-amber-400/40'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-black text-sm">{opt.label}</span>
                    <span className={`text-[9px] ${isSelected ? 'text-amber-100' : 'text-slate-400'} font-medium truncate max-w-full`}>
                      {opt.subtitle}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Projected Shift Display Box */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-300/60 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 block">
                Projected New Pickup Window
              </span>
              <p className="text-base font-black text-slate-900 flex items-center gap-2">
                <span>~ {formattedShiftedTime}</span>
                <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                  +{selectedDelay} Mins
                </span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <ArrowRight className="w-5 h-5" />
            </div>
          </div>

          {/* Quick Reason Presets */}
          <div className="space-y-2">
            <label className="block text-xs font-black uppercase tracking-wider text-slate-600">
              Quick Reason (Shared with Escort)
            </label>
            <div className="space-y-1.5">
              {PRESET_REASONS.map((reason) => {
                const isSelected = selectedReason === reason.label;
                return (
                  <button
                    key={reason.label}
                    type="button"
                    onClick={() => setSelectedReason(reason.label)}
                    className={`w-full p-2.5 rounded-xl border text-left text-xs font-medium flex items-center gap-2.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-base">{reason.icon}</span>
                    <span className="flex-1 truncate">{reason.label}</span>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Note */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black uppercase tracking-wider text-slate-600">
              Additional Note for Escort (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Please blow horn once you arrive at the gate."
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all"
            />
          </div>

          {/* Explanatory Smart Route Benefit Banner */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-950 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              <strong>How this helps:</strong> Your escort is notified immediately on their live route map. The system automatically shifts {fullName} to a later stop so the escort picks other ready children first. This saves time and ensures no children wait in idle traffic!
            </p>
          </div>

          {/* Actions */}
          <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-1/3 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-extrabold text-xs hover:bg-slate-50 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-2/3 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Notifying Escort &amp; Shifting Route…</span>
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4" />
                  <span>Shift Pickup (+{selectedDelay} Mins)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
