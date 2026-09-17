import { getAdminClient } from '@/lib/supabase/admin';
import {
  RATE_PER_KM,
  SERVICE_CHARGE_PERCENT,
  type EscortFareRateOverrides,
} from '@/lib/escort/escort-pricing';
import { nowUtcIso } from '@/lib/utils/time';

/** Map city config knobs into the fare engine override shape. */
export function toEscortFareOverrides(
  config: Pick<CityFareRates, 'rate_per_km' | 'rate_per_half_km' | 'service_charge_percent'>
): EscortFareRateOverrides {
  const ratePerKm = Number(
    config.rate_per_km != null && Number(config.rate_per_km) > 0
      ? config.rate_per_km
      : config.rate_per_half_km === 300
        ? RATE_PER_KM
        : config.rate_per_half_km ?? RATE_PER_KM
  );
  return {
    rate_per_km: ratePerKm,
    service_charge_percent: Number(config.service_charge_percent ?? SERVICE_CHARGE_PERCENT),
  };
}

export type CityFareRates = {
  /** ₦ per whole km band (0–1 km, 1–2 km, …) — primary fare knob */
  rate_per_km: number;
  /** Legacy column; mirrored from rate_per_km for older rows */
  rate_per_half_km: number;
  /** Deprecated; unused under per-km formula */
  rate_per_tenth_km: number;
  service_charge_percent: number;
  shared_ride_base_fare_round: number;
  shared_ride_base_fare_single: number;
  shared_ride_service_fee: number;
  currency: string;
};

export type EffectiveMode = 'immediate' | 'rewrite_stored' | 'effective_from';

export type CityPricingConfig = CityFareRates & {
  id?: string;
  city_key: string;
  city_label: string;
  version: number;
  last_reason: string | null;
  last_adjusted_at: string | null;
  last_adjusted_by: string | null;
  pending_rates: CityFareRates | null;
  pending_effective_from: string | null;
  pending_reason: string | null;
  pending_adjustment_id: string | null;
};

export const DEFAULT_CITY_KEY = 'LAGOS';

export const CITY_OPTIONS: { key: string; label: string }[] = [
  { key: 'LAGOS', label: 'Lagos (Default)' },
  { key: 'LAGOS MAINLAND', label: 'Lagos Mainland' },
  { key: 'LAGOS ISLAND', label: 'Lagos Island' },
  { key: 'IKEJA', label: 'Ikeja' },
  { key: 'LEKKI', label: 'Lekki' },
  { key: 'ABUJA', label: 'Abuja' },
  { key: 'EDO', label: 'Benin City / Edo' },
];

export function defaultCityFareRates(): CityFareRates {
  return {
    rate_per_km: RATE_PER_KM,
    rate_per_half_km: RATE_PER_KM,
    rate_per_tenth_km: 0,
    service_charge_percent: SERVICE_CHARGE_PERCENT,
    shared_ride_base_fare_round: 1500,
    shared_ride_base_fare_single: 850,
    shared_ride_service_fee: 100,
    currency: 'NGN',
  };
}

export function normalizeCityKey(raw?: string | null): string {
  const key = String(raw || '').trim().toUpperCase();
  if (!key || key === 'ALL' || key === 'OTHER') return DEFAULT_CITY_KEY;
  return key;
}

export function cityLabelForKey(cityKey: string): string {
  const found = CITY_OPTIONS.find((c) => c.key === cityKey);
  return found?.label || cityKey;
}

function ratesFromRow(row: any): CityFareRates {
  const half = Number(row.rate_per_half_km);
  const fromCol = row.rate_per_km != null ? Number(row.rate_per_km) : NaN;
  let ratePerKm = Number.isFinite(fromCol) && fromCol > 0 ? fromCol : NaN;
  if (!Number.isFinite(ratePerKm)) {
    // Migrate old default 300 → new 500; keep CM-custom values otherwise
    ratePerKm = half === 300 || !Number.isFinite(half) || half <= 0 ? RATE_PER_KM : half;
  }
  return {
    rate_per_km: ratePerKm,
    rate_per_half_km: ratePerKm,
    rate_per_tenth_km: Number(row.rate_per_tenth_km ?? 0),
    service_charge_percent: Number(row.service_charge_percent ?? SERVICE_CHARGE_PERCENT),
    shared_ride_base_fare_round: Number(row.shared_ride_base_fare_round ?? 1500),
    shared_ride_base_fare_single: Number(row.shared_ride_base_fare_single ?? 850),
    shared_ride_service_fee: Number(row.shared_ride_service_fee ?? 100),
    currency: String(row.currency || 'NGN'),
  };
}

