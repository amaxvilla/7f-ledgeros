import * as crypto from 'crypto';

/**
 * Release ID.2 Part 2 — WhatsApp Cloud API webhook signature verification.
 *
 * Verifies the `X-Hub-Signature-256` header Meta sends on every webhook
 * callback. Per Meta's documented algorithm this is computed over the
 * EXACT raw request body bytes (not re-serialized params, unlike Twilio's
 * form-encoded scheme in twilio-signature.util.ts) — HMAC-SHA256 keyed on
 * the WhatsApp Business App's App Secret, hex-encoded, prefixed
 * "sha256=". This is why the WhatsApp webhook controller reads
 * `req.rawBody` (see main.ts's `rawBody: true` bootstrap option) instead
 * of the parsed JSON body: re-serializing the parsed object would not
 * reliably reproduce the exact bytes Meta signed (key order, spacing).
 */
export function verifyMetaSignature(
  appSecret: string,
  rawBody: Buffer | undefined,
  signatureHeader: string | undefined,
): boolean {
  if (!signatureHeader || !rawBody) return false;

  const separatorIndex = signatureHeader.indexOf('=');
  if (separatorIndex === -1) return false;
  const algo = signatureHeader.slice(0, separatorIndex);
  const providedHex = signatureHeader.slice(separatorIndex + 1);
  if (algo !== 'sha256' || !providedHex) return false;

  const expectedHex = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');

  // Constant-time comparison — this is a security check, not just an
  // equality test, so avoid short-circuiting on the first differing byte.
  const expectedBuf = Buffer.from(expectedHex, 'utf-8');
  const providedBuf = Buffer.from(providedHex, 'utf-8');
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}
