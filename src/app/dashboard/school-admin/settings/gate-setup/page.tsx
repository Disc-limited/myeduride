// @ts-nocheck
'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchData } from '@/lib/api';
import { Save, Clock, GraduationCap, Users, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { schoolToSettingsForm, TIME_FIELDS, timeInputToDb } from '@/lib/time-input';
import Link from 'next/link';

const GATE_HOUR_FIELDS = [
  'gate_open_time',
  'school_start_time',
  'late_threshold',
  'gate_close_time',
  'dismissal_start_time',
  'dismissal_end_time',
  'staff_gate_start',
  'staff_gate_end',
  'student_gate_start',
  'student_gate_end',
] as const;

export default function GateSetupPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schoolId, setSchoolId] = useState('');
  const [migrationRequired, setMigrationRequired] = useState(false);
  const [formData, setFormData] = useState({
    gate_open_time: '06:30',
    school_start_time: '08:00',
    late_threshold: '08:15',
    gate_close_time: '09:00',
    dismissal_start_time: '14:00',
    dismissal_end_time: '16:00',
    staff_gate_start: '07:00',
    staff_gate_end: '17:00',
    student_gate_start: '07:30',
    student_gate_end: '15:00',
  });

  const loadSettings = useCallback(async (id) => {
    const sid = id || schoolId;
    if (!sid) return;
    try {
      const res = await fetch(`/api/schools/settings?school_id=${sid}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load settings');

      if (data.time_columns_available === false) {
        setMigrationRequired(true);
      } else {
        setMigrationRequired(false);
      }

      const parsed = schoolToSettingsForm(data.school);
      setFormData({
        gate_open_time: parsed.gate_open_time || '06:30',
        school_start_time: parsed.school_start_time || '08:00',
        late_threshold: parsed.late_threshold || '08:15',
        gate_close_time: parsed.gate_close_time || '09:00',
        dismissal_start_time: parsed.dismissal_start_time || '14:00',
        dismissal_end_time: parsed.dismissal_end_time || '16:00',
        staff_gate_start: parsed.staff_gate_start || '07:00',
        staff_gate_end: parsed.staff_gate_end || '17:00',
        student_gate_start: parsed.student_gate_start || '07:30',
        student_gate_end: parsed.student_gate_end || '15:00',
      });
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Could not load gate setup settings');
    }
  }, [schoolId]);

  useEffect(() => {
    (async () => {
      try {
        const schoolData = await fetchData('get_school_admin_data', { role: 'school_admin' });
        if (!schoolData.school_id) {
          setLoading(false);
          return;
        }
        setSchoolId(schoolData.school_id);
        await loadSettings(schoolData.school_id);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    })();
  }, [loadSettings]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!schoolId) {
      toast.error('School not loaded — refresh the page');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, string> = { school_id: schoolId };
      for (const field of GATE_HOUR_FIELDS) {
        payload[field] = formData[field];
      }

      const res = await fetch('/api/schools/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.migration_required) {
        setMigrationRequired(true);
        toast.error('Gate hour columns are missing in your database. Run migration 007 in Supabase SQL Editor.');
        setSaving(false);
        return;
      }

      if (!res.ok) throw new Error(data.error || 'Save failed');

      setMigrationRequired(false);
      toast.success('Gate schedules updated successfully');
    } catch (err) {
      toast.error(err.message || 'Could not save gate schedules');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-primary-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen pt-14 md:pt-6">
      <h1 className="text-2xl font-bold mb-6">School Settings</h1>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200 mb-6">
        <Link href="/dashboard/school-admin/settings" className="px-4 py-2 text-gray-500 hover:text-gray-700 font-medium text-sm">
          General Settings
        </Link>
        <Link href="/dashboard/school-admin/settings/gate-setup" className="px-4 py-2 border-b-2 border-primary-600 text-primary-700 font-medium text-sm">
          Gate Setup
        </Link>
      </div>

      {/* Migration banner */}
      {migrationRequired && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 flex gap-3">
          <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800 text-sm">Database migration required</p>
            <p className="text-xs text-amber-700 mt-1">
              The gate-hour columns are missing from your Supabase database. Run the following SQL in your{' '}
              <strong>Supabase → SQL Editor</strong> to fix this:
            </p>
            <pre className="mt-2 text-[11px] bg-amber-100 rounded-lg px-3 py-2 text-amber-900 overflow-x-auto whitespace-pre-wrap">
{`-- migrations/007_all_gate_hour_columns.sql
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS gate_open_time       TIME DEFAULT '06:30',
  ADD COLUMN IF NOT EXISTS school_start_time    TIME DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS late_threshold       TIME DEFAULT '08:15',
  ADD COLUMN IF NOT EXISTS gate_close_time      TIME DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS dismissal_start_time TIME DEFAULT '14:00',
  ADD COLUMN IF NOT EXISTS dismissal_end_time   TIME DEFAULT '16:00',
  ADD COLUMN IF NOT EXISTS staff_gate_start     TIME DEFAULT '07:00',
  ADD COLUMN IF NOT EXISTS staff_gate_end       TIME DEFAULT '17:00',
  ADD COLUMN IF NOT EXISTS student_gate_start   TIME DEFAULT '07:30',
  ADD COLUMN IF NOT EXISTS student_gate_end     TIME DEFAULT '15:00';

NOTIFY pgrst, 'reload schema';`}
            </pre>
            <p className="text-xs text-amber-600 mt-2">After running, refresh this page and save again.</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6 max-w-2xl">

        {/* Student School Hours */}
        <div className="card">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="text-primary-600" size={20} />
            <h2 className="font-semibold text-gray-900">School Day Hours</h2>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Controls when the gate opens, when school starts, the late cut-off, and dismissal window.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gate Opens</label>
              <input
                type="time"
                value={formData.gate_open_time}
                onChange={(e) => setFormData((p) => ({ ...p, gate_open_time: e.target.value }))}
                className="input"
              />
              <p className="text-[11px] text-gray-400 mt-0.5">Students may enter from this time</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">School Starts</label>
              <input
                type="time"
                value={formData.school_start_time}
                onChange={(e) => setFormData((p) => ({ ...p, school_start_time: e.target.value }))}
                className="input"
              />
              <p className="text-[11px] text-gray-400 mt-0.5">Official start of the school day</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Late Threshold <span className="text-amber-600 font-semibold">★</span>
              </label>
              <input
                type="time"
                value={formData.late_threshold}
                onChange={(e) => setFormData((p) => ({ ...p, late_threshold: e.target.value }))}
                className="input border-amber-300 focus:border-amber-500"
              />
              <p className="text-[11px] text-amber-600 mt-0.5">Arrivals after this time are marked Late</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gate Closes (Morning)</label>
              <input
                type="time"
                value={formData.gate_close_time}
                onChange={(e) => setFormData((p) => ({ ...p, gate_close_time: e.target.value }))}
                className="input"
              />
              <p className="text-[11px] text-gray-400 mt-0.5">No entry accepted after this time</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dismissal Start</label>
              <input
                type="time"
                value={formData.dismissal_start_time}
                onChange={(e) => setFormData((p) => ({ ...p, dismissal_start_time: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dismissal End</label>
              <input
                type="time"
                value={formData.dismissal_end_time}
                onChange={(e) => setFormData((p) => ({ ...p, dismissal_end_time: e.target.value }))}
                className="input"
              />
            </div>
          </div>
        </div>

        {/* Staff Gate Hours */}
        <div className="card">
          <div className="flex items-center gap-2 mb-1">
            <GraduationCap className="text-primary-600" size={20} />
            <h2 className="font-semibold text-gray-900">Staff Gate Hours</h2>
          </div>
          <p className="text-xs text-gray-500 mb-4">Staff clock-in and clock-out window (separate from student gate).</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Staff Start Time</label>
              <input
                type="time"
                value={formData.staff_gate_start}
                onChange={(e) => setFormData((p) => ({ ...p, staff_gate_start: e.target.value }))}
                className="input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Staff End Time</label>
              <input
                type="time"
                value={formData.staff_gate_end}
                onChange={(e) => setFormData((p) => ({ ...p, staff_gate_end: e.target.value }))}
                className="input"
                required
              />
            </div>
          </div>
        </div>

        {/* Student Gate Hours */}
        <div className="card">
          <div className="flex items-center gap-2 mb-1">
            <Users className="text-primary-600" size={20} />
            <h2 className="font-semibold text-gray-900">Student Gate Hours</h2>
          </div>
          <p className="text-xs text-gray-500 mb-4">Separate arrival and departure window for students.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Student Arrival Start</label>
              <input
                type="time"
                value={formData.student_gate_start}
                onChange={(e) => setFormData((p) => ({ ...p, student_gate_start: e.target.value }))}
                className="input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Student Departure End</label>
              <input
                type="time"
                value={formData.student_gate_end}
                onChange={(e) => setFormData((p) => ({ ...p, student_gate_end: e.target.value }))}
                className="input"
                required
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving || migrationRequired}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          <Save size={16} /> {saving ? 'Saving...' : 'Save Gate Setup'}
        </button>
        {migrationRequired && (
          <p className="text-xs text-amber-600">Run the migration above before saving.</p>
        )}
      </form>
    </div>
  );
}
