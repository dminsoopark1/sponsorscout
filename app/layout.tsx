import './globals.css';
import type { Metadata } from 'next';
import { SiteHeader } from '../components/site-header';

export const metadata: Metadata = {
  title: 'SponsorScout — Creator Deal Intelligence',
  description: 'Analyze creator sponsorship offers with transparent assumptions, rights flags, and negotiation drafts.',
};

export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <SiteHeader />
          {children}
          <footer>SPONSORSCOUT <span>·</span> A prototype for creator-first deal intelligence <span>·</span> Recommendations are not verified market valuations.</footer>
        </div>
      </body>
    </html>
  );
}
