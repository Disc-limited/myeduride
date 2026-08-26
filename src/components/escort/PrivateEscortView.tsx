// @ts-nocheck
'use client';

import { useState } from 'react';
import {
  UserCheck,
  MapPin,
  Calendar,
  ShieldAlert,
  DollarSign,
  Phone,
  Clock,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  ArrowRight,
  TrendingUp,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';

interface PrivateEscortViewProps {
  onOpenVerificationModal: (student?: any) => void;
  onOpenIncidentModal: () => void;
}

export default function PrivateEscortView({
  onOpenVerificationModal,
  onOpenIncidentModal,
}: PrivateEscortViewProps) {
  const [activeTab, setActiveTab] = useState<'students' | 'routes' | 'schedules' | 'safety' | 'earnings'>('students');

  // Parent-assigned students data from database
  const [parentAssignedStudents, setParentAssignedStudents] = useState<any[]>([]);

  // Earnings summary
  const earningsData = {
    thisMonth: '₦0.00',
    pendingPayout: '₦0.00',
    completedTrips: 0,
    rating: '5.0 ★',
  };

  return (
    <div className="space-y-6">
      {/* SECTION TABS HEADER */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-2 shadow-sm flex flex-wrap gap-1.5 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('students')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all ${
            activeTab === 'students'
              ? 'bg-[#0A1128] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <UserCheck size={15} />
          <span>Parent-Assigned Students ({parentAssignedStudents.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('routes')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all ${
            activeTab === 'routes'
              ? 'bg-[#0A1128] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <MapPin size={15} />
          <span>Route Information</span>
        </button>

        <button
          onClick={() => setActiveTab('schedules')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all ${
            activeTab === 'schedules'
              ? 'bg-[#0A1128] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Calendar size={15} />
          <span>Pickup Schedules</span>
        </button>

        <button
          onClick={() => setActiveTab('safety')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all ${
            activeTab === 'safety'
              ? 'bg-[#0A1128] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShieldAlert size={15} />
          <span>Safety Reporting</span>
        </button>

        <button
          onClick={() => setActiveTab('earnings')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all ${
            activeTab === 'earnings'
              ? 'bg-[#0A1128] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <DollarSign size={15} />
          <span>Earnings & Payouts</span>
        </button>
      </div>

      {/* TAB 1: PARENT-ASSIGNED STUDENTS */}
      {activeTab === 'students' && (
        parentAssignedStudents.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center space-y-2">
            <UserCheck size={32} className="mx-auto text-slate-300" />
            <h4 className="font-extrabold text-sm text-slate-700">No Private Escort Assignments</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Parent-assigned private transport contracts and door-to-door assignments will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {parentAssignedStudents.map((stud) => (
              <div
                key={stud.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        PRIVATE ESCORT CONTRACT
                      </span>
                      <h4 className="font-extrabold text-base text-slate-900 mt-1">{stud.name}</h4>
                      <span className="text-xs text-slate-500 font-medium">{stud.school}</span>
                    </div>
                    <span className="font-extrabold text-sm text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-100">
                      {stud.monthlyFee}
                    </span>
                  </div>

                  <div className="pt-3 space-y-2 text-xs text-slate-700">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                      <span className="text-slate-400 font-semibold block">Pickup Address</span>
                      <span className="font-bold text-slate-900 block">{stud.pickupAddress}</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                      <span className="text-slate-400 font-semibold block">Parent Contact</span>
                      <span className="font-bold text-slate-900 block">{stud.parentName}</span>
                      <span className="font-mono text-emerald-600">{stud.parentPhone}</span>
                    </div>

                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 text-amber-900 text-[11px] space-y-0.5">
                      <span className="font-bold block">Special Parent Instructions:</span>
                      <span>{stud.specialInstructions}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center gap-3">
                  <button
                    onClick={() => onOpenVerificationModal(stud)}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs py-2.5 px-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5"
                  >
                    <QrCode size={16} />
                    <span>Verify Pickup PIN</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* TAB 2: ROUTE INFORMATION */}
      {activeTab === 'routes' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-extrabold text-lg text-slate-900">Private Transit Route Breakdown</h3>
              <p className="text-xs text-slate-500">Custom Door-to-Door Escort Routing</p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex justify-between font-bold text-slate-900">
                <span>Lekki Phase 1 ➔ Corona Secondary Campus (Agbara)</span>
                <span className="text-emerald-600">Approx. 45 Mins</span>
              </div>
              <p className="text-slate-500">Door pickup at 06:45 AM • Arrival at 07:30 AM</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PICKUP SCHEDULES */}
      {activeTab === 'schedules' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-extrabold text-lg text-slate-900">Weekly Pickup Schedule</h3>
              <p className="text-xs text-slate-500">Recurring Parent Handover Timetable</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 text-sm block">Morning Home Departure</span>
                <span className="text-slate-500">Monday - Friday at 06:45 AM</span>
              </div>
              <span className="bg-emerald-100 text-emerald-800 font-bold px-3 py-1 rounded-full">
                Active Schedule
              </span>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 text-sm block">Afternoon Campus Pickup</span>
                <span className="text-slate-500">Monday - Friday at 03:30 PM</span>
              </div>
              <span className="bg-emerald-100 text-emerald-800 font-bold px-3 py-1 rounded-full">
                Active Schedule
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SAFETY REPORTING */}
      {activeTab === 'safety' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-extrabold text-lg text-slate-900">Safety & Incident Reporting</h3>
              <p className="text-xs text-slate-500">Log Safety Hazards & Dispatch Emergency Alerts</p>
            </div>

            <button
              onClick={onOpenIncidentModal}
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-md flex items-center gap-1.5 transition-all"
            >
              <AlertTriangle size={16} />
              <span>Report Emergency / Hazard</span>
            </button>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs text-slate-600">
            All safety reports are logged in real-time to the DISC Command Centre and broadcast to assigned parents.
          </div>
        </div>
      )}

      {/* TAB 5: EARNINGS */}
      {activeTab === 'earnings' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-extrabold text-lg text-slate-900">Earnings & Payout Summary</h3>
              <p className="text-xs text-slate-500">Private Escort Contract Financials</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl">
              <span className="text-emerald-800 font-bold uppercase block text-[10px]">TOTAL EARNED (THIS MONTH)</span>
              <span className="font-extrabold text-2xl text-emerald-950 block mt-1">{earningsData.thisMonth}</span>
            </div>

            <div className="p-5 bg-blue-50 border border-blue-200 rounded-2xl">
              <span className="text-blue-800 font-bold uppercase block text-[10px]">PENDING ESCROW PAYOUT</span>
              <span className="font-extrabold text-2xl text-blue-950 block mt-1">{earningsData.pendingPayout}</span>
            </div>

            <div className="p-5 bg-purple-50 border border-purple-200 rounded-2xl">
              <span className="text-purple-800 font-bold uppercase block text-[10px]">ESCORT RATING</span>
              <span className="font-extrabold text-2xl text-purple-950 block mt-1">{earningsData.rating}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
