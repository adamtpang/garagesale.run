'use client';
// The star that adds a deal to Targets or takes it off. Lives outside the tile's link, so it is its own
// button for keyboard and screen readers.
import React, { useEffect, useState } from 'react';
import { readTargets, toggleTarget, TARGETS_EVENT } from '../lib/targets.js';

const e = React.createElement;

export default function TargetStar({ tile, big = false }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const sync = () => setOn(!!readTargets()[tile.id]);
    sync();
    window.addEventListener(TARGETS_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(TARGETS_EVENT, sync); window.removeEventListener('storage', sync); };
  }, [tile.id]);
  const click = () => { const next = toggleTarget(tile); if (next !== null) setOn(next); };
  const label = on ? 'In Targets' : 'Add to Targets';
  if (big) {
    return e('button', { type: 'button', onClick: click, 'aria-pressed': on, 'data-field': 'target-star', className: `inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold ${on ? 'bg-brand text-white' : 'bg-card text-foreground'}` },
      e('span', { 'aria-hidden': 'true' }, on ? '★' : '☆'), label);
  }
  return e('button', {
    type: 'button',
    onClick: click,
    'aria-pressed': on,
    'aria-label': `${label}: ${tile.title}`,
    title: label,
    'data-field': 'target-star',
    className: `absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-border text-lg leading-none ${on ? 'bg-brand text-white' : 'bg-card text-foreground'}`,
  }, on ? '★' : '☆');
}
