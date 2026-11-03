// How old the scout feed is. More than 2 hours is stale.
export const STALE_MS = 2 * 60 * 60 * 1000;

export function agoLabel(ms) {
  const n = Math.max(0, Number(ms) || 0);
  const min = Math.floor(n / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const day = Math.floor(hr / 24);
  return `${day} day${day === 1 ? '' : 's'} ago`;
}

export function scoutFreshness(iso, now = Date.now()) {
  if (!iso) return { label: null, stale: false, ms: null };
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return { label: null, stale: false, ms: null };
  const ms = now - t;
  return { label: agoLabel(ms), stale: ms > STALE_MS, ms };
}
