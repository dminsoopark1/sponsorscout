import { beforeEach, describe, expect, it } from 'vitest';
import { ANALYSIS_LIMITS, resetRateLimits, takeAnalysisToken } from '../lib/rate-limit';

describe('analysis rate limit', () => {
  beforeEach(() => resetRateLimits());

  it('limits each anonymous address and still allows a different address', () => {
    for (let count = 0; count < ANALYSIS_LIMITS.anonymous.limit; count += 1) {
      expect(takeAnalysisToken({ userId: null, ip: '203.0.113.10' }, 1_000).ok).toBe(true);
    }
    expect(takeAnalysisToken({ userId: null, ip: '203.0.113.10' }, 1_000).ok).toBe(false);
    expect(takeAnalysisToken({ userId: null, ip: '203.0.113.11' }, 1_000).ok).toBe(true);
  });

  it('gives signed-in users their own bucket and caps anonymous traffic overall', () => {
    for (let count = 0; count < ANALYSIS_LIMITS.authenticated.limit; count += 1) {
      expect(takeAnalysisToken({ userId: '11111111-1111-4111-8111-111111111111', ip: '203.0.113.10' }, 5_000).ok).toBe(true);
    }
    expect(takeAnalysisToken({ userId: '11111111-1111-4111-8111-111111111111', ip: '203.0.113.10' }, 5_000).ok).toBe(false);
    expect(takeAnalysisToken({ userId: '22222222-2222-4222-8222-222222222222', ip: '203.0.113.10' }, 5_000).ok).toBe(true);

    resetRateLimits();
    for (let count = 0; count < ANALYSIS_LIMITS.anonymousGlobal.limit; count += 1) {
      expect(takeAnalysisToken({ userId: null, ip: `198.51.100.${count}` }, 9_000).ok).toBe(true);
    }
    expect(takeAnalysisToken({ userId: null, ip: '198.51.100.250' }, 9_000).ok).toBe(false);
  });
});
