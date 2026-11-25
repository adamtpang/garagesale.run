import NavMsgs from '../components/NavMsgs';
import BankrollPill from '../components/BankrollPill';
import './globals.css';
import './shadcn.css';
import Assistant from '../components/Assistant';
const SITE_TITLE = 'Garage Sale: flip deals near New Braunfels, ranked by real profit';
const SITE_DESCRIPTION = 'Surplus lots and local listings near New Braunfels, TX, each with the profit after fees, gas and drive time, best first.';
// The link preview (LinkedIn, X, iMessage). The image is app/opengraph-image.png and app/twitter-image.png,
// a real capture of the Market. metadataBase makes their URLs absolute, which LinkedIn needs.
export const metadata = {
  metadataBase: new URL('https://garagesale.run'),
  title: 'Garage Sale · Flip deals near New Braunfels',
  applicationName: 'Garage Sale',
  description: SITE_DESCRIPTION,
  openGraph: { type: 'website', url: 'https://garagesale.run', siteName: 'Garage Sale', title: SITE_TITLE, description: SITE_DESCRIPTION },
  twitter: { card: 'summary_large_image', title: SITE_TITLE, description: SITE_DESCRIPTION },
};
export const viewport = { themeColor: '#000000', width: 'device-width', initialScale: 1, viewportFit: 'cover' };
export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark"><body className="bg-background font-sans text-foreground antialiased">
      <nav className="nav"><div className="wrap navin gap-2">
        <a href="/" className="brand shrink-0 whitespace-nowrap !gap-2 text-[14px] font-semibold tracking-tight sm:text-[15px]"><span className="logo !h-7 !w-7 !rounded-lg text-sm" aria-hidden="true">G</span>Garage Sale</a>
        <div className="navlinks min-w-0 items-center !gap-0 whitespace-nowrap text-[12px] max-[520px]:text-[11px] sm:text-[13px] sm:!gap-1 [&>a]:rounded-full [&>a]:px-[5px] max-[520px]:[&>a]:px-1 sm:[&>a]:px-3 [&>a]:py-1.5 [&>a]:transition-colors hover:[&>a]:bg-accent/60"><a href="/">Market</a><a href="/targets">Targets</a><a href="/selling">Selling</a><a href="/ladder">Bankroll</a></div>
        <BankrollPill />
      </div></nav>
      {children}
      <Assistant />
      <footer className="foot !mt-32 border-t border-border"><div className="wrap footin text-[13px] text-muted-foreground">
        <span>Built with Grok Bot · Austin · Oct 2026</span>
        {/* The listing tools live here. The nav is for deals. */}
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1 [&>a:hover]:text-foreground"><a href="/surplus">Surplus</a><a href="/ledger">Ledger</a><a href="/buy">Buy</a><a href="/sell">Sell</a><NavMsgs /><a href="/about">About</a><a href="https://github.com/adamtpang/garagesale.run" target="_blank" rel="noopener">GitHub</a></span>
      </div></footer>
    </body></html>
  );
}
