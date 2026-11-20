'use client';
import { useEffect, useState } from 'react';
import Market from '@/components/Market';

// Loads the daily feed and keeps the countdowns moving.
export default function DealFeedScreen() {
  const [feed, setFeed] = useState(undefined);
  const [failed, setFailed] = useState(false);
  // True when a later refresh failed but an earlier load is still on screen.
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [now, setNow] = useState(null);

  useEffect(() => {
    let dead = false;
    const load = () => {
      fetch('/api/feed', { cache: 'no-store', signal: AbortSignal.timeout(20000) })
        .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
        .then((body) => { if (!dead) { setFeed(body); setFailed(false); setRefreshFailed(false); } })
        // A failed refresh never removes deals that already loaded. Only a first load with nothing to show is an error page.
        .catch(() => { if (!dead) setFeed((had) => { if (had) { setRefreshFailed(true); return had; } setFailed(true); return null; }); });
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

  return <Market feed={feed} now={now} failed={failed} refreshFailed={refreshFailed} loading={feed === undefined && !failed} />;
}