/** Columns that exist on city_pricing_config today (rate_per_km optional until migration). */
function toDbRateColumns(rates: CityFareRates) {
  return {
    rate_per_km: rates.rate_per_km,
    rate_per_half_km: rates.rate_per_km,
    rate_per_tenth_km: 0,
    service_charge_percent: rates.service_charge_percent,
    shared_ride_base_fare_round: rates.shared_ride_base_fare_round,
    shared_ride_base_fare_single: rates.shared_ride_base_fare_single,
    shared_ride_service_fee: rates.shared_ride_service_fee,
    currency: rates.currency || 'NGN',
  };
}

function configFromRow(row: any): CityPricingConfig {
  return {
    id: row.id,
    city_key: row.city_key,
    city_label: row.city_label || cityLabelForKey(row.city_key),
    version: Number(row.version || 1),
    last_reason: row.last_reason || null,
    last_adjusted_at: row.last_adjusted_at || null,
    last_adjusted_by: row.last_adjusted_by || null,
    pending_rates: row.pending_rates ? ratesFromRow(row.pending_rates) : null,
    pending_effective_from: row.pending_effective_from || null,
    pending_reason: row.pending_reason || null,
    pending_adjustment_id: row.pending_adjustment_id || null,
    ...ratesFromRow(row),
  };
}

/** Ensure a city row exists (seed on demand). */
export async function ensureCityPricingRow(cityKeyRaw?: string | null) {
  const cityKey = normalizeCityKey(cityKeyRaw);
  const supabase = getAdminClient();
  const { data: existing } = await supabase
    .from('city_pricing_config')
    .select('*')
    .eq('city_key', cityKey)
    .maybeSingle();

  if (existing) return configFromRow(existing);

  const defaults = defaultCityFareRates();
  const payload = {
    city_key: cityKey,
    city_label: cityLabelForKey(cityKey),
    ...toDbRateColumns(defaults),
    last_reason: 'Initial rates: ₦500/km + 6% service; complete trip = one-way × 2',
  };

  const { data: created, error } = await supabase
    .from('city_pricing_config')
    .upsert(payload, { onConflict: 'city_key' })
    .select('*')
    .maybeSingle();

  if (error && /rate_per_km/i.test(error.message)) {
    const { rate_per_km: _drop, ...withoutKm } = payload as any;
    const retry = await supabase
      .from('city_pricing_config')
      .upsert(withoutKm, { onConflict: 'city_key' })
      .select('*')
      .maybeSingle();
    if (retry.error) {
      console.warn('[city-pricing] ensure row notice:', retry.error.message);
      return {
        city_key: cityKey,
        city_label: cityLabelForKey(cityKey),
        version: 1,
        last_reason: 'Initial platform rates (fallback)',
        last_adjusted_at: null,
        last_adjusted_by: null,
        pending_rates: null,
        pending_effective_from: null,
        pending_reason: null,
        pending_adjustment_id: null,
        ...defaults,
      } as CityPricingConfig;
    }
    return configFromRow(retry.data);
  }

  if (error) {
    console.warn('[city-pricing] ensure row notice:', error.message);
    return {
      city_key: cityKey,
      city_label: cityLabelForKey(cityKey),
      version: 1,
      last_reason: 'Initial platform rates (fallback)',
      last_adjusted_at: null,
      last_adjusted_by: null,
      pending_rates: null,
      pending_effective_from: null,
      pending_reason: null,
      pending_adjustment_id: null,
      ...defaults,
    } as CityPricingConfig;
  }

  return configFromRow(created);
}

