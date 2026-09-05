import { useState } from 'react';
import {
  X,
  ShieldCheck,
  User,
  Phone,
  Mail,
  Car,
  Compass,
  Users,
  Clock,
  CheckCircle2,
  Calendar,
  AlertCircle,
  FileText,
  MapPin,
  ExternalLink,
  ChevronRight,
  Edit3,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { photoSrc } from '@/lib/photo';
import StudentAvatar from '@/components/shared/StudentAvatar';

interface EscortDetailDrawerProps {
  escort: any;
  onClose: () => void;
  onUpdateStatus?: (escortId: string, newStatus: string) => void;
  onRefresh?: () => void;
}

export default function EscortDetailDrawer({ escort, onClose, onUpdateStatus, onRefresh }: EscortDetailDrawerProps) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    fullName: escort?.full_name || escort?.fullName || '',
    phone: escort?.phone || '',
    email: escort?.email || '',
    address: escort?.residentialAddress || escort?.address || '',
    operatingArea: escort?.operating_area || escort?.operatingArea || '',
    emergencyContactName: escort?.emergencyContactName || escort?.emergency_contact_name || '',
    emergencyContactPhone: escort?.emergencyContactPhone || escort?.emergency_contact_phone || '',
    nin: escort?.nin || '',
    driverLicense: escort?.driver_license || escort?.driverLicense || '',
    correctionNotes: '',
  });

  if (!escort) return null;

  const handleSubmitCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/school-admin/escorts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'submit_correction',
          escort_id: escort.id,
          correction_data: formData,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Correction submitted to City Manager!');
        setShowEditModal(false);
        if (onRefresh) onRefresh();
      } else {
        toast.error(data.error || 'Failed to submit correction');
      }
    } catch {
      toast.error('Network error submitting correction');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 z-50 flex justify-end backdrop-blur-xs animate-in fade-in duration-200 font-sans">
      <div className="bg-white w-full max-w-xl h-full shadow-2xl overflow-y-auto flex flex-col justify-between border-l border-slate-200 relative">
        <div>
          {/* Top Header */}
          <div className="p-6 bg-gradient-to-r from-[#07132B] via-[#0B1E36] to-[#0A1633] text-white space-y-4">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-black text-[10px] border border-emerald-400/30 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck size={12} /> {escort.status === 'CORRECTION_PENDING' ? 'Correction Pending (City Manager Review)' : (escort.approval?.status === 'CITY_MANAGER_APPROVED' ? 'City Manager Approved' : 'Verified Escort')}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(true)}
                  className="px-3 py-1 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[11px] flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                >
                  <Edit3 size={13} /> Edit Escort Info
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-slate-400 hover:text-white p-1 rounded-full bg-slate-800/80 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <StudentAvatar
                photoUrl={escort.avatar_url}
                fullName={escort.full_name}
                size="lg"
                className="w-16 h-16 rounded-2xl border-2 border-emerald-500 shrink-0"
              />
              <div className="min-w-0">
                <h2 className="text-xl font-black text-white tracking-tight">{escort.full_name}</h2>
                <p className="text-xs text-slate-300 font-mono">{escort.id} · {escort.escort_type}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px] uppercase">
                    {escort.operational_status}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">NIN: {escort.nin}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5 text-xs text-slate-800">
            {/* Pending Correction Notice Banner */}
            {escort.status === 'CORRECTION_PENDING' && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
                <div className="flex items-center gap-2 font-black text-xs">
                  <AlertCircle size={15} className="text-amber-600" />
                  <span>Pending City Manager Correction Approval</span>
                </div>
                <p className="text-[11px] text-amber-800">
                  School Admin submitted an information update for this escort. Proposed changes are awaiting review and approval by the City Manager.
                </p>
              </div>
            )}

            {/* 1. School Affiliation */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">School Domain</span>
              <p className="font-black text-slate-900 text-sm">{escort.school_name || 'Myeduride Academy School'}</p>
            </div>

            {/* 2. Assigned Vehicle */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                  <Car size={13} className="text-slate-600" /> Assigned Fleet Vehicle
                </span>
                <span className="font-mono text-[11px] font-bold text-slate-600">{escort.vehicle?.reg_number}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400 block">Vehicle Model</span>
                  <span className="font-bold text-slate-900">{escort.vehicle?.make_model}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Capacity</span>
                  <span className="font-bold text-slate-900">{escort.vehicle?.capacity} Passenger Seats</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Driver License</span>
                  <span className="font-mono font-bold text-slate-800">{escort.driver_license}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Roadworthiness</span>
                  <span className="text-emerald-600 font-bold">Vetted</span>
                </div>
              </div>
            </div>

            {/* 3. Transport Route */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                <Compass size={13} className="text-slate-600" /> Designated Route
              </span>
              <p className="font-bold text-slate-900">{escort.route?.code}: {escort.route?.name}</p>
              <div className="flex items-center gap-4 text-[11px] text-slate-600">
                <span>Morning: <strong>{escort.route?.departure_morning}</strong></span>
                <span>Afternoon: <strong>{escort.route?.departure_afternoon}</strong></span>
                <span>Stops: <strong>{escort.route?.total_stops} Points</strong></span>
              </div>
            </div>

            {/* 4. Connected Students Passenger Manifest */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                  <Users size={13} className="text-slate-600" /> Connected Students ({escort.connected_students?.length || 0})
                </span>
                <span className="text-[10px] font-bold text-emerald-700">Live Manifest</span>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {escort.connected_students?.map((stu: any) => (
                  <div key={stu.student_id} className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-3 text-xs">
                    <StudentAvatar
                      photoUrl={stu.photo_url}
                      fullName={stu.name}
                      size="xs"
                      className="w-8 h-8 rounded-xl shrink-0"
                    />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <p className="font-black text-slate-900 truncate">{stu.name}</p>
                        <span className="text-[10px] font-bold text-slate-500">{stu.class}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 truncate">📍 Stop: <strong>{stu.stop}</strong></p>
                      <p className="text-[10px] text-slate-400 font-mono">📞 Parent: {stu.parent_phone}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Drawer Actions */}
        <div className="p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {['Active On Duty', 'In Transit', 'Standby', 'Off Duty'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => onUpdateStatus?.(escort.id, st)}
                className={`px-3 py-1.5 rounded-xl font-bold text-[11px] cursor-pointer transition-all ${
                  escort.operational_status === st
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowEditModal(true)}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs cursor-pointer flex items-center gap-1.5"
          >
            <Edit3 size={14} /> Edit Info
          </button>
        </div>

        {/* EDIT ESCORT INFORMATION MODAL */}
        {showEditModal && (
          <div className="fixed inset-0 bg-slate-950/80 z-60 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-black text-slate-900">Edit School Escort Information</h3>
                  <p className="text-xs text-slate-500">
                    Changes will be submitted to the City Manager for review and approval.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmitCorrection} className="space-y-3.5 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Phone Number</label>
                    <input
                      type="text"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">NIN Number</label>
                    <input
                      type="text"
                      value={formData.nin}
                      onChange={(e) => setFormData({ ...formData, nin: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono font-medium"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Driver License No.</label>
                    <input
                      type="text"
                      value={formData.driverLicense}
                      onChange={(e) => setFormData({ ...formData, driverLicense: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Residential Address</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Operating Area</label>
                  <input
                    type="text"
                    value={formData.operatingArea}
                    onChange={(e) => setFormData({ ...formData, operatingArea: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Emergency Contact Name</label>
                    <input
                      type="text"
                      value={formData.emergencyContactName}
                      onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Emergency Contact Phone</label>
                    <input
                      type="text"
                      value={formData.emergencyContactPhone}
                      onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Correction Notes for City Manager</label>
                  <textarea
                    rows={2}
                    value={formData.correctionNotes}
                    onChange={(e) => setFormData({ ...formData, correctionNotes: e.target.value })}
                    placeholder="Reason for updating escort information..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium placeholder:text-slate-400"
                  />
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-[11px] flex items-center gap-2 font-medium">
                  <ShieldCheck size={16} className="text-blue-600 shrink-0" />
                  <span>Submitting will notify the City Manager to review and approve these corrections.</span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Send size={13} /> {submitting ? 'Submitting...' : 'Submit to City Manager'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
