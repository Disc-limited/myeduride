// @ts-nocheck
'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  Plus,
  Search,
  ShieldAlert,
  Clock,
  CheckCircle2,
  Phone,
  FileText,
  X,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

export default function SafetyIncidentsPage() {
  const [incidents, setIncidents] = useState([
    {
      id: 'INC-2026-001',
      title: 'Minor Traffic Delay on Lekki-Epe Expressway',
      category: 'Transit Delay',
      severity: 'low',
      reportedBy: 'Emeka Chukwu (Driver)',
      vehicle: 'IKJ-904-KT',
      studentsAffected: 9,
      timestamp: '2026-08-22 07:15 AM',
      status: 'resolved',
      details: 'Vehicle experienced a 12-minute standstill due to bridge maintenance. Parents automatically notified via EduRide SMS broadcast.',
    },
    {
      id: 'INC-2026-002',
      title: 'Unannounced Pickup Person Attempt at Front Gate',
      category: 'Unauthorized Pickup Attempt',
      severity: 'high',
      reportedBy: 'Gate Officer Ibrahim',
      vehicle: 'N/A',
      studentsAffected: 1,
      timestamp: '2026-08-21 03:40 PM',
      status: 'resolved',
      details: 'Unregistered relative requested student release without parental pre-authorization. Gate officer prevented departure and contacted verified parent.',
    },
  ]);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    category: 'Transit Delay',
    severity: 'medium',
    details: '',
  });

  const handleCreateIncident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.details) {
      toast.error('Title and details required');
      return;
    }
    const newInc = {
      id: `INC-2026-00${incidents.length + 1}`,
      title: form.title,
      category: form.category,
      severity: form.severity,
      reportedBy: 'School Administrator',
      vehicle: 'Campus Wide',
      studentsAffected: 0,
      timestamp: new Date().toLocaleString(),
      status: 'investigating',
      details: form.details,
    };
    setIncidents([newInc, ...incidents]);
    toast.success('Incident logged and safety officer notified!');
    setModalOpen(false);
    setForm({ title: '', category: 'Transit Delay', severity: 'medium', details: '' });
  };

  return (
    <div className="space-y-6 font-sans text-slate-800 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#07132B] via-[#0B1E36] to-[#0A1633] rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 font-black text-[11px] border border-rose-400/30 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle size={13} /> Safety & Emergency Response
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            Safety Incidents & Emergency Logging
          </h1>
          <p className="text-slate-300 text-xs md:text-sm max-w-2xl font-medium">
            Monitor and record student safety incident reports, unauthorized gate pickup interventions, transit delays, and emergency escalations.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="px-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs transition-all shadow-lg shadow-rose-600/30 flex items-center gap-2 cursor-pointer shrink-0"
        >
          <Plus size={16} />
          <span>Log Safety Incident</span>
        </button>
      </div>

      {/* Incidents List */}
      <div className="space-y-4">
        {incidents.map((inc) => (
          <div key={inc.id} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span
                  className={`px-2.5 py-1 rounded-full font-black text-[10px] uppercase ${
                    inc.severity === 'high'
                      ? 'bg-rose-100 text-rose-800'
                      : inc.severity === 'medium'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {inc.severity} priority
                </span>
                <span className="font-mono text-xs font-bold text-slate-400">{inc.id}</span>
                <span className="text-xs font-bold text-slate-500">· {inc.category}</span>
              </div>

              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px] uppercase flex items-center gap-1 self-start sm:self-auto">
                <CheckCircle2 size={12} /> {inc.status}
              </span>
            </div>

            <div>
              <h3 className="font-black text-slate-900 text-base">{inc.title}</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">{inc.details}</p>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-[11px] flex flex-wrap items-center justify-between gap-3 text-slate-500">
              <span>Reported by: <strong>{inc.reportedBy}</strong></span>
              <span>Vehicle: <strong>{inc.vehicle}</strong></span>
              <span>Time: <strong>{inc.timestamp}</strong></span>
            </div>
          </div>
        ))}
      </div>

      {/* Log Incident Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-base">Record Safety Incident Report</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateIncident} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Incident Headline *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bus transit mechanical delay on Route C"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  >
                    <option value="Transit Delay">Transit Delay</option>
                    <option value="Unauthorized Pickup Attempt">Unauthorized Pickup Attempt</option>
                    <option value="Medical / Health Alert">Medical / Health Alert</option>
                    <option value="Route Hazard">Route Hazard</option>
                    <option value="Gate Safety Violation">Gate Safety Violation</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Severity Level</label>
                  <select
                    value={form.severity}
                    onChange={(e) => setForm({ ...form, severity: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  >
                    <option value="low">Low (Standard Notification)</option>
                    <option value="medium">Medium (Requires Intervention)</option>
                    <option value="high">High (Critical Incident)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Incident Summary & Action Taken *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe what occurred, time of event, and preventive action implemented..."
                  value={form.details}
                  onChange={(e) => setForm({ ...form, details: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black shadow-md shadow-rose-600/20"
                >
                  Submit Incident Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
