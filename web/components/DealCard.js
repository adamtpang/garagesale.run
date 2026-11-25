import Photo from './Photo';
const money = (v) => (v === undefined || v === null || v === '' || isNaN(Number(v)) ? (v ?? '') : '$' + Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 }));
const pct = (v) => { const n = Number(v); if (isNaN(n)) return ''; return Math.round(n <= 1 && n > 0 ? n * 100 : n) + '%'; };
export function badge(src) {
  const s = String(src || '').toLowerCase();
  if (s.includes('fb') || s.includes('facebook') || s.includes('marketplace')) return ['FB', 'b-fb'];
  if (s.includes('ebay')) return ['eBay', 'b-ebay'];
  if (s.includes('amazon')) return ['Amazon', 'b-amazon'];
  if (s.includes('swappa')) return ['Swappa', 'b-other'];
  if (s.includes('mercari')) return ['Mercari', 'b-other'];
  if (s.includes('craigslist')) return ['Craigslist', 'b-other'];
  if (s.includes('offerup')) return ['OfferUp', 'b-other'];
  return [src ? 'Comps' : 'Web', 'b-other'];
}
export default function DealCard({ d, example }) {
  const link = d.fb_url || d.link || d.url;
  const photo = d.photo_url || d.image_url || d.image;
  const ask = d.ask_price ?? d.buy_price ?? d.price;
  const resell = d.resale_price ?? d.resell_price ?? d.est_market_price;
  const profit = d.est_profit ?? (resell !== undefined && ask !== undefined && !isNaN(resell - ask) ? Number(resell) - Number(ask) : undefined);
  const disc = d.discount_pct ?? (resell && ask ? (1 - ask / resell) * 100 : undefined);
  const comps = Array.isArray(d.comps) ? d.comps : [];
  const sellUrl = d.resale_url || d.resell_url || (comps[0] && (comps[0].url || comps[0].link)) || undefined;
  const [rb] = badge(d.resale_source || d.resell_source || d.resell_platform || (comps[0] && comps[0].source) || '');
  const spread = profit !== undefined && !isNaN(profit) && Number(ask) > 0 ? Math.round((Number(profit) / Number(ask)) * 100) : null;
  const href = d._href || link || undefined;
  return <div className="dcard dc2">
    <a className="dimg" href={href}>
      <Photo src={photo} title={d.title} fb={(d.fb_url || d.source_url || d.link || d.url)} />
      {example && <span className="extag">Example</span>}
      {disc !== undefined && !isNaN(disc) && <span className="off abs">{pct(disc)} under</span>}
    </a>
    <div className="dbody">
      <div className="dprice">{money(ask)}</div>
      <a className="dt" href={href}>{d.title}</a>
      <div className="dflip">
        <a className="leg buyl" href={link || undefined} target="_blank" rel="noopener"><span>Buy here</span><b>FB {money(ask)}</b></a>
        <a className="leg selll" href={sellUrl} target="_blank" rel="noopener"><span>Sell here</span><b>{resell !== undefined && resell !== null ? `${rb} ${money(resell)}` : 'Check comps'}</b></a>
      </div>
      {profit !== undefined && !isNaN(profit) && <em className="pchip big dpchip">+{money(profit)}{spread !== null && <small className="spct"> {spread}%</small>}</em>}
    </div>
  </div>;
}
