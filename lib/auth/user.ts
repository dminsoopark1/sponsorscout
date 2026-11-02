const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export type VerifiedUser = { id: string; email: string | null };

type ClaimsLike = { sub?: unknown; email?: unknown; [key: string]: unknown } | null | undefined;

/** Identity comes only from verified JWT claims. Other ids in the same object are ignored. */
export function userFromClaims(claims: ClaimsLike): VerifiedUser | null {
  if (!claims || typeof claims.sub !== 'string' || !isUuid(claims.sub)) return null;
  const email = typeof claims.email === 'string' && claims.email.length <= 320 ? claims.email : null;
  return { id: claims.sub, email };
}

const PROTECTED_PREFIXES = ['/dashboard', '/account', '/api/profile', '/api/analyses'];

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export type AccessDecision = 'continue' | 'login' | 'api-401';

export function proxyAccessDecision(pathname: string, user: VerifiedUser | null): AccessDecision {
  if (!isProtectedPath(pathname)) return 'continue';
  if (user) return 'continue';
  return pathname.startsWith('/api/') ? 'api-401' : 'login';
}

/** Same-site relative paths only. Rejects protocol-relative and absolute URLs. */
export function safeNextPath(input: string | null | undefined, fallback = '/dashboard'): string {
  if (!input) return fallback;
  let value = input.trim();
  if (!value || value.length > 512) return fallback;
  try {
    value = decodeURIComponent(value);
  } catch {
    return fallback;
  }
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  if (value.includes('\\') || value.includes('://') || value.includes('\0')) return fallback;
  return value;
}
