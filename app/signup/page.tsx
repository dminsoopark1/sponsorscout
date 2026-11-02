import { redirect } from 'next/navigation';
import { AuthForm } from '../../components/auth-form';
import { EnvNotice } from '../../components/env-notice';
import { safeNextPath } from '../../lib/auth/user';
import { getVerifiedUser } from '../../lib/auth/session';
import { readSupabaseEnv } from '../../lib/supabase/env';

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);
  const user = await getVerifiedUser();
  if (user) redirect(nextPath);
  const env = readSupabaseEnv();
  return (
    <main className="subpage">
      {env.ok ? <AuthForm mode="signup" nextPath={nextPath} /> : <EnvNotice reason={env.reason} />}
    </main>
  );
}
