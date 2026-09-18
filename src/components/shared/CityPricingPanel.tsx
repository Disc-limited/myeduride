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
  Sun,
  Moon,
  ArrowRightLeft,
  Sparkles,
  CheckCircle2,
  Calculator,
} from 'lucide-react';
import { toast } from 'sonner';

type EffectiveMode = 'immediate' | 'rewrite_stored' | 'effective_from';

type PricingPayload = {
  city_key: string;
  city_label: string;
  currency: string;
  rate_per_km: number;
  rate_per_half_km?: number;
  rate_per_tenth_km?: number;
  service_charge_percent: number;
  shared_ride_base_fare_round: number;
  shared_ride_base_fare_single: number;
  shared_ride_service_fee: number;
  version?: number;
  last_reason?: string | null;
  last_adjusted_at?: string | null;
  pending_effective_from?: string | null;
  pending_reason?: string | null;
  formula?: string;
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

  const [roDistance, setRoDistance] = useState(1);

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

  const roRatePerKm = Number(pricing?.rate_per_km ?? pricing?.rate_per_half_km ?? 500);
  const roSvcPercent = Number(pricing?.service_charge_percent ?? 6);
  const roBaseFare = roRatePerKm * roDistance;
  const roSvcAmount = Math.round(roBaseFare * (roSvcPercent / 100));
  const roOneWayFare = roBaseFare + roSvcAmount;
  const roCompleteFare = roOneWayFare * 2;
  const roSavings = roCompleteFare - roOneWayFare;

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
                Formula: One-way = Base + service % · Complete trip = One-way × 2 · Base = ₦/km × each 0–1 km band.
                Personal student discounts remain overlays on top of these bases.
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
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
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
          <div className="space-y-5">
            {/* TRIP RATE COMPARISON PREVIEW CARDS */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <div>
                  <span className="text-[10px] uppercase font-black tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                    Trip Provision Preview
                  </span>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 mt-1">
                    One-Way Single Trip vs. Complete Round Trip Comparison
                  </h3>
                </div>
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 px-1.5 flex items-center gap-1">
                    <Calculator size={12} /> Corridor:
                  </span>
                  {[1, 3, 5, 10].map((km) => (
                    <button
                      key={km}
                      type="button"
                      onClick={() => setRoDistance(km)}
                      className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        roDistance === km
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {km} km
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* PREVIEW CARD 1: ONE-WAY SINGLE TRIP */}
                <div className="rounded-2xl border-2 border-amber-200 bg-gradient-to-b from-amber-50/80 to-white p-4 sm:p-5 flex flex-col justify-between shadow-xs">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black uppercase tracking-wider border border-amber-200 flex items-center gap-1">
                        <Sun size={11} /> 50% Baseline (Single Leg)
                      </span>
                      <span className="text-[11px] font-bold text-slate-500">{roDistance} km corridor</span>
                    </div>

                    <h4 className="text-base font-black text-slate-900 mt-2">
                      One-Way Single Trip
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Morning Pickup Only OR Afternoon Drop-off Only
                    </p>

                    <div className="my-3">
                      <span className="text-2xl sm:text-3xl font-black text-amber-600 tracking-tight font-mono">
                        {formatNgn(roOneWayFare)}
                      </span>
                      <span className="text-xs text-slate-500 font-medium ml-1.5">/ day</span>
                    </div>

                    <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-100 space-y-1 text-xs text-slate-700">
                      <div className="flex justify-between text-[11px]">
                        <span>Base Fare ({roDistance} km @ {formatNgn(roRatePerKm)}/km):</span>
                        <span className="font-mono font-bold text-slate-900">{formatNgn(roBaseFare)}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span>Service Charge ({roSvcPercent}%):</span>
                        <span className="font-mono font-bold text-slate-900">{formatNgn(roSvcAmount)}</span>
                      </div>
                      <div className="pt-1 border-t border-amber-200/60 flex justify-between text-[11px] font-extrabold text-amber-900">
                        <span>Single Leg Total:</span>
                        <span className="font-mono">{formatNgn(roOneWayFare)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-amber-100 flex items-center justify-between text-[11px]">
                    <span className="text-amber-800 font-bold flex items-center gap-1">
                      <CheckCircle2 size={13} className="text-amber-600" /> Saves 50% vs Complete Trip
                    </span>
                    <span className="text-xs font-black text-amber-700">Save {formatNgn(roSavings)}</span>
                  </div>
                </div>

                {/* PREVIEW CARD 2: COMPLETE ROUND TRIP */}
                <div className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-b from-emerald-50/80 to-white p-4 sm:p-5 flex flex-col justify-between shadow-xs">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider border border-emerald-200 flex items-center gap-1">
                        <ArrowRightLeft size={11} /> 100% Full Commute (Two-Way)
                      </span>
                      <span className="text-[11px] font-bold text-slate-500">{roDistance} km corridor</span>
                    </div>

                    <h4 className="text-base font-black text-slate-900 mt-2">
                      Complete Round Trip
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Both Morning Pickup &amp; Afternoon School Return
                    </p>

                    <div className="my-3">
                      <span className="text-2xl sm:text-3xl font-black text-emerald-600 tracking-tight font-mono">
                        {formatNgn(roCompleteFare)}
                      </span>
                      <span className="text-xs text-slate-500 font-medium ml-1.5">/ day</span>
                    </div>

                    <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-1 text-xs text-slate-700">
                      <div className="flex justify-between text-[11px]">
                        <span>Morning Leg (Pickup):</span>
                        <span className="font-mono font-bold text-slate-900">{formatNgn(roOneWayFare)}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span>Afternoon Leg (Drop-off):</span>
                        <span className="font-mono font-bold text-slate-900">{formatNgn(roOneWayFare)}</span>
                      </div>
                      <div className="pt-1 border-t border-emerald-200/60 flex justify-between text-[11px] font-extrabold text-emerald-900">
                        <span>Round Trip Total:</span>
                        <span className="font-mono">{formatNgn(roCompleteFare)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-emerald-100 flex items-center justify-between text-[11px]">
                    <span className="text-emerald-800 font-bold flex items-center gap-1">
                      <CheckCircle2 size={13} className="text-emerald-600" /> Full Door-to-Door Escort Care
                    </span>
                    <span className="text-xs font-black text-emerald-700">Morning + Afternoon</span>
                  </div>
                </div>
              </div>
            </div>

            {/* BASELINE RATE SPECIFICATIONS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Per km rate (0–1 km)', value: formatNgn(pricing.rate_per_km ?? pricing.rate_per_half_km) },
                { label: 'Platform service charge', value: `${pricing.service_charge_percent}%` },
                { label: 'Shared ride (complete round)', value: formatNgn(pricing.shared_ride_base_fare_round) },
                { label: 'Shared ride (one-way single)', value: formatNgn(pricing.shared_ride_base_fare_single) },
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
          </div>
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
  const [previewDistance, setPreviewDistance] = useState<number>(1);
  const [form, setForm] = useState({
    rate_per_km: 500,
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
          rate_per_km: Number(data.config.rate_per_km ?? data.config.rate_per_half_km ?? 500),
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

  const cmRate = Number(form.rate_per_km || 0);
  const cmSvc = Number(form.service_charge_percent || 0);
  const cmBase = cmRate * previewDistance;
  const cmSvcAmount = Math.round(cmBase * (cmSvc / 100));
  const cmOneWay = cmBase + cmSvcAmount;
  const cmComplete = cmOneWay * 2;
  const cmSavings = cmComplete - cmOneWay;

  return (
    <div className="space-y-5 animate-in fade-in text-slate-100">
      <div className="bg-[#0b1c30] rounded-3xl border border-slate-800 p-5 sm:p-6 shadow-xl space-y-6">
        {/* Header Bar */}
        <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
              <BadgePercent size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white tracking-tight">City Pricing Adjuster &amp; Trip Fare Engine</h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/40">
                  LIVE RATE ENGINE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                Formula: One-way = Base + service % · Complete trip = One-way × 2 · Base = ₦/km for every 0–1 km.
                Publishing broadcasts notices to parents with active bookings, schools, and escorts.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase font-bold text-slate-400">Jurisdiction:</span>
            <select
              value={city}
              onChange={(e) => handleCityPick(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-xs text-emerald-400 font-black px-3.5 py-2 rounded-xl"
            >
              {(cities.length ? cities : [{ key: city, label: city }]).map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PROMINENT LIVE PREVIEW: ONE-WAY SINGLE TRIP VS COMPLETE ROUND TRIP        */}
        {/* ========================================================================= */}
        <div className="rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-br from-[#0c223a] via-[#091b30] to-[#061424] p-5 sm:p-6 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-700/60">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider border border-emerald-500/40 flex items-center gap-1">
                  <Sparkles size={12} /> Live Rate Provisions &amp; Policy Preview
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  City: <strong className="text-white">{city}</strong>
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-white mt-1 flex items-center gap-2">
                Trip Rates: One-Way Single Trip vs. Complete Round Trip
              </h3>
              <p className="text-xs text-slate-300">
                Distinct pricing model ensuring parents paying for only morning or afternoon transit are billed fairly.
              </p>
            </div>

            {/* Distance Corridor Selector */}
            <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-2xl border border-slate-700 shrink-0">
              <span className="text-[10px] uppercase font-extrabold text-slate-400 px-2 flex items-center gap-1">
                <Calculator size={12} /> Corridor:
              </span>
              {[1, 3, 5, 10, 15].map((km) => (
                <button
                  key={km}
                  type="button"
                  onClick={() => setPreviewDistance(km)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    previewDistance === km
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {km} km
                </button>
              ))}
            </div>
          </div>

          {/* DUAL PREVIEW CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* CARD 1: ONE-WAY SINGLE TRIP */}
            <div className="rounded-2xl border-2 border-amber-500/50 bg-gradient-to-b from-amber-500/10 via-slate-900/95 to-slate-950 p-4 sm:p-5 relative overflow-hidden flex flex-col justify-between shadow-xl">
              <div className="absolute top-0 right-0 px-3 py-1 bg-amber-500 text-slate-950 font-black text-[10px] rounded-bl-xl uppercase tracking-wider">
                50% Base Fare
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-black">
                    <Sun size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-amber-400 font-black text-xs uppercase tracking-wider">Option A</span>
                      <span className="text-[10px] text-slate-400">· Single Leg (Morning OR Afternoon)</span>
                    </div>
                    <h4 className="text-lg font-black text-white">One-Way Single Trip</h4>
                  </div>
                </div>

                <div className="flex items-baseline gap-2 pt-1">
                  <span className="text-3xl sm:text-4xl font-black text-amber-400 tracking-tight font-mono">
                    {formatNgn(cmOneWay)}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">/ day ({previewDistance} km corridor)</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/90 border border-amber-500/20 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-300 text-[11px]">
                    <span>Base Distance ({previewDistance} km @ {formatNgn(cmRate)}/km):</span>
                    <span className="font-mono font-bold text-white">{formatNgn(cmBase)}</span>
                  </div>
                  <div className="flex justify-between text-slate-300 text-[11px]">
                    <span>Platform Service Charge ({cmSvc}%):</span>
                    <span className="font-mono font-bold text-white">{formatNgn(cmSvcAmount)}</span>
                  </div>
                  <div className="pt-1.5 border-t border-slate-800 flex justify-between text-[11px] font-bold text-amber-300">
                    <span>Parent Single Trip Total:</span>
                    <span className="font-mono font-extrabold text-sm">{formatNgn(cmOneWay)}</span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-300">
                  <p className="flex items-start gap-1.5">
                    <CheckCircle2 size={14} className="text-amber-400 shrink-0 mt-0.5" />
                    <span><strong>Policy Coverage:</strong> Billed when parent selects morning pickup only or afternoon drop-off only.</span>
                  </p>
                  <p className="flex items-start gap-1.5">
                    <CheckCircle2 size={14} className="text-amber-400 shrink-0 mt-0.5" />
                    <span><strong>Shared Ride Single:</strong> {formatNgn(form.shared_ride_base_fare_single)} base fare.</span>
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-amber-500/20 flex items-center justify-between text-[11px]">
                <span className="text-amber-300 font-bold flex items-center gap-1">
                  <Sun size={13} /> Morning Pickup Only OR <Moon size={13} className="ml-1" /> Afternoon Drop-off Only
                </span>
                <span className="px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 font-extrabold text-[10px]">
                  Saves {formatNgn(cmSavings)} (50%)
                </span>
              </div>
            </div>

            {/* CARD 2: COMPLETE ROUND TRIP */}
            <div className="rounded-2xl border-2 border-emerald-500/50 bg-gradient-to-b from-emerald-500/10 via-slate-900/95 to-slate-950 p-4 sm:p-5 relative overflow-hidden flex flex-col justify-between shadow-xl">
              <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-500 text-slate-950 font-black text-[10px] rounded-bl-xl uppercase tracking-wider">
                100% Full Commute
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-black">
                    <ArrowRightLeft size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-emerald-400 font-black text-xs uppercase tracking-wider">Option B</span>
                      <span className="text-[10px] text-slate-400">· Full Commute (Both Morning &amp; Afternoon)</span>
                    </div>
                    <h4 className="text-lg font-black text-white">Complete Round Trip</h4>
                  </div>
                </div>

                <div className="flex items-baseline gap-2 pt-1">
                  <span className="text-3xl sm:text-4xl font-black text-emerald-400 tracking-tight font-mono">
                    {formatNgn(cmComplete)}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">/ day ({previewDistance} km corridor)</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/90 border border-emerald-500/20 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-300 text-[11px]">
                    <span>Morning Leg (Home to School):</span>
                    <span className="font-mono font-bold text-white">{formatNgn(cmOneWay)}</span>
                  </div>
                  <div className="flex justify-between text-slate-300 text-[11px]">
                    <span>Afternoon Leg (School to Home):</span>
                    <span className="font-mono font-bold text-white">{formatNgn(cmOneWay)}</span>
                  </div>
                  <div className="pt-1.5 border-t border-slate-800 flex justify-between text-[11px] font-bold text-emerald-300">
                    <span>Parent Complete Round Trip Total:</span>
                    <span className="font-mono font-extrabold text-sm">{formatNgn(cmComplete)}</span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-300">
                  <p className="flex items-start gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Policy Coverage:</strong> Standard full-day transport with morning pickup and afternoon return.</span>
                  </p>
                  <p className="flex items-start gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Shared Ride Round:</strong> {formatNgn(form.shared_ride_base_fare_round)} base fare.</span>
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-emerald-500/20 flex items-center justify-between text-[11px]">
                <span className="text-emerald-300 font-bold flex items-center gap-1">
                  <ArrowRightLeft size={13} /> Complete 2-Way Commute (Morning + Afternoon)
                </span>
                <span className="px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 font-extrabold text-[10px]">
                  Full Escort Care
                </span>
              </div>
            </div>
          </div>
        </div>

        {loading && !config ? (
          <div className="flex justify-center py-12 text-slate-400 gap-2 text-sm">
            <Loader2 className="animate-spin" size={18} /> Loading…
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
                  Base Rates Configuration Inputs
                </h4>
                <span className="text-[11px] text-slate-400">Values update live in preview above</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(
                  [
                    ['rate_per_km', '₦ per km (0–1 km band)'],
                    ['service_charge_percent', 'Service charge %'],
                    ['shared_ride_base_fare_round', 'Shared ride complete round (₦)'],
                    ['shared_ride_base_fare_single', 'Shared ride one-way single (₦)'],
                    ['shared_ride_service_fee', 'Shared ride service fee (₦)'],
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
                    {formatNgn(config.rate_per_km ?? config.rate_per_half_km)} / km + {config.service_charge_percent}%
                    service · complete = one-way × 2
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
