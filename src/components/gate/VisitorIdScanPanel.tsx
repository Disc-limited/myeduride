// @ts-nocheck
'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Users,
  QrCode,
  Search,
  UserPlus,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  Smartphone,
  Eye,
  Camera,
  X,
  Phone,
  Building,
  Car,
  RefreshCw,
  Plus
} from 'lucide-react';
import { toast } from 'sonner';
import DigitalVisitorPassModal from './DigitalVisitorPassModal';

interface VisitorIdScanPanelProps {
  schoolId: string;
  onVisitorCountChange?: (count: number) => void;
}

export default function VisitorIdScanPanel({ schoolId, onVisitorCountChange }: VisitorIdScanPanelProps) {
  const [visitors, setVisitors] = useState([]);
  const [onCampusVisitors, setOnCampusVisitors] = useState([]);
  const [metrics, setMetrics] = useState({
    total_visitors_today: 0,
    currently_on_campus: 0,
    departed_today: 0,
  });
  const [loading, setLoading] = useState(true);
  const [scanInput, setScanInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isScanningCamera, setIsScanningCamera] = useState(false);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [selectedPassVisitor, setSelectedPassVisitor] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form for Register Visitor
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    purpose_of_visit: '',
    person_to_see: '',
    department: 'General Administration',
    vehicle_plate: '',
    visitor_type: 'Parent / Guardian',
  });

  const loadVisitors = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/gate/visitors?school_id=${schoolId || ''}`);
      const json = await res.json();
      if (json.success) {
        setVisitors(json.all_visitors || []);
        setOnCampusVisitors(json.on_campus_visitors || []);
        setMetrics(json.metrics || {});
        onVisitorCountChange?.(json.metrics?.currently_on_campus || 0);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load visitor records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVisitors();
  }, [schoolId]);

  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInput.trim()) return;

    try {
      const res = await fetch('/api/gate/visitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'scan_verify_visitor',
          school_id: schoolId,
          scan_token: scanInput.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        if (json.action_performed === 'exit') {
          toast.success(json.message || `Visitor ${json.visitor.full_name} exited.`);
        } else {
          toast.info(json.message || `Visitor verified: ${json.visitor.full_name}`);
        }
        setScanInput('');
        loadVisitors();
      } else {
        toast.error(json.error || 'Digital pass not recognized');
      }
    } catch (err: any) {
      toast.error('Scan processing error');
    }
  };

  const handleRegisterVisitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name || !form.phone || !form.purpose_of_visit) {
      toast.error('Name, phone, and purpose of visit are required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/gate/visitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register_visitor',
          school_id: schoolId,
          visitor_data: form,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Visitor ${json.visitor.full_name} registered! Digital Pass generated.`);
        setRegisterModalOpen(false);
        setSelectedPassVisitor(json.visitor); // Open digital pass preview
        setForm({
          full_name: '',
          phone: '',
          email: '',
          purpose_of_visit: '',
          person_to_see: '',
          department: 'General Administration',
          vehicle_plate: '',
          visitor_type: 'Parent / Guardian',
        });
        loadVisitors();
      } else {
        toast.error(json.error || 'Failed to register visitor');
      }
    } catch (err: any) {
      toast.error('Registration error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualExit = async (visitorId: string, visitorName: string) => {
    try {
      const res = await fetch('/api/gate/visitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'log_visitor_exit',
          school_id: schoolId,
          visitor_id: visitorId,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Visitor ${visitorName} exit recorded.`);
        loadVisitors();
      }
    } catch (err) {
      toast.error('Failed to log exit');
    }
  };

  const filteredVisitors = visitors.filter(
    (v) =>
      (v.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.phone || '').includes(searchQuery) ||
      (v.id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.person_to_see || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 font-sans">
      {/* SCANNING WORKSTATION & ACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: High-Speed Scan Terminal */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-800 flex items-center justify-center font-black">
                <QrCode size={24} />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base">Digital Visitor Scan & Verification</h3>
                <p className="text-xs text-slate-500 font-medium">
                  Scan smartphone QR code passes or enter system-generated Visitor ID.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setRegisterModalOpen(true)}
              className="px-4 py-2.5 rounded-2xl bg-[#00A859] hover:bg-emerald-600 text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              <Plus size={16} />
              <span>Register New Visitor</span>
            </button>
          </div>

          {/* Quick Scan Input Box */}
          <form onSubmit={handleScanSubmit} className="space-y-3">
            <div className="relative">
              <input
                type="text"
                autoFocus
                placeholder="Scan digital visitor QR pass or enter Visitor ID (e.g. VIS-2026-0881)..."
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                className="w-full pl-12 pr-28 py-3.5 bg-slate-50 border-2 border-slate-200 focus:border-purple-600 rounded-2xl text-xs font-mono font-bold focus:outline-none transition-all"
              />
              <QrCode className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs cursor-pointer shadow-xs"
              >
                Scan / Check
              </button>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium px-1">
              <span>Supports digital smartphone QR pass tokens & manual ID search.</span>
              <span className="font-bold text-purple-700">Non-printable digital verification</span>
            </div>
          </form>

          {/* KPI Snapshot */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="p-3 rounded-2xl bg-purple-50 border border-purple-100 text-center">
              <span className="text-[10px] font-black uppercase text-purple-800 tracking-wider">Total Today</span>
              <p className="text-xl font-black text-purple-900 mt-0.5">{metrics.total_visitors_today}</p>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100 text-center">
              <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">Currently On Campus</span>
              <p className="text-xl font-black text-emerald-900 mt-0.5">{metrics.currently_on_campus}</p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center">
              <span className="text-[10px] font-black uppercase text-slate-600 tracking-wider">Departed</span>
              <p className="text-xl font-black text-slate-900 mt-0.5">{metrics.departed_today}</p>
            </div>
          </div>
        </div>

        {/* Right Col: Active On-Campus Quick Release Station */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-black text-slate-900 text-sm">Active Visitors On Campus</h4>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">
                {onCampusVisitors.length} Active
              </span>
            </div>

            <div className="space-y-2.5 mt-3 max-h-72 overflow-y-auto pr-1">
              {onCampusVisitors.map((v) => (
                <div key={v.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs">
                  <div className="flex items-start justify-between gap-1">
                    <div>
                      <h5 className="font-black text-slate-900">{v.full_name}</h5>
                      <span className="text-[10px] font-mono text-purple-700 font-bold">{v.id}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleManualExit(v.id, v.full_name)}
                      className="px-2.5 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 font-black text-[10px] uppercase cursor-pointer"
                    >
                      Log Exit
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">To see: <strong>{v.person_to_see}</strong></p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5 border-t border-slate-100">
                    <span>Entry: {new Date(v.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedPassVisitor(v)}
                      className="text-purple-600 font-bold hover:underline"
                    >
                      View Digital Pass
                    </button>
                  </div>
                </div>
              ))}
              {onCampusVisitors.length === 0 && (
                <div className="p-6 text-center text-slate-400 text-xs">
                  No visitors currently checked into campus.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ALL VISITORS OPERATIONAL RECORD TABLE */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <Users size={18} className="text-slate-600" />
            <h3 className="font-black text-slate-900 text-base">School Visitor Operational Log</h3>
          </div>

          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Search visitor name, ID, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="p-3 font-bold">Visitor Details</th>
                <th className="p-3 font-bold">Purpose of Visit</th>
                <th className="p-3 font-bold">Person / Dept to See</th>
                <th className="p-3 font-bold">Vehicle Plate</th>
                <th className="p-3 font-bold">Entry Time</th>
                <th className="p-3 font-bold">Exit / Duration</th>
                <th className="p-3 font-bold">Status</th>
                <th className="p-3 font-bold">Digital Pass</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVisitors.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="p-3 font-bold text-slate-900">
                    {v.full_name}
                    <span className="block text-[10px] text-slate-400 font-mono">{v.id} · {v.phone}</span>
                  </td>
                  <td className="p-3 text-slate-700 font-medium">{v.purpose_of_visit}</td>
                  <td className="p-3 text-slate-800 font-bold">{v.person_to_see}</td>
                  <td className="p-3 font-mono font-bold text-slate-700">{v.vehicle_plate || 'N/A'}</td>
                  <td className="p-3 font-bold text-emerald-700">
                    {new Date(v.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="p-3 font-medium text-slate-600">
                    {v.exit_time
                      ? `${new Date(v.exit_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${v.duration_minutes}m)`
                      : '— In Session —'}
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-extrabold text-[10px] uppercase ${
                        v.status === 'on_campus' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {v.status === 'on_campus' ? 'On Campus' : 'Departed'}
                    </span>
                  </td>
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => setSelectedPassVisitor(v)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <Smartphone size={12} />
                      <span>Digital Pass</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* REGISTER VISITOR MODAL */}
      {registerModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-800 flex items-center justify-center font-black">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Register Visitor Entry</h3>
                  <p className="text-xs text-slate-500 font-medium">Generates a system-generated digital visitor pass.</p>
                </div>
              </div>
              <button onClick={() => setRegisterModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRegisterVisitor} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Visitor Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Engr. Chidi Okafor"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="+234..."
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Visitor Classification</label>
                  <select
                    value={form.visitor_type}
                    onChange={(e) => setForm({ ...form, visitor_type: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    <option value="Parent / Guardian">Parent / Guardian</option>
                    <option value="Official Vendor / Contractor">Official Vendor / Contractor</option>
                    <option value="Government Official">Government Official</option>
                    <option value="Prospective Parent">Prospective Parent</option>
                    <option value="Guest / Other">Guest / Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Purpose of Visit *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Academic Conference with Class Teacher"
                  value={form.purpose_of_visit}
                  onChange={(e) => setForm({ ...form, purpose_of_visit: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Person / Host to See</label>
                  <input
                    type="text"
                    placeholder="Host staff name"
                    value={form.person_to_see}
                    onChange={(e) => setForm({ ...form, person_to_see: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Vehicle License Plate (if any)</label>
                  <input
                    type="text"
                    placeholder="e.g. LAG-381-KT"
                    value={form.vehicle_plate}
                    onChange={(e) => setForm({ ...form, vehicle_plate: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl uppercase font-mono"
                  />
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 space-y-1">
                <span className="font-bold block flex items-center gap-1">
                  <ShieldCheck size={13} className="text-amber-700" /> Digital Pass Invariant Notice
                </span>
                <p>
                  Visitor will receive a system-generated Digital Pass. As per security regulations, this pass cannot be printed as a physical card and must be scanned digitally on visitor exit.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRegisterModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black shadow-md shadow-purple-600/20 cursor-pointer"
                >
                  {submitting ? 'Registering...' : 'Register Entry & Generate Pass'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DIGITAL VISITOR PASS MODAL */}
      {selectedPassVisitor && (
        <DigitalVisitorPassModal
          visitor={selectedPassVisitor}
          onClose={() => setSelectedPassVisitor(null)}
        />
      )}
    </div>
  );
}
