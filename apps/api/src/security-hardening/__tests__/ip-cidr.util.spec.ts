import { ipInCidr, isIPv4 } from '../ip-cidr.util';

describe('ip-cidr.util', () => {
  describe('isIPv4', () => {
    it('accepts a well-formed dotted-quad address', () => {
      expect(isIPv4('203.0.113.5')).toBe(true);
    });

    it('rejects non-IPv4 strings', () => {
      expect(isIPv4('not-an-ip')).toBe(false);
      expect(isIPv4('::1')).toBe(false);
      expect(isIPv4('')).toBe(false);
    });
  });

  describe('ipInCidr', () => {
    it('matches an address inside a /24 range', () => {
      expect(ipInCidr('203.0.113.42', '203.0.113.0/24')).toBe(true);
    });

    it('rejects an address outside a /24 range', () => {
      expect(ipInCidr('203.0.114.1', '203.0.113.0/24')).toBe(false);
    });

    it('treats a bare IP (no prefix) as a /32 exact match', () => {
      expect(ipInCidr('203.0.113.5', '203.0.113.5')).toBe(true);
      expect(ipInCidr('203.0.113.6', '203.0.113.5')).toBe(false);
    });

    it('matches everything under /0', () => {
      expect(ipInCidr('8.8.8.8', '0.0.0.0/0')).toBe(true);
    });

    it('strips the ::ffff: IPv4-mapped IPv6 prefix seen behind some proxies', () => {
      expect(ipInCidr('::ffff:203.0.113.5', '203.0.113.0/24')).toBe(true);
    });

    it('fails closed (never throws) on a malformed CIDR', () => {
      expect(ipInCidr('203.0.113.5', 'not-a-cidr')).toBe(false);
      expect(ipInCidr('203.0.113.5', '203.0.113.0/99')).toBe(false);
    });

    it('fails closed on a non-IPv4 caller address', () => {
      expect(ipInCidr('2001:db8::1', '0.0.0.0/0')).toBe(false);
    });
  });
});
