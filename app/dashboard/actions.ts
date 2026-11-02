'use server';

import { redirect } from 'next/navigation';
import { isUuid } from '../../lib/auth/user';
import { requireUser } from '../../lib/auth/session';
import { deleteSavedAnalysis } from '../../lib/data/analyses';
import { createClient } from '../../lib/supabase/server';

export async function deleteAnalysis(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get('id') ?? '');
  if (!isUuid(id)) redirect('/dashboard');
  const supabase = await createClient();
  await deleteSavedAnalysis(supabase, user.id, id);
  redirect('/dashboard');
}
