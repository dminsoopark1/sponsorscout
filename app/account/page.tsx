import { requireUser } from '../../lib/auth/session';
import { getOwnProfile } from '../../lib/data/profiles';
import { createClient } from '../../lib/supabase/server';
import { SignOutButton } from '../../components/sign-out-button';
import { updateProfile } from './actions';

export const dynamic = 'force-dynamic';

const messages: Record<string, string> = {
  name: 'Use a display name of 1–80 characters without line breaks.',
  save: 'The profile could not be saved. Apply the Supabase migration and try again.',
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();
  const profile = await getOwnProfile(supabase, user.id);
  const displayName = profile.data?.display_name ?? '';
  return (
    <main className="subpage">
      <div className="pagehead">
        <div>
          <div className="step">ACCOUNT</div>
          <h1>Your profile</h1>
          <p className="authlead">Email comes from the signed-in session. This form only updates the display name.</p>
        </div>
        <SignOutButton />
      </div>
      {params.saved === '1' && <p className="note" role="status">Display name saved.</p>}
      {params.error && messages[params.error] && <p className="error" role="alert">{messages[params.error]}</p>}
      {profile.error && <p className="note" role="alert">The profile table is unavailable until the Supabase migration is applied.</p>}
      <form className="authcard" action={updateProfile}>
        <label className="field">
          <span>EMAIL</span>
          <input value={user.email ?? 'Not available'} readOnly />
        </label>
        <label className="field">
          <span>DISPLAY NAME</span>
          <input name="displayName" defaultValue={displayName} maxLength={80} required />
        </label>
        <button className="primary" type="submit">Save profile</button>
      </form>
    </main>
  );
}
