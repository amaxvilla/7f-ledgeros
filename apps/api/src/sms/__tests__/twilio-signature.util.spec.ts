import * as crypto from 'crypto';
import { verifyTwilioSignature } from '../twilio-signature.util';

function computeSignature(authToken: string, url: string, params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) data += key + params[key];
  return crypto.createHmac('sha1', authToken).update(Buffer.from(data, 'utf-8')).digest('base64');
}

describe('verifyTwilioSignature', () => {
  const authToken = 'test-auth-token';
  const url = 'https://api.example.com/api/v1/sms/webhook/status';
  const params = { MessageSid: 'SM123', MessageStatus: 'delivered' };

  it('accepts a correctly computed signature', () => {
    const signature = computeSignature(authToken, url, params);
    expect(verifyTwilioSignature(authToken, url, params, signature)).toBe(true);
  });

  it('rejects a signature computed with the wrong auth token', () => {
    const signature = computeSignature('wrong-token', url, params);
    expect(verifyTwilioSignature(authToken, url, params, signature)).toBe(false);
  });

  it('rejects a signature computed for a different URL', () => {
    const signature = computeSignature(authToken, url, params);
    expect(verifyTwilioSignature(authToken, 'https://api.example.com/other-path', params, signature)).toBe(false);
  });

  it('rejects a signature computed over tampered params', () => {
    const signature = computeSignature(authToken, url, params);
    expect(verifyTwilioSignature(authToken, url, { ...params, MessageStatus: 'failed' }, signature)).toBe(false);
  });

  it('rejects when no signature header was present', () => {
    expect(verifyTwilioSignature(authToken, url, params, undefined)).toBe(false);
  });

  it('rejects a malformed/garbage signature without throwing', () => {
    expect(verifyTwilioSignature(authToken, url, params, 'not-base64-!!!')).toBe(false);
  });
});
