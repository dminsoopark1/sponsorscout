import Analyzer from '../components/analyzer';
import { getVerifiedUser } from '../lib/auth/session';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await getVerifiedUser();
  return <Analyzer isAuthenticated={user !== null} />;
}
