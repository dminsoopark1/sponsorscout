import { requireUser } from '../../lib/auth/session';
import { EMPTY_PROFILE, getCreatorProfileBundle } from '../../lib/data/creator-profile';
import { createClient } from '../../lib/supabase/server';
import { publicSupabaseEnv } from '../../lib/supabase/env';
import { CreatorProfileForm } from '../../components/creator-profile-form';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await requireUser();
  let bundle = EMPTY_PROFILE;
  let unavailable = false;
  if (publicSupabaseEnv()) {
    try {
      const supabase = await createClient();
      const result = await getCreatorProfileBundle(supabase, user.id);
      bundle = result.bundle;
      unavailable = result.error === 'unavailable';
    } catch {
      unavailable = true;
    }
  } else {
    unavailable = true;
  }

  return (
    <main className="subpage profilepage">
      <div className="pagehead">
        <div>
          <div className="step">CREATOR PROFILE</div>
          <h1>Your creator profile</h1>
          <p className="authlead">
            Save the identity, platforms, and preferences used when analyzing offers. Metrics are self-reported until a platform connection exists.
          </p>
        </div>
      </div>
      {unavailable && (
        <p className="note" role="alert">
          Profile storage is unavailable until the Creator Profiles v0.6 Supabase migration is applied.
        </p>
      )}
      <CreatorProfileForm initial={bundle} disabled={unavailable} />
    </main>
  );
}
