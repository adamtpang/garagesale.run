'use client';
import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
export default function NavMsgs() {
  const [unread, setUnread] = useState(0); const [toast, setToast] = useState(''); const last = useRef(null);
  useEffect(() => {
    let alive = true;
    const onMsgs = () => typeof window !== 'undefined' && window.location.pathname.startsWith('/conversations');
    const load = async () => {
      try {
        const j = await (await fetch('/api/jobs?recent=1', { cache: 'no-store' })).json();
        if (!alive || !Array.isArray(j.jobs)) return;
        const jobs = j.jobs.filter((x) => !x.test);
        const total = jobs.reduce((a, x) => a + (Number(x.inquiries) || 0), 0);
        if (last.current !== null && total > last.current) {
          let who = 'a buyer';
          try { const jb = jobs.find((x) => Number(x.inquiries) > 0); if (jb) { const f = await (await fetch(`/api/jobs/${jb.id}`, { cache: 'no-store' })).json(); const qs = (f && f.inquiries) || []; const q = qs.slice().sort((a, b) => String(b.ts || '').localeCompare(String(a.ts || '')))[0]; if (q && q.buyer_name) who = q.buyer_name; } } catch (e) {}
          if (alive) { setToast(`New message from ${who}`); setTimeout(() => alive && setToast(''), 6000); }
        }
        last.current = total;
        let seen = 0; try { seen = Number(localStorage.getItem('gs_seen_msgs') || 0); } catch (e) {}
        if (onMsgs()) { try { localStorage.setItem('gs_seen_msgs', String(total)); } catch (e) {} setUnread(0); } else setUnread(Math.max(0, total - seen));
      } catch (e) {}
    };
    load(); const t = setInterval(load, onMsgs() ? 15000 : 30000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  return <><a href="/conversations" className="msglink relative inline-flex items-center sm:gap-1.5">Messages{unread > 0 && <Badge variant="destructive" className="absolute -right-1 -top-1.5 h-4 min-w-4 justify-center px-1 text-[10px] leading-none not-italic sm:static sm:h-5 sm:min-w-5 sm:px-1.5 sm:text-xs">{unread}</Badge>}</a>
    {toast && <a href="/conversations" className="fixed left-1/2 top-20 z-[60] -translate-x-1/2 rounded-full border border-border bg-card/95 px-5 py-3 text-sm font-medium text-foreground shadow-2xl backdrop-blur animate-in fade-in slide-in-from-top-2">{toast}</a>}</>;
}
