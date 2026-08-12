/**
 * Resolves the JWT access-token signing secret.
 *
 * This is the shared home for logic that used to live only in
 * apps/api/src/common/config/jwt-secret.ts. It moved here so apps/worker
 * can sign short-lived service tokens (for its internal calls back into
 * the API) using the exact same secret resolution rules, without
 * duplicating them. apps/api/src/common/config/jwt-secret.ts now re-exports
 * this function unchanged, so no existing import path breaks.
 *
 * In production, a missing JWT_ACCESS_SECRET is treated as a fatal
 * configuration error rather than silently falling back to a known,
 * publicly-visible default — using that fallback in production would let
 * anyone mint valid access tokens for any user.
 *
 * In non-production environments we still fall back to a clearly-labelled
 * dev-only value so local setup keeps working without extra config.
 */
export function getJwtAccessSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (secret && secret.trim().length > 0) {
    return secret;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_ACCESS_SECRET is not set. Refusing to start in production with an insecure default secret.',
    );
  }
  return 'dev-only-insecure-secret';
}
