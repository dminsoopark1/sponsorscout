import Link from 'next/link';
import { ArrowRight, Target } from 'lucide-react';
import { getVerifiedUser } from '../lib/auth/session';

export async function SiteHeader() {
  const user = await getVerifiedUser();
  return (
    <header className="topbar">
      <Link href="/" className="brand">
        <span className="brandmark"><Target size={19} /></span>Sponsor<span>Scout</span><span className="beta">BETA</span>
      </Link>
      <div className="topright">
        <span className="dot" />
        Creator deal intelligence
        <span className="topdivider" />
        <a href="https://github.com" target="_blank" rel="noopener noreferrer">About this prototype <ArrowRight size={13} /></a>
      </div>
      <nav className="authnav" aria-label="Account">
        {user ? (
          <>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/account">Account</Link>
          </>
        ) : (
          <Link href="/login">Sign in</Link>
        )}
      </nav>
    </header>
  );
}
