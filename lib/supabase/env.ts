export type SupabaseEnv = { url: string; key: string };

export type SupabaseEnvResult =
  | { ok: true; env: SupabaseEnv }
  | { ok: false; reason: 'missing' | 'service-role' };

function decodeBase64Url(value: string): string | null {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    return atob(padded);
  } catch {
    return null;
  }
}

/** Reject secret keys before they can be sent from the browser or used as the app key. */
export function isServiceRoleKey(key: string): boolean {
  const trimmed = key.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('sb_secret_') || trimmed.includes('service_role')) return true;
  const payload = trimmed.split('.')[1];
  if (!payload) return false;
  const decoded = decodeBase64Url(payload);
  if (!decoded) return false;
  try {
    const parsed = JSON.parse(decoded) as { role?: unknown };
    return parsed.role === 'service_role';
  } catch {
    return false;
  }
}

export function readSupabaseEnv(
  source: Record<string, string | undefined> = process.env,
): SupabaseEnvResult {
  const url = source.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (
    source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || source.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();
  if (!url || !key) return { ok: false, reason: 'missing' };
  if (isServiceRoleKey(key)) return { ok: false, reason: 'service-role' };
  return { ok: true, env: { url, key } };
}

export function publicSupabaseEnv(): SupabaseEnv | null {
  // Direct process.env.NEXT_PUBLIC_* reads are required so Next can inline them
  // into the browser bundle. Passing process.env as an object does not.
  const result = readSupabaseEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  return result.ok ? result.env : null;
}
