/**
 * STANDARDIZED CRYPTOGRAPHIC RECEIPT ENGINE
 * 
 * Provides deterministic, cryptographically signed receipts for all wallet deposits:
 * 1. Generates human-readable, auditable Receipt Numbers (REC-YYYYMMDD-XXXX).
 * 2. Formats timestamps in Africa/Lagos timezone (dd MMM yyyy, hh:mm A).
 * 3. Calculates statutory Nigerian VAT (7.5%) breakdown (Net + VAT = Total).
 * 4. Normalizes payment channels to user-friendly payment method descriptions.
 * 5. Computes a tamper-proof SHA-256 HMAC signature over canonical payload fields.
 * 6. Verifies HMAC authenticity to protect against receipt forgery.
 */

import crypto from 'crypto';

export interface ReceiptData {
  receiptNumber: string; // REC-YYYYMMDD-XXXX
  transactionReference: string; // MYEDU-DEP-... or MYEDU-SCH-...
  gatewayReference: string; // SeerBit or gateway reference
  entityType: 'PARENT' | 'SCHOOL' | 'ESCORT';
  entityName: string; // Parent Full Name / School Name
  userEmail: string;
  userPhone?: string;
  currency: 'NGN';
  netAmountNgn: number; // Excluding VAT (7.5%)
  vatAmountNgn: number; // Statutory 7.5% VAT
  totalAmountNgn: number; // Net + VAT
  balanceAfterNgn?: number;
  paymentMethod: string; // e.g., 'Card Checkout', 'Virtual Account Transfer'
  timestamp: string; // e.g., "15 Oct 2026, 08:30 AM" in Africa/Lagos
  rawTimestamp: string; // ISO 8601 string
  hmacSignature: string; // SHA-256 HMAC hex digest
  status: 'SUCCESS' | 'CREDITED';
  description?: string;
}

export interface GenerateReceiptInput {
  transactionReference: string;
  gatewayReference?: string;
  entityType?: 'PARENT' | 'SCHOOL' | 'ESCORT';
  entityName: string;
  userEmail: string;
  userPhone?: string;
  amountNgn?: number;
  amountKobo?: number;
  balanceAfterNgn?: number;
  balanceAfterKobo?: number;
  paymentChannel?: string;
  timestamp?: string | Date;
  description?: string;
  customReceiptNumber?: string;
}

/**
 * Get the secret key used for HMAC signing
 */
function getSigningSecret(): string {
  return (
    process.env.RECEIPT_SIGNING_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SEERBIT_SECRET_KEY ||
    'myeduride-receipt-hmac-integrity-key-production-vault'
  );
}

/**
 * Normalizes payment channel identifiers to clean, user-friendly labels.
 */
export function normalizePaymentMethod(channel?: string): string {
  if (!channel) return 'Card Checkout';
  const c = channel.toUpperCase().trim();

  if (c.includes('CARD')) return 'Card Checkout';
  if (c.includes('TRANSFER') || c.includes('ACCOUNT') || c.includes('VIRTUAL')) {
    return 'Virtual Account Transfer';
  }
  if (c.includes('USSD')) return 'USSD Banking';
  if (c.includes('QR')) return 'QR Code Payment';
  if (c.includes('SEERBIT')) return 'Card / Bank Checkout';
  if (c.includes('WALLET_TRANSFER') || c.includes('SYSTEM')) return 'Internal Wallet Credit';

  return 'Card Checkout';
}

/**
 * Format date in Africa/Lagos timezone (dd MMM yyyy, hh:mm A)
 */
export function formatLagosTimestamp(dateInput?: string | Date): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) {
    return formatLagosTimestamp(new Date());
  }

  // Format using Intl in Africa/Lagos timezone
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const parts = formatter.formatToParts(d);
  const partMap: Record<string, string> = {};
  for (const part of parts) {
    partMap[part.type] = part.value;
  }

  const day = partMap.day || '01';
  const month = partMap.month || 'Jan';
  const year = partMap.year || '2026';
  const hour = partMap.hour || '12';
  const minute = partMap.minute || '00';
  const dayPeriod = (partMap.dayPeriod || 'AM').toUpperCase();

  return `${day} ${month} ${year}, ${hour}:${minute} ${dayPeriod}`;
}

