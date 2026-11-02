'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { safeNextPath } from '../lib/auth/user';
import { signInWithEmail, signUpWithEmail } from '../lib/auth/flows';
import { createClient } from '../lib/supabase/client';

export function AuthForm({ mode, nextPath }: { mode: 'login' | 'signup'; nextPath: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);
  const next = safeNextPath(nextPath);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');
    setPending(true);
    try {
      const supabase = createClient();
      if (mode === 'login') {
        const result = await signInWithEmail(supabase, { email, password, next });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.push(result.redirectTo);
        router.refresh();
        return;
      }
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const result = await signUpWithEmail(supabase, { email, password, emailRedirectTo: redirectTo, next });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.needsConfirmation) {
        setNotice('Check your email to confirm the account. The link returns you to SponsorScout.');
        return;
      }
      router.push(result.redirectTo);
      router.refresh();
    } catch {
      setError('Sign-in is unavailable right now. Check the Supabase configuration and try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="authcard" onSubmit={onSubmit}>
      <h1>{mode === 'login' ? 'Log in' : 'Sign up'}</h1>
      <p className="authlead">
        {mode === 'login'
          ? 'Use the email and password for your SponsorScout account. Offer analysis still works without an account.'
          : 'Create an account with your email. You can keep analyzing offers as a guest.'}
      </p>
      <label className="field">
        <span>EMAIL</span>
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
        />
      </label>
      <label className="field">
        <span>PASSWORD</span>
        <input
          type="password"
          required
          minLength={8}
          maxLength={72}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="note" role="status">{notice}</p>}
      <button className="primary" type="submit" disabled={pending}>
        {pending ? 'Working...' : mode === 'login' ? 'Log in' : 'Create account'}
      </button>
      <p className="authswitch">
        {mode === 'login' ? (
          <>Need an account? <Link href={`/signup?next=${encodeURIComponent(next)}`}>Sign up</Link></>
        ) : (
          <>Already have an account? <Link href={`/login?next=${encodeURIComponent(next)}`}>Log in</Link></>
        )}
      </p>
    </form>
  );
}
