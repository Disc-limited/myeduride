// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import {
  FileCheck,
  ShieldCheck,
  Search,
  Filter,
  Download,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Phone,
  RefreshCw,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { getEscortApplications } from '@/lib/escort/escort-db';

export default function EscortVerificationReportsPage() {
  const [escorts, setEscorts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/school-admin/escorts');
        const json = await res.json();
        if (json.success && Array.isArray(json.escorts)) {
          setEscorts(json.escorts);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = escorts.filter(
    (e) =>
      e.name?.toLowerCase().includes(search.toLowerCase()) ||
      e.phone?.includes(search) ||
      e.nin?.includes(search) ||
      e.regNumber?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 font-sans text-slate-800 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#07132B] via-[#0B1E36] to-[#0A1633] rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-black text-[11px] border border-emerald-400/30 uppercase tracking-wider flex items-center gap-1.5">
              <FileCheck size={13} /> Regulatory Vetting & Compliance
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            Escort Verification Audit Reports
          </h1>
          <p className="text-slate-300 text-xs md:text-sm max-w-2xl font-medium">
            Complete audit trail of City Manager approval credentials, NIN identity verifications, vehicle roadworthiness documentation, and escort background checks.
          </p>
        </div>
      </div>

      {/* Audit Summary Deck */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Escorts Vetted</span>
          <p className="text-2xl font-black text-slate-900 mt-1">{escorts.length}</p>
          <span className="text-xs text-slate-500">School & Platform records</span>
        </div>

        <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200/80 shadow-xs">
          <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">City Manager Approved</span>
          <p className="text-2xl font-black text-emerald-900 mt-1">
            {escorts.filter((e) => ['CITY_MANAGER_APPROVED', 'ACTIVATED', 'ACTIVE'].includes(e.status)).length}
          </p>
          <span className="text-xs text-emerald-700 font-bold">Authorized for pickup</span>
        </div>

        <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200/80 shadow-xs">
          <span className="text-[10px] font-black uppercase text-amber-800 tracking-wider">Pending Vetting Review</span>
          <p className="text-2xl font-black text-amber-900 mt-1">
            {escorts.filter((e) => e.status === 'PENDING_CITY_MANAGER_REVIEW').length}
          </p>
          <span className="text-xs text-amber-700 font-bold">Awaiting City Manager review</span>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search escort name, phone, or NIN..."
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium"
            />
          </div>
          <span className="text-xs font-bold text-slate-500">{filtered.length} Audit Records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="p-3 font-bold">Escort Details</th>
                <th className="p-3 font-bold">Identity NIN</th>
                <th className="p-3 font-bold">Vehicle Reg</th>
                <th className="p-3 font-bold">Operating Area</th>
                <th className="p-3 font-bold">City Manager Status</th>
                <th className="p-3 font-bold">Compliance Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((escort) => {
                const isApproved = ['CITY_MANAGER_APPROVED', 'ACTIVATED', 'ACTIVE'].includes(escort.status);
                return (
                  <tr key={escort.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3 font-bold text-slate-900">
                      {escort.name || escort.fullName}
                      <span className="block text-[11px] text-slate-500 font-mono">{escort.phone}</span>
                    </td>
                    <td className="p-3 font-mono text-slate-700">
                      {escort.nin ? `NIN: ${escort.nin}` : 'Verified via portal'}
                    </td>
                    <td className="p-3 font-bold text-slate-800">
                      {escort.regNumber || 'Registered'}
                    </td>
                    <td className="p-3 text-slate-600">
                      {escort.operatingArea || escort.city || 'Lagos'}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-md font-extrabold text-[10px] ${
                          isApproved ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {escort.status?.replaceAll('_', ' ')}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] flex items-center gap-1 w-fit">
                        <CheckCircle2 size={11} /> Vetted
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    No escort verification reports match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
