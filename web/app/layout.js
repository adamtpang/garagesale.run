import NavMsgs from '../components/NavMsgs';
import './globals.css';
import './shadcn.css';
import Assistant from '../components/Assistant';
export const metadata = {
  title: 'Garage Sale · AI agents that buy and sell on Marketplace',
  applicationName: 'Garage Sale',
  description: 'Snap a photo to sell, or tell us what you want to buy. Grok Bot agents research real prices, write the listing, and find under-market deals on Facebook Marketplace.',
};
export const viewport = { themeColor: '#000000', width: 'device-width', initialScale: 1, viewportFit: 'cover' };
export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark"><body className="bg-background font-sans text-foreground antialiased">
      <nav className="nav"><div className="wrap navin gap-2">
        <a href="/" className="brand shrink-0 whitespace-nowrap !gap-2 text-[14px] font-semibold tracking-tight sm:text-[15px]"><span className="logo !h-7 !w-7 !rounded-lg text-sm" aria-hidden="true">G</span>Garage Sale</a>
        <div className="navlinks min-w-0 items-center !gap-0 whitespace-nowrap text-[12px] sm:text-[13px] sm:!gap-1 [&>a]:rounded-full [&>a]:px-[5px] sm:[&>a]:px-3 [&>a]:py-1.5 max-[379px]:[&>a:last-of-type]:!hidden [&>a]:transition-colors hover:[&>a]:bg-accent/60"><a href="/sell">Sell</a><a href="/buy">Buy</a><a href="/dashboard">Dashboard</a><NavMsgs /><a href="/about">About</a></div>
      </div></nav>
      {children}
      <Assistant />
      <footer className="foot !mt-32 border-t border-border/60"><div className="wrap footin text-[13px] text-muted-foreground">
        <span>Built with Grok Bot · Austin · Oct 2026</span>
        <a href="https://github.com/adamtpang/grokbothackathon" target="_blank" rel="noopener" className="hover:text-foreground">GitHub</a>
      </div></footer>
    </body></html>
  );
}
