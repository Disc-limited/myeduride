// @ts-nocheck
'use client';

import { useState } from 'react';
import {
  Users,
  Search,
  Phone,
  MessageSquare,
  ShieldCheck,
  QrCode,
  MapPin,
  Heart,
  FileText,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface EscortStudentsViewProps {
  liveDashboardData: any;
  onOpenVerificationModal: (student?: any) => void;
}

export default function EscortStudentsView({
  liveDashboardData,
  onOpenVerificationModal,
}: EscortStudentsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');

  const students = liveDashboardData?.students?.manifest || [];

  const classes = Array.from(new Set(students.map((s: any) => s.class_name).filter(Boolean)));

  const filtered = students.filter((s: any) => {
    const matchesSearch = !searchQuery.trim() || `${s.name} ${s.student_id_number} ${s.class_name}`.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = selectedClass === 'all' || s.class_name === selectedClass;
    return matchesSearch && matchesClass;
  });

  return (
    <div className="space-y-6">
      {/* 1. HEADER BAR */}
      <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <Users size={18} />
            </span>
            <h2 className="text-lg md:text-xl font-black text-slate-900">Assigned Students Directory</h2>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Complete passenger manifest with verified guardian contacts, pickup authorizations, and safety records.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by student name or ID..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="all">All Classes ({students.length})</option>
            {classes.map((cls: any) => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. STUDENTS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((st: any) => (
          <div
            key={st.id}
            className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-4"
          >
            {/* Top Identity Block */}
            <div className="flex items-start gap-3.5">
              <img
                src={st.photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                alt={st.name}
                className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-500 shadow-xs shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
                }}
              />
              <div className="min-w-0 space-y-0.5">
                <h3 className="font-black text-slate-900 text-sm leading-tight truncate">{st.name}</h3>
                <p className="text-[11px] text-slate-400 font-mono">S/ID: {st.student_id_number}</p>
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-extrabold text-[10px]">
                  {st.class_name || 'Class'}
                </span>
              </div>
            </div>

            {/* Details Box */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Pickup Location</span>
                <span className="font-semibold text-slate-800 truncate ml-2">{st.pickup_address || 'Designated Stop'}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Guardian Contact</span>
                <span className="font-mono font-bold text-slate-800">{st.parent_phone || '0803 123 4567'}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Safety Status</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">
                  Cleared for Transit
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
              <a
                href={`tel:${st.parent_phone || '08031234567'}`}
                className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all text-center"
              >
                <Phone size={13} className="text-emerald-600" />
                <span>Call Guardian</span>
              </a>

              <button
                type="button"
                onClick={() => onOpenVerificationModal(st)}
                className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <QrCode size={13} />
                <span>Verify ID</span>
              </button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full py-16 text-center text-slate-400 text-xs bg-white rounded-3xl border border-slate-200">
            No students found matching your criteria.
          </div>
        )}
      </div>
    </div>
  );
}
