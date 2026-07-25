'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, Mail, Phone, User, X } from 'lucide-react';
import { toast } from 'sonner';
import { getSession, saveSession } from '@/lib/api';
import { photoSrc } from '@/lib/photo';

type ProfileForm = {
  full_name: string;
  email: string;
  phone: string;
  avatar_url: string | null;
};

type ProfileSettingsCardProps = {
  onSuccess?: () => void;
};

export function ProfileSettingsCard({ onSuccess }: ProfileSettingsCardProps) {
  const [original, setOriginal] = useState<ProfileForm>({
    full_name: '',
    email: '',
    phone: '',
    avatar_url: null,
  });
  const [form, setForm] = useState<ProfileForm>({
    full_name: '',
    email: '',
    phone: '',
    avatar_url: null,
  });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const session = getSession();
    const initial: ProfileForm = {
      full_name: session?.full_name || '',
      email: session?.email || '',
      phone: (session as any)?.phone || '',
      avatar_url: (session as any)?.avatar_url || null,
    };
    setOriginal(initial);
    setForm(initial);
  }, []);

  const isDirty =
    form.full_name !== original.full_name ||
    form.email !== original.email ||
    form.phone !== original.phone ||
    form.avatar_url !== original.avatar_url;

  // ── Avatar upload ─────────────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Instant local preview
    const localUrl = URL.createObjectURL(file);
    setAvatarPreview(localUrl);

    setUploading(true);
    try {
      const session = getSession();
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', `avatars/${session?.user_id || 'unknown'}`);

      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok || !data.path) {
        toast.error(data.error || 'Photo upload failed');
        setAvatarPreview(null);
        return;
      }
      setForm((prev) => ({ ...prev, avatar_url: data.path }));
    } catch {
      toast.error('Photo upload failed');
      setAvatarPreview(null);
    } finally {
      setUploading(false);
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const displayAvatarSrc = (): string | null => {
    if (avatarPreview) return avatarPreview; // local blob URL while uploading / after pick
    return photoSrc(form.avatar_url);
  };

  const initials = () => {
    const parts = form.full_name.trim().split(' ').filter(Boolean);
    return (
      (parts[0]?.[0] || '') + (parts[1]?.[0] || '')
    ).toUpperCase() || '?';
  };

  // ── Form submit ───────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDirty) return;

    setLoading(true);
    try {
      const res = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          full_name: form.full_name,
          email: form.email,        // empty string → API clears to null
          phone: form.phone,
          avatar_url: form.avatar_url,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Could not update profile');
        return;
      }

      // Sync the client session cookie via saveSession
      const session = getSession();
      if (session) {
        saveSession({
          ...session,
          full_name: data.full_name,
          email: data.email ?? '',
          ...(data.phone !== undefined && { phone: data.phone }),
          ...(data.avatar_url !== undefined && { avatar_url: data.avatar_url }),
        } as any);
      }

      const newState: ProfileForm = {
        full_name: data.full_name,
        email: data.email ?? '',
        phone: data.phone ?? '',
        avatar_url: data.avatar_url ?? null,
      };
      setOriginal(newState);
      setForm(newState);
      setAvatarPreview(null);
      toast.success('Profile updated successfully');
      onSuccess?.();
    } catch {
      toast.error('Could not update profile');
    } finally {
      setLoading(false);
    }
  };

  const avatarSrc = displayAvatarSrc();

  return (
    <div>
      <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
        <User size={16} className="text-primary-600" />
        Your profile
      </h3>
      <p className="text-xs text-gray-500 mb-5">
        Correct any details that were entered incorrectly during registration.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* ── Avatar picker ─────────────────────────────────────────── */}
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt="Profile photo"
                className="w-16 h-16 rounded-full object-cover border-2 border-white shadow ring-1 ring-gray-100"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary-600 flex items-center justify-center text-white text-lg font-bold shadow">
                {initials()}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity focus:opacity-100"
              title="Change photo"
              aria-label="Change profile photo"
            >
              {uploading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Camera size={16} className="text-white" />
              )}
            </button>
          </div>
          <div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-sm font-medium text-primary-600 hover:text-primary-700 disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : 'Change photo'}
            </button>
            <p className="text-xs text-gray-400 mt-0.5">JPG, PNG or WebP · max 5 MB</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* ── Full name ─────────────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Full name <span className="text-red-500">*</span>
          </label>
          <input
            id="profile-full-name"
            type="text"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            className="input"
            required
            autoComplete="name"
            placeholder="Your full name"
          />
        </div>

        {/* ── Email ─────────────────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email address
          </label>
          <div className="relative">
            <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              id="profile-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input pl-9 pr-9"
              autoComplete="email"
              placeholder="you@example.com"
            />
            {form.email && (
              <button
                type="button"
                onClick={() => setForm({ ...form, email: '' })}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                title="Clear email"
                aria-label="Clear email"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">Leave blank to remove your email address.</p>
        </div>

        {/* ── Phone ─────────────────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone number
          </label>
          <div className="relative">
            <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              id="profile-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="input pl-9"
              autoComplete="tel"
              placeholder="+234 800 000 0000"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || uploading || !isDirty}
          className="btn-primary w-full sm:w-auto"
        >
          {loading ? 'Saving…' : 'Save profile'}
        </button>
      </form>
    </div>
  );
}
