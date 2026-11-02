'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { safeNextPath } from '../lib/auth/user';
import { signInWithEmail, signUpWithEmail, startGoogleSignIn } from '../lib/auth/flows';
import { createClient } from '../lib/supabase/client';

export function AuthForm({ mode, nextPath }: { mode: 'login' | 'signup'; nextPath: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
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
      const result = await signUpWithEmail(supabase, {
        email,
        password,
        displayName,
        emailRedirectTo: redirectTo,
        next,
      });
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
      setError('Supabase is not configured for this app yet.');
    } finally {
      setPending(false);
    }
  }

  async function onGoogle() {
    setError('');
    setNotice('');
    setPending(true);
    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const result = await startGoogleSignIn(supabase, redirectTo);
      if (!result.ok) {
        setError(result.error);
        setPending(false);
        return;
      }
      window.location.assign(result.url);
    } catch {
      setError('Supabase is not configured for this app yet.');
      setPending(false);
    }
  }

  return (
    <form className="authcard" onSubmit={onSubmit}>
      <h1>{mode === 'login' ? 'Sign in' : 'Create an account'}</h1>
      <p className="authlead">
        {mode === 'login'
          ? 'Your saved analyses stay on this account. Offer analysis still works without signing in.'
          : 'Save analyses and return to them later. You can keep analyzing offers as a guest.'}
      </p>
      {mode === 'signup' && (
        <label className="field">
          <span>DISPLAY NAME</span>
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" maxLength={80} />
        </label>
      )}
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
        {pending ? 'Working...' : mode === 'login' ? 'Sign in' : 'Create account'}
      </button>
      <div className="divider">or</div>
      <button className="google" type="button" onClick={onGoogle} disabled={pending}>
        Continue with Google
      </button>
      <p className="authswitch">
        {mode === 'login' ? (
          <>Need an account? <Link href={`/signup?next=${encodeURIComponent(next)}`}>Sign up</Link></>
        ) : (
          <>Already have an account? <Link href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link></>
        )}
      </p>
    </form>
  );
}
