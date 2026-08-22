import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// fetchApi calls next/headers's cookies() at request time — mocked the
// same way every 'use server' actions module is mocked elsewhere in
// this app's tests, since there's no real request context here.
const cookiesGetMock = vi.fn();
vi.mock('next/headers', () => ({
  cookies: () => ({ get: cookiesGetMock }),
}));

const fetchMock = vi.fn();

// api.ts reads process.env.API_SERVICE_TOKEN into a module-level const
// at import time (not per-call), so changing it between tests requires
// a fresh module instance each time — vi.resetModules() + a dynamic
// import after vi.stubEnv(), rather than a single top-level import.
async function loadApi(serviceToken?: string) {
  vi.resetModules();
  if (serviceToken === undefined) {
    vi.stubEnv('API_SERVICE_TOKEN', '');
  } else {
    vi.stubEnv('API_SERVICE_TOKEN', serviceToken);
  }
  return import('../api');
}

beforeEach(() => {
  cookiesGetMock.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('fetchApi — bearer token precedence (Checkpoint AJ)', () => {
  it('prefers the accessToken cookie over the service token when both are present', async () => {
    cookiesGetMock.mockImplementation((name: string) => (name === 'accessToken' ? { value: 'user-token' } : undefined));
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}), text: async () => "{}" });
    const { fetchApi } = await loadApi('service-token');

    await fetchApi('/some/path');

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer user-token');
  });

  it('falls back to the service token when no accessToken cookie exists', async () => {
    cookiesGetMock.mockReturnValue(undefined);
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}), text: async () => "{}" });
    const { fetchApi } = await loadApi('service-token');

    await fetchApi('/some/path');

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer service-token');
  });

  it('sends no Authorization header when neither an accessToken cookie nor a service token exists', async () => {
    cookiesGetMock.mockReturnValue(undefined);
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}), text: async () => "{}" });
    const { fetchApi } = await loadApi(undefined);

    await fetchApi('/some/path');

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('throws an ApiError carrying the response status on a failed request', async () => {
    cookiesGetMock.mockReturnValue(undefined);
    fetchMock.mockResolvedValue({ ok: false, status: 404, text: async () => 'not found' });
    const { fetchApi, ApiError } = await loadApi('service-token');

    await expect(fetchApi('/missing')).rejects.toBeInstanceOf(ApiError);
  });
});
