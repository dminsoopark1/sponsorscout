import Link from 'next/link';
import { requireUser } from '../../lib/auth/session';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await requireUser();
  return (
    <main className="subpage">
      <div className="step">CREATOR DASHBOARD</div>
      <h1>Welcome</h1>
      <p className="authlead">You are signed in as {user.email ?? 'your SponsorScout account'}.</p>
      <p className="note">Offer analysis stays on the home page. Save a creator profile so signed-in analyses can use your platforms and preferences.</p>
      <p><Link className="copy" href="/profile">Creator profile</Link></p>
      <p><Link className="copy" href="/">Analyze an offer</Link></p>
    </main>
  );
}
