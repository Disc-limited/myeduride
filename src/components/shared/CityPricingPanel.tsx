'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BadgePercent,
  CalendarClock,
  History,
  Info,
  Loader2,
  Megaphone,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';

type EffectiveMode = 'immediate' | 'rewrite_stored' | 'effective_from';

type PricingPayload = {
  city_key: string;
  city_label: string;
  currency: string;
  rate_per_half_km: number;
  rate_per_tenth_km: number;
  service_charge_percent: number;
  shared_ride_base_fare_round: number;
  shared_ride_base_fare_single: number;
  shared_ride_service_fee: number;
  version?: number;
  last_reason?: string | null;
  last_adjusted_at?: string | null;
  pending_effective_from?: string | null;
  pending_reason?: string | null;
};

function formatNgn(n: number) {
  return `₦${Number(n || 0).toLocaleString('en-NG')}`;
}

export function CityPricingReadOnlyPanel({
  cityKey = 'LAGOS',
  title = 'City Transport Pricing',
  className = '',
}: {
  cityKey?: string;
  title?: string;
  className?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [pricing, setPricing] = useState<PricingPayload | null>(null);
  const [notices, setNotices] = useState<any[]>([]);
  const [cities, setCities] = useState<{ key: string; label: string }[]>([]);
  const [selectedCity, setSelectedCity] = useState(cityKey);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pricing/active?city=${encodeURIComponent(selectedCity)}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load pricing');
      setPricing(data.pricing);
      setNotices(data.notices || []);
      if (Array.isArray(data.cities)) setCities(data.cities);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load city pricing');
    } finally {
      setLoading(false);
    }
  }, [selectedCity]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className={`space-y-5 ${className}`}>
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <BadgePercent size={22} />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">{title}</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Active city rate card set by City Manager. Personal student discounts remain overlays on top of these bases.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {cities.length > 0 && (
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-800"
              >
                {cities.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={load}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
              title="Refresh"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {loading && !pricing ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm py-8 justify-center">
            <Loader2 className="animate-spin" size={18} /> Loading city rates…
          </div>
        ) : pricing ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: 'Per 0.5 km', value: formatNgn(pricing.rate_per_half_km) },
                { label: 'Per extra 0.1 km', value: formatNgn(pricing.rate_per_tenth_km) },
                { label: 'Service charge', value: `${pricing.service_charge_percent}%` },
                { label: 'Shared ride (round)', value: formatNgn(pricing.shared_ride_base_fare_round) },
                { label: 'Shared ride (single)', value: formatNgn(pricing.shared_ride_base_fare_single) },
                { label: 'Shared ride fee', value: formatNgn(pricing.shared_ride_service_fee) },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{item.label}</p>
                  <p className="text-base font-black text-slate-900 mt-1">{item.value}</p>
                </div>
              ))}
            </div>

            {(pricing.last_reason || pricing.pending_effective_from) && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 flex gap-3">
                <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 space-y-1">
                  {pricing.last_reason && (
                    <p>
                      <span className="font-extrabold">Latest reason:</span> {pricing.last_reason}
                    </p>
                  )}
                  {pricing.pending_effective_from && (
                    <p className="flex items-center gap-1.5">
                      <CalendarClock size={14} />
                      Scheduled change from{' '}
                      {new Date(pricing.pending_effective_from).toLocaleString('en-NG')}
                      {pricing.pending_reason ? ` — ${pricing.pending_reason}` : ''}
                    </p>
                  )}
                  {pricing.last_adjusted_at && (
                    <p className="text-amber-700/80">
                      Updated {new Date(pricing.last_adjusted_at).toLocaleString('en-NG')}
                      {pricing.version != null ? ` · v${pricing.version}` : ''}
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-500 text-center py-6">No pricing data available.</p>
        )}
      </div>

      {notices.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Megaphone size={18} className="text-emerald-600" />
            <h3 className="text-sm font-extrabold text-slate-900">Recent fare announcements</h3>
          </div>
          {notices.map((n) => (
            <div key={n.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5">
              <p className="text-xs font-extrabold text-slate-900">{n.title}</p>
              <p className="text-xs text-slate-600 mt-1 whitespace-pre-line">{n.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CityManagerPricingView({
  selectedCity = 'LAGOS',
  onCityChange,
}: {
  selectedCity?: string;
  onCityChange?: (city: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [cities, setCities] = useState<{ key: string; label: string }[]>([]);
  const [city, setCity] = useState(selectedCity === 'ALL' || selectedCity === 'OTHER' ? 'LAGOS' : selectedCity);
  const [config, setConfig] = useState<PricingPayload | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [form, setForm] = useState({
    rate_per_half_km: 300,
    rate_per_tenth_km: 30,
    service_charge_percent: 6,
    shared_ride_base_fare_round: 1500,
    shared_ride_base_fare_single: 850,
    shared_ride_service_fee: 100,
    reason: '',
    effective_mode: 'immediate' as EffectiveMode,
    effective_from: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/city-manager/pricing?city=${encodeURIComponent(city)}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load pricing');
      setCities(data.cities || []);
      setConfig(data.config);
      setHistory(data.history || []);
      if (data.config) {
        setForm((prev) => ({
          ...prev,
          rate_per_half_km: Number(data.config.rate_per_half_km),
          rate_per_tenth_km: Number(data.config.rate_per_tenth_km),
          service_charge_percent: Number(data.config.service_charge_percent),
          shared_ride_base_fare_round: Number(data.config.shared_ride_base_fare_round),
          shared_ride_base_fare_single: Number(data.config.shared_ride_base_fare_single),
          shared_ride_service_fee: Number(data.config.shared_ride_service_fee),
        }));
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load city pricing');
    } finally {
      setLoading(false);
    }
  }, [city]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (selectedCity && selectedCity !== 'ALL' && selectedCity !== 'OTHER') {
      setCity(selectedCity);
    }
  }, [selectedCity]);

  const handleCityPick = (next: string) => {
    setCity(next);
    onCityChange?.(next);
  };

  const publish = async () => {
    if (!form.reason.trim()) {
      toast.error('Please enter the reason for this price adjustment (broadcast to parents, schools, escorts).');
      return;
    }
    if (form.effective_mode === 'effective_from' && !form.effective_from) {
      toast.error('Pick a future effective date/time.');
      return;
    }

    setPublishing(true);
    try {
      const res = await fetch('/api/city-manager/pricing', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city_key: city,
          ...form,
          effective_from:
            form.effective_mode === 'effective_from' && form.effective_from
              ? new Date(form.effective_from).toISOString()
              : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Publish failed');
      toast.success(data.message || 'Rates published');
      setForm((prev) => ({ ...prev, reason: '' }));
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Could not publish rates');
    } finally {
      setPublishing(false);
    }
  };

  const modeHelp: Record<EffectiveMode, string> = {
    immediate: 'Applies to new quotes only. Existing stored booking fares stay as-is until reassigned.',
    rewrite_stored:
      'Applies immediately and recalculates base fares on active assignments/bookings. Personal CM/accountant discounts stay as overlays.',
    effective_from: 'Rates stay current until the scheduled date; then they activate automatically. Audience is notified now.',
  };

  return (
    <div className="space-y-5 animate-in fade-in text-slate-100">
      <div className="bg-[#0b1c30] rounded-2xl border border-slate-800 p-5 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
              <BadgePercent size={22} />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white">City Pricing Adjuster</h2>
              <p className="text-xs text-slate-400 mt-0.5 max-w-xl">
                Per-city global rate card. Publishing broadcasts in-app notifications and school notice banners to parents with
                active escort bookings, schools, and escorts.
              </p>
            </div>
          </div>
          <select
            value={city}
            onChange={(e) => handleCityPick(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-xs text-emerald-400 font-bold px-3 py-2 rounded-xl"
          >
            {(cities.length ? cities : [{ key: city, label: city }]).map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {loading && !config ? (
          <div className="flex justify-center py-12 text-slate-400 gap-2 text-sm">
            <Loader2 className="animate-spin" size={18} /> Loading…
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-7 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(
                  [
                    ['rate_per_half_km', '₦ per 0.5 km'],
                    ['rate_per_tenth_km', '₦ per extra 0.1 km'],
                    ['service_charge_percent', 'Service charge %'],
                    ['shared_ride_base_fare_round', 'Shared ride round (₦)'],
                    ['shared_ride_base_fare_single', 'Shared ride single (₦)'],
                    ['shared_ride_service_fee', 'Shared ride fee (₦)'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="block rounded-xl border border-slate-700 bg-slate-900/60 p-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
                    <input
                      type="number"
                      min={0}
                      step={key === 'service_charge_percent' ? 0.1 : 1}
                      value={form[key]}
                      onChange={(e) => setForm((p) => ({ ...p, [key]: Number(e.target.value) }))}
                      className="mt-1.5 w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-sm font-bold text-white"
                    />
                  </label>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Effective timing</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(
                    [
                      ['immediate', 'Immediate (new quotes)'],
                      ['rewrite_stored', 'Rewrite stored fares'],
                      ['effective_from', 'Effective from date'],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, effective_mode: mode }))}
                      className={`text-left rounded-xl border px-3 py-2.5 text-xs font-bold transition-all ${
                        form.effective_mode === mode
                          ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                          : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 flex gap-1.5 items-start">
                  <ShieldCheck size={14} className="shrink-0 mt-0.5 text-emerald-500" />
                  {modeHelp[form.effective_mode]}
                </p>
                {form.effective_mode === 'effective_from' && (
                  <input
                    type="datetime-local"
                    value={form.effective_from}
                    onChange={(e) => setForm((p) => ({ ...p, effective_from: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white"
                  />
                )}
              </div>

              <label className="block space-y-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Broadcast reason (required)
                </span>
                <textarea
                  rows={3}
                  value={form.reason}
                  onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                  placeholder="e.g. Fuel price increase across Lagos corridors — adjusting distance rates."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600"
                />
              </label>

              <button
                type="button"
                disabled={publishing}
                onClick={publish}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-extrabold text-sm flex items-center justify-center gap-2"
              >
                {publishing ? <Loader2 className="animate-spin" size={16} /> : <Megaphone size={16} />}
                Publish &amp; Notify Audience
              </button>
            </div>

            <div className="xl:col-span-5 space-y-4">
              {config && (
                <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4 space-y-2">
                  <p className="text-[10px] font-extrabold uppercase text-slate-400">Active card · v{config.version}</p>
                  <p className="text-sm text-slate-200">
                    {formatNgn(config.rate_per_half_km)} / 0.5 km · {formatNgn(config.rate_per_tenth_km)} / 0.1 km ·{' '}
                    {config.service_charge_percent}% service
                  </p>
                  {config.last_reason && (
                    <p className="text-xs text-slate-400">Last: {config.last_reason}</p>
                  )}
                  {config.pending_effective_from && (
                    <p className="text-xs text-amber-400 flex items-center gap-1">
                      <CalendarClock size={12} />
                      Pending {new Date(config.pending_effective_from).toLocaleString('en-NG')}
                    </p>
                  )}
                </div>
              )}

              <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <History size={16} className="text-slate-400" />
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-300">Adjustment history</h3>
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {history.length === 0 && (
                    <p className="text-xs text-slate-500 py-4 text-center">No adjustments yet for this city.</p>
                  )}
                  {history.map((h) => (
                    <div key={h.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                      <div className="flex justify-between gap-2 text-[10px] text-slate-500 font-bold">
                        <span className="uppercase text-emerald-400/90">{h.effective_mode}</span>
                        <span>{h.created_at ? new Date(h.created_at).toLocaleString('en-NG') : ''}</span>
                      </div>
                      <p className="text-xs text-slate-200 mt-1 font-medium">{h.reason}</p>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Status: {h.status}
                        {h.rewrite_count ? ` · ${h.rewrite_count} rebased` : ''}
                        {h.notification_count ? ` · ${h.notification_count} notified` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
