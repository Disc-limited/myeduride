'use client';

import { useEffect, useState } from 'react';
import { X, Building2, Mail, Phone, User, Clock, Palette, MapPin } from 'lucide-react';
import { toast } from 'sonner';

export type SchoolForEdit = {
  id: string;
  name: string;
  address?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  gate_open_time?: string | null;
  gate_close_time?: string | null;
  dismissal_start_time?: string | null;
  dismissal_end_time?: string | null;
  admin_user_id?: string | null;
  admin_name?: string | null;
  admin_email?: string | null;
  admin_phone?: string | null;
  admin_username?: string | null;
};

interface EditSchoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  school: SchoolForEdit | null;
}

export default function EditSchoolModal({
  isOpen,
  onClose,
  onSuccess,
  school,
}: EditSchoolModalProps) {
  const [form, setForm] = useState({
    name: '',
    address: '',
    primary_color: '#1B4D3E',
    secondary_color: '#D4A017',
    gate_open_time: '06:30',
    gate_close_time: '09:00',
    dismissal_start_time: '14:00',
    dismissal_end_time: '16:00',
    admin_name: '',
    admin_email: '',
    admin_phone: '',
    admin_username: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (school) {
      setForm({
        name: school.name || '',
        address: school.address || '',
        primary_color: school.primary_color || '#1B4D3E',
        secondary_color: school.secondary_color || '#D4A017',
        gate_open_time: school.gate_open_time ? String(school.gate_open_time).slice(0, 5) : '06:30',
        gate_close_time: school.gate_close_time ? String(school.gate_close_time).slice(0, 5) : '09:00',
        dismissal_start_time: school.dismissal_start_time ? String(school.dismissal_start_time).slice(0, 5) : '14:00',
        dismissal_end_time: school.dismissal_end_time ? String(school.dismissal_end_time).slice(0, 5) : '16:00',
        admin_name: school.admin_name || '',
        admin_email: school.admin_email || '',
        admin_phone: school.admin_phone || '',
        admin_username: school.admin_username || '',
      });
    }
  }, [school]);

  if (!isOpen || !school) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('School name is required');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/super-admin/schools/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_id: school.id,
          name: form.name.trim(),
          address: form.address.trim() || null,
          primary_color: form.primary_color,
          secondary_color: form.secondary_color,
          gate_open_time: form.gate_open_time,
          gate_close_time: form.gate_close_time,
          dismissal_start_time: form.dismissal_start_time,
          dismissal_end_time: form.dismissal_end_time,
          admin_user_id: school.admin_user_id || undefined,
          admin_name: form.admin_name.trim() || undefined,
          admin_email: form.admin_email.trim() || undefined,
          admin_phone: form.admin_phone.trim() || undefined,
          admin_username: form.admin_username.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to update school details');
        return;
      }

      toast.success('School information updated successfully. Changes are effective immediately.');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Network error updating school');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Building2 size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Edit School Information</h2>
              <p className="text-xs text-slate-500 font-medium">Updates to email and admin profiles take effect immediately.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Section: School Information */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Building2 size={14} className="text-emerald-600" />
              School Profile
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">School Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  placeholder="e.g. Greenfield Academy"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <MapPin size={12} className="text-slate-400" /> Address
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  placeholder="Street, City, State"
                />
              </div>
            </div>
          </div>

          {/* Section: School Administrator & Contact */}
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <User size={14} className="text-blue-600" />
                Administrator &amp; Official Contact
              </h3>
              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                Email changes effective immediately
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Admin Full Name</label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={form.admin_name}
                    onChange={(e) => setForm({ ...form, admin_name: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    placeholder="Principal or Admin Name"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Admin Email Address *
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="email"
                    value={form.admin_email}
                    onChange={(e) => setForm({ ...form, admin_email: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 font-medium"
                    placeholder="admin@school.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Admin Phone Number</label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="tel"
                    value={form.admin_phone}
                    onChange={(e) => setForm({ ...form, admin_phone: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    placeholder="08012345678"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Admin Username</label>
                <input
                  type="text"
                  value={form.admin_username}
                  onChange={(e) => setForm({ ...form, admin_username: e.target.value.toLowerCase().replace(/\s/g, '') })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 font-mono text-xs"
                  placeholder="schooladmin"
                />
              </div>
            </div>
          </div>

          {/* Section: Gate Timetable & Hours */}
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Clock size={14} className="text-amber-500" />
              Gate Schedule &amp; Timings
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Gate Open</label>
                <input
                  type="time"
                  value={form.gate_open_time}
                  onChange={(e) => setForm({ ...form, gate_open_time: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Gate Close</label>
                <input
                  type="time"
                  value={form.gate_close_time}
                  onChange={(e) => setForm({ ...form, gate_close_time: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Dismissal Start</label>
                <input
                  type="time"
                  value={form.dismissal_start_time}
                  onChange={(e) => setForm({ ...form, dismissal_start_time: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Dismissal End</label>
                <input
                  type="time"
                  value={form.dismissal_end_time}
                  onChange={(e) => setForm({ ...form, dismissal_end_time: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section: Brand Colors */}
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Palette size={14} className="text-purple-500" />
              School Branding Colors
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.primary_color}
                  onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                  className="w-10 h-10 rounded-xl cursor-pointer border border-slate-200 p-0.5"
                />
                <div>
                  <p className="text-xs font-bold text-slate-700">Primary Color</p>
                  <p className="text-[11px] font-mono text-slate-400">{form.primary_color}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.secondary_color}
                  onChange={(e) => setForm({ ...form, secondary_color: e.target.value })}
                  className="w-10 h-10 rounded-xl cursor-pointer border border-slate-200 p-0.5"
                />
                <div>
                  <p className="text-xs font-bold text-slate-700">Secondary Color</p>
                  <p className="text-[11px] font-mono text-slate-400">{form.secondary_color}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-colors flex items-center justify-center gap-2"
            >
              {loading ? 'Saving Changes...' : 'Save & Apply Immediately'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
