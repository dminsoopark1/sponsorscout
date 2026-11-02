import { cache } from 'react';
import { redirect } from 'next/navigation';
import { userFromClaims, type VerifiedUser } from './user';
import { createClient } from '../supabase/server';
import { publicSupabaseEnv } from '../supabase/env';

export const getVerifiedUser = cache(async (): Promise<VerifiedUser | null> => {
  if (!publicSupabaseEnv()) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims) return null;
    return userFromClaims(data.claims);
  } catch {
    return null;
  }
});

export async function requireUser(): Promise<VerifiedUser> {
  const user = await getVerifiedUser();
  if (!user) redirect('/login?error=denied');
  return user;
}
