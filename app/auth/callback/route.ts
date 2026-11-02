import { NextResponse } from 'next/server';
import { callbackDestination } from '../../../lib/auth/flows';
import { createClient } from '../../../lib/supabase/server';
import { publicSupabaseEnv } from '../../../lib/supabase/env';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  let exchangeFailed = true;
  if (code && !url.searchParams.get('error') && publicSupabaseEnv()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    exchangeFailed = Boolean(error);
  }
  const destination = callbackDestination({
    origin: url.origin,
    code,
    next: url.searchParams.get('next'),
    providerError: url.searchParams.get('error'),
    exchangeFailed,
  });
  return NextResponse.redirect(destination);
}
