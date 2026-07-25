// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { fetchData } from '@/lib/api';
import { GraduationCap, DoorOpen, Shield, User, X } from 'lucide-react';
import { toast } from 'sonner';

const ACCESS_OPTIONS = [
  { value: 'staff', label: 'Staff (sign-in + own attendance)', icon: User },
  { value: 'gate_officer', label: 'Gate officer', icon: DoorOpen },
  { value: 'school_admin', label: 'School admin', icon: Shield },
];

export default function EditStaffModal({ isOpen, onClose, onSuccess, staffMember, customRoles, schoolId }) {
  const [form, setForm] = useState({
    full_name: '',
    username: '',
    contact_email: '',
    phone: '',
    access_role: 'staff',
    custom_role_id: '',
    class_id: '',
    teacher_responsibility: '',
  });
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    fetchData('get_classes', { school_id: schoolId })
      .then((d) => setClasses(d.classes || []))
      .catch(() => {});
  }, [schoolId]);

  useEffect(() => {
    if (staffMember) {
      const rolesList = staffMember.roles || [];
      let primaryRole = 'staff';
      if (rolesList.includes('school_admin')) primaryRole = 'school_admin';
      else if (rolesList.includes('gate_officer')) primaryRole = 'gate_officer';

      setForm({
        full_name: staffMember.profile?.full_name || '',
        username: staffMember.profile?.username || '',
        contact_email: staffMember.profile?.email || '',
        phone: staffMember.profile?.phone || '',
        access_role: primaryRole,
        custom_role_id: staffMember.staff?.custom_role_id || '',
        class_id: staffMember.staff?.class_id || '',
        teacher_responsibility: staffMember.staff?.teacher_responsibility || '',
      });
    }
  }, [staffMember]);

  if (!isOpen || !staffMember) return null;

  const selectedCustom = customRoles.find((r) => r.id === form.custom_role_id);
  const mayAssignClass =
    form.access_role === 'staff' &&
    (form.teacher_responsibility === 'class_teacher' || form.teacher_responsibility === 'both');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.full_name || !form.username) {
      toast.error('Name and username required');
      return;
    }
    if (form.access_role === 'staff' && !form.custom_role_id) {
      toast.error('Select a job role');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/staff/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: staffMember.user_id,
          school_id: schoolId,
          full_name: form.full_name,
          username: form.username,
          contact_email: form.contact_email || null,
          phone: form.phone,
          role: form.access_role,
          custom_role_id: form.custom_role_id || null,
          class_id: mayAssignClass ? form.class_id || null : null,
          teacher_responsibility: form.access_role === 'staff' ? form.teacher_responsibility || null : null,
        }),
      });

      const d = await res.json();
      if (res.ok) {
        toast.success('Staff member updated successfully');
        onSuccess();
        onClose();
      } else {
        toast.error(d.error || 'Failed to update staff member');
      }
    } catch (err) {
      toast.error('An error occurred during update');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Edit staff member</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Username *</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
              className="input"
              placeholder="e.g. jsmith"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Full name *</label>
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="input"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Contact email (optional)</label>
            <input
              type="email"
              value={form.contact_email}
              onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
              className="input"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="input"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">App access *</label>
            <select
              value={form.access_role}
              onChange={(e) =>
                setForm({ ...form, access_role: e.target.value, class_id: '', custom_role_id: '' })
              }
              className="input"
            >
              {ACCESS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {form.access_role === 'staff' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Job title *</label>
              <select
                value={form.custom_role_id}
                onChange={(e) => setForm({ ...form, custom_role_id: e.target.value, class_id: '' })}
                className="input"
                required
              >
                <option value="">Select role...</option>
                {customRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.can_assign_class ? ' (may have class)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {form.access_role === 'staff' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Teacher Responsibility</label>
              <select
                value={form.teacher_responsibility}
                onChange={(e) =>
                  setForm({
                    ...form,
                    teacher_responsibility: e.target.value,
                    class_id: e.target.value === 'class_teacher' || e.target.value === 'both' ? form.class_id : '',
                  })
                }
                className="input"
              >
                <option value="">None (Standard Staff)</option>
                <option value="class_teacher">Class Teacher</option>
                <option value="subject_teacher">Subject Teacher</option>
                <option value="both">Both Class Teacher and Subject Teacher</option>
              </select>
            </div>
          )}

          {mayAssignClass && classes.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Assign class (optional)</label>
              <select
                value={form.class_id}
                onChange={(e) => setForm({ ...form, class_id: e.target.value })}
                className="input"
              >
                <option value="">No class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.section ? ` · Arm ${c.section}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 min-h-[44px]">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 min-h-[44px]">
              {loading ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
