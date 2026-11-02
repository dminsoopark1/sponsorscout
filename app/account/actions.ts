'use server';

import { redirect } from 'next/navigation';
import { requireUser } from '../../lib/auth/session';
import { parseDisplayName, saveDisplayName } from '../../lib/data/profiles';
import { createClient } from '../../lib/supabase/server';

export async function updateProfile(formData: FormData) {
  const user = await requireUser();
  const parsed = parseDisplayName(formData.get('displayName'));
  if (!parsed.ok) redirect('/account?error=name');
  const supabase = await createClient();
  const saved = await saveDisplayName(supabase, user, parsed.displayName);
  if (!saved.ok) redirect('/account?error=save');
  redirect('/account?saved=1');
}
