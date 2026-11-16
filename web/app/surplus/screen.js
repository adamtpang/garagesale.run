'use client';
import { useEffect, useState } from 'react';
import SurplusBoard from '@/components/SurplusBoard';
import { withClock } from '@/lib/surplus';

export default function SurplusScreen() {
  const [view, setView] = useState(undefined);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(null);

  useEffect(() => {
    let dead = false;
    const load = () => {
      fetch('/api/surplus', { cache: 'no-store', signal: AbortSignal.timeout(10000) })
        .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
        .then((body) => { if (!dead) { setView(body); setFailed(false); } })
        .catch(() => { if (!dead) { setFailed(true); setView(null); } });
    };
    load();
    const timer = setInterval(load, 60000);
    return () => { dead = true; clearInterval(timer); };
  }, []);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const shown = view && now ? withClock(view, now) : view;
  return <main className="wrap py-10 md:py-16"><SurplusBoard view={shown} failed={failed} loading={view === undefined && !failed} /></main>;
}