/**
 * Activate any pending effective_from rates whose time has arrived.
 * Returns the active (post-activation) config.
 */
export async function activateDuePendingRates(cityKeyRaw?: string | null): Promise<CityPricingConfig> {
  const cityKey = normalizeCityKey(cityKeyRaw);
  const config = await ensureCityPricingRow(cityKey);
  if (!config.pending_rates || !config.pending_effective_from) return config;

  const due = new Date(config.pending_effective_from).getTime() <= Date.now();
  if (!due) return config;

  const supabase = getAdminClient();
  const pending = config.pending_rates;
  const nextVersion = Number(config.version || 1) + 1;

  const { data: updated, error } = await supabase
    .from('city_pricing_config')
    .update({
      ...toDbRateColumns(pending),
      version: nextVersion,
      last_reason: config.pending_reason || 'Scheduled rate change activated',
      last_adjusted_at: nowUtcIso(),
      pending_rates: null,
      pending_effective_from: null,
      pending_reason: null,
      pending_adjustment_id: null,
      updated_at: nowUtcIso(),
    })
    .eq('city_key', cityKey)
    .select('*')
    .maybeSingle();

  if (config.pending_adjustment_id) {
    try {
      await supabase
        .from('city_pricing_adjustments')
        .update({ status: 'activated', version_after: nextVersion })
        .eq('id', config.pending_adjustment_id);
    } catch (err) {
      console.warn('[city-pricing] activate adjustment notice:', err);
    }
  }

  if (error) {
    console.warn('[city-pricing] activate pending notice:', error.message);
    return config;
  }

  return configFromRow(updated);
}

/** Active rates for a city (activates due pending schedules first). */
export async function getActiveCityPricing(cityKeyRaw?: string | null): Promise<CityPricingConfig> {
  return activateDuePendingRates(cityKeyRaw);
}

export async function listCityPricingHistory(cityKeyRaw?: string | null, limit = 20) {
  const cityKey = normalizeCityKey(cityKeyRaw);
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('city_pricing_adjustments')
    .select('*')
    .eq('city_key', cityKey)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('[city-pricing] history notice:', error.message);
    return [];
  }
  return data || [];
}

export async function listActivePricingNotices(cityKeyRaw?: string | null, limit = 10) {
  const cityKey = normalizeCityKey(cityKeyRaw);
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('city_pricing_notices')
    .select('*')
    .eq('city_key', cityKey)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('[city-pricing] notices notice:', error.message);
    return [];
  }

  const now = Date.now();
  return (data || []).filter((n: any) => {
    if (!n.expires_at) return true;
    return new Date(n.expires_at).getTime() > now;
  });
}

export type PublishPricingInput = {
  cityKey: string;
  rates: Partial<CityFareRates>;
  reason: string;
  effectiveMode: EffectiveMode;
  effectiveFrom?: string | null;
  authorUserId?: string | null;
  authorName?: string | null;
  rewriteStored?: boolean;
};

export type PublishPricingResult = {
  success: boolean;
  config?: CityPricingConfig;
  adjustment?: any;
  rewrite_count?: number;
  notification_count?: number;
  error?: string;
};

function mergeRates(base: CityFareRates, patch: Partial<CityFareRates>): CityFareRates {
  const ratePerKm = Number(
    patch.rate_per_km ?? patch.rate_per_half_km ?? base.rate_per_km ?? RATE_PER_KM
  );
  return {
    rate_per_km: ratePerKm,
    rate_per_half_km: ratePerKm,
    rate_per_tenth_km: Number(patch.rate_per_tenth_km ?? 0),
    service_charge_percent: Number(patch.service_charge_percent ?? base.service_charge_percent),
    shared_ride_base_fare_round: Number(patch.shared_ride_base_fare_round ?? base.shared_ride_base_fare_round),
    shared_ride_base_fare_single: Number(patch.shared_ride_base_fare_single ?? base.shared_ride_base_fare_single),
    shared_ride_service_fee: Number(patch.shared_ride_service_fee ?? base.shared_ride_service_fee),
    currency: String(patch.currency || base.currency || 'NGN'),
  };
}

