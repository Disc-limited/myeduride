// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { fetchData } from '@/lib/api';
import { GraduationCap, DoorOpen, Shield, User, X, Camera, Upload, Trash2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { photoSrc } from '@/lib/photo';

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
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
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

      const initialPhoto = staffMember.staff?.photo_url || staffMember.profile?.avatar_url;
      setPhotoPreview(initialPhoto ? photoSrc(initialPhoto) : null);
    }
  }, [staffMember]);

  if (!isOpen || !staffMember) return null;

  const selectedCustom = customRoles?.find((r) => r.id === form.custom_role_id);
  const mayAssignClass =
    form.access_role === 'staff' &&
    (form.teacher_responsibility === 'class_teacher' || form.teacher_responsibility === 'both');

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setPhotoPreview(base64);
      setUploadingPhoto(true);
      try {
        const res = await fetch('/api/staff/photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            school_id: schoolId,
            user_id: staffMember.user_id,
            photo_base64: base64,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to upload photo');
        toast.success('Staff photograph updated and synchronized successfully!');
        if (data.preview_url) {
          setPhotoPreview(data.preview_url);
        }
        if (staffMember.staff) staffMember.staff.photo_url = data.photo_url;
        if (staffMember.profile) staffMember.profile.avatar_url = data.photo_url;
        onSuccess?.();
      } catch (err: any) {
        toast.error(err?.message || 'Photo upload failed');
      } finally {
        setUploadingPhoto(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
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
        onSuccess?.();
        onClose?.();
      } else {
        toast.error(d.error || 'Failed to update staff member');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error updating staff');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-lg font-bold text-slate-900">Edit Staff Profile</h2>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* STAFF PHOTOGRAPH SECTION */}
        <div className="flex items-center gap-4 p-3 rounded-2xl bg-slate-50 border border-slate-100">
          <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-slate-200 border-2 border-white shadow-xs shrink-0 flex items-center justify-center">
            {photoPreview ? (
              <img src={photoPreview} alt="Staff" className="w-full h-full object-cover" />
            ) : (
              <User size={28} className="text-slate-400" />
            )}
            {uploadingPhoto && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-[10px] font-bold">
                Saving...
              </div>
            )}
          </div>

          <div className="space-y-1">
            <h4 className="text-xs font-bold text-slate-800">Staff Photograph</h4>
            <p className="text-[10px] text-slate-500">Visible on ID cards, gate scanner, and dashboards.</p>
            <label className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-[11px] font-bold cursor-pointer transition-all shadow-xs">
              <Camera size={12} />
              <span>{photoPreview ? 'Change Photograph' : 'Upload Photograph'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            </label>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
            <input
              type="text"
              required
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Username *</label>
              <input
                type="text"
                required
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-700"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Phone Number</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              value={form.contact_email}
              onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Access Role *</label>
            <select
              value={form.access_role}
              onChange={(e) => setForm({ ...form, access_role: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl"
            >
              {ACCESS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {form.access_role === 'staff' && customRoles?.length > 0 && (
            <div>
              <label className="block font-bold text-slate-700 mb-1">Job Role / Designation *</label>
              <select
                value={form.custom_role_id}
                onChange={(e) => setForm({ ...form, custom_role_id: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-primary-700"
              >
                <option value="">Select Job Role...</option>
                {customRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {mayAssignClass && (
            <div>
              <label className="block font-bold text-slate-700 mb-1">Assigned Class</label>
              <select
                value={form.class_id}
                onChange={(e) => setForm({ ...form, class_id: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              >
                <option value="">No Class Assigned</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-600 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold cursor-pointer"
            >
              {loading ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
