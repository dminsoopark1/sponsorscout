import { NextResponse } from 'next/server';
import { callbackDestination, isEmailOtpType } from '../../../lib/auth/flows';
import { createClient } from '../../../lib/supabase/server';
import { publicSupabaseEnv } from '../../../lib/supabase/env';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  let verified = false;
  if (!url.searchParams.get('error') && publicSupabaseEnv()) {
    const supabase = await createClient();
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      verified = !error;
    } else if (tokenHash && isEmailOtpType(type)) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      verified = !error;
    }
  }
  const destination = callbackDestination({
    origin: url.origin,
    verified,
    next: url.searchParams.get('next'),
    providerError: url.searchParams.get('error'),
  });
  return NextResponse.redirect(destination);
}
