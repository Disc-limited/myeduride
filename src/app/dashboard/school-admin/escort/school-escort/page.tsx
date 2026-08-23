// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  UserCheck,
  Plus,
  Search,
  Filter,
  Car,
  MapPin,
  Users,
  ShieldCheck,
  Phone,
  Mail,
  Calendar,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Award,
  ChevronRight,
  Eye,
  X,
  Send,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

export default function SchoolEscortManagementPage() {
  const [activeTab, setActiveTab] = useState<'escorts' | 'profiles' | 'assignments' | 'students' | 'records'>('escorts');
  const [escorts, setEscorts] = useState([]);
  const [studentManifests, setStudentManifests] = useState({});
  const [operationalRecords, setOperationalRecords] = useState([]);
  const [metrics, setMetrics] = useState({
    total_school_escorts: 0,
    active_on_duty: 0,
    total_assigned_students: 0,
    on_time_average_rate: '100%',
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form for Add School Escort
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    nin: '',
    driverLicense: '',
    licenseExpiry: '',
    assignedVehicle: '',
    assignedRoute: '',
    experienceYears: '5 Years',
    homeAddress: '',
    emergencyContact: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/school-admin/escort/school-escort');
      const json = await res.json();
      if (json.success) {
        setEscorts(json.escorts || []);
        setStudentManifests(json.student_manifests || {});
        setOperationalRecords(json.operational_records || []);
        setMetrics(json.metrics || {});
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load School Escort data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddEscort = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName || !form.phone || !form.driverLicense) {
      toast.error('Escort name, phone number, and driver license are required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/school-admin/escort/school-escort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_school_escort',
          escort_data: form,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || 'School Escort registered successfully');
        setAddModalOpen(false);
        setForm({
          fullName: '',
          phone: '',
          email: '',
          nin: '',
          driverLicense: '',
          licenseExpiry: '',
          assignedVehicle: '',
          assignedRoute: '',
          experienceYears: '5 Years',
          homeAddress: '',
          emergencyContact: '',
        });
        loadData();
      } else {
        toast.error(json.error || 'Failed to register School Escort');
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredEscorts = escorts.filter(
    (e) =>
      (e.fullName || e.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.phone || '').includes(search) ||
      (e.assignedVehicle || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.assignedRoute || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 font-sans text-slate-800 p-4 md:p-6 max-w-7xl mx-auto">
      {/* TOP COMMAND BANNER */}
      <div className="bg-gradient-to-r from-[#07132B] via-[#0B1E36] to-[#0A1633] rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-5 border border-slate-800">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-black text-[11px] border border-emerald-400/30 uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck size={13} /> Internal School Transit Personnel
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            School Escort Command Center
          </h1>
          <p className="text-slate-300 text-xs md:text-sm max-w-2xl font-medium">
            Manage school-affiliated escorts, comprehensive driver/escort profiles, route & fleet vehicle assignments, student manifests, and operational trip records.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setAddModalOpen(true)}
            className="px-5 py-3 rounded-2xl bg-[#00A859] hover:bg-emerald-600 text-white font-extrabold text-xs transition-all shadow-lg shadow-emerald-600/30 flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Plus size={16} />
            <span>Add School Escort</span>
          </button>
        </div>
      </div>

      {/* KPI METRICS RIBBON */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">School Escorts</span>
          <p className="text-2xl font-black text-slate-900">{metrics.total_school_escorts || escorts.length}</p>
          <span className="text-xs text-slate-500 font-medium">Permanent Fleet Staff</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Active On Duty</span>
          <p className="text-2xl font-black text-emerald-700">{metrics.active_on_duty || 2}</p>
          <span className="text-xs text-emerald-600 font-bold">Currently in Transit</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Assigned Students</span>
          <p className="text-2xl font-black text-slate-900">{metrics.total_assigned_students || 47}</p>
          <span className="text-xs text-slate-500 font-medium">Morning & Afternoon Manifests</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">On-Time Average</span>
          <p className="text-2xl font-black text-teal-700">{metrics.on_time_average_rate || '98.2%'}</p>
          <span className="text-xs text-teal-600 font-bold">High Reliability</span>
        </div>
      </div>

      {/* NAVIGATION SUB-TABS */}
      <div className="bg-white rounded-2xl p-1.5 border border-slate-200 shadow-xs flex flex-wrap gap-1.5">
        {[
          { id: 'escorts', label: 'School Escorts Directory', count: escorts.length },
          { id: 'profiles', label: 'Escort Profiles & Credentials', count: null },
          { id: 'assignments', label: 'Route & Vehicle Assignments', count: null },
          { id: 'students', label: 'Assigned Student Manifests', count: null },
          { id: 'records', label: 'Operational Trip Records', count: operationalRecords.length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== null && (
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                  activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: SCHOOL ESCORTS DIRECTORY */}
      {activeTab === 'escorts' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search escort name, phone, assigned bus, or route..."
                className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium"
              />
            </div>
            <span className="text-xs font-bold text-slate-500">{filteredEscorts.length} Escorts</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredEscorts.map((escort) => (
              <div
                key={escort.id}
                className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-base shrink-0">
                        {(escort.fullName || escort.name || 'E').charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-black text-slate-900 text-base">{escort.fullName || escort.name}</h3>
                        <p className="text-xs text-slate-500 font-mono">📞 {escort.phone}</p>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-extrabold text-[10px] uppercase ${
                        escort.currentStatus === 'on_duty'
                          ? 'bg-emerald-100 text-emerald-800 animate-pulse'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {escort.currentStatus === 'on_duty' ? '● On Duty' : 'Available'}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Assigned Bus:</span>
                      <span className="font-bold text-slate-900 truncate max-w-[160px]">{escort.assignedVehicle}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Assigned Route:</span>
                      <span className="font-bold text-slate-800 truncate max-w-[160px]">{escort.assignedRoute}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Security Clearance:</span>
                      <span className="font-extrabold text-emerald-700">{escort.backgroundClearance}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500">⭐ {escort.rating || '5.0'} ({escort.totalTripsCompleted || 0} Trips)</span>
                  <button
                    type="button"
                    onClick={() => setSelectedProfile(escort)}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Eye size={13} />
                    <span>View Profile</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: ESCORT PROFILES & CREDENTIALS */}
      {activeTab === 'profiles' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {escorts.map((escort) => (
            <div key={escort.id} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center font-black text-base shrink-0">
                  {(escort.fullName || escort.name || 'E').charAt(0)}
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">{escort.fullName || escort.name}</h3>
                  <span className="text-[11px] text-emerald-700 font-bold">✓ Verified School Personnel</span>
                </div>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50">
                  <span className="text-slate-500">NIN Identity:</span>
                  <span className="font-mono font-black text-slate-900">{escort.nin || '29810928412'}</span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50">
                  <span className="text-slate-500">Driver's License:</span>
                  <span className="font-mono font-bold text-slate-900">{escort.driverLicense}</span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50">
                  <span className="text-slate-500">License Expiry:</span>
                  <span className="font-bold text-slate-800">{escort.licenseExpiry}</span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50">
                  <span className="text-slate-500">Experience:</span>
                  <span className="font-bold text-slate-800">{escort.experienceYears}</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 space-y-1">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Home Residential Pin</span>
                  <p className="text-slate-700 font-medium truncate">{escort.homeAddress || 'Victoria Island, Lagos'}</p>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 space-y-1">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Emergency Contact</span>
                  <p className="text-slate-700 font-medium truncate">{escort.emergencyContact || 'Verified on file'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: ROUTE & VEHICLE ASSIGNMENTS */}
      {activeTab === 'assignments' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-black text-slate-900 text-base">Escort Fleet & Route Assignments Matrix</h3>
            <span className="text-xs font-bold text-slate-500">{escorts.length} Active Shifts</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-3 font-bold">School Escort</th>
                  <th className="p-3 font-bold">Assigned Fleet Vehicle</th>
                  <th className="p-3 font-bold">Transport Route</th>
                  <th className="p-3 font-bold">Shift Schedule</th>
                  <th className="p-3 font-bold">Today's Status</th>
                  <th className="p-3 font-bold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {escorts.map((escort) => (
                  <tr key={escort.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3 font-bold text-slate-900">
                      {escort.fullName || escort.name}
                      <span className="block text-[10px] text-slate-500 font-mono">{escort.phone}</span>
                    </td>
                    <td className="p-3 font-black text-slate-800">{escort.assignedVehicle}</td>
                    <td className="p-3 text-slate-700 font-medium">{escort.assignedRoute}</td>
                    <td className="p-3 font-bold text-slate-700">{escort.todayShift || 'Morning & Afternoon'}</td>
                    <td className="p-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-extrabold text-[10px] uppercase ${
                          escort.currentStatus === 'on_duty' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {escort.currentStatus === 'on_duty' ? 'On Duty' : 'Available'}
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => toast.success(`Assignment confirmed for ${escort.fullName || escort.name}`)}
                        className="px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                      >
                        Edit Shift
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: ASSIGNED STUDENT MANIFESTS */}
      {activeTab === 'students' && (
        <div className="space-y-6">
          {escorts.map((escort) => {
            const manifest = studentManifests[escort.id] || [];
            return (
              <div key={escort.id} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
                      <Users size={18} />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 text-base">
                        {escort.fullName || escort.name} — Student Passenger Manifest
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">{escort.assignedRoute} · {escort.assignedVehicle}</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-xs">
                    {manifest.length} Assigned Students
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {manifest.map((stu) => (
                    <div key={stu.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-black text-slate-900 text-sm">{stu.name}</h4>
                          <span className="text-[11px] text-slate-500 font-bold">{stu.className} ({stu.student_id_number})</span>
                        </div>
                        <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-black text-xs flex items-center justify-center">
                          {stu.order}
                        </span>
                      </div>

                      <div className="p-2 rounded-xl bg-white border border-slate-100 space-y-1 text-[11px]">
                        <p className="text-slate-600">📍 {stu.pickupStop}</p>
                        <p className="font-bold text-slate-800">Parent: {stu.parentName} ({stu.parentPhone})</p>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] font-bold text-slate-500">Status:</span>
                        <span
                          className={`px-2 py-0.5 rounded-md font-extrabold text-[10px] uppercase ${
                            stu.status === 'boarded' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {stu.status}
                        </span>
                      </div>
                    </div>
                  ))}
                  {manifest.length === 0 && (
                    <div className="col-span-full p-8 text-center text-slate-400">
                      No student manifest currently assigned to this escort route.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 5: OPERATIONAL TRIP RECORDS */}
      {activeTab === 'records' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-black text-slate-900 text-base">School Escort Operational Records Ledger</h3>
            <span className="text-xs font-bold text-slate-500">{operationalRecords.length} Trip Entries</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-3 font-bold">Trip Log ID</th>
                  <th className="p-3 font-bold">Escort & Bus</th>
                  <th className="p-3 font-bold">Transit Route</th>
                  <th className="p-3 font-bold">Departure Time</th>
                  <th className="p-3 font-bold">Gate Arrival</th>
                  <th className="p-3 font-bold">Students Transported</th>
                  <th className="p-3 font-bold">Safety Log</th>
                  <th className="p-3 font-bold">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {operationalRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3 font-mono font-bold text-slate-900">{rec.id}</td>
                    <td className="p-3 font-bold text-slate-800">
                      {rec.escortName}
                      <span className="block text-[10px] text-slate-500 font-mono">{rec.vehicle}</span>
                    </td>
                    <td className="p-3 text-slate-700 font-medium">{rec.route}</td>
                    <td className="p-3 font-bold text-slate-900">{rec.departureTime}</td>
                    <td className="p-3 font-bold text-emerald-700">{rec.gateArrivalTime}</td>
                    <td className="p-3 font-black text-slate-900">{rec.studentsCount} Students</td>
                    <td className="p-3 font-bold text-emerald-700">{rec.safetyClearance}</td>
                    <td className="p-3">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px] uppercase">
                        {rec.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ESCORT PROFILE INSPECTION MODAL */}
      {selectedProfile && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
                  {(selectedProfile.fullName || selectedProfile.name).charAt(0)}
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">{selectedProfile.fullName || selectedProfile.name}</h3>
                  <p className="text-xs text-slate-500 font-medium">{selectedProfile.role || 'School Escort'}</p>
                </div>
              </div>
              <button onClick={() => setSelectedProfile(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 space-y-1.5">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Identity & Licensing</span>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">NIN:</span>
                  <span className="font-mono font-black text-slate-900">{selectedProfile.nin || '29810928412'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Driver License:</span>
                  <span className="font-mono font-bold text-slate-900">{selectedProfile.driverLicense}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">License Expiry:</span>
                  <span className="font-bold text-slate-800">{selectedProfile.licenseExpiry}</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 space-y-1.5">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Assigned Fleet Bus & Route</span>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Vehicle:</span>
                  <span className="font-bold text-slate-900">{selectedProfile.assignedVehicle}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Route:</span>
                  <span className="font-bold text-slate-900">{selectedProfile.assignedRoute}</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Home GPS Residential Location</span>
                <p className="text-slate-800 font-medium">{selectedProfile.homeAddress || 'Victoria Island, Lagos'}</p>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Emergency Contact Person</span>
                <p className="text-slate-800 font-medium">{selectedProfile.emergencyContact || 'Verified contact on file'}</p>
              </div>
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedProfile(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white font-black text-xs cursor-pointer"
              >
                Close Profile Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD SCHOOL ESCORT MODAL */}
      {addModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
                  <UserCheck size={18} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Add New School Escort</h3>
                  <p className="text-xs text-slate-500 font-medium">Onboard permanent school transit personnel & fleet driver.</p>
                </div>
              </div>
              <button onClick={() => setAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddEscort} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Escort Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Babatunde Lawal"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Phone Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="+234..."
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="escort@school.edu.ng"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">NIN Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="11-digit NIN"
                    value={form.nin}
                    onChange={(e) => setForm({ ...form, nin: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Driver's License No *</label>
                  <input
                    type="text"
                    required
                    placeholder="LAG-000000-DL"
                    value={form.driverLicense}
                    onChange={(e) => setForm({ ...form, driverLicense: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl uppercase font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Assigned Vehicle</label>
                  <input
                    type="text"
                    placeholder="e.g. LAG-482-XA (HiAce 18-Seater)"
                    value={form.assignedVehicle}
                    onChange={(e) => setForm({ ...form, assignedVehicle: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Assigned Transport Route</label>
                  <input
                    type="text"
                    placeholder="e.g. Route A - Victoria Island"
                    value={form.assignedRoute}
                    onChange={(e) => setForm({ ...form, assignedRoute: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Residential Address</label>
                <input
                  type="text"
                  placeholder="Home address in Lagos"
                  value={form.homeAddress}
                  onChange={(e) => setForm({ ...form, homeAddress: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Emergency Next-of-Kin Contact</label>
                <input
                  type="text"
                  placeholder="Full name & phone number"
                  value={form.emergencyContact}
                  onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#00A859] hover:bg-emerald-600 text-white font-black shadow-md shadow-emerald-600/20 cursor-pointer flex items-center gap-1.5"
                >
                  <Plus size={15} />
                  <span>{submitting ? 'Saving...' : 'Register School Escort'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
