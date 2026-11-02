import { NextResponse } from 'next/server';
import { signOut } from '../../../lib/auth/flows';
import { createClient } from '../../../lib/supabase/server';
import { publicSupabaseEnv } from '../../../lib/supabase/env';

export async function POST(request: Request) {
  if (publicSupabaseEnv()) {
    const supabase = await createClient();
    await signOut(supabase);
  }
  return NextResponse.redirect(new URL('/', request.url), { status: 303 });
}
