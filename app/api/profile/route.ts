import { NextResponse } from 'next/server';
import { getVerifiedUser } from '../../../lib/auth/session';
import { clientSuppliedIdentity, getOwnProfile, parseDisplayName, saveDisplayName } from '../../../lib/data/profiles';
import { createClient } from '../../../lib/supabase/server';

const noStore = { 'Cache-Control': 'private, no-store' };

export async function GET() {
  const user = await getVerifiedUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401, headers: noStore });
  }
  const supabase = await createClient();
  const { data, error } = await getOwnProfile(supabase, user.id);
  if (error) {
    return NextResponse.json({ error: 'Unable to load the profile.' }, { status: 500, headers: noStore });
  }
  return NextResponse.json(
    {
      id: user.id,
      email: user.email,
      displayName: data?.display_name ?? null,
      createdAt: data?.created_at ?? null,
    },
    { headers: noStore },
  );
}

export async function PATCH(req: Request) {
  const user = await getVerifiedUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401, headers: noStore });
  }
  let payload: unknown = null;
  try {
    payload = await req.json();
  } catch {
    payload = null;
  }
  if (clientSuppliedIdentity(payload)) {
    return NextResponse.json(
      { error: 'Account identity comes from the signed-in session.' },
      { status: 400, headers: noStore },
    );
  }
  const displayName = payload && typeof payload === 'object' && 'displayName' in payload ? payload.displayName : null;
  const parsed = parseDisplayName(displayName);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400, headers: noStore });
  const supabase = await createClient();
  const saved = await saveDisplayName(supabase, user, parsed.displayName);
  if (!saved.ok) {
    return NextResponse.json({ error: 'Unable to update the profile.' }, { status: 500, headers: noStore });
  }
  return NextResponse.json({ ok: true, displayName: parsed.displayName }, { headers: noStore });
}
