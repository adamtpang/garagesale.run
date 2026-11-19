import { DM_Sans, Permanent_Marker } from 'next/font/google';
import NavMsgs from '../components/NavMsgs';
import './globals.css';
import './shadcn.css';
import Assistant from '../components/Assistant';
// DM Sans carries everything. Permanent Marker is only for prices, like a hand-written sticker.
const dm = DM_Sans({ subsets: ['latin'], variable: '--font-dm', display: 'swap' });
const marker = Permanent_Marker({ subsets: ['latin'], weight: '400', variable: '--font-marker', display: 'swap' });
export const metadata = {
  title: 'Garage Sale · Flip deals near New Braunfels',
  applicationName: 'Garage Sale',
  description: 'Surplus lots and local listings near New Braunfels, TX, each with the profit after fees, gas and drive time, best first.',
};
export const viewport = { themeColor: '#ffffff', width: 'device-width', initialScale: 1, viewportFit: 'cover' };
export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${dm.variable} ${marker.variable}`}><body className="bg-background font-sans text-foreground antialiased">
      <nav className="nav"><div className="wrap navin gap-2">
        <a href="/" className="brand shrink-0 whitespace-nowrap !gap-2 text-[14px] font-semibold tracking-tight sm:text-[15px]"><span className="logo !h-7 !w-7 !rounded-lg text-sm" aria-hidden="true">G</span>Garage Sale</a>
        <div className="navlinks min-w-0 items-center !gap-0 whitespace-nowrap text-[12px] max-[520px]:text-[11px] sm:text-[13px] sm:!gap-1 [&>a]:rounded-full [&>a]:px-[5px] max-[520px]:[&>a]:px-1 sm:[&>a]:px-3 [&>a]:py-1.5 [&>a]:transition-colors hover:[&>a]:bg-accent/60"><a href="/">Market</a><a href="/surplus">Surplus</a><a href="/ladder">Bankroll</a><a href="/ledger">Ledger</a></div>
      </div></nav>
      {children}
      <Assistant />
      <footer className="foot !mt-32 border-t border-border"><div className="wrap footin text-[13px] text-muted-foreground">
        <span>Built with Grok Bot · Austin · Oct 2026</span>
        {/* The listing tools live here. The nav is for deals. */}
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1 [&>a:hover]:text-foreground"><a href="/buy">Buy</a><a href="/sell">Sell</a><NavMsgs /><a href="/about">About</a><a href="https://github.com/adamtpang/garagesale.run" target="_blank" rel="noopener">GitHub</a></span>
      </div></footer>
    </body></html>
  );
}
