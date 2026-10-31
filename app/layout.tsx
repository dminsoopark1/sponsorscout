import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = {title:'SponsorScout — Creator Deal Intelligence', description:'Analyze creator sponsorship offers with transparent assumptions, rights flags, and negotiation drafts.'};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}</body></html>}
