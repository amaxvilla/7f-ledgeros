/**
 * Minimal IPv4 CIDR matching. IPv6 is NOT supported — an IPv6 request
 * address always fails to match any rule (see isIpAllowed's fail-closed
 * behavior in IpRestrictionService: this only matters once at least one
 * active rule applies to the caller, at which point an unmatched IPv6
 * address is correctly treated as "not allowed" rather than silently
 * bypassing the restriction). Flagged as a known limitation rather than
 * silently ignored; adding IPv6 support later is additive.
 */
export function isIPv4(ip: string): boolean {
  return /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(ip);
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/** True if `ip` (plain IPv4, e.g. from req.ip) falls within `cidr`
 *  (e.g. "203.0.113.0/24", or a bare IP treated as a /32). Returns false
 *  — never throws — for anything malformed, so a bad rule or a
 *  non-IPv4 caller address fails closed rather than crashing the guard. */
export function ipInCidr(ip: string, cidr: string): boolean {
  const normalizedIp = ip.startsWith('::ffff:') ? ip.slice(7) : ip; // IPv4-mapped IPv6, common behind proxies
  if (!isIPv4(normalizedIp)) return false;

  const [rangeIp, prefixStr] = cidr.includes('/') ? cidr.split('/') : [cidr, '32'];
  const prefix = Number(prefixStr);
  if (!isIPv4(rangeIp) || Number.isNaN(prefix) || prefix < 0 || prefix > 32) return false;

  const ipInt = ipv4ToInt(normalizedIp);
  const rangeInt = ipv4ToInt(rangeIp);
  if (ipInt === null || rangeInt === null) return false;

  if (prefix === 0) return true; // 0.0.0.0/0 — matches everything
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}
