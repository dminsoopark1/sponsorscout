import { NextResponse } from 'next/server';
import { isUuid } from '../../../../lib/auth/user';
import { getVerifiedUser } from '../../../../lib/auth/session';
import { deleteSavedAnalysis, getSavedAnalysis } from '../../../../lib/data/analyses';
import { createClient } from '../../../../lib/supabase/server';

const noStore = { 'Cache-Control': 'private, no-store' };

type Context = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: Context) {
  const user = await getVerifiedUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401, headers: noStore });
  }
  const { id } = await context.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'Analysis not found.' }, { status: 404, headers: noStore });
  }
  const supabase = await createClient();
  const result = await getSavedAnalysis(supabase, user.id, id);
  if (result.error === 'unavailable') {
    return NextResponse.json({ error: 'Unable to load this analysis.' }, { status: 500, headers: noStore });
  }
  if (!result.row) {
    return NextResponse.json({ error: 'Analysis not found.' }, { status: 404, headers: noStore });
  }
  return NextResponse.json({ analysis: result.row }, { headers: noStore });
}

export async function DELETE(_req: Request, context: Context) {
  const user = await getVerifiedUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401, headers: noStore });
  }
  const { id } = await context.params;
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
