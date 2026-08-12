import * as crypto from 'crypto';
import { verifyMetaSignature } from '../whatsapp-signature.util';

function computeSignature(appSecret: string, rawBody: Buffer): string {
  const hex = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  return `sha256=${hex}`;
}

describe('verifyMetaSignature', () => {
  const appSecret = 'test-app-secret';
  const rawBody = Buffer.from(JSON.stringify({ object: 'whatsapp_business_account', entry: [] }), 'utf-8');

  it('accepts a correctly computed signature', () => {
    const signature = computeSignature(appSecret, rawBody);
    expect(verifyMetaSignature(appSecret, rawBody, signature)).toBe(true);
  });

  it('rejects a signature computed with the wrong app secret', () => {
    const signature = computeSignature('wrong-secret', rawBody);
    expect(verifyMetaSignature(appSecret, rawBody, signature)).toBe(false);
  });

  it('rejects when the raw body was tampered with after signing', () => {
    const signature = computeSignature(appSecret, rawBody);
    const tampered = Buffer.from(JSON.stringify({ object: 'whatsapp_business_account', entry: [{}] }), 'utf-8');
    expect(verifyMetaSignature(appSecret, tampered, signature)).toBe(false);
  });

  it('rejects when no signature header was present', () => {
    expect(verifyMetaSignature(appSecret, rawBody, undefined)).toBe(false);
  });

  it('rejects when no raw body was captured', () => {
    const signature = computeSignature(appSecret, rawBody);
    expect(verifyMetaSignature(appSecret, undefined, signature)).toBe(false);
  });

  it('rejects a header using an unsupported algorithm prefix', () => {
    const hex = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
    expect(verifyMetaSignature(appSecret, rawBody, `sha1=${hex}`)).toBe(false);
  });

  it('rejects a malformed/garbage signature without throwing', () => {
    expect(verifyMetaSignature(appSecret, rawBody, 'not-a-valid-header')).toBe(false);
  });
});
