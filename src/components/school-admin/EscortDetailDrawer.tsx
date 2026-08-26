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
  ChevronRight
} from 'lucide-react';
import { photoSrc } from '@/lib/photo';
import StudentAvatar from '@/components/shared/StudentAvatar';

interface EscortDetailDrawerProps {
  escort: any;
  onClose: () => void;
  onUpdateStatus?: (escortId: string, newStatus: string) => void;
}

export default function EscortDetailDrawer({ escort, onClose, onUpdateStatus }: EscortDetailDrawerProps) {
  if (!escort) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/70 z-50 flex justify-end backdrop-blur-xs animate-in fade-in duration-200 font-sans">
      <div className="bg-white w-full max-w-xl h-full shadow-2xl overflow-y-auto flex flex-col justify-between border-l border-slate-200">
        <div>
          {/* Top Header */}
          <div className="p-6 bg-gradient-to-r from-[#07132B] via-[#0B1E36] to-[#0A1633] text-white space-y-4">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-black text-[10px] border border-emerald-400/30 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck size={12} /> {escort.approval?.status === 'CITY_MANAGER_APPROVED' ? 'City Manager Approved' : 'Verified Escort'}
              </span>
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-white p-1 rounded-full bg-slate-800/80 cursor-pointer"
              >
                <X size={18} />
              </button>
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
            {/* 1. School Affiliation */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">School Domain</span>
              <p className="font-black text-slate-900 text-sm">{escort.school_name || 'Gracefield International School'}</p>
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
                  <span className="font-mono font-bold text-emerald-700">{escort.vehicle?.roadworthiness_expiry}</span>
                </div>
              </div>
            </div>

            {/* 3. Designated Transport Route */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                  <Compass size={13} className="text-slate-600" /> Designated Transport Corridor
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white font-mono font-bold text-[10px]">
                  {escort.route?.code}
                </span>
              </div>
              <p className="font-black text-slate-900 text-xs">{escort.route?.name}</p>
              <p className="text-[11px] text-slate-500 font-medium">📍 Corridor: {escort.route?.corridor}</p>
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60 font-medium">
                <span>Morning: <strong>{escort.route?.departure_morning}</strong></span>
                <span>Afternoon: <strong>{escort.route?.departure_afternoon}</strong></span>
                <span>Stops: <strong>{escort.route?.total_stops} Points</strong></span>
              </div>
            </div>

            {/* 4. Duty Assignment */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                <Clock size={13} className="text-slate-600" /> Duty &amp; Shift Assignment
              </span>
              <p className="font-black text-slate-900">{escort.assignment?.duty_type}</p>
              <p className="text-slate-500 text-[11px]">Shift Window: <strong>{escort.assignment?.shift_window}</strong></p>
            </div>

            {/* 5. Connected Students Passenger Manifest */}
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
                {(!escort.connected_students || escort.connected_students.length === 0) && (
                  <div className="p-4 text-center text-slate-400 text-xs">
                    No students currently assigned to this escort's transit roster.
                  </div>
                )}
              </div>
            </div>

            {/* 6. City Manager Approval & Regulatory Clearances */}
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs space-y-2">
              <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider flex items-center gap-1">
                <ShieldCheck size={13} className="text-emerald-700" /> Regulatory Clearance &amp; Verification
              </span>
              <div className="space-y-1 text-[11px] text-emerald-950">
                <p>Status: <strong>{escort.approval?.status}</strong></p>
                <p>Vetted by: <strong>{escort.approval?.verified_by}</strong></p>
                <p>Criminal Background Check: <strong>{escort.approval?.background_check}</strong></p>
                <p>Medical Clearance: <strong>{escort.approval?.medical_clearance}</strong></p>
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
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