/**
 * Rewrite stored base fares on active bookings/assignments for schools in this city.
 * Preserves student discount overlays (fare_correction) by rebasing originalFare.
 */
export async function rewriteStoredFaresForCity(
  cityKey: string,
  newRates: CityFareRates
): Promise<number> {
  const supabase = getAdminClient();
  const { calculateEscortFare, parseEscortNotes } = await import('@/lib/escort/escort-pricing');

  // Scope: all active escort assignments (city is operational jurisdiction; schools aren't keyed by city_key yet)
  const { data: assignments } = await supabase
    .from('escort_assignments')
    .select('id, notes, booking_id, student_id, status')
    .in('status', ['active', 'pending_confirmation', 'pending'])
    .limit(500);

  let rewritten = 0;
  for (const row of assignments || []) {
    try {
      const notes = parseEscortNotes(row.notes);
      const distanceKm = Number(notes.distance_km || notes.fareResult?.billableKm || 4.2) || 4.2;
      const tripType =
        notes.trip_type === 'morning_only' || notes.trip_type === 'afternoon_only'
          ? notes.trip_type
          : 'both';
      const engine = calculateEscortFare(distanceKm, tripType, newRates);
      const correction = notes.fare_correction || notes.discount || null;
      const nextNotes = { ...notes };
      nextNotes.daily_fare = engine.dailyFare;
      nextNotes.morning_fare = engine.morningFare;
      nextNotes.afternoon_fare = engine.afternoonFare;
      nextNotes.fareResult = {
        ...(notes.fareResult || {}),
        dailyFare: correction?.discountedFare != null ? Number(correction.discountedFare) : engine.dailyFare,
        morningFare: engine.morningFare,
        afternoonFare: engine.afternoonFare,
        originalDailyFare: engine.dailyFare,
        billableKm: engine.billableKm,
        distanceCharge: engine.distanceCharge,
        serviceCharge: engine.serviceCharge,
        ratePerKm: newRates.rate_per_km,
        ratePerHalfKm: newRates.rate_per_km,
        ratePerTenthKm: 0,
        serviceChargePercent: newRates.service_charge_percent,
        city_rate_rebase_at: nowUtcIso(),
        city_key: cityKey,
        formula: 'one_way = base + service%; complete = one_way × 2; base = ₦/km × ceil(km)',
      };
      if (correction) {
        nextNotes.fare_correction = {
          ...correction,
          originalFare: engine.dailyFare,
        };
        if (notes.discount) {
          nextNotes.discount = {
            ...notes.discount,
            originalFare: engine.dailyFare,
          };
        }
      }

      const { error } = await supabase
        .from('escort_assignments')
        .update({ notes: JSON.stringify(nextNotes) })
        .eq('id', row.id);
      if (!error) rewritten += 1;

      if (row.booking_id) {
        const { data: booking } = await supabase
          .from('transport_bookings')
          .select('id, notes, fare_amount')
          .eq('id', row.booking_id)
          .maybeSingle();
        if (booking?.id) {
          const bNotes = parseEscortNotes(booking.notes);
          const merged = {
            ...bNotes,
            ...nextNotes,
            security_pin: bNotes.security_pin,
            security_pin_date: bNotes.security_pin_date,
            retired_security_pins: bNotes.retired_security_pins,
          };
          const dailyStored =
            correction?.discountedFare != null ? Number(correction.discountedFare) : engine.dailyFare;
          await supabase
            .from('transport_bookings')
            .update({ notes: JSON.stringify(merged), fare_amount: dailyStored })
            .eq('id', booking.id);
        }
      }
    } catch (err) {
      console.warn('[city-pricing] rewrite row notice:', err);
    }
  }

  return rewritten;
}

