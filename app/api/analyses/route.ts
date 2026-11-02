import { NextResponse } from 'next/server';
import { isUuid } from '../../../lib/auth/user';
import { getVerifiedUser } from '../../../lib/auth/session';
import { createSavedAnalysis, deleteSavedAnalysis, listSavedAnalyses } from '../../../lib/data/analyses';
import { createClient } from '../../../lib/supabase/server';

const noStore = { 'Cache-Control': 'private, no-store' };

function unauthorized() {
  return NextResponse.json({ error: 'Authentication required.' }, { status: 401, headers: noStore });
}

export async function GET() {
  const user = await getVerifiedUser();
  if (!user) return unauthorized();
  const supabase = await createClient();
  const result = await listSavedAnalyses(supabase, user.id);
  if (result.error) {
    return NextResponse.json({ error: 'Unable to load saved analyses.' }, { status: 500, headers: noStore });
  }
  return NextResponse.json({ analyses: result.items }, { headers: noStore });
}

export async function POST(req: Request) {
  const user = await getVerifiedUser();
  if (!user) return unauthorized();
  let payload: unknown = null;
  try {
    payload = await req.json();
  } catch {
    payload = null;
  }
  const supabase = await createClient();
  const result = await createSavedAnalysis(user, payload, supabase);
  return NextResponse.json(result.body, { status: result.status, headers: noStore });
}

export async function DELETE(req: Request) {
  const user = await getVerifiedUser();
  if (!user) return unauthorized();
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'Analysis not found.' }, { status: 404, headers: noStore });
  }
  const supabase = await createClient();
  const { data, error } = await deleteSavedAnalysis(supabase, user.id, id);
  if (error) {
    return NextResponse.json({ error: 'Unable to delete this analysis.' }, { status: 500, headers: noStore });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Analysis not found.' }, { status: 404, headers: noStore });
  }
  return NextResponse.json({ ok: true }, { headers: noStore });
}
