// Round-trip drive time and miles from home, and what that drive costs.
// The routing calls go to OpenRouteService (HeiGIT). The key is ORS_API_KEY in the environment and is
// never stored, logged or returned. With no key, nothing is looked up and drive time stays unknown.
// API shape taken from the official client (github.com/GIScience/openrouteservice-py, read Nov 17, 2026):
//   POST {base}/openrouteservice/v2/directions/driving-car/json  body {"coordinates":[[lng,lat],[lng,lat]]}
//   GET  {base}/pelias/v1/search?text=...   both with the key in the Authorization header.
import { RULES_CONFIG } from '../config/rules.js';

const round2 = (n) => Math.round(n * 100) / 100;
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const METERS_PER_MILE = 1609.344;
// A geocoder match below this is not trusted, and the drive stays unknown.
export const MIN_GEOCODE_CONFIDENCE = 0.8;

export const HOME_POINT = Object.freeze({ lat: RULES_CONFIG.areas[0].lat, lng: RULES_CONFIG.areas[0].lng });
export const routingKey = () => (process.env.ORS_API_KEY || '').trim() || null;
const base = () => (process.env.ORS_BASE_URL || 'https://api.heigit.org').replace(/\/+$/, '');

// One place, as a cache key. Coordinates win over an address.
export function placeKey(place) {
  if (!place) return null;
  if (num(place.lat) != null && num(place.lng) != null) return `p:${place.lat.toFixed(4)},${place.lng.toFixed(4)}`;
  const a = typeof place.address === 'string' ? place.address.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() : '';
  return a.length >= 4 ? `a:${a.slice(0, 160)}` : null;
}

// A stored or posted drive. Anything that is not a sane number is dropped.
export function cleanDrive(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const minutes = num(raw.minutes_round_trip);
  const miles = num(raw.miles_round_trip);
  if (minutes == null || miles == null || minutes < 0 || miles < 0 || minutes > 1440 || miles > 2000) return null;
  return {
    minutes_round_trip: Math.round(minutes),
    miles_round_trip: round2(miles),
    source: typeof raw.source === 'string' ? raw.source.slice(0, 40) : 'posted',
    looked_up_at: typeof raw.looked_up_at === 'string' ? raw.looked_up_at.slice(0, 40) : null,
    to: typeof raw.to === 'string' ? raw.to.slice(0, 160) : null,
  };
}

// What the drive costs: gas on the routed miles, and Adam's time at the hourly rate.
// Each part is null when it cannot be worked out. Null is never treated as $0 by the caller without saying so.
export function driveCosts(drive, rules) {
  const d = cleanDrive(drive);
  if (!d) return { minutes: null, miles: null, gas: null, time_cost: null };
  return {
    minutes: d.minutes_round_trip,
    miles: d.miles_round_trip,
    gas: num(rules.gas_per_mile) != null ? round2(d.miles_round_trip * rules.gas_per_mile) : null,
    time_cost: num(rules.hourly_rate) != null ? round2((d.minutes_round_trip / 60) * rules.hourly_rate) : null,
  };
}

export function driveText(drive) {
  const d = cleanDrive(drive);
  return d ? `${d.minutes_round_trip} min round trip, ${d.miles_round_trip} mi` : 'unknown';
}

async function call(url, init, deps) {
  const res = await deps.fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: deps.key }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`routing service answered ${res.status}`);
  return res.json();
}

// An address to a point. Null when there is no match or the match is weak.
export async function geocode(address, deps) {
  const q = new URLSearchParams({ text: address, size: '1', 'boundary.country': 'US', 'focus.point.lat': String(HOME_POINT.lat), 'focus.point.lon': String(HOME_POINT.lng) });
  const body = await call(`${base()}/pelias/v1/search?${q}`, { method: 'GET' }, deps);
  const f = body && Array.isArray(body.features) ? body.features[0] : null;
  const c = f && f.geometry && Array.isArray(f.geometry.coordinates) ? f.geometry.coordinates : null;
  const conf = f && f.properties ? num(f.properties.confidence) : null;
  if (!c || num(c[0]) == null || num(c[1]) == null || conf == null || conf < MIN_GEOCODE_CONFIDENCE) return null;
  return { lng: c[0], lat: c[1], label: typeof f.properties.label === 'string' ? f.properties.label : null };
}

// Home to the point by car. The way back is taken to be the same as the way there.
export async function routeRoundTrip(point, deps) {
  const body = await call(`${base()}/openrouteservice/v2/directions/driving-car/json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ coordinates: [[HOME_POINT.lng, HOME_POINT.lat], [point.lng, point.lat]] }),
  }, deps);
  const s = body && Array.isArray(body.routes) && body.routes[0] ? body.routes[0].summary : null;
  const meters = s ? num(s.distance) : null;
  const seconds = s ? num(s.duration) : null;
  if (meters == null || seconds == null) return null;
  return cleanDrive({
    minutes_round_trip: (seconds * 2) / 60,
    miles_round_trip: (meters * 2) / METERS_PER_MILE,
    source: 'openrouteservice',
    looked_up_at: new Date().toISOString(),
    to: point.label || null,
  });
}

// place: { lat, lng } or { address }. Returns a drive, or null when it cannot be worked out.
export async function lookUpDrive(place, deps) {
  let point = num(place.lat) != null && num(place.lng) != null ? { lat: place.lat, lng: place.lng } : null;
  if (!point && place.address) point = await geocode(place.address, deps);
  return point ? routeRoundTrip(point, deps) : null;
}