/** Fan-out in-app notifications + city pricing banner notice. */
export async function broadcastCityPricingChange(opts: {
  cityKey: string;
  cityLabel: string;
  reason: string;
  ratesAfter: CityFareRates;
  ratesBefore: CityFareRates;
  effectiveMode: EffectiveMode;
  effectiveFrom?: string | null;
  adjustmentId: string;
  authorUserId?: string | null;
}): Promise<{ notification_count: number; notice_id: string | null }> {
  const supabase = getAdminClient();

  const title =
    opts.effectiveMode === 'effective_from' && opts.effectiveFrom
      ? `City fare update scheduled (${opts.cityLabel})`
      : `City fare update — ${opts.cityLabel}`;

  const whenText =
    opts.effectiveMode === 'effective_from' && opts.effectiveFrom
      ? `Effective from ${new Date(opts.effectiveFrom).toLocaleString('en-NG')}.`
      : opts.effectiveMode === 'rewrite_stored'
        ? 'Effective immediately; active trip base fares were recalculated (personal discounts kept).'
        : 'Effective immediately for new quotes.';

  const summary = `₦${opts.ratesAfter.rate_per_km}/km (was ₦${opts.ratesBefore.rate_per_km}/km) + ${opts.ratesAfter.service_charge_percent}% service. One-way = base + service; complete trip = one-way × 2.`;
  const message = `${opts.reason}\n\n${whenText}\n${summary}`;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14);

  let noticeId: string | null = null;
  try {
    const { data: notice } = await supabase
      .from('city_pricing_notices')
      .insert({
        city_key: opts.cityKey,
        adjustment_id: opts.adjustmentId,
        title,
        message,
        target_audiences: ['parents', 'school_admin', 'escorts'],
        effective_mode: opts.effectiveMode,
        effective_from: opts.effectiveFrom || null,
        rates_summary: {
          before: opts.ratesBefore,
          after: opts.ratesAfter,
        },
        is_active: true,
        expires_at: expiresAt.toISOString(),
        created_by: opts.authorUserId || null,
      })
      .select('id')
      .maybeSingle();
    noticeId = notice?.id || null;
  } catch (err) {
    console.warn('[city-pricing] notice insert notice:', err);
  }

  // Also mirror into school_notices for banner components already wired to that table
  try {
    const { data: schools } = await supabase.from('schools').select('id').limit(200);
    for (const school of schools || []) {
      await supabase.from('school_notices').insert({
        school_id: school.id,
        sender_user_id: opts.authorUserId || null,
        title,
        message,
        category: 'pricing',
        target_audiences: ['parents', 'escorts', 'teachers'],
        send_email: false,
      });
    }
  } catch (err) {
    console.warn('[city-pricing] school_notices fan-out notice:', err);
  }

  // Notify parents with active escort bookings + school admins + escorts
  let notificationCount = 0;
  try {
    const { data: liveAssigns } = await supabase
      .from('escort_assignments')
      .select('student_id, escort_application_id, school_id')
      .in('status', ['active', 'pending_confirmation', 'pending'])
      .limit(800);

    const studentIds = Array.from(new Set((liveAssigns || []).map((a) => a.student_id).filter(Boolean)));
    const schoolIds = Array.from(new Set((liveAssigns || []).map((a) => a.school_id).filter(Boolean)));
    const escortAppIds = Array.from(
      new Set((liveAssigns || []).map((a) => a.escort_application_id).filter(Boolean))
    );

    const parentIds = new Set<string>();
    if (studentIds.length > 0) {
      const { data: links } = await supabase
        .from('student_parents')
        .select('parent_user_id, student_id')
        .in('student_id', studentIds);
      for (const link of links || []) {
        if (link.parent_user_id) parentIds.add(link.parent_user_id);
      }
    }

    const adminIds = new Set<string>();
    if (schoolIds.length > 0) {
      const { data: adminRoles } = await supabase
        .from('user_school_roles')
        .select('user_id, school_id')
        .in('school_id', schoolIds)
        .eq('role', 'school_admin')
        .eq('is_active', true);
      for (const r of adminRoles || []) {
        if (r.user_id) adminIds.add(r.user_id);
      }
    }

    const escortUserIds = new Set<string>();
    if (escortAppIds.length > 0) {
      const { data: escorts } = await supabase
        .from('escort_applications')
        .select('id, user_id')
        .in('id', escortAppIds);
      for (const e of escorts || []) {
        if (e.user_id) escortUserIds.add(e.user_id);
      }
    }

    const recipients: { user_id: string; school_id: string | null }[] = [];
    const schoolForStudent = new Map(
      (liveAssigns || []).map((a) => [a.student_id, a.school_id || null])
    );

    if (studentIds.length > 0) {
      const { data: links } = await supabase
        .from('student_parents')
        .select('parent_user_id, student_id')
        .in('student_id', studentIds);
      for (const link of links || []) {
        if (!link.parent_user_id) continue;
        recipients.push({
          user_id: link.parent_user_id,
          school_id: schoolForStudent.get(link.student_id) || schoolIds[0] || null,
        });
      }
    }

    for (const uid of adminIds) {
      recipients.push({ user_id: uid, school_id: schoolIds[0] || null });
    }
    for (const uid of escortUserIds) {
      recipients.push({ user_id: uid, school_id: schoolIds[0] || null });
    }

    // Deduplicate by user_id
    const seen = new Set<string>();
    const unique = recipients.filter((r) => {
      if (seen.has(r.user_id)) return false;
      seen.add(r.user_id);
      return true;
    });

    // notifications.school_id is NOT NULL — skip users without a school
    const rows = unique
      .filter((r) => r.school_id)
      .slice(0, 500)
      .map((r) => ({
        user_id: r.user_id,
        school_id: r.school_id,
        title,
        message,
        type: 'system',
        is_read: false,
      }));

    if (rows.length > 0) {
      const chunk = 100;
      for (let i = 0; i < rows.length; i += chunk) {
        const slice = rows.slice(i, i + chunk);
        const { error } = await supabase.from('notifications').insert(slice);
        if (!error) notificationCount += slice.length;
        else console.warn('[city-pricing] notifications insert notice:', error.message);
      }
    }
  } catch (err) {
    console.warn('[city-pricing] broadcast recipients notice:', err);
  }

  return { notification_count: notificationCount, notice_id: noticeId };
}

