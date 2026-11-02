import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AnalysisResults } from '../../../components/analysis-results';
import { isUuid } from '../../../lib/auth/user';
import { requireUser } from '../../../lib/auth/session';
import { getSavedAnalysis } from '../../../lib/data/analyses';
import { createClient } from '../../../lib/supabase/server';
import { deleteAnalysis } from '../actions';

export const dynamic = 'force-dynamic';

export default async function SavedAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const user = await requireUser();
  const supabase = await createClient();
  const result = await getSavedAnalysis(supabase, user.id, id);
  if (result.error === 'unavailable') {
    return (
      <main className="subpage">
        <p className="note" role="alert">This analysis cannot be loaded yet. Apply the Supabase migration, then refresh.</p>
      </main>
    );
  }
  if (!result.row) notFound();
  const { analysis, offerText, createdAt } = result.row;
  return (
    <main className="subpage">
      <Link className="textbtn" href="/dashboard">Back to dashboard</Link>
      <div className="pagehead">
        <div>
          <div className="step">SAVED ANALYSIS</div>
          <h1>{analysis.brand}</h1>
          <p className="authlead">
            Saved {new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            {' · '}
            {analysis.mode === 'ai' ? 'Claude AI' : 'Rule-based demo'}
          </p>
        </div>
        <form action={deleteAnalysis}>
          <input type="hidden" name="id" value={result.row.id} />
          <button className="copy" type="submit">Delete</button>
        </form>
      </div>
      <AnalysisResults data={analysis} />
      <section className="section">
        <h3>Reply draft</h3>
        <pre>{analysis.draft}</pre>
      </section>
      <section className="section">
        <h3>Original offer</h3>
        <pre>{offerText}</pre>
      </section>
    </main>
  );
}
