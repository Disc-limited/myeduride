// @ts-nocheck
'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Bus,
  ShieldCheck,
  UserPlus,
  Users,
  Clock,
  MapPin,
  Search,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ArrowRight,
  Sparkles,
  ShieldAlert,
  Car
} from 'lucide-react';

export default function SchoolTransportOverviewPage() {
  return (
    <div className="space-y-6 font-sans text-slate-800 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#07132B] via-[#0b1c30] to-[#0A1633] rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-extrabold text-xs border border-emerald-400/30 uppercase tracking-wider flex items-center gap-1.5">
              <Bus size={14} /> School Transport Hub
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            School Transport & Escort Management
          </h1>
          <p className="text-slate-300 text-xs md:text-sm max-w-2xl font-medium">
            Manage school escorts, initiate escort account creation, track real-time trip progress, and monitor City Manager vetting statuses.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Link
            href="/dashboard/school-admin/transport/escorts/add"
            className="px-5 py-3 rounded-2xl bg-[#00A859] hover:bg-emerald-600 text-white font-extrabold text-xs transition-all shadow-lg shadow-emerald-600/30 flex items-center gap-2 cursor-pointer"
          >
            <UserPlus size={16} />
            <span>Add School Escort</span>
          </Link>
          <Link
            href="/dashboard/school-admin/transport/escorts"
            className="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-extrabold text-xs transition-all border border-white/20 flex items-center gap-2 cursor-pointer"
          >
            <Users size={16} />
            <span>View All Escorts</span>
          </Link>
        </div>
      </div>

      {/* Quick Action Navigation Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Link
          href="/dashboard/school-admin/transport/escorts"
          className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold group-hover:scale-105 transition-all">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base group-hover:text-emerald-600 transition-colors">
                School Escorts List
              </h3>
              <p className="text-slate-500 text-xs mt-1 leading-snug font-medium">
                View assigned school escorts, check verification credentials, and monitor City Manager approval status.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs font-extrabold text-emerald-600 pt-4">
            <span>Access Escorts Directory</span>
            <ChevronRight size={14} />
          </div>
        </Link>

        <Link
          href="/dashboard/school-admin/transport/escorts/add"
          className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold group-hover:scale-105 transition-all">
              <UserPlus size={24} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base group-hover:text-blue-600 transition-colors">
                Add School Escort
              </h3>
              <p className="text-slate-500 text-xs mt-1 leading-snug font-medium">
                Initiate a new Escort record with NIN, photo, licence, home GPS pin, vehicle info & front/rear/side photos.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs font-extrabold text-blue-600 pt-4">
            <span>Create New Escort Record</span>
            <ChevronRight size={14} />
          </div>
        </Link>

        <div className="bg-amber-50/60 p-5 rounded-2xl border border-amber-200/90 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
              <ShieldAlert size={24} />
            </div>
            <div>
              <h3 className="font-black text-amber-950 text-base">
                City Manager Vetting Policy
              </h3>
              <p className="text-amber-900/80 text-xs mt-1 leading-snug font-medium">
                School Administrators initiate Escort records, but Escorts are strictly vetted and approved by the responsible <strong>City Manager</strong>.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-extrabold text-amber-800 pt-3 block">
            Status: PENDING_CITY_MANAGER_REVIEW
          </span>
        </div>
      </div>
    </div>
  );
}