export async function publishCityPricing(input: PublishPricingInput): Promise<PublishPricingResult> {
  const reason = String(input.reason || '').trim();
  if (!reason) return { success: false, error: 'Reason for the price adjustment is required' };

  const cityKey = normalizeCityKey(input.cityKey);
  const current = await getActiveCityPricing(cityKey);
  const ratesBefore: CityFareRates = {
    rate_per_km: current.rate_per_km,
    rate_per_half_km: current.rate_per_km,
    rate_per_tenth_km: current.rate_per_tenth_km,
    service_charge_percent: current.service_charge_percent,
    shared_ride_base_fare_round: current.shared_ride_base_fare_round,
    shared_ride_base_fare_single: current.shared_ride_base_fare_single,
    shared_ride_service_fee: current.shared_ride_service_fee,
    currency: current.currency,
  };
  const ratesAfter = mergeRates(ratesBefore, input.rates);

  for (const [label, val] of Object.entries(ratesAfter)) {
    if (label === 'currency') continue;
    if (typeof val === 'number' && (!Number.isFinite(val) || val < 0)) {
      return { success: false, error: `Invalid rate value for ${label}` };
    }
  }

  const mode = input.effectiveMode;
  if (mode === 'effective_from') {
    const from = input.effectiveFrom ? new Date(input.effectiveFrom) : null;
    if (!from || Number.isNaN(from.getTime()) || from.getTime() <= Date.now()) {
      return { success: false, error: 'effective_from must be a future date/time' };
    }
  }

  const supabase = getAdminClient();
  const cityLabel = current.city_label || cityLabelForKey(cityKey);

  const { data: adjustment, error: adjErr } = await supabase
    .from('city_pricing_adjustments')
    .insert({
      city_key: cityKey,
      city_label: cityLabel,
      effective_mode: mode,
      effective_from: mode === 'effective_from' ? input.effectiveFrom : nowUtcIso(),
      reason,
      currency: ratesAfter.currency,
      rates_before: ratesBefore,
      rates_after: ratesAfter,
      version_before: current.version,
      version_after: mode === 'effective_from' ? current.version : current.version + 1,
      author_user_id: input.authorUserId || null,
      author_name: input.authorName || null,
      status: mode === 'effective_from' ? 'scheduled' : 'applied',
    })
    .select('*')
    .maybeSingle();

  if (adjErr || !adjustment) {
    return { success: false, error: adjErr?.message || 'Could not save adjustment history' };
  }

  let rewriteCount = 0;
  let nextConfig: CityPricingConfig = current;

  if (mode === 'effective_from') {
    const { data: updated, error } = await supabase
      .from('city_pricing_config')
      .update({
        pending_rates: ratesAfter,
        pending_effective_from: input.effectiveFrom,
        pending_reason: reason,
        pending_adjustment_id: adjustment.id,
        updated_at: nowUtcIso(),
      })
      .eq('city_key', cityKey)
      .select('*')
      .maybeSingle();
    if (error) return { success: false, error: error.message };
    nextConfig = configFromRow(updated);
  } else {
    const nextVersion = current.version + 1;
    const dbRates = toDbRateColumns(ratesAfter);
    let { data: updated, error } = await supabase
      .from('city_pricing_config')
      .update({
        ...dbRates,
        version: nextVersion,
        last_reason: reason,
        last_adjusted_at: nowUtcIso(),
        last_adjusted_by: input.authorUserId || null,
        pending_rates: null,
        pending_effective_from: null,
        pending_reason: null,
        pending_adjustment_id: null,
        updated_at: nowUtcIso(),
      })
      .eq('city_key', cityKey)
      .select('*')
      .maybeSingle();
    if (error && /rate_per_km/i.test(error.message)) {
      const { rate_per_km: _drop, ...withoutKm } = dbRates as any;
      const retry = await supabase
        .from('city_pricing_config')
        .update({
          ...withoutKm,
          version: nextVersion,
          last_reason: reason,
          last_adjusted_at: nowUtcIso(),
          last_adjusted_by: input.authorUserId || null,
          pending_rates: null,
          pending_effective_from: null,
          pending_reason: null,
          pending_adjustment_id: null,
          updated_at: nowUtcIso(),
        })
        .eq('city_key', cityKey)
        .select('*')
        .maybeSingle();
      updated = retry.data;
      error = retry.error;
    }
    if (error) return { success: false, error: error.message };
    nextConfig = configFromRow(updated);

    if (mode === 'rewrite_stored') {
      rewriteCount = await rewriteStoredFaresForCity(cityKey, ratesAfter);
    }
  }

  const broadcast = await broadcastCityPricingChange({
    cityKey,
    cityLabel,
    reason,
    ratesAfter,
    ratesBefore,
    effectiveMode: mode,
    effectiveFrom: input.effectiveFrom,
    adjustmentId: adjustment.id,
    authorUserId: input.authorUserId,
  });

  await supabase
    .from('city_pricing_adjustments')
    .update({
      rewrite_count: rewriteCount,
      notification_count: broadcast.notification_count,
      notice_ids: broadcast.notice_id ? [broadcast.notice_id] : [],
      audience_snapshot: {
        notifications: broadcast.notification_count,
        rewrite_count: rewriteCount,
      },
    })
    .eq('id', adjustment.id);

  try {
    await supabase.from('city_manager_audit_log').insert({
      actor_user_id: input.authorUserId || null,
      action: 'CITY_PRICING_ADJUSTED',
      entity_type: 'city_pricing_config',
      entity_id: nextConfig.id || cityKey,
      details: {
        city_key: cityKey,
        mode,
        reason,
        rates_before: ratesBefore,
        rates_after: ratesAfter,
        rewrite_count: rewriteCount,
        notification_count: broadcast.notification_count,
      },
    });
  } catch (err) {
    console.warn('[city-pricing] audit notice:', err);
  }

  return {
    success: true,
    config: nextConfig,
    adjustment,
    rewrite_count: rewriteCount,
    notification_count: broadcast.notification_count,
  };
}
