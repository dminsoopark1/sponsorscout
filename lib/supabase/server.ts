import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { publicSupabaseEnv } from './env';

export async function createClient() {
  const env = publicSupabaseEnv();
  if (!env) throw new Error('Supabase is not configured.');
  const cookieStore = await cookies();
  return createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot write cookies. The proxy refreshes the session.
        }
      },
    },
  });
}
