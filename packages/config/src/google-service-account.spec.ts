import { generateKeyPairSync, createVerify } from 'crypto';
import { acquireGoogleServiceAccountAccessToken, buildGoogleServiceAccountAssertion } from './google-service-account';

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

function decodeSegment(segment: string): any {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
}

function verifyAssertion(assertion: string): boolean {
  const [headerB64, claimsB64, signatureB64] = assertion.split('.');
  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${claimsB64}`);
  verifier.end();
  return verifier.verify(publicKey, Buffer.from(signatureB64, 'base64url'));
}

describe('buildGoogleServiceAccountAssertion', () => {
  const credentials = { clientEmail: 'svc@my-project.iam.gserviceaccount.com', privateKey };

  it('produces a three-segment RS256 JWT with the expected header', () => {
    const assertion = buildGoogleServiceAccountAssertion(credentials, {
      scopes: ['https://www.googleapis.com/auth/admin.directory.user'],
    });
    const segments = assertion.split('.');
    expect(segments).toHaveLength(3);
    expect(decodeSegment(segments[0])).toEqual({ alg: 'RS256', typ: 'JWT' });
  });

  it('sets iss, scope (space-joined), aud, iat/exp, and omits sub when no impersonation is given', () => {
    const assertion = buildGoogleServiceAccountAssertion(credentials, {
      scopes: ['scope-a', 'scope-b'],
      tokenUri: 'https://oauth2.googleapis.com/token',
    });
    const claims = decodeSegment(assertion.split('.')[1]);
    expect(claims.iss).toBe(credentials.clientEmail);
    expect(claims.scope).toBe('scope-a scope-b');
    expect(claims.aud).toBe('https://oauth2.googleapis.com/token');
    expect(claims.exp - claims.iat).toBe(3600);
    expect(claims.sub).toBeUndefined();
  });

  it('sets sub to the impersonated user when domain-wide delegation is requested', () => {
    const assertion = buildGoogleServiceAccountAssertion(credentials, {
      scopes: ['scope-a'],
      impersonatedUserEmail: 'admin@example.com',
    });
    const claims = decodeSegment(assertion.split('.')[1]);
    expect(claims.sub).toBe('admin@example.com');
  });

  it('honors a custom expiresInSeconds', () => {
    const assertion = buildGoogleServiceAccountAssertion(credentials, { scopes: ['scope-a'], expiresInSeconds: 60 });
    const claims = decodeSegment(assertion.split('.')[1]);
    expect(claims.exp - claims.iat).toBe(60);
  });

  it('produces a signature verifiable against the corresponding public key', () => {
    const assertion = buildGoogleServiceAccountAssertion(credentials, { scopes: ['scope-a'] });
    expect(verifyAssertion(assertion)).toBe(true);
  });

  it('produces a signature that fails verification against a different key pair', () => {
    const otherPair = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const assertion = buildGoogleServiceAccountAssertion(credentials, { scopes: ['scope-a'] });
    const [headerB64, claimsB64, signatureB64] = assertion.split('.');
    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${headerB64}.${claimsB64}`);
    verifier.end();
    expect(verifier.verify(otherPair.publicKey, Buffer.from(signatureB64, 'base64url'))).toBe(false);
  });
});

describe('acquireGoogleServiceAccountAccessToken', () => {
  const credentials = { clientEmail: 'svc@my-project.iam.gserviceaccount.com', privateKey };
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
  });

  it('POSTs a jwt-bearer grant with the signed assertion and returns the access token', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok-abc' }) });

    const token = await acquireGoogleServiceAccountAccessToken(credentials, {
      scopes: ['https://www.googleapis.com/auth/admin.directory.user'],
      impersonatedUserEmail: 'admin@example.com',
    });

    expect(token).toBe('tok-abc');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://oauth2.googleapis.com/token');
    expect(init.method).toBe('POST');
    const body = new URLSearchParams(init.body as string);
    expect(body.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
    expect(verifyAssertion(body.get('assertion')!)).toBe(true);
  });

  it('respects a custom tokenUri for both the assertion aud and the request itself', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok-xyz' }) });
    await acquireGoogleServiceAccountAccessToken(credentials, {
      scopes: ['scope-a'],
      tokenUri: 'https://example-test-endpoint.invalid/token',
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://example-test-endpoint.invalid/token');
    const body = new URLSearchParams(init.body as string);
    const claims = decodeSegment(body.get('assertion')!.split('.')[1]);
    expect(claims.aud).toBe('https://example-test-endpoint.invalid/token');
  });

  it('throws with the status and body when the token endpoint rejects the assertion', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'invalid_grant: bad signature' });
    await expect(acquireGoogleServiceAccountAccessToken(credentials, { scopes: ['scope-a'] })).rejects.toThrow(
      /401.*invalid_grant/,
    );
  });

  it('throws when the response has no access_token', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    await expect(acquireGoogleServiceAccountAccessToken(credentials, { scopes: ['scope-a'] })).rejects.toThrow(
      'Token response had no access_token',
    );
  });
});
