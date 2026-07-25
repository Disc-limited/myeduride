// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';

export default function EditParentModal({ isOpen, onClose, onSuccess, parent, schoolId }) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    username: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (parent) {
      setForm({
        name: parent.name || '',
        phone: parent.phone || '',
        email: parent.email || '',
        username: parent.username || '',
      });
    }
  }, [parent]);

  if (!isOpen || !parent) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Parent name is required');
      return;
    }

    setLoading(true);
    try {
      // Get student IDs of all children linked to this parent row
      const studentIds = parent.children?.map((c) => c.student_id) || [];
      const firstStudentId = studentIds[0] || null;

      const res = await fetch('/api/school-admin/parents/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parent_user_id: parent.id || null,
          student_id: firstStudentId,
          student_ids: studentIds, // pass all children ids so backend can update all on-file records
          school_id: schoolId,
          name: form.name,
          phone: form.phone,
          email: form.email,
          username: parent.has_login ? form.username : null,
        }),
      });

      const d = await res.json();
      if (res.ok) {
        toast.success('Parent details updated successfully');
        onSuccess();
        onClose();
      } else {
        toast.error(d.error || 'Failed to update parent details');
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
          <h2 className="text-lg font-bold text-slate-900">Edit parent</h2>
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
            <label className="block text-xs font-medium text-gray-600 mb-1">Parent Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Phone number</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="input"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email address</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input"
            />
          </div>

          {parent.has_login && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Username *</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
                className="input"
                required
              />
            </div>
          )}

          {!parent.has_login && (
            <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2.5">
              This parent has no app login yet. Updates will apply to their on-file contact details for their child(ren).
            </p>
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
