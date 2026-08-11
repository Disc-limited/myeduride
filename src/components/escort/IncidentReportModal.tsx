// @ts-nocheck
'use client';

import { useState } from 'react';
import { AlertTriangle, ShieldAlert, Send, X, Camera, MapPin, PhoneCall } from 'lucide-react';
import { toast } from 'sonner';

interface IncidentReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  escortType?: string;
  onReportSubmitted?: (report: any) => void;
}

export default function IncidentReportModal({
  isOpen,
  onClose,
  escortType = 'School Escort',
  onReportSubmitted,
}: IncidentReportModalProps) {
  const [category, setCategory] = useState('Traffic Delay');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'critical'>('medium');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      toast.error('Please describe the safety incident');
      return;
    }

    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      toast.success(
        severity === 'critical'
          ? '🚨 EMERGENCY SOS DISPATCHED to DISC Command Centre & Supervisors!'
          : 'Safety Incident Report submitted successfully.'
      );
      if (onReportSubmitted) {
        onReportSubmitted({
          category,
          severity,
          description,
          timestamp: new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' }),
        });
      }
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-slate-100 relative animate-in fade-in zoom-in duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-all"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md">
            <AlertTriangle size={22} />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-slate-900 leading-tight">
              Safety Incident & Hazard Log
            </h3>
            <p className="text-xs text-slate-500">{escortType} Operational Security</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Incident Category */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-800">Incident Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="Traffic Delay">Traffic / Route Delay</option>
              <option value="Vehicle Breakdown">Vehicle Mechanical Issue</option>
              <option value="Student Medical Alert">Student Medical / Sick Bay Request</option>
              <option value="Unclaimed Student">Unclaimed Student at Dropoff</option>
              <option value="Route Hazard">Route Hazard / Weather Blockage</option>
              <option value="Security Alert">Security Emergency (SOS)</option>
            </select>
          </div>

          {/* Severity Picker */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-800">Severity Level</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSeverity('low')}
                className={`py-2 px-3 rounded-xl font-bold border transition-all ${
                  severity === 'low'
                    ? 'bg-blue-50 text-blue-700 border-blue-300 shadow-sm'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                Low / Minor
              </button>
              <button
                type="button"
                onClick={() => setSeverity('medium')}
                className={`py-2 px-3 rounded-xl font-bold border transition-all ${
                  severity === 'medium'
                    ? 'bg-amber-50 text-amber-700 border-amber-300 shadow-sm'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                Moderate
              </button>
              <button
                type="button"
                onClick={() => setSeverity('critical')}
                className={`py-2 px-3 rounded-xl font-bold border transition-all ${
                  severity === 'critical'
                    ? 'bg-red-50 text-red-700 border-red-300 shadow-sm animate-pulse'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                🚨 Critical SOS
              </button>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-800">Incident Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide details about the location, cause of delay, or emergency..."
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-400 font-medium text-slate-800"
            />
          </div>

          {/* GPS Location Tag */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-slate-600">
            <div className="flex items-center gap-2">
              <MapPin size={15} className="text-amber-500" />
              <span className="font-medium">Current Location Tag</span>
            </div>
            <span className="font-mono font-bold text-slate-800 text-[11px]">6.3350° N, 5.6037° E</span>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`flex-1 font-bold text-xs py-2.5 px-4 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-white ${
                severity === 'critical'
                  ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20'
                  : 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'
              }`}
            >
              {submitting ? (
                <span>Submitting...</span>
              ) : (
                <>
                  <Send size={15} />
                  <span>{severity === 'critical' ? 'Dispatch SOS Alert' : 'Submit Incident'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
