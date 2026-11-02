import { z } from 'zod';
import { safeNextPath } from './user';
import { optionalDisplayName } from '../data/profiles';

const credentialsSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(72),
});

export type AuthError = { message: string };

export type PasswordAuthClient = {
  auth: {
    signInWithPassword: (credentials: { email: string; password: string }) => Promise<{ error: AuthError | null }>;
    signUp: (credentials: {
      email: string;
      password: string;
      options?: { emailRedirectTo?: string; data?: { display_name: string } };
    }) => Promise<{ data: { session: unknown | null }; error: AuthError | null }>;
    signInWithOAuth: (args: {
      provider: 'google';
      options: { redirectTo: string };
    }) => Promise<{ data: { url: string | null }; error: AuthError | null }>;
    signOut: () => Promise<{ error: AuthError | null }>;
  };
};

export type SignInResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string };

export async function signInWithEmail(
  client: PasswordAuthClient,
  input: { email: string; password: string; next?: string | null },
): Promise<SignInResult> {
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Enter a valid email and a password of at least 8 characters.' };
  }
  const { error } = await client.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { ok: false, error: 'Email or password is incorrect.' };
  return { ok: true, redirectTo: safeNextPath(input.next) };
}

export type SignUpResult =
  | { ok: true; needsConfirmation: true }
  | { ok: true; needsConfirmation: false; redirectTo: string }
  | { ok: false; error: string };

export async function signUpWithEmail(
  client: PasswordAuthClient,
  input: {
    email: string;
    password: string;
    displayName: string;
    emailRedirectTo: string;
    next?: string | null;
  },
): Promise<SignUpResult> {
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Enter a valid email and a password of at least 8 characters.' };
  }
  const displayName = optionalDisplayName(input.displayName);
  if (!displayName.ok) return { ok: false, error: displayName.error };
  const { data, error } = await client.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: input.emailRedirectTo,
      data: displayName.value ? { display_name: displayName.value } : undefined,
    },
  });
  if (error) {
    if (/already registered|already exists/i.test(error.message)) {
      return { ok: false, error: 'An account with that email already exists. Sign in instead.' };
    }
    return { ok: false, error: 'Unable to create the account. Try again.' };
  }
  if (!data.session) return { ok: true, needsConfirmation: true };
  return { ok: true, needsConfirmation: false, redirectTo: safeNextPath(input.next) };
}

export async function startGoogleSignIn(client: PasswordAuthClient, redirectTo: string) {
  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });
  if (error || !data.url || !isAllowedAuthUrl(data.url)) {
    return { ok: false as const, error: 'Google sign-in is unavailable. Try email instead.' };
  }
  return { ok: true as const, url: data.url };
}

function isAllowedAuthUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') return true;
    return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  } catch {
    return false;
  }
}

export async function signOut(client: Pick<PasswordAuthClient, 'auth'>) {
  await client.auth.signOut();
  return { redirectTo: '/' as const };
}

export function callbackDestination(input: {
  origin: string;
  code: string | null;
  next: string | null;
  providerError: string | null;
  exchangeFailed: boolean;
}) {
  if (input.providerError || !input.code || input.exchangeFailed) {
    return `${input.origin}/login?error=auth`;
  }
  return `${input.origin}${safeNextPath(input.next)}`;
}
