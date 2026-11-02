import { requireUser } from '../../lib/auth/session';
import { SignOutButton } from '../../components/sign-out-button';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <main className="subpage">
      <div className="pagehead">
        <div>
          <div className="step">ACCOUNT</div>
          <h1>Your account</h1>
          <p className="authlead">This email comes from your signed-in session.</p>
        </div>
        <SignOutButton />
      </div>
      <section className="authcard">
        <div className="term"><span>Email</span><b>{user.email ?? 'Not available'}</b></div>
        <div className="term"><span>Status</span><b>Signed in</b></div>
      </section>
    </main>
  );
}
