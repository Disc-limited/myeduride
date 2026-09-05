// @ts-nocheck
'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchData } from '@/lib/api';
import {
  Calendar,
  Trash2,
  Sparkles,
  AlertTriangle,
  Users,
  Megaphone,
  CheckCircle2,
  Lock,
  Unlock,
} from 'lucide-react';
import { toast } from 'sonner';
import { todayInLagos } from '@/lib/timezone';

const DAY_TYPES = [
  { value: 'public_holiday', label: 'Public Holiday (Gate/Pickup Locked)', desc: 'Blocks gate check-in & student pickups. Broadcasts to all roles.' },
  { value: 'school_event', label: 'School Event (Gate & Transit Active)', desc: 'Gate and pickup stay active. Broadcasts event schedule.' },
  { value: 'closure', label: 'School Closure (Gate/Pickup Locked)', desc: 'Total closure. Blocks gate and pickup operations.' },
];

const AUDIENCE_OPTIONS = [
  { id: 'parents', label: 'Parents' },
  { id: 'escorts', label: 'Escorts' },
  { id: 'city_managers', label: 'City Managers' },
  { id: 'teachers', label: 'Teachers' },
  { id: 'gate_officers', label: 'Gate Officers' },
];

function formatRange(start, end) {
  if (!start) return '';
  if (!end || start === end) return start;
  return `${start} → ${end}`;
}

