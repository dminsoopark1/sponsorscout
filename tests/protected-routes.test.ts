import { describe, expect, it } from 'vitest';
import { isProtectedPath, proxyAccessDecision, userFromClaims } from '../lib/auth/user';

const userA = '11111111-1111-4111-8111-111111111111';
const userB = '22222222-2222-4222-8222-222222222222';

describe('protected routes', () => {
  it('keeps offer analysis public and protects creator data', () => {
    expect(isProtectedPath('/')).toBe(false);
    expect(isProtectedPath('/api/analyze')).toBe(false);
    expect(isProtectedPath('/login')).toBe(false);
    expect(isProtectedPath('/dashboard')).toBe(true);
    expect(isProtectedPath('/dashboard/abc')).toBe(true);
    expect(isProtectedPath('/account')).toBe(true);
    expect(isProtectedPath('/api/profile')).toBe(true);
    expect(isProtectedPath('/api/analyses')).toBe(true);
    expect(isProtectedPath(`/api/analyses/${userA}`)).toBe(true);
  });

  it('sends anonymous visitors to login and anonymous API calls to 401', () => {
    expect(proxyAccessDecision('/dashboard', null)).toBe('login');
    expect(proxyAccessDecision('/account', null)).toBe('login');
    expect(proxyAccessDecision('/api/analyses', null)).toBe('api-401');
    expect(proxyAccessDecision('/api/profile', null)).toBe('api-401');
    expect(proxyAccessDecision('/', null)).toBe('continue');
    expect(proxyAccessDecision('/api/analyze', null)).toBe('continue');
  });

  it('allows a verified user through and ignores a different id on the claims object', () => {
    const user = userFromClaims({ sub: userA, email: 'a@example.com', user_id: userB });
    expect(user).toEqual({ id: userA, email: 'a@example.com' });
    expect(proxyAccessDecision('/dashboard', user)).toBe('continue');
    expect(proxyAccessDecision('/api/analyses', user)).toBe('continue');
    expect(userFromClaims({ user_id: userB, email: 'b@example.com' })).toBeNull();
    expect(userFromClaims(null)).toBeNull();
  });
});
