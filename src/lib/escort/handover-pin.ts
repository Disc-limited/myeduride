/** Extract the parent handover PIN from booking notes without removing other note fields. */
export function extractHandoverPin(notes: unknown): string | null {
  return readHandoverPinState(notes).pin;
}

export function normalizePin(value: unknown): string {
  return String(value || '').replace(/\D/g, '').slice(0, 6);
}

export function generateHandoverPin(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export type HandoverPinState = {
  pin: string | null;
  date: string | null;
  retired: string[];
};

function parseNotesObject(notes: unknown): { obj: Record<string, unknown> | null; raw: string } {
  if (notes && typeof notes === 'object' && !Array.isArray(notes)) {
    return { obj: { ...(notes as Record<string, unknown>) }, raw: JSON.stringify(notes) };
  }
  const raw = notes == null ? '' : String(notes);
  try {
    if (raw.trim().startsWith('{')) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { obj: parsed, raw };
      }
    }
  } catch {
    // Keep raw string notes
  }
  return { obj: null, raw };
}

export function readHandoverPinState(notes: unknown): HandoverPinState {
  const { obj, raw } = parseNotesObject(notes);
  const pinFromObj = obj ? normalizePin(obj.security_pin) : '';
  const dateFromObj = obj && typeof obj.security_pin_date === 'string' ? obj.security_pin_date : null;
  const retiredFromObj = Array.isArray(obj?.retired_security_pins)
    ? (obj.retired_security_pins as unknown[]).map((p) => normalizePin(p)).filter((p) => p.length >= 4)
    : [];

  const pinMatch = raw.match(/PIN:\s*(\d{4,6})/i);
  const dateMatch = raw.match(/PIN_DATE:\s*(\d{4}-\d{2}-\d{2})/i);
  const pin = (pinFromObj.length >= 4 ? pinFromObj : pinMatch?.[1] || null) as string | null;
  const date = dateFromObj || dateMatch?.[1] || null;

  return {
    pin,
    date,
    retired: retiredFromObj,
  };
}

/** Keep existing notes and add/overwrite only the handover PIN. */
export function attachHandoverPin(notes: unknown, pin: string, date?: string, retired?: string[]): string {
  const normalized = normalizePin(pin);
  if (normalized.length < 4) {
    return notes == null ? '' : typeof notes === 'object' ? JSON.stringify(notes) : String(notes);
  }

  const { obj, raw } = parseNotesObject(notes);
  const nextRetired = (retired || readHandoverPinState(notes).retired)
    .map((p) => normalizePin(p))
    .filter((p) => p.length >= 4)
    .slice(-60);

  if (obj) {
    obj.security_pin = normalized;
    if (date) obj.security_pin_date = date;
    obj.retired_security_pins = nextRetired;
    return JSON.stringify(obj);
  }

  let next = raw;
  if (/PIN:\s*\d{4,6}/i.test(next)) {
    next = next.replace(/PIN:\s*\d{4,6}/i, `PIN: ${normalized}`);
  } else {
    next = next ? `${next} | PIN: ${normalized}` : `PIN: ${normalized}`;
  }
  if (date) {
    if (/PIN_DATE:\s*\d{4}-\d{2}-\d{2}/i.test(next)) {
      next = next.replace(/PIN_DATE:\s*\d{4}-\d{2}-\d{2}/i, `PIN_DATE: ${date}`);
    } else {
      next = `${next} | PIN_DATE: ${date}`;
    }
  }
  return next;
}

/**
 * Issue a fresh 4-digit parent phone code for today.
 * Yesterday's code is retired and cannot be reused.
 */
export function ensureDailyHandoverPin(
  notes: unknown,
  today: string
): { notes: string; pin: string; date: string; rotated: boolean } {
  const state = readHandoverPinState(notes);
  if (state.pin && state.date === today) {
    const currentNotes = notes == null ? '' : typeof notes === 'object' ? JSON.stringify(notes) : String(notes);
    return { notes: currentNotes, pin: state.pin, date: today, rotated: false };
  }

  const retired = [...state.retired];
  if (state.pin && !retired.includes(state.pin)) {
    retired.push(state.pin);
  }

  const blocked = new Set(retired);
  let next = generateHandoverPin();
  let guard = 0;
  while (blocked.has(next) && guard < 80) {
    next = generateHandoverPin();
    guard += 1;
  }

  return {
    notes: attachHandoverPin(notes, next, today, retired.slice(-60)),
    pin: next,
    date: today,
    rotated: true,
  };
}

/** A parent phone code is valid only for the Lagos calendar day it was issued. */
export function isTodayHandoverPin(notes: unknown, enteredPin: string, today: string): boolean {
  const pin = normalizePin(enteredPin);
  if (pin.length < 4) return false;
  const state = readHandoverPinState(notes);
  if (state.retired.includes(pin)) return false;
  if (state.date !== today) return false;
  return state.pin === pin;
}