/**
 * Calculate statutory Nigerian VAT (7.5%) and net amount.
 * For an inclusive total deposit T:
 * Net = Round(T / 1.075, 2)
 * VAT = Round(T - Net, 2)
 */
export function calculateVatBreakdown(totalAmountNgn: number): {
  netAmountNgn: number;
  vatAmountNgn: number;
  totalAmountNgn: number;
} {
  const total = Math.max(0, Math.round(totalAmountNgn * 100) / 100);
  const net = Math.round((total / 1.075) * 100) / 100;
  const vat = Math.round((total - net) * 100) / 100;

  return {
    netAmountNgn: net,
    vatAmountNgn: vat,
    totalAmountNgn: total,
  };
}

/**
 * Formats a deterministic Receipt Number: REC-YYYYMMDD-XXXX
 */
export function generateReceiptNumber(timestamp?: string | Date, reference?: string): string {
  const d = timestamp ? new Date(timestamp) : new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  let suffix = '';
  if (reference) {
    // Generate deterministic 4-character uppercase alphanumeric from hash of reference
    const hash = crypto.createHash('sha256').update(reference).digest('hex').toUpperCase();
    suffix = hash.slice(0, 4);
  } else {
    suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  }

  return `REC-${dateStr}-${suffix}`;
}

/**
 * Build canonical string for HMAC computation:
 * receiptNumber|transactionReference|gatewayReference|totalAmountNgn|userEmail|rawTimestamp
 */
export function buildCanonicalReceiptString(payload: {
  receiptNumber: string;
  transactionReference: string;
  gatewayReference: string;
  totalAmountNgn: number;
  userEmail: string;
  rawTimestamp: string;
}): string {
  return [
    payload.receiptNumber.trim(),
    payload.transactionReference.trim(),
    (payload.gatewayReference || '').trim(),
    payload.totalAmountNgn.toFixed(2),
    payload.userEmail.trim().toLowerCase(),
    payload.rawTimestamp.trim(),
  ].join('|');
}

/**
 * Compute SHA-256 HMAC verification hash over canonical receipt payload.
 */
export function computeReceiptHmac(payload: {
  receiptNumber: string;
  transactionReference: string;
  gatewayReference: string;
  totalAmountNgn: number;
  userEmail: string;
  rawTimestamp: string;
}): string {
  const secret = getSigningSecret();
  const canonical = buildCanonicalReceiptString(payload);
  return crypto.createHmac('sha256', secret).update(canonical).digest('hex');
}

/**
 * Verifies the authenticity of a receipt against tampering using timing-safe comparison.
 */
export function verifyReceiptHmac(receipt: ReceiptData): boolean {
  if (!receipt.hmacSignature) return false;

  try {
    const computed = computeReceiptHmac({
      receiptNumber: receipt.receiptNumber,
      transactionReference: receipt.transactionReference,
      gatewayReference: receipt.gatewayReference,
      totalAmountNgn: receipt.totalAmountNgn,
      userEmail: receipt.userEmail,
      rawTimestamp: receipt.rawTimestamp,
    });

    const sigBuffer = Buffer.from(receipt.hmacSignature, 'hex');
    const computedBuffer = Buffer.from(computed, 'hex');

    if (sigBuffer.length !== computedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuffer, computedBuffer);
  } catch {
    return false;
  }
}

/**
 * Master Generator: Produces a fully formed, cryptographically signed ReceiptData record.
 */
