import Link from 'next/link';
import { requireUser } from '../../lib/auth/session';
import { listSavedAnalyses } from '../../lib/data/analyses';
import { createClient } from '../../lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const result = await listSavedAnalyses(supabase, user.id);
  return (
    <main className="subpage">
      <div className="pagehead">
        <div>
          <div className="step">CREATOR DASHBOARD</div>
          <h1>Saved analyses</h1>
          <p className="authlead">These rows are loaded for the signed-in account only.</p>
        </div>
        <Link className="copy" href="/">Analyze an offer</Link>
      </div>
      {result.error && (
        <p className="note" role="alert">Saved analyses cannot be loaded yet. Apply the Supabase migration, then refresh.</p>
      )}
      {!result.error && result.items.length === 0 && (
        <p className="note">Nothing saved yet. Analyze an offer and choose Save to dashboard.</p>
      )}
      <div className="savedlist">
        {result.items.map((item) => (
          <Link className="saveditem" key={item.id} href={`/dashboard/${item.id}`}>
            <strong>{item.brand}</strong>
            <span>{new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
