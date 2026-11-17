'use client';
import { useEffect, useState } from 'react';
import DealFeed from '@/components/DealFeed';

// Loads the daily feed and keeps the countdowns moving.
export default function DealFeedScreen() {
  const [feed, setFeed] = useState(undefined);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(null);

  useEffect(() => {
    let dead = false;
    const load = () => {
      fetch('/api/feed', { cache: 'no-store', signal: AbortSignal.timeout(20000) })
        .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
        .then((body) => { if (!dead) { setFeed(body); setFailed(false); } })
        .catch(() => { if (!dead) { setFailed(true); setFeed(null); } });
    };
    load();
    const timer = setInterval(load, 5 * 60000);
    return () => { dead = true; clearInterval(timer); };
  }, []);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  return <DealFeed feed={feed} now={now} failed={failed} loading={feed === undefined && !failed} />;
}
