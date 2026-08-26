// @ts-nocheck
'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Search,
  Plus,
  Users,
  Car,
  Compass,
  Clock,
  Filter,
  CheckCircle2,
  RefreshCcw,
  ExternalLink,
  ChevronRight,
  UserCheck,
  Sparkles,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { toast } from 'sonner';
import { photoSrc } from '@/lib/photo';
import StudentAvatar from '@/components/shared/StudentAvatar';
import EscortDetailDrawer from '@/components/school-admin/EscortDetailDrawer';

export default function EscortRecordsHubPage() {
  const [escorts, setEscorts] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>({
    total_escorts: 0,
    active_on_duty: 0,
    vehicles_assigned: 0,
    students_connected: 0,
    compliance_rate: '100%',
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [selectedEscort, setSelectedEscort] = useState<any | null>(null);

  useEffect(() => {
    loadEscorts();
  }, []);

  const loadEscorts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/school-admin/escorts', {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEscorts(data.escorts || []);
        if (data.metrics) setMetrics(data.metrics);
      } else {
        toast.error(data.error || 'Failed to load escort records');
      }
    } catch {
      toast.error('Network error loading escort records');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (escortId: string, newStatus: string) => {
    try {
      const res = await fetch('/api/school-admin/escorts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'toggle_status',
          escort_id: escortId,
          new_status: newStatus,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message);
        setEscorts((prev) =>
          prev.map((e) => (e.id === escortId ? { ...e, operational_status: newStatus } : e))
        );
        if (selectedEscort?.id === escortId) {
          setSelectedEscort((prev: any) => ({ ...prev, operational_status: newStatus }));
        }
      } else {
        toast.error(data.error || 'Failed to update status');
      }
    } catch {
      toast.error('Error updating status');
    }
  };

  const filteredEscorts = useMemo(() => {
    return escorts.filter((e) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        e.full_name?.toLowerCase().includes(q) ||
        e.phone?.includes(q) ||
        e.nin?.includes(q) ||
        e.driver_license?.toLowerCase().includes(q) ||
        e.vehicle?.reg_number?.toLowerCase().includes(q) ||
        e.route?.code?.toLowerCase().includes(q) ||
        e.route?.name?.toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && (e.operational_status === 'Active On Duty' || e.operational_status === 'In Transit')) ||
        (statusFilter === 'STANDBY' && e.operational_status === 'Standby') ||
        (statusFilter === 'OFF_DUTY' && e.operational_status === 'Off Duty');

      const matchesType =
        typeFilter === 'ALL' ||
        (typeFilter === 'SCHOOL' && e.escort_type === 'School Escort') ||
        (typeFilter === 'MYEDURIDE' && e.escort_type === 'MyEduRide Escort');

      return matchesQuery && matchesStatus && matchesType;
    });
  }, [escorts, searchQuery, statusFilter, typeFilter]);

  return (
    <div className="p-4 sm:p-6 min-h-screen bg-slate-50/50 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-black uppercase tracking-wider">
              Active Operational Records
            </span>
            <span className="text-xs text-slate-400 font-mono">MyEduRide Vetted</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">Escort Records Hub</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Operational escort records connected to school, students, fleet vehicles, routes, assignments, and approvals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadEscorts}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-all cursor-pointer shadow-2xs"
            title="Refresh records"
          >
            <RefreshCcw size={15} className={loading ? 'animate-spin' : ''} />
          </button>

          <Link
            href="/dashboard/school-admin/escort/school-escort"
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
          >
            <Layers size={14} className="text-slate-500" /> School Escorts
          </Link>

          <Link
            href="/dashboard/school-admin/escort/myeduride-escort"
            className="px-3.5 py-2 rounded-xl bg-[#0B1E36] hover:bg-[#07132B] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
          >
            <Sparkles size={14} className="text-amber-400" /> MyEduRide Escorts
          </Link>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Escorts</span>
          <p className="text-2xl font-black text-slate-900">{metrics.total_escorts}</p>
          <span className="text-[10px] text-slate-500 font-medium">All registered escorts</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Active On Duty</span>
          <p className="text-2xl font-black text-emerald-600">{metrics.active_on_duty}</p>
          <span className="text-[10px] text-emerald-700 font-bold">Currently in operation</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Vehicles Assigned</span>
          <p className="text-2xl font-black text-slate-900">{metrics.vehicles_assigned}</p>
          <span className="text-[10px] text-slate-500 font-medium">Linked fleet buses</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Students in Transit</span>
          <p className="text-2xl font-black text-blue-600">{metrics.students_connected}</p>
          <span className="text-[10px] text-blue-700 font-bold">Roster passengers</span>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 shadow-2xs space-y-1 col-span-2 md:col-span-1">
          <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider flex items-center gap-1">
            <ShieldCheck size={12} className="text-emerald-700" /> Compliance
          </span>
          <p className="text-2xl font-black text-emerald-900">{metrics.compliance_rate}</p>
          <span className="text-[10px] text-emerald-700 font-bold">City Manager Vetted</span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="p-3 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search escorts by name, phone, license, vehicle plate, or route..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
          >
            <option value="ALL">All Operational Statuses</option>
            <option value="ACTIVE">Active On Duty / In Transit</option>
            <option value="STANDBY">Standby</option>
            <option value="OFF_DUTY">Off Duty</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
          >
            <option value="ALL">All Escort Types</option>
            <option value="SCHOOL">School Escorts Only</option>
            <option value="MYEDURIDE">MyEduRide Escorts Only</option>
          </select>
        </div>
      </div>

      {/* Escort Records List Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-900">
            Escort Operational Directory ({filteredEscorts.length})
          </h2>
          <span className="text-xs text-slate-400 font-medium">Click any record for full manifest &amp; telemetry</span>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredEscorts.map((escort) => (
            <div
              key={escort.id}
              onClick={() => setSelectedEscort(escort)}
              className="p-4.5 hover:bg-slate-50/80 transition-colors cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              {/* Escort Identity & Photo */}
              <div className="flex items-center gap-3.5 min-w-[240px]">
                <StudentAvatar
                  photoUrl={escort.avatar_url}
                  fullName={escort.full_name}
                  size="md"
                  className="w-12 h-12 rounded-2xl shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-black text-slate-900 truncate">{escort.full_name}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                      escort.escort_type === 'School Escort' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}>
                      {escort.escort_type}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono">{escort.phone} · {escort.id}</p>
                  <p className="text-[10px] text-slate-400 font-mono">DL: {escort.driver_license}</p>
                </div>
              </div>

              {/* Connected Vehicle */}
              <div className="min-w-[160px] text-xs">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                  <Car size={11} className="text-slate-500" /> Assigned Vehicle
                </span>
                <p className="font-bold text-slate-800 mt-0.5">{escort.vehicle?.reg_number}</p>
                <p className="text-[10px] text-slate-500">{escort.vehicle?.make_model} ({escort.vehicle?.capacity} seats)</p>
              </div>

              {/* Connected Route */}
              <div className="min-w-[200px] text-xs">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                  <Compass size={11} className="text-slate-500" /> Designated Route
                </span>
                <p className="font-bold text-slate-800 mt-0.5">{escort.route?.code}: {escort.route?.name}</p>
                <p className="text-[10px] text-slate-500">Departure: {escort.route?.departure_morning}</p>
              </div>

              {/* Connected Students Manifest Count */}
              <div className="min-w-[120px] text-xs">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                  <Users size={11} className="text-slate-500" /> Manifest
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 font-black text-xs border border-emerald-200">
                    {escort.connected_students?.length || 0} Students
                  </span>
                </div>
              </div>

              {/* Operational & Approval Status */}
              <div className="flex items-center justify-between md:justify-end gap-3 min-w-[170px]">
                <div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-black text-[10px] uppercase flex items-center gap-1">
                    <CheckCircle2 size={10} /> {escort.operational_status}
                  </span>
                  <span className="text-[9px] text-slate-400 block text-right mt-0.5 font-bold">
                    ✓ City Manager Approved
                  </span>
                </div>
                <ChevronRight size={16} className="text-slate-300" />
              </div>
            </div>
          ))}

          {filteredEscorts.length === 0 && !loading && (
            <div className="p-12 text-center text-slate-400 text-xs space-y-2">
              <p>No escort records matched your search or filters.</p>
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setStatusFilter('ALL'); setTypeFilter('ALL'); }}
                className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 cursor-pointer"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Escort Slide-Over Inspection Drawer */}
      <EscortDetailDrawer
        escort={selectedEscort}
        onClose={() => setSelectedEscort(null)}
        onUpdateStatus={handleUpdateStatus}
      />
    </div>
  );
}
