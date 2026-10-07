import crypto from 'crypto';

/**
 * Validates incoming SeerBit webhook signature using constant-time comparison
 * to eliminate timing-attack side-channel vulnerabilities.
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
 * to prevent replay attacks.
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
 * Generates deterministic SHA-256 fingerprint of payload for duplicate detection
 */
export function computePayloadHash(payload: string | object): string {
  const str = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return crypto.createHash('sha256').update(str).digest('hex');
}
