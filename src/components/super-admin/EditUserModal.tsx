// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';

export default function EditUserModal({ isOpen, onClose, onSuccess, user }) {
  const [form, setForm] = useState({
    full_name: '',
    username: '',
    phone: '',
    email: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        full_name: user.full_name || user.parent_name || '',
        username: user.username || user.parent_username || '',
        phone: user.phone || user.parent_phone || '',
        email: user.email || user.parent_email || '',
      });
    }
  }, [user]);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!form.username.trim()) {
      toast.error('Username is required');
      return;
    }

    setLoading(true);
    try {
      const userId = user.id || user.parent_user_id;
      const res = await fetch('/api/super-admin/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          full_name: form.full_name,
          username: form.username,
          phone: form.phone,
          email: form.email,
        }),
      });

      const d = await res.json();
      if (res.ok) {
        toast.success('User details updated successfully');
        onSuccess();
        onClose();
      } else {
        toast.error(d.error || 'Failed to update user details');
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
          <h2 className="text-lg font-bold text-slate-900">Edit User Details</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="input text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Username *</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
              className="input text-sm font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Phone Number</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="input text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email Address</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input text-sm"
            />
          </div>

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
