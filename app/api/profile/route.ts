import { NextResponse } from 'next/server';
import { getVerifiedUser } from '../../../lib/auth/session';
import {
  EMPTY_PROFILE,
  getCreatorProfileBundle,
  parseProfileSave,
  saveCreatorProfileBundle,
} from '../../../lib/data/creator-profile';
import { createClient } from '../../../lib/supabase/server';

function unauthorized() {
  return NextResponse.json({ error: 'Authentication required.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET() {
  const user = await getVerifiedUser();
  if (!user) return unauthorized();
  try {
    const supabase = await createClient();
    const result = await getCreatorProfileBundle(supabase, user.id);
    if (result.error) {
      return NextResponse.json(
        { error: 'The creator profile tables are unavailable. Apply the v0.6 migration in Supabase.' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return NextResponse.json(result.bundle, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json(EMPTY_PROFILE, { headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function PUT(req: Request) {
  const user = await getVerifiedUser();
  if (!user) return unauthorized();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Provide a JSON profile payload.' }, { status: 400 });
  }
  const parsed = parseProfileSave(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const supabase = await createClient();
    const saved = await saveCreatorProfileBundle(supabase, user.id, parsed.data);
    if (!saved.ok) {
      const status = saved.error === 'forbidden' ? 403 : 503;
      return NextResponse.json(
        { error: saved.error === 'forbidden' ? 'That social account does not belong to this session.' : 'Unable to save the creator profile.' },
        { status },
      );
    }
    return NextResponse.json(saved.bundle, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Unable to save the creator profile.' }, { status: 500 });
  }
}
