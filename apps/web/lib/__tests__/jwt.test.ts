import { describe, it, expect } from 'vitest';
import { decodeAccessTokenEmail } from '../jwt';

function makeToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.fake-signature`;
}

describe('decodeAccessTokenEmail', () => {
  it('returns the email from a well-formed payload', () => {
    const token = makeToken({ sub: 'user-1', email: 'ada@example.com' });
    expect(decodeAccessTokenEmail(token)).toBe('ada@example.com');
  });

  it('returns null when the payload has no email field', () => {
    const token = makeToken({ sub: 'user-1' });
    expect(decodeAccessTokenEmail(token)).toBeNull();
  });

  it('returns null when the email field is not a string', () => {
    const token = makeToken({ sub: 'user-1', email: 12345 });
    expect(decodeAccessTokenEmail(token)).toBeNull();
  });

  it('returns null for a malformed token with fewer than two segments', () => {
    expect(decodeAccessTokenEmail('not-a-jwt')).toBeNull();
  });

  it('returns null for a token whose payload segment is not valid base64url JSON', () => {
    expect(decodeAccessTokenEmail('header.%%%not-base64%%%.sig')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(decodeAccessTokenEmail('')).toBeNull();
  });
});
