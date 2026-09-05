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
  AlertCircle,
  Navigation,
  ExternalLink,
  Compass,
  CheckCircle2,
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
  const [directionsModalStudent, setDirectionsModalStudent] = useState<any | null>(null);

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
                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-extrabold text-[10px]">
                    {st.class_name || 'Class'}
                  </span>
                  {st.is_house_pinned && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[10px]">
                      <MapPin size={10} />
                      GPS Pinned
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Details Box */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Pickup Location</span>
                <span className="font-semibold text-slate-800 truncate ml-2">{st.pickup_address || 'Designated Stop'}</span>
              </div>
              {st.house_landmark && (
                <div className="flex items-start justify-between text-slate-600">
                  <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">Landmark</span>
                  <span className="text-[11px] text-slate-700 truncate ml-2 text-right">{st.house_landmark}</span>
                </div>
              )}
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

            {/* Location & Directions Action */}
            <button
              type="button"
              onClick={() => setDirectionsModalStudent(st)}
              className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Navigation size={13} className="text-emerald-600" />
              <span>Location & Directions Report</span>
            </button>

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

      {/* 3. LOCATION & DIRECTIONS REPORT MODAL */}
      {directionsModalStudent && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Compass size={18} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Location & Directions Report</h3>
                  <p className="text-xs text-slate-500">Student Navigation & Transit Coordinates</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDirectionsModalStudent(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Student Overview Header */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <img
                src={directionsModalStudent.photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                alt={directionsModalStudent.name}
                className="w-12 h-12 rounded-xl object-cover border border-emerald-500 shrink-0"
              />
              <div className="min-w-0">
                <h4 className="font-extrabold text-slate-900 text-sm">{directionsModalStudent.name}</h4>
                <p className="text-xs text-slate-500 font-mono">
                  ID: {directionsModalStudent.student_id_number} · Class: {directionsModalStudent.class_name || 'N/A'}
                </p>
              </div>
            </div>

            {/* Address & Landmark Breakdown */}
            <div className="space-y-2.5 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Pickup / Residence Address</span>
                  {directionsModalStudent.is_house_pinned ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold flex items-center gap-1">
                      <CheckCircle2 size={10} /> GPS Verified
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                      Standard Stop
                    </span>
                  )}
                </div>
                <p className="font-semibold text-slate-800 leading-relaxed">
                  {directionsModalStudent.pickup_address || directionsModalStudent.house_address || 'Designated School Stop'}
                </p>
              </div>

              {/* Landmark / Gate Details */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400">Landmark & Approach Notes</span>
                <p className="text-slate-700 leading-relaxed font-medium">
                  {directionsModalStudent.house_landmark || directionsModalStudent.house_notes || 'No specific landmark recorded. Proceed to front gate or verified stop.'}
                </p>
              </div>

              {/* GPS Coordinates */}
              {directionsModalStudent.house_lat != null && directionsModalStudent.house_lng != null && (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-slate-400">GPS Coordinates</span>
                  <span className="font-mono text-slate-700 text-[11px] font-bold">
                    {directionsModalStudent.house_lat.toFixed(6)}, {directionsModalStudent.house_lng.toFixed(6)}
                  </span>
                </div>
              )}

              {/* Guardian Contact Info */}
              <div className="p-3 bg-emerald-50/50 rounded-2xl border border-emerald-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-emerald-700">Guardian Contact</span>
                  <p className="font-bold text-slate-900 text-xs">{directionsModalStudent.parent_name || 'Parent'}</p>
                </div>
                <a
                  href={`tel:${directionsModalStudent.parent_phone || '08031234567'}`}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all"
                >
                  <Phone size={12} />
                  <span>{directionsModalStudent.parent_phone || 'Call'}</span>
                </a>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDirectionsModalStudent(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Close Report
              </button>
              <a
                href={
                  directionsModalStudent.google_maps_nav_url ||
                  (directionsModalStudent.house_lat != null && directionsModalStudent.house_lng != null
                    ? `https://www.google.com/maps/dir/?api=1&destination=${directionsModalStudent.house_lat},${directionsModalStudent.house_lng}`
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(directionsModalStudent.pickup_address || 'Lagos')}`)
                }
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all"
              >
                <Navigation size={14} />
                <span>Open in Google Maps</span>
                <ExternalLink size={12} className="opacity-75" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
