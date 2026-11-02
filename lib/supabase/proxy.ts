import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { proxyAccessDecision, userFromClaims } from '../auth/user';
import { publicSupabaseEnv } from './env';

const CACHE_HEADERS = ['cache-control', 'expires', 'pragma'] as const;

function applyAuthResponse(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });
  for (const header of CACHE_HEADERS) {
    const value = from.headers.get(header);
    if (value) to.headers.set(header, value);
  }
  to.headers.set('Cache-Control', 'private, no-store');
  return to;
}

function finish(request: NextRequest, user: ReturnType<typeof userFromClaims>, supabaseResponse: NextResponse) {
  const decision = proxyAccessDecision(request.nextUrl.pathname, user);
  if (decision === 'continue') return supabaseResponse;
  if (decision === 'api-401') {
    const denied = NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    return applyAuthResponse(supabaseResponse, denied);
  }
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return applyAuthResponse(supabaseResponse, NextResponse.redirect(url));
}

export async function updateSession(request: NextRequest) {
  if (!publicSupabaseEnv()) {
    return finish(request, null, NextResponse.next({ request }));
  }
  const env = publicSupabaseEnv();
  if (!env) return finish(request, null, NextResponse.next({ request }));

  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([key, value]) => {
          supabaseResponse.headers.set(key, value);
        });
      },
    },
  });

  // Do not add requests between creating the client and getClaims().
  // A second refresh of the same token can sign the user out.
  let user = null;
  try {
    const { data, error } = await supabase.auth.getClaims();
    if (!error && data?.claims) user = userFromClaims(data.claims);
  } catch {
    user = null;
  }
  return finish(request, user, supabaseResponse);
}
