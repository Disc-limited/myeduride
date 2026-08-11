// @ts-nocheck
'use client';

import { useState } from 'react';
import {
  Shield,
  Users,
  Bus,
  Navigation,
  Activity,
  CalendarCheck,
  DollarSign,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Sparkles,
  MapPin,
  RefreshCw,
  QrCode,
  ShieldCheck,
  Clock,
  Radio,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';

interface MyEduRideEscortViewProps {
  onOpenVerificationModal: (student?: any) => void;
  onOpenIncidentModal: () => void;
}

export default function MyEduRideEscortView({
  onOpenVerificationModal,
  onOpenIncidentModal,
}: MyEduRideEscortViewProps) {
  const [activeTab, setActiveTab] = useState<
    'operations' | 'assignments' | 'vehicle' | 'optimisation' | 'journey' | 'attendance' | 'earnings' | 'incidents' | 'analytics'
  >('operations');

  // Simulated Live Journey state
  const [journeyStatus, setJourneyStatus] = useState<'idle' | 'tracking' | 'completed'>('tracking');
  const [speed, setSpeed] = useState(38); // km/h

  // Sample student assignments across schools
  const [discAssignments] = useState([
    {
      id: 'DISC-STU-01',
      name: 'Stephanie Mba',
      school: 'Meadow Hall School',
      route: 'Lekki Shared Corridor Route A',
      status: 'boarded',
      time: '07:18 AM',
    },
    {
      id: 'DISC-STU-02',
      name: 'Tunde Bakare',
      school: 'Corona Secondary School',
      route: 'Agbara Transit Route B',
      status: 'boarded',
      time: '07:25 AM',
    },
    {
      id: 'DISC-STU-03',
      name: 'Amina Sani',
      school: 'Fortune Springs Montessori',
      route: 'Ikotun Corridor Route C',
      status: 'pending',
      time: null,
    },
  ]);

  // Operational metrics
  const operationsMetrics = {
    fleetStatus: 'Active & Verified',
    totalPassengers: 14,
    routeOptimisationScore: '96% Optimal',
    speedAlerts: 0,
    discSupervisor: 'Commander Peter Okon',
  };

  return (
    <div className="space-y-6">
      {/* DISC BRAND BANNER */}
      <div className="bg-gradient-to-r from-[#0A1128] via-[#121E42] to-[#0A1128] rounded-2xl p-5 text-white shadow-md border border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
            <Shield size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-500/30 uppercase tracking-widest">
                DISC-MANAGED FLEET OPERATOR
              </span>
              <span className="text-xs text-slate-400">• Unit #DISC-902</span>
            </div>
            <h3 className="font-extrabold text-lg tracking-tight text-white mt-1">
              MyEduRide Official Transit Escort Command
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 text-xs font-semibold shrink-0">
          <Radio size={15} className="text-emerald-400 animate-pulse" />
          <span>Live Operations Link Active</span>
        </div>
      </div>

      {/* SECTION TABS HEADER */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-2 shadow-sm flex flex-wrap gap-1.5 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('operations')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all ${
            activeTab === 'operations' ? 'bg-[#0A1128] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Shield size={15} />
          <span>DISC Operations</span>
        </button>

        <button
          onClick={() => setActiveTab('assignments')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all ${
            activeTab === 'assignments' ? 'bg-[#0A1128] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users size={15} />
          <span>Student Assignments</span>
        </button>

        <button
          onClick={() => setActiveTab('vehicle')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all ${
            activeTab === 'vehicle' ? 'bg-[#0A1128] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Bus size={15} />
          <span>Vehicle Management</span>
        </button>

        <button
          onClick={() => setActiveTab('optimisation')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all ${
            activeTab === 'optimisation' ? 'bg-[#0A1128] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Sparkles size={15} />
          <span>Route Optimisation</span>
        </button>

        <button
          onClick={() => setActiveTab('journey')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all ${
            activeTab === 'journey' ? 'bg-[#0A1128] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Activity size={15} />
          <span>Journey Monitoring</span>
        </button>

        <button
          onClick={() => setActiveTab('attendance')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all ${
            activeTab === 'attendance' ? 'bg-[#0A1128] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <CalendarCheck size={15} />
          <span>Attendance</span>
        </button>

        <button
          onClick={() => setActiveTab('earnings')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all ${
            activeTab === 'earnings' ? 'bg-[#0A1128] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <DollarSign size={15} />
          <span>Daily Earnings</span>
        </button>

        <button
          onClick={() => setActiveTab('incidents')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all ${
            activeTab === 'incidents' ? 'bg-[#0A1128] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <AlertTriangle size={15} />
          <span>Incident Reporting</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all ${
            activeTab === 'analytics' ? 'bg-[#0A1128] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BarChart3 size={15} />
          <span>Performance Analytics</span>
        </button>
      </div>

      {/* TAB 1: DISC OPERATIONS */}
      {activeTab === 'operations' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-1">
              <span className="text-emerald-800 font-bold uppercase text-[10px]">FLEET STATUS</span>
              <span className="font-extrabold text-base text-emerald-950 block">{operationsMetrics.fleetStatus}</span>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl space-y-1">
              <span className="text-blue-800 font-bold uppercase text-[10px]">PASSENGER MANIFEST</span>
              <span className="font-extrabold text-base text-blue-950 block">{operationsMetrics.totalPassengers} Students</span>
            </div>

            <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl space-y-1">
              <span className="text-purple-800 font-bold uppercase text-[10px]">AI ROUTE OPTIMALITY</span>
              <span className="font-extrabold text-base text-purple-950 block">{operationsMetrics.routeOptimisationScore}</span>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
              <span className="text-slate-500 font-bold uppercase text-[10px]">DISC SUPERVISOR</span>
              <span className="font-bold text-slate-800 block text-xs truncate">{operationsMetrics.discSupervisor}</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STUDENT ASSIGNMENTS */}
      {activeTab === 'assignments' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-extrabold text-lg text-slate-900">DISC Passenger Manifest</h3>
              <p className="text-xs text-slate-500">Multi-School Assigned Students</p>
            </div>
            <button
              onClick={() => onOpenVerificationModal()}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs py-2 px-3.5 rounded-xl shadow-md flex items-center gap-1.5"
            >
              <QrCode size={15} />
              <span>Verify Passenger PIN</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                  <th className="py-3 px-3">Student Name</th>
                  <th className="py-3 px-3">School</th>
                  <th className="py-3 px-3">Corridor Route</th>
                  <th className="py-3 px-3">Boarding Status</th>
                  <th className="py-3 px-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {discAssignments.map((st) => (
                  <tr key={st.id} className="hover:bg-slate-50">
                    <td className="py-3.5 px-3 font-bold text-slate-900">{st.name}</td>
                    <td className="py-3.5 px-3">{st.school}</td>
                    <td className="py-3.5 px-3 text-slate-600">{st.route}</td>
                    <td className="py-3.5 px-3">
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {st.status === 'boarded' ? `Boarded (${st.time})` : 'Pending'}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <button
                        onClick={() => onOpenVerificationModal(st)}
                        className="text-emerald-600 font-bold hover:underline"
                      >
                        Verify Handover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: VEHICLE MANAGEMENT */}
      {activeTab === 'vehicle' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <h3 className="font-extrabold text-lg text-slate-900">DISC Vehicle Asset & Maintenance Log</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <span className="text-slate-400 font-bold block">Assigned Van</span>
              <span className="font-extrabold text-slate-900 text-sm mt-0.5 block">MyEduRide Executive Shuttle 09</span>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <span className="text-slate-400 font-bold block">License Plate</span>
              <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">LAG-992-MY</span>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <span className="text-slate-400 font-bold block">Fuel Status</span>
              <span className="font-bold text-emerald-600 text-sm mt-0.5 block">92% (Full Tank)</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ROUTE OPTIMISATION */}
      {activeTab === 'optimisation' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-extrabold text-lg text-slate-900">AI Route Optimisation Engine</h3>
              <p className="text-xs text-slate-500">Real-time Traffic & Shortest Corridor Suggestions</p>
            </div>
            <button
              onClick={() => toast.success('Route re-optimised! Saved 8 minutes of transit time.')}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs py-2 px-3.5 rounded-xl shadow-md flex items-center gap-1.5"
            >
              <RefreshCw size={14} />
              <span>Re-calculate Best Path</span>
            </button>
          </div>

          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 font-medium">
            ✨ Optimal Path Selected: Lekki Express Corridor ➔ Alma Beach ➔ Agbara Route (Saves 12 mins traffic delay).
          </div>
        </div>
      )}

      {/* TAB 5: JOURNEY MONITORING */}
      {activeTab === 'journey' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-extrabold text-lg text-slate-900">Live Journey Telemetry & Telematics</h3>
              <p className="text-xs text-slate-500">High-Precision GPS & Speed Monitoring</p>
            </div>
            <span className="bg-emerald-100 text-emerald-800 font-bold text-xs px-3 py-1 rounded-full flex items-center gap-1">
              <Activity size={14} />
              <span>Speed: {speed} km/h (Normal)</span>
            </span>
          </div>

          <div className="p-8 bg-slate-900 text-white rounded-2xl flex flex-col items-center justify-center text-center space-y-3">
            <Radio size={40} className="text-emerald-400 animate-pulse" />
            <h4 className="font-extrabold text-base">DISC Live Telematics Active</h4>
            <p className="text-xs text-slate-400 max-w-sm">
              Continuous 1-second GPS location feed broadcast to parent app and command center.
            </p>
          </div>
        </div>
      )}

      {/* TAB 6: ATTENDANCE */}
      {activeTab === 'attendance' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h3 className="font-extrabold text-lg text-slate-900">Official DISC Duty Attendance</h3>
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 font-bold">
            ✓ Duty Shift Clocked In at 06:50 AM Today by Command Operator
          </div>
        </div>
      )}

      {/* TAB 7: DAILY EARNINGS */}
      {activeTab === 'earnings' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h3 className="font-extrabold text-lg text-slate-900">Daily Earnings & Performance Allowances</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="text-slate-400 font-bold block">Base Shift Allowance</span>
              <span className="font-extrabold text-slate-900 text-lg mt-1 block">₦12,500 / Day</span>
            </div>
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200">
              <span className="text-emerald-800 font-bold block">Safety Bonus</span>
              <span className="font-extrabold text-emerald-900 text-lg mt-1 block">+₦3,000 Verified</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: INCIDENT REPORTING */}
      {activeTab === 'incidents' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-extrabold text-lg text-slate-900">DISC Incident Logs</h3>
              <p className="text-xs text-slate-500">Security & Operational Delays</p>
            </div>
            <button
              onClick={onOpenIncidentModal}
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs py-2 px-3.5 rounded-xl shadow-md flex items-center gap-1.5"
            >
              <AlertTriangle size={15} />
              <span>Log New Incident</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 9: PERFORMANCE ANALYTICS */}
      {activeTab === 'analytics' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h3 className="font-extrabold text-lg text-slate-900">DISC Performance Scorecard</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-center">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="text-slate-400 font-bold uppercase block text-[10px]">ROUTE EFFICIENCY</span>
              <span className="font-extrabold text-slate-900 text-xl mt-1 block">99.2%</span>
            </div>
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200">
              <span className="text-emerald-800 font-bold uppercase block text-[10px]">SAFETY RATING</span>
              <span className="font-extrabold text-emerald-900 text-xl mt-1 block">5.0 ★</span>
            </div>
            <div className="p-4 bg-purple-50 rounded-2xl border border-purple-200">
              <span className="text-purple-800 font-bold uppercase block text-[10px]">PASSENGER SATISFACTION</span>
              <span className="font-extrabold text-purple-900 text-xl mt-1 block">98%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
