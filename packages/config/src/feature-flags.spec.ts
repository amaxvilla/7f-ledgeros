import { isFeatureEnabled } from './feature-flags';

describe('isFeatureEnabled', () => {
  it('returns false when the flag does not exist', () => {
    expect(isFeatureEnabled(null)).toBe(false);
  });

  it('returns false when the flag is disabled', () => {
    expect(isFeatureEnabled({ key: 'x', enabled: false, rolloutPercent: null })).toBe(false);
  });

  it('returns true when enabled with no rollout percent set', () => {
    expect(isFeatureEnabled({ key: 'x', enabled: true, rolloutPercent: null })).toBe(true);
  });

  it('returns true when rolloutPercent is 100', () => {
    expect(isFeatureEnabled({ key: 'x', enabled: true, rolloutPercent: 100 }, 'subject-1')).toBe(true);
  });

  it('returns false when rolloutPercent is 0', () => {
    expect(isFeatureEnabled({ key: 'x', enabled: true, rolloutPercent: 0 }, 'subject-1')).toBe(false);
  });

  it('is deterministic for the same flag key and subject', () => {
    const flag = { key: 'x', enabled: true, rolloutPercent: 50 };
    const first = isFeatureEnabled(flag, 'subject-1');
    const second = isFeatureEnabled(flag, 'subject-1');
    expect(first).toBe(second);
  });
});