export default function SchoolCalendarPage() {
  const [schoolId, setSchoolId] = useState('');
  const [events, setEvents] = useState([]);
  const [gateOverrides, setGateOverrides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [overrideForm, setOverrideForm] = useState({ override_date: todayInLagos(), reason: '' });
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [form, setForm] = useState({
    start_date: todayInLagos(),
    end_date: todayInLagos(),
    day_type: 'public_holiday',
    title: '',
    description: '',
    target_audiences: ['parents', 'escorts', 'city_managers', 'teachers', 'gate_officers'],
  });

  const loadEvents = useCallback(async (sid) => {
    if (!sid) return;
    const res = await fetch(`/api/schools/calendar?school_id=${sid}`, { credentials: 'include' });
    const json = await res.json();
    if (json.migration_required) {
      toast.error('Run supabase/schema.sql in Supabase SQL Editor');
      setEvents([]);
      return;
    }
    if (!res.ok) throw new Error(json.error);
    setEvents(json.events || []);
    setGateOverrides(json.gate_overrides || []);
  }, []);

  const addGateOverride = async (e) => {
    e.preventDefault();
    if (!overrideForm.reason.trim()) {
      toast.error('Reason required (e.g. Saturday exam)');
      return;
    }
    setOverrideSaving(true);
    try {
      const res = await fetch('/api/schools/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'gate_override',
          school_id: schoolId,
          override_date: overrideForm.override_date,
          reason: overrideForm.reason.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success('Gate open override saved — logged in audit');
      setOverrideForm((f) => ({ ...f, reason: '' }));
      await loadEvents(schoolId);
    } catch (err) {
      toast.error(err.message || 'Failed');
    }
    setOverrideSaving(false);
  };

  const removeOverride = async (ov) => {
    if (!confirm(`Remove gate override for ${ov.override_date}?`)) return;
    const res = await fetch('/api/schools/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        action: 'delete_gate_override',
        school_id: schoolId,
        id: ov.id,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || 'Failed');
      return;
    }
    toast.success('Override removed');
    await loadEvents(schoolId);
  };

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchData('get_school_admin_data', { role: 'school_admin' });
        setSchoolId(data.school_id || '');
        if (data.school_id) await loadEvents(data.school_id);
      } catch (e) {
        toast.error('Could not load calendar');
      }
      setLoading(false);
    })();
  }, [loadEvents]);

  const addRange = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('Title required');
      return;
    }
    if (form.end_date < form.start_date) {
      toast.error('End date must be on or after start date');
      return;
    }
    try {
      const res = await fetch('/api/schools/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          school_id: schoolId,
          start_date: form.start_date,
          end_date: form.end_date,
          day_type: form.day_type,
          title: form.title,
          description: form.description,
          target_audiences: form.target_audiences,
          notify_parents: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      const n = json.days_created || 1;
      toast.success(
        n === 1
          ? 'Event/Holiday saved and broadcasted across portals'
          : `${n} days saved and broadcasted across portals (${json.start_date} to ${json.end_date})`
      );
      setForm((f) => ({ ...f, title: '', description: '' }));
      await loadEvents(schoolId);
    } catch (err) {
      toast.error(err.message || 'Failed');
    }
  };

  const removeEvent = async (ev) => {
    if (!confirm(`Remove "${ev.title}"${ev.day_count > 1 ? ` (${ev.day_count} days)` : ''}?`)) return;
    const params = new URLSearchParams({ school_id: schoolId });
    if (ev.batch_id) params.set('batch_id', ev.batch_id);
    else params.set('id', ev.id);

    const res = await fetch(`/api/schools/calendar?${params}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || 'Failed');
      return;
    }
    toast.success('Removed');
    await loadEvents(schoolId);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center md:ml-56">
        <div className="animate-pulse text-primary-600">Loading…</div>
      </div>
    );
  }

  return (
    <div className="page-shell max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Calendar className="text-primary-600" size={28} />
        <div>
          <h1 className="text-2xl font-bold">School calendar</h1>
          <p className="text-sm text-slate-500">
            Holidays and closures block gate check-in/out and pickup. Weekends are always non-school. Use a gate override below for occasional Saturday events.
          </p>
        </div>
      </div>

      <form onSubmit={addRange} className="card-elevated p-5 space-y-3 mb-6">
        <h2 className="font-semibold text-sm">Add holiday, event, or closure</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Start date</label>
            <input
              type="date"
              className="input"
              value={form.start_date}
              onChange={(e) => {
                const v = e.target.value;
                setForm((f) => ({
                  ...f,
                  start_date: v,
                  end_date: f.end_date < v ? v : f.end_date,
                }));
              }}
              required
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">End date</label>
            <input
              type="date"
              className="input"
              value={form.end_date}
              min={form.start_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              required
            />
          </div>
        </div>
        <p className="text-[11px] text-slate-400">
          Same start and end = single weekday. Weekends in a range are skipped automatically.
        </p>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Type</label>
          <select
            className="input"
            value={form.day_type}
            onChange={(e) => setForm({ ...form, day_type: e.target.value })}
          >
            {DAY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <p className="text-[11px] text-slate-400 mt-1">
            {DAY_TYPES.find((t) => t.value === form.day_type)?.desc}
          </p>
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Title</label>
          <input
            className="input"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Easter break / Inter-House Sports Day"
            required
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Notes / Operational Instructions (optional)</label>
          <textarea
            className="input min-h-[72px]"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="e.g. Normal bus routes will not run today. Campus reopens on Monday."
          />
        </div>

        <div>
          <label className="text-xs text-slate-600 font-bold block mb-1.5 flex items-center gap-1.5">
            <Megaphone size={13} className="text-emerald-600" />
            <span>Broadcast Announcement To (Portal Banners):</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {AUDIENCE_OPTIONS.map((aud) => {
              const checked = form.target_audiences.includes(aud.id);
              return (
                <button
                  type="button"
                  key={aud.id}
                  onClick={() => {
                    setForm((f) => ({
                      ...f,
                      target_audiences: checked
                        ? f.target_audiences.filter((x) => x !== aud.id)
                        : [...f.target_audiences, aud.id],
                    }));
                  }}
                  className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-all cursor-pointer ${
                    checked
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {checked ? '✓ ' : '+ '}
                  {aud.label}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Selected roles (Parents, Escorts, City Managers) will receive real-time notices on their portal dashboards.
          </p>
        </div>

        <button type="submit" className="btn-primary w-full">Save and Broadcast</button>
      </form>

      <form onSubmit={addGateOverride} className="card-elevated p-5 space-y-3 mb-6 border border-amber-200 bg-amber-50/50">
        <div className="flex items-center gap-2">
          <Unlock size={18} className="text-amber-700" />
          <h2 className="font-bold text-sm text-amber-950">School Open Override (HR / Admin)</h2>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Allows the gate scanner and student pickup control to operate on a weekend or public holiday if the school decides to open for a special occasion. All overrides are audit-logged.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Date</label>
            <input
              type="date"
              className="input"
              value={overrideForm.override_date}
              onChange={(e) => setOverrideForm((f) => ({ ...f, override_date: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Reason *</label>
            <input
              className="input"
              value={overrideForm.reason}
              onChange={(e) => setOverrideForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder="e.g. Saturday Entrance Exam"
              required
            />
          </div>
        </div>
        <button type="submit" disabled={overrideSaving} className="btn-primary w-full bg-amber-600 hover:bg-amber-700 border-amber-600">
          {overrideSaving ? 'Saving…' : 'Authorize School Open on This Date'}
        </button>
        {gateOverrides.length > 0 && (
          <ul className="divide-y border border-amber-200 rounded-xl bg-white mt-2">
            {gateOverrides.map((ov) => (
              <li key={ov.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                <span>
                  <strong className="text-emerald-800">✓ {ov.override_date}</strong> — {ov.reason}
                </span>
                <button type="button" onClick={() => removeOverride(ov)} className="text-red-600 hover:text-red-700 text-xs font-semibold">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>

      <div className="card-elevated divide-y">
        <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">Scheduled Events & Calendar Roster</h3>
          <span className="text-xs font-bold text-slate-400">{events.length} Active Records</span>
        </div>
        {events.map((ev) => (
          <div key={ev.batch_id || ev.id} className="p-4 flex items-start justify-between gap-3 hover:bg-slate-50/40 transition-colors">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-black text-slate-900 text-sm">{ev.title}</p>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                  ev.day_type === 'public_holiday'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : ev.day_type === 'closure'
                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                }`}>
                  {ev.day_type === 'public_holiday' ? (
                    <>
                      <Lock size={10} /> Public Holiday (Gate/Pickup Locked)
                    </>
                  ) : ev.day_type === 'closure' ? (
                    <>
                      <AlertTriangle size={10} /> School Closure (Locked)
                    </>
                  ) : (
                    <>
                      <Sparkles size={10} /> School Event (Active)
                    </>
                  )}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                📅 {formatRange(ev.start_date, ev.end_date)}
                {ev.day_count > 1 && ` · ${ev.day_count} days`}
              </p>
              {ev.description && <p className="text-xs text-slate-600 mt-1 font-normal">{ev.description}</p>}
              <p className="text-[10px] font-semibold text-emerald-700 pt-0.5">
                ✓ Visible to Parents, Escorts, and City Managers
              </p>
            </div>
            <button
              type="button"
              onClick={() => removeEvent(ev)}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg shrink-0 transition-colors cursor-pointer"
              aria-label="Delete"
              title="Delete Event"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {events.length === 0 && (
          <p className="py-10 text-center text-slate-400 text-sm">No holidays or events registered yet</p>
        )}
      </div>
    </div>
  );
}
