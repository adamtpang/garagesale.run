'use client';
// The right end of the nav: "Connect Garry" when signed out, the account name when signed in.
import { useEffect, useState } from 'react';
export default function AccountNav() {
  const [me, setMe] = useState(undefined);
  useEffect(() => {
    let alive = true;
    fetch('/api/me', { cache: 'no-store' }).then((r) => r.json()).then((j) => { if (alive) setMe(j.account || null); }).catch(() => { if (alive) setMe(null); });
    return () => { alive = false; };
  }, []);
  if (me === undefined) return null;
  if (!me) return <a href="/connect" data-account="none" className="!rounded-full border border-border/70 !px-3 font-medium">Connect Garry</a>;
  return <a href="/connect" data-account={me.id} title="Your account" className="!rounded-full border border-border/70 !px-3 font-medium">{me.name}</a>;
}
