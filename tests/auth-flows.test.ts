import { describe, expect, it, vi } from 'vitest';
import {
  callbackDestination,
  signInWithEmail,
  signOut,
  signUpWithEmail,
  type PasswordAuthClient,
} from '../lib/auth/flows';
import { safeNextPath } from '../lib/auth/user';

const userA = '11111111-1111-4111-8111-111111111111';

function authClient(overrides: Partial<PasswordAuthClient['auth']> = {}): PasswordAuthClient & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    auth: {
      signInWithPassword: vi.fn(async (credentials) => {
        calls.push({ method: 'signInWithPassword', credentials });
        return { error: null };
      }),
      signUp: vi.fn(async (credentials) => {
        calls.push({ method: 'signUp', credentials });
        return { data: { session: { user: { id: userA } } }, error: null };
      }),
      signOut: vi.fn(async () => {
        calls.push({ method: 'signOut' });
        return { error: null };
      }),
      ...overrides,
    },
  };
}

describe('login and logout flows', () => {
  it('signs in with email and password and stays on a same-site path', async () => {
    const client = authClient();
    const result = await signInWithEmail(client, {
      email: 'ada@example.com',
      password: 'long-password',
      next: '/account',
    });
    expect(result).toEqual({ ok: true, redirectTo: '/account' });
    expect(client.calls).toEqual([
      { method: 'signInWithPassword', credentials: { email: 'ada@example.com', password: 'long-password' } },
    ]);
  });

  it('rejects a bad password without treating the message as a redirect', async () => {
    const client = authClient({
      signInWithPassword: vi.fn(async () => ({ error: { message: 'Invalid login credentials' } })),
    });
    const result = await signInWithEmail(client, {
      email: 'ada@example.com',
      password: 'long-password',
      next: 'https://evil.example/phish',
    });
    expect(result).toEqual({ ok: false, error: 'Email or password is incorrect.' });
  });

  it('tells an unconfirmed account to use the email link', async () => {
    const client = authClient({
      signInWithPassword: vi.fn(async () => ({ error: { message: 'Email not confirmed' } })),
    });
    const result = await signInWithEmail(client, { email: 'ada@example.com', password: 'long-password' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Confirm your email/);
  });

  it('asks a new account to confirm email when no session is returned', async () => {
    const client = authClient({
      signUp: vi.fn(async () => ({ data: { session: null }, error: null })),
    });
    const result = await signUpWithEmail(client, {
      email: 'ada@example.com',
      password: 'long-password',
      emailRedirectTo: 'http://localhost:3000/auth/callback?next=/dashboard',
    });
    expect(result).toEqual({ ok: true, needsConfirmation: true });
  });

  it('does not follow an off-site address after sign-up', async () => {
    const client = authClient();
    const result = await signUpWithEmail(client, {
      email: 'ada@example.com',
      password: 'long-password',
      emailRedirectTo: 'http://localhost:3000/auth/callback',
      next: '//evil.example',
    });
    expect(result).toEqual({ ok: true, needsConfirmation: false, redirectTo: '/dashboard' });
  });

  it('signs out to the home page and does not accept a redirect target', async () => {
    const client = authClient();
    await expect(signOut(client)).resolves.toEqual({ redirectTo: '/' });
    expect(client.calls).toEqual([{ method: 'signOut' }]);
  });

  it('sends failed or hostile callbacks back to login', () => {
    expect(callbackDestination({
      origin: 'http://localhost:3000',
      verified: true,
      next: 'https://evil.example',
      providerError: null,
    })).toBe('http://localhost:3000/dashboard');
    expect(callbackDestination({
      origin: 'http://localhost:3000',
      verified: false,
      next: '/account',
      providerError: 'access_denied',
    })).toBe('http://localhost:3000/login?error=auth');
    expect(safeNextPath('/%2F%2Fevil.example')).toBe('/dashboard');
  });
});