export function generateReceipt(input: GenerateReceiptInput): ReceiptData {
  const d = input.timestamp ? new Date(input.timestamp) : new Date();
  const rawTimestamp = d.toISOString();
  const formattedTimestamp = formatLagosTimestamp(d);

  // Derive total NGN
  let totalAmountNgn = 0;
  if (typeof input.amountNgn === 'number') {
    totalAmountNgn = input.amountNgn;
  } else if (typeof input.amountKobo === 'number') {
    totalAmountNgn = input.amountKobo / 100;
  }

  const { netAmountNgn, vatAmountNgn } = calculateVatBreakdown(totalAmountNgn);

  // Derive balance after NGN if provided
  let balanceAfterNgn: number | undefined = undefined;
  if (typeof input.balanceAfterNgn === 'number') {
    balanceAfterNgn = input.balanceAfterNgn;
  } else if (typeof input.balanceAfterKobo === 'number') {
    balanceAfterNgn = input.balanceAfterKobo / 100;
  }

  const receiptNumber =
    input.customReceiptNumber || generateReceiptNumber(d, input.transactionReference);

  const gatewayReference = input.gatewayReference || input.transactionReference;
  const userEmail = input.userEmail.trim().toLowerCase();

  const hmacSignature = computeReceiptHmac({
    receiptNumber,
    transactionReference: input.transactionReference,
    gatewayReference,
    totalAmountNgn,
    userEmail,
    rawTimestamp,
  });

  return {
    receiptNumber,
    transactionReference: input.transactionReference,
    gatewayReference,
    entityType: input.entityType || 'PARENT',
    entityName: input.entityName.trim(),
    userEmail,
    userPhone: input.userPhone?.trim(),
    currency: 'NGN',
    netAmountNgn,
    vatAmountNgn,
    totalAmountNgn,
    balanceAfterNgn,
    paymentMethod: normalizePaymentMethod(input.paymentChannel),
    timestamp: formattedTimestamp,
    rawTimestamp,
    hmacSignature,
    status: 'SUCCESS',
    description: input.description || 'Wallet Deposit Credit (Safe Shuttle & Gate Access)',
  };
}

/**
 * Adapter to build a standardized ReceiptData object from a raw database transaction row
 * and optional fallback entity details.
 */
export function buildReceiptFromTransaction(
  tx: any,
  fallbackEntity?: {
    name?: string;
    email?: string;
    phone?: string;
    entityType?: 'PARENT' | 'SCHOOL' | 'ESCORT';
  }
): ReceiptData {
  // If transaction already contains cached receipt in metadata, return it
  if (tx?.metadata?.receipt && typeof tx.metadata.receipt === 'object') {
    const cached = tx.metadata.receipt;
    if (cached.receiptNumber && cached.hmacSignature) {
      return cached as ReceiptData;
    }
  }

  const ref = tx.reference || tx.id || `TX-${Date.now()}`;
  const gatewayRef =
    tx.metadata?.seerbit_reference ||
    tx.metadata?.gateway_reference ||
    tx.seerbit_reference ||
    ref;

  const totalNgn =
    typeof tx.amount_ngn === 'number'
      ? tx.amount_ngn
      : typeof tx.amount_kobo === 'number'
      ? tx.amount_kobo / 100
      : 0;

  const balanceAfterNgn =
    typeof tx.balance_after_ngn === 'number'
      ? tx.balance_after_ngn
      : typeof tx.balance_after_kobo === 'number'
      ? tx.balance_after_kobo / 100
      : undefined;

  const entityName =
    tx.metadata?.parent_name ||
    tx.metadata?.school_name ||
    tx.metadata?.entity_name ||
    fallbackEntity?.name ||
    'Valued Customer';

  const userEmail =
    tx.metadata?.parent_email ||
    tx.metadata?.admin_email ||
    tx.metadata?.user_email ||
    fallbackEntity?.email ||
    'billing@myeduride.com';

  const userPhone =
    tx.metadata?.parent_phone ||
    tx.metadata?.phone ||
    fallbackEntity?.phone;

  const entityType =
    fallbackEntity?.entityType ||
    (ref.startsWith('MYEDU-SCH-') || tx.metadata?.entity_type === 'school'
      ? 'SCHOOL'
      : ref.startsWith('MYEDU-ESC-') || tx.metadata?.entity_type === 'escort'
      ? 'ESCORT'
      : 'PARENT');

  return generateReceipt({
    transactionReference: ref,
    gatewayReference: gatewayRef,
    entityType,
    entityName,
    userEmail,
    userPhone,
    amountNgn: totalNgn,
    balanceAfterNgn,
    paymentChannel: tx.channel || tx.metadata?.channel_type || 'SEERBIT_CHECKOUT',
    timestamp: tx.created_at || new Date().toISOString(),
    description: tx.description || 'Wallet Deposit Credit',
  });
}
