export type EscortTripType = 'both' | 'morning_only' | 'afternoon_only';

export function normalizeEscortTripType(raw: unknown): EscortTripType {
  const value = String(raw || '').trim().toLowerCase();
  if (value === 'morning_only' || value === 'morning') return 'morning_only';
  if (value === 'afternoon_only' || value === 'afternoon') return 'afternoon_only';
  return 'both';
}
