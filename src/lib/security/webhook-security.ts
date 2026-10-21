import crypto from 'crypto';

/**
 * Known SeerBit production webhook egress IP addresses and CIDR subnets.
 * Can be augmented or overridden via SEERBIT_WEBHOOK_IP_ALLOWLIST env var.
 */
export const SEERBIT_PRODUCTION_IPS = [
  '102.164.214.0/24',
  '52.208.200.0/24',
  '54.216.0.0/16',
  '102.164.214.15',
  '52.208.200.222',
  '54.216.14.88',
];

export const PRIVATE_DEV_IPS = [
  '127.0.0.1',
  '::1',
  '::ffff:127.0.0.1',
  'localhost',
];

/**
 * Validates incoming SeerBit webhook signature using constant-time comparison
 * to eliminate timing-attack side-channel vulnerabilities (Phase 6.2).
 */
export function verifySeerbitWebhookSignature(
  rawBody: string,
  incomingSignature: string | null | undefined,
  secrets: string | string[]
): boolean {
  if (!incomingSignature || !rawBody || !secrets) return false;

  const secretList = Array.isArray(secrets) ? secrets : [secrets];
  const cleanIncoming = incomingSignature.trim().toLowerCase();

  for (const secretKey of secretList) {
    if (!secretKey) continue;
    try {
      // 1. Compute HMAC-SHA512 (SeerBit standard webhook signature)
      const computedHmac512 = crypto
        .createHmac('sha512', secretKey)
        .update(rawBody, 'utf8')
        .digest('hex');

      // Constant-time check against SHA512
      if (cleanIncoming.length === computedHmac512.length) {
        const incomingBuf = Buffer.from(cleanIncoming, 'hex');
        const computedBuf = Buffer.from(computedHmac512, 'hex');
        if (incomingBuf.length === computedBuf.length && crypto.timingSafeEqual(incomingBuf, computedBuf)) {
          return true;
        }
      }

      // 2. Also compute HMAC-SHA256 in case provider configured SHA256 key
      const computedHmac256 = crypto
        .createHmac('sha256', secretKey)
        .update(rawBody, 'utf8')
        .digest('hex');

      // Constant-time check against SHA256
      if (cleanIncoming.length === computedHmac256.length) {
        const incomingBuf = Buffer.from(cleanIncoming, 'hex');
        const computedBuf = Buffer.from(computedHmac256, 'hex');
        if (incomingBuf.length === computedBuf.length && crypto.timingSafeEqual(incomingBuf, computedBuf)) {
          return true;
        }
      }
    } catch (err) {
      console.error('[WebhookSecurity] Signature verification error:', err);
    }
  }

  return false;
}

/**
 * Checks if incoming webhook timestamp is within allowable skew (default 5 minutes)
 * to prevent replay attacks (Phase 6.2).
 */
export function isTimestampSkewValid(
  timestamp: string | number | undefined,
  maxSkewMinutes = 5
): boolean {
  if (!timestamp) return true; // If provider doesn't send timestamp header, bypass
  try {
    const epochMs = typeof timestamp === 'number'
      ? (timestamp > 1e11 ? timestamp : timestamp * 1000)
      : new Date(timestamp).getTime();

    if (isNaN(epochMs)) return true;
    const diffMs = Math.abs(Date.now() - epochMs);
    return diffMs <= maxSkewMinutes * 60 * 1000;
  } catch {
    return true;
  }
}

/**
 * Validates if the requesting client IP matches SeerBit production or trusted dev endpoints.
 */
export function isSeerbitIpAllowed(clientIp?: string | null): boolean {
  if (!clientIp) return false;
  const cleanIp = clientIp.trim().toLowerCase().replace(/^::ffff:/, '');

  // Local development / private subnet bypass
  if (process.env.NODE_ENV !== 'production') {
    if (
      cleanIp === '127.0.0.1' ||
      cleanIp === '::1' ||
      cleanIp === 'localhost' ||
      cleanIp.startsWith('192.168.') ||
      cleanIp.startsWith('10.') ||
      cleanIp.startsWith('172.')
    ) {
      return true;
    }
  }

  // Check custom environment allowlist if configured
  const envAllowlist = process.env.SEERBIT_WEBHOOK_IP_ALLOWLIST;
  if (envAllowlist) {
    const allowedList = envAllowlist.split(',').map((ip) => ip.trim().toLowerCase());
    if (allowedList.includes(cleanIp)) return true;
  }

  // Check production IP list
  for (const entry of SEERBIT_PRODUCTION_IPS) {
    if (entry.includes('/')) {
      // Subnet check (simple prefix match for /24 or /16)
      const [subnetPrefix, mask] = entry.split('/');
      if (mask === '24') {
        const prefix = subnetPrefix.split('.').slice(0, 3).join('.');
        if (cleanIp.startsWith(`${prefix}.`)) return true;
      } else if (mask === '16') {
        const prefix = subnetPrefix.split('.').slice(0, 2).join('.');
        if (cleanIp.startsWith(`${prefix}.`)) return true;
      }
    } else {
      if (cleanIp === entry.toLowerCase()) return true;
    }
  }

  return false;
}

/**
 * Generates deterministic SHA-256 fingerprint of payload for duplicate detection
 */
export function computePayloadHash(payload: string | object): string {
  const str = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return crypto.createHash('sha256').update(str).digest('hex');
}
