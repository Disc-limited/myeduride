// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { X, Trash2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function EditUserModal({ isOpen, onClose, onSuccess, user }) {
  const [form, setForm] = useState({
    full_name: '',
    username: '',
    phone: '',
    email: '',
  });
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        full_name: user.full_name || user.parent_name || '',
        username: user.username || user.parent_username || '',
        phone: user.phone || user.parent_phone || '',
        email: user.email || user.parent_email || '',
      });
      setShowDeleteConfirm(false);
    }
  }, [user]);

  if (!isOpen || !user) return null;

  const userId = user.id || user.parent_user_id;

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
      const res = await fetch('/api/super-admin/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          full_name: form.full_name.trim(),
          username: form.username.trim(),
          phone: form.phone?.trim() || '',
          email: form.email?.trim() || '',
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
    } catch {
      toast.error('An error occurred during update');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userId) {
      toast.error('Cannot identify user account ID');
      return;
    }

    setDeleteLoading(true);
    try {
      const res = await fetch('/api/super-admin/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Account deleted successfully');
        onSuccess();
        onClose();
      } else {
        toast.error(data.error || 'Failed to delete user account');
      }
    } catch {
      toast.error('An error occurred while deleting account');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Edit User Details</h2>
            <p className="text-xs text-slate-400 font-medium">Update account credentials or permanently remove</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Delete Confirmation View */}
        {showDeleteConfirm ? (
          <div className="p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center mx-auto">
              <AlertCircle size={26} />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-extrabold text-slate-900">
                Permanently Delete This Account?
              </h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Are you sure you want to delete the account for <strong className="text-slate-800">{form.full_name}</strong> (@{form.username})?
                This will revoke their access and clean up associated records. This cannot be undone.
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteLoading}
                className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={deleteLoading}
                className="flex-1 py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <Trash2 size={14} />
                <span>{deleteLoading ? 'Deleting...' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        ) : (
          /* Form */
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
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-gray-600">Email Address</label>
                <span className="text-[10px] text-emerald-600 font-semibold">Immediate effect</span>
              </div>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input text-sm"
                placeholder="name@example.com"
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="px-3 py-2 rounded-xl text-red-600 hover:bg-red-50 text-xs font-bold transition-colors inline-flex items-center gap-1.5"
                title="Delete this account"
              >
                <Trash2 size={14} />
                <span>Delete Account</span>
              </button>

              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="btn-secondary px-3 min-h-[38px] text-xs">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="btn-primary px-4 min-h-[38px] text-xs font-bold">
                  {loading ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
