// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  UserPlus,
  Search,
  Filter,
  MapPin,
  Car,
  Phone,
  Mail,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Navigation,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

export default function SchoolEscortsDirectoryPage() {
  const [escorts, setEscorts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchEscorts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/school-admin/escorts');
      const data = await res.json();
      if (res.ok && data.success) {
        setEscorts(data.escorts || []);
      } else {
        toast.error(data.error || 'Failed to load school escorts');
      }
    } catch (err: any) {
      toast.error('Network error loading school escorts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEscorts();
  }, []);

  const filteredEscorts = escorts.filter((item) => {
    const matchesSearch =
      !searchQuery ||
      item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.phone?.includes(searchQuery) ||
      item.nin?.includes(searchQuery) ||
      item.regNumber?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'pending' && item.status === 'PENDING_CITY_MANAGER_REVIEW') ||
      (statusFilter === 'approved' && item.status === 'CITY_MANAGER_APPROVED') ||
      (statusFilter === 'activated' && item.status === 'ACTIVATED');

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 font-sans text-slate-800 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-extrabold text-[10px] uppercase tracking-wider">
              School Transport
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 mt-1">
            School Escorts Directory
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            List of school escorts created by School Administrator. All applications are vetted by City Manager.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchEscorts}
            className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
            title="Refresh List"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <Link
            href="/dashboard/school-admin/transport/escorts/add"
            className="px-5 py-2.5 rounded-2xl bg-[#00A859] hover:bg-emerald-600 text-white font-extrabold text-xs transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer shrink-0"
          >
            <UserPlus size={16} />
            <span>+ Add School Escort</span>
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, NIN, plate..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:border-emerald-500 transition-all"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl w-full md:w-auto text-xs font-bold">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              statusFilter === 'all' ? 'bg-white text-slate-900 shadow-xs font-extrabold' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            All ({escorts.length})
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              statusFilter === 'pending' ? 'bg-amber-500 text-slate-950 font-extrabold' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Pending Vetting ({escorts.filter((e) => e.status === 'PENDING_CITY_MANAGER_REVIEW').length})
          </button>
          <button
            onClick={() => setStatusFilter('approved')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              statusFilter === 'approved' ? 'bg-emerald-600 text-white font-extrabold' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Approved ({escorts.filter((e) => e.status === 'CITY_MANAGER_APPROVED').length})
          </button>
          <button
            onClick={() => setStatusFilter('activated')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              statusFilter === 'activated' ? 'bg-blue-600 text-white font-extrabold' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Activated ({escorts.filter((e) => e.status === 'ACTIVATED').length})
          </button>
        </div>
      </div>

      {/* Escorts Grid List */}
      {loading ? (
        <div className="py-12 text-center space-y-3 bg-white rounded-2xl border border-slate-200/90 shadow-sm">
          <RefreshCw size={24} className="animate-spin text-emerald-600 mx-auto" />
          <p className="text-xs text-slate-500 font-semibold">Loading School Escorts directory...</p>
        </div>
      ) : filteredEscorts.length === 0 ? (
        <div className="py-12 px-4 text-center space-y-3 bg-white rounded-2xl border border-slate-200/90 shadow-sm">
          <ShieldCheck size={40} className="text-slate-300 mx-auto" />
          <h3 className="font-extrabold text-slate-800 text-sm">No School Escorts Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No school escort records match your search criteria. Click "+ Add School Escort" to initiate a new record for City Manager vetting.
          </p>
          <Link
            href="/dashboard/school-admin/transport/escorts/add"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white font-extrabold text-xs hover:bg-emerald-700 transition-all"
          >
            <UserPlus size={14} /> Add School Escort Now
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredEscorts.map((escort) => {
            const isPending = escort.status === 'PENDING_CITY_MANAGER_REVIEW';
            const isApproved = escort.status === 'CITY_MANAGER_APPROVED';
            const isActivated = escort.status === 'ACTIVATED';

            return (
              <div
                key={escort.id}
                className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Status Pill & Header */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-slate-400">
                      ID: {escort.id}
                    </span>
                    {isPending && (
                      <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 text-[10px] font-extrabold border border-amber-300/80 flex items-center gap-1">
                        <Clock size={12} className="text-amber-700" /> Pending City Manager Vetting
                      </span>
                    )}
                    {isApproved && (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold border border-emerald-300 flex items-center gap-1">
                        <CheckCircle2 size={12} className="text-emerald-600" /> City Manager Approved
                      </span>
                    )}
                    {isActivated && (
                      <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 text-[10px] font-extrabold border border-blue-300 flex items-center gap-1">
                        <ShieldCheck size={12} className="text-blue-600" /> Activated
                      </span>
                    )}
                  </div>

                  {/* Escort Profile Info */}
                  <div className="flex items-start gap-3">
                    <img
                      src={escort.photo || escort.uploadedDocDetails?.selfie?.fileUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                      alt={escort.name || escort.fullName}
                      className="w-12 h-12 rounded-2xl object-cover border-2 border-slate-200 shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
                      }}
                    />
                    <div className="min-w-0 space-y-0.5">
                      <h4 className="font-extrabold text-slate-900 text-sm truncate">
                        {escort.name || escort.fullName}
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                        <Mail size={12} className="text-slate-400 shrink-0" />
                        <span className="truncate">{escort.email || escort.emailOrUsername}</span>
                      </p>
                      <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                        <Phone size={12} className="text-slate-400 shrink-0" />
                        <span>{escort.phone || 'N/A'}</span>
                      </p>
                    </div>
                  </div>

                  {/* Identification Details */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">NIN Number:</span>
                      <span className="font-mono font-bold text-slate-800">{escort.nin || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Driver Licence:</span>
                      <span className="font-mono font-bold text-slate-800">{escort.driversLicence || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Vehicle / Reg No:</span>
                      <span className="font-semibold text-slate-800">
                        {escort.vehicleType || escort.vehicle?.type || 'Bus'} ({escort.regNumber || escort.vehicle?.regNumber || 'N/A'})
                      </span>
                    </div>
                  </div>

                  {/* Home GPS Location Pin */}
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium bg-emerald-50/60 p-2 rounded-xl border border-emerald-100">
                    <MapPin size={14} className="text-emerald-600 shrink-0" />
                    <span className="truncate">
                      {escort.pinnedGpsLocation?.address || escort.address || escort.city || 'Lagos, Nigeria'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between font-medium">
                  <span>Created: {escort.registrationDate || escort.createdAt || 'Today'}</span>
                  <span>Vetting: City Manager</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
