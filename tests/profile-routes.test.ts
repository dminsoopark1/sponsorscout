import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const userA = '11111111-1111-4111-8111-111111111111';
const getVerifiedUser = vi.fn(async (): Promise<{ id: string; email: string | null } | null> => null);
const createClient = vi.fn();

vi.mock('../lib/auth/session', () => ({
  getVerifiedUser: () => getVerifiedUser(),
}));
vi.mock('../lib/supabase/server', () => ({
  createClient: () => createClient(),
}));

import { GET as getProfile, PUT as putProfile } from '../app/api/profile/route';
import { POST as analyze } from '../app/api/analyze/route';
import { HLTH_CODE_EXAMPLE } from '../lib/analyzer';
import { resetRateLimits } from '../lib/rate-limit';
import { createMemoryStore } from './memory-store';

describe('profile and analysis routes', () => {
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    resetRateLimits();
    getVerifiedUser.mockReset();
    createClient.mockReset();
    getVerifiedUser.mockResolvedValue(null);
  });

  it('refuses profile reads and writes without a session', async () => {
    expect((await getProfile()).status).toBe(401);
    expect(
      (
        await putProfile(
          new Request('http://localhost/api/profile', {
            method: 'PUT',
            body: JSON.stringify({ displayName: 'Ada', userId: userA }),
          }),
        )
      ).status,
    ).toBe(401);
  });

  it('lets a guest analyze without a creator profile', async () => {
    const response = await analyze(
      new NextRequest('http://localhost/api/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.80' },
        body: JSON.stringify({ offer: HLTH_CODE_EXAMPLE }),
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.creatorContextUsed).toBe(false);
    expect(body.brand).toBe('HLTH Code');
  });

  it('loads saved profile context for a signed-in analysis', async () => {
    const store = createMemoryStore();
    getVerifiedUser.mockResolvedValue({ id: userA, email: 'a@example.com' });
    createClient.mockResolvedValue(store.client);
    const saved = await putProfile(
      new Request('http://localhost/api/profile', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          displayName: 'Ada',
          creatorName: 'Ada Creates',
          primaryNiche: 'Wellness',
          additionalNiches: [],
          primaryAudienceRegion: 'US',
          bio: '',
          preferences: {
            compensationPreference: 'affiliate_allowed',
            minimumGuaranteedFee: null,
            preferredCurrency: 'USD',
            acceptsGiftedOnly: true,
            acceptsAffiliateLinks: true,
            acceptsCommissionOnly: true,
          },
          accounts: [
            {
              platform: 'Instagram',
              handle: 'ada.creates',
              profileUrl: 'https://instagram.com/ada.creates',
              metrics: { followerCount: 12000, metricsWindow: 'last 20 posts' },
            },
          ],
        }),
      }),
    );
    expect(saved.status).toBe(200);
    const loaded = await getProfile();
    expect(loaded.status).toBe(200);
    const profile = await loaded.json();
    expect(profile.accounts[0].metrics.followerCount).toBe(12000);

    const analysis = await analyze(
      new NextRequest('http://localhost/api/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.81' },
        body: JSON.stringify({ offer: HLTH_CODE_EXAMPLE }),
      }),
    );
    const body = await analysis.json();
    expect(analysis.status).toBe(200);
    expect(body.creatorContextUsed).toBe(true);
    expect(body.creatorContextNote).toMatch(/self-reported/i);
  });
});
