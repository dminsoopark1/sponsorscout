import { z } from 'zod';
import { safeNextPath } from './user';

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
      options?: { emailRedirectTo?: string };
    }) => Promise<{ data: { session: unknown | null }; error: AuthError | null }>;
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
  if (error) {
    if (/email not confirmed/i.test(error.message)) {
      return { ok: false, error: 'Confirm your email before signing in. Check your inbox for the verification link.' };
    }
    return { ok: false, error: 'Email or password is incorrect.' };
  }
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
    emailRedirectTo: string;
    next?: string | null;
  },
): Promise<SignUpResult> {
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Enter a valid email and a password of at least 8 characters.' };
  }
  const { data, error } = await client.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: input.emailRedirectTo },
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

export async function signOut(client: Pick<PasswordAuthClient, 'auth'>) {
  await client.auth.signOut();
  return { redirectTo: '/' as const };
}

const EMAIL_OTP_TYPES = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'] as const;

export type EmailOtpType = (typeof EMAIL_OTP_TYPES)[number];

export function isEmailOtpType(value: string | null): value is EmailOtpType {
  return EMAIL_OTP_TYPES.some((type) => type === value);
}

export function callbackDestination(input: {
  origin: string;
  verified: boolean;
  next: string | null;
  providerError: string | null;
}) {
  if (input.providerError || !input.verified) {
    return `${input.origin}/login?error=auth`;
  }
  return `${input.origin}${safeNextPath(input.next)}`;
}
