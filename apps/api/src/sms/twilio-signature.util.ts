import * as crypto from 'crypto';

/**
 * Verifies the `X-Twilio-Signature` header on an incoming status-callback
 * webhook. Implemented directly with node:crypto rather than the `twilio`
 * npm SDK — same "one well-documented operation isn't worth a dependency"
 * call TwilioSmsService's own doc comment makes for sending.
 *
 * Per Twilio's documented algorithm: take the exact URL Twilio POSTed to,
 * append every POST parameter as `key + value` (no separator) sorted
 * alphabetically by key, HMAC-SHA1 the result with the account's auth
 * token, base64-encode, and compare to the header. `url` MUST be the
 * exact URL Twilio used to reach this endpoint (protocol + host +
 * path, no query string added or removed) — see the doc comment on
 * resolveWebhookUrl in twilio-webhook.controller.ts for how that's
 * obtained behind a reverse proxy, where re-deriving it from the request
 * is unreliable.
 */
export function verifyTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  signature: string | undefined,
): boolean {
  if (!signature) return false;

  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) {
    data += key + params[key];
  }

  const expected = crypto.createHmac('sha1', authToken).update(Buffer.from(data, 'utf-8')).digest('base64');

  // Constant-time comparison — this is a security check, not just an
  // equality test, so avoid short-circuiting on the first differing byte.
  const expectedBuf = Buffer.from(expected);
  const signatureBuf = Buffer.from(signature);
  if (expectedBuf.length !== signatureBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
}
