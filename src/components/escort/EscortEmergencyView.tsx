// @ts-nocheck
'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  ShieldCheck,
  Phone,
  Car,
  Clock,
  CheckCircle2,
  Users,
  Radio,
  FileText,
  AlertCircle,
  Plus,
  X
} from 'lucide-react';
import { toast } from 'sonner';

interface EscortEmergencyViewProps {
  liveDashboardData: any;
  onRefreshData: () => void;
}

export default function EscortEmergencyView({
  liveDashboardData,
  onRefreshData,
}: EscortEmergencyViewProps) {
  const [showReportModal, setShowReportModal] = useState(false);
  const [incidentType, setIncidentType] = useState('Vehicle Breakdown');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emergencies = liveDashboardData?.emergencies || [];

  const handleReportEmergency = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/escorts/dashboard-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'report_emergency',
          incident_type: incidentType,
          reason,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Emergency reported! City Manager dispatched.');
        setShowReportModal(false);
        setReason('');
        onRefreshData();
      } else {
        throw new Error(data.error || 'Failed to report emergency');
      }
    } catch (err: any) {
      toast.error(err.message || 'Emergency report failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. HERO EMERGENCY HOTLINE & SOS */}
      <div className="bg-gradient-to-tr from-red-950 via-red-900 to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-400 animate-ping" />
            <span className="text-[10px] font-black uppercase tracking-widest text-red-300">
              City Manager Central Emergency Dispatch
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">
            Emergency &amp; Deputy Assignment Console
          </h2>
          <p className="text-xs text-red-200/90 font-medium max-w-xl">
            In case of vehicle breakdown, mechanical failure, or route blockage, report an incident to instantly deploy a nearby certified deputy escort and maintain passenger custody safety.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <a
            href="tel:08091234567"
            className="flex-1 md:flex-none px-5 py-3.5 rounded-2xl bg-white text-red-950 font-black text-xs shadow-lg hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
          >
            <Phone size={16} className="text-red-700" />
            <span>Call SOS Hotline</span>
          </a>

          <button
            type="button"
            onClick={() => setShowReportModal(true)}
            className="flex-1 md:flex-none px-5 py-3.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <AlertTriangle size={16} />
            <span>Report Breakdown</span>
          </button>
        </div>
      </div>

      {/* 2. ACTIVE & HISTORICAL EMERGENCY DISPATCHES */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-base text-slate-900">Active Incident &amp; Deputy Logs</h3>
          <span className="text-xs font-bold text-slate-400">Database Dispatch Records</span>
        </div>

        <div className="space-y-3">
          {emergencies.map((em: any, idx: number) => (
            <div
              key={em.id || idx}
              className="p-4 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-xs">{em.incident_type || 'Transit Emergency'}</h4>
                  <p className="text-[11px] text-slate-500 font-medium">{em.reason || 'Incident reported by escort'}</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    Logged: {em.created_at ? new Date(em.created_at).toLocaleString() : 'Recent'}
                  </p>
                </div>
              </div>

              <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 font-extrabold text-[10px] uppercase tracking-wider shrink-0">
                {em.status?.replace(/_/g, ' ') || 'DISPATCHED'}
              </span>
            </div>
          ))}

          {emergencies.length === 0 && (
            <div className="py-12 text-center text-slate-400 text-xs">
              <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
              <p className="font-bold text-slate-700">All Nominal — No Active Emergencies</p>
              <p className="text-[11px] text-slate-400 mt-0.5">All scheduled route operations are proceeding smoothly.</p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: REPORT BREAKDOWN / EMERGENCY */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                <AlertTriangle size={20} className="text-red-600" /> Report Transit Emergency
              </h3>
              <button onClick={() => setShowReportModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleReportEmergency} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-700 mb-1">Emergency Category</label>
                <select
                  value={incidentType}
                  onChange={(e) => setIncidentType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                >
                  <option value="Vehicle Breakdown">Vehicle Breakdown / Engine Fault</option>
                  <option value="Tire Puncture">Flat Tire / Suspension Issue</option>
                  <option value="Route Blockage">Traffic Gridlock / Road Blockage</option>
                  <option value="Medical Emergency">Passenger Medical Assistance</option>
                  <option value="Other">Other Operational Incident</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Incident Details &amp; Current Location</label>
                <textarea
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Describe vehicle location, number of passengers on board, and immediate assistance needed..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
              </div>

              <div className="p-3 bg-red-50 text-red-900 rounded-2xl border border-red-200 text-[11px] space-y-1">
                <p className="font-bold">Automated Protocol:</p>
                <p>Upon submission, the City Manager dispatch console will assign the closest available certified deputy escort to safely complete student transit.</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="flex-1 py-3 border border-slate-300 rounded-2xl font-extrabold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-extrabold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Reporting...' : 'Dispatch Deputy Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
