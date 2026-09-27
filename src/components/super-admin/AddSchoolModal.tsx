'use client';

import { useEffect, useRef, useState } from 'react';
import { Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { InitialPasswordFields } from '@/components/shared/InitialPasswordFields';
import { ExistingUsernameBanner } from '@/components/shared/ExistingUsernameBanner';
import { useUsernameLookup } from '@/hooks/useUsernameLookup';

export default function AddSchoolModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (school?: any) => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    admin_username: '',
    admin_name: '',
    admin_phone: '',
    admin_email: '',
    admin_password: '',
    confirm_password: '',
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const { existingUser: existingAdmin, checking: checkingAdmin } = useUsernameLookup(formData.admin_username);

  useEffect(() => {
    if (!existingAdmin) return;
    setFormData((prev) => ({
      ...prev,
      admin_username: existingAdmin.username,
      admin_name: existingAdmin.full_name || prev.admin_name,
      admin_phone: existingAdmin.phone || prev.admin_phone,
      admin_email: existingAdmin.email || prev.admin_email,
    }));
  }, [existingAdmin]);

  const handleLogoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.target.files?.[0];
    if (!file) return;

    const name = file.name.toLowerCase();
    const okType =
      ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      name.endsWith('.jpg') ||
      name.endsWith('.jpeg') ||
      name.endsWith('.png') ||
      name.endsWith('.webp');

    if (!okType) {
      toast.error('Use JPG, PNG, or WebP for the school logo');
      if (logoInputRef.current) logoInputRef.current.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Logo must be 5 MB or smaller');
      if (logoInputRef.current) logoInputRef.current.value = '';
      return;
    }

    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview((ev.target?.result as string) || '');
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/schools/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      const result = await response.json();
      if (result.success) {
        const schoolId = result.school_id || result.school?.id;
        if (logoFile && schoolId) {
          const fd = new FormData();
          fd.append('school_id', schoolId);
          fd.append('file', logoFile);
          const logoRes = await fetch('/api/schools/logo', {
            method: 'POST',
            credentials: 'include',
            body: fd,
          });
          const logoJson = await logoRes.json();
          if (!logoRes.ok) {
            toast.error(logoJson.error || 'School created but logo upload failed');
          } else if (logoJson.path && result.school) {
            result.school.logo_url = logoJson.path;
          }
        }
        toast.success(
          `${formData.name} created — username: ${result.admin_username || formData.admin_username}, password: ${result.admin_password || formData.admin_password}`,
          { duration: 12000 }
        );
        onSuccess(result.school);
      } else {
        toast.error(result.error || 'Failed to create school');
      }
    } catch {
      toast.error('Failed to create school');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
        <h2 className="text-xl font-extrabold mb-4 flex items-center gap-2 text-slate-900">
          <Building2 size={22} className="text-emerald-600" />
          Add New School
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">School Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              placeholder="e.g. Greenfield Academy"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Address</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              placeholder="School address"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">School Logo (optional)</label>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              onChange={handleLogoPick}
              className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-emerald-50 file:text-emerald-700 file:font-semibold"
            />
            <p className="text-[10px] text-slate-400 mt-1">JPG, PNG or WebP · max 5 MB</p>
            {logoPreview && (
              <div className="mt-2 p-2 bg-slate-50 rounded-xl inline-block border border-slate-200">
                <img src={logoPreview} alt="Preview" className="h-10 object-contain" />
              </div>
            )}
          </div>

          <hr className="my-4 border-slate-100" />
          <p className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
            School Admin Credentials
          </p>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Admin Username</label>
            <input
              type="text"
              value={formData.admin_username}
              onChange={(e) => setFormData(prev => ({ ...prev, admin_username: e.target.value.toLowerCase().replace(/\s/g, '') }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              placeholder="school_admin"
              required
            />
            <ExistingUsernameBanner user={existingAdmin} checking={checkingAdmin} roleHint="school admin" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Admin Email (optional)</label>
            <input
              type="email"
              value={formData.admin_email}
              onChange={(e) => setFormData(prev => ({ ...prev, admin_email: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              placeholder="admin@school.com"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Admin Full Name</label>
            <input
              type="text"
              value={formData.admin_name}
              onChange={(e) => setFormData(prev => ({ ...prev, admin_name: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Admin Phone</label>
            <input
              type="tel"
              value={formData.admin_phone}
              onChange={(e) => setFormData(prev => ({ ...prev, admin_phone: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <InitialPasswordFields
            password={formData.admin_password}
            confirmPassword={formData.confirm_password}
            onPasswordChange={(v) => setFormData((prev) => ({ ...prev, admin_password: v }))}
            onConfirmChange={(v) => setFormData((prev) => ({ ...prev, confirm_password: v }))}
            label="Admin default password"
          />

          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create School'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
