import { redirect } from 'next/navigation';
import { AuthForm } from '../../components/auth-form';
import { EnvNotice } from '../../components/env-notice';
import { safeNextPath } from '../../lib/auth/user';
import { getVerifiedUser } from '../../lib/auth/session';
import { readSupabaseEnv } from '../../lib/supabase/env';

const errors: Record<string, string> = {
  auth: 'Sign-in did not finish. Try again.',
  denied: 'That page requires an account.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);
  const user = await getVerifiedUser();
  if (user) redirect(nextPath);
  const env = readSupabaseEnv();
  return (
    <main className="subpage">
      {params.error && errors[params.error] && <p className="error" role="alert">{errors[params.error]}</p>}
      {env.ok ? (
        <AuthForm mode="login" nextPath={nextPath} />
      ) : (
        <EnvNotice reason={env.reason} />
      )}
    </main>
  );
}
