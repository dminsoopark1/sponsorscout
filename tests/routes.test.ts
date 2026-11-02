import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('../lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      exchangeCodeForSession: vi.fn(async () => ({ error: null })),
      signOut: vi.fn(async () => ({ error: null })),
    },
  })),
}));

import { GET as callback } from '../app/auth/callback/route';
import { POST as signOutRoute } from '../app/auth/signout/route';
import { DELETE as deleteAnalyses, GET as listAnalyses, POST as createAnalysis } from '../app/api/analyses/route';
import { PATCH as updateProfile } from '../app/api/profile/route';
import { POST as analyze } from '../app/api/analyze/route';
import { resetRateLimits } from '../lib/rate-limit';
import { createClient } from '../lib/supabase/server';

describe('auth routes', () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    resetRateLimits();
    vi.mocked(createClient).mockClear();
  });

  it('completes a callback without following an external next path', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_example';
    const response = await callback(new Request('http://localhost:3000/auth/callback?code=abc&next=https://evil.example&userId=22222222-2222-4222-8222-222222222222'));
    expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard');
    expect(createClient).toHaveBeenCalledOnce();
  });

  it('signs out to the home page', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_example';
    const response = await signOutRoute(new Request('http://localhost:3000/auth/signout', { method: 'POST' }));
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('http://localhost:3000/');
  });

  it('refuses saved analyses and profile edits without a session, even if the body names a user', async () => {
    const body = JSON.stringify({
      userId: '22222222-2222-4222-8222-222222222222',
      displayName: 'Ada',
      offer: 'A'.repeat(20),
    });
    expect((await listAnalyses()).status).toBe(401);
    expect((await createAnalysis(new Request('http://localhost/api/analyses', { method: 'POST', body }))).status).toBe(401);
    expect((await deleteAnalyses(new Request('http://localhost/api/analyses?id=11111111-1111-4111-8111-111111111111', { method: 'DELETE' }))).status).toBe(401);
    expect((await updateProfile(new Request('http://localhost/api/profile', { method: 'PATCH', body }))).status).toBe(401);
  });

  it('rate limits the public analysis route and still answers a guest under the limit', async () => {
    const offer = 'A brand offered one Instagram Reel for a short campaign.';
    const send = (ip: string) =>
      analyze(new NextRequest('http://localhost/api/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
        body: JSON.stringify({ offer }),
      }));
    for (let count = 0; count < 8; count += 1) {
      expect((await send('203.0.113.44')).status).toBe(200);
    }
    const blocked = await send('203.0.113.44');
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBeTruthy();
    expect((await send('203.0.113.45')).status).toBe(200);
  });
});
