// Sharing the yacht's position from a host or crew phone, every 2 minutes while the app is open.
import { sb, state } from './store.js';
import { POSITION_INTERVAL_MS } from './config.js';

let watchId = null;
let lastSent = 0;
let wakeLock = null;
const listeners = new Set();
export const sharing = { on: false, last: null, error: null };

export function onSharing(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit() {
  for (const fn of listeners) fn(sharing);
}

async function keepAwake() {
  try {
    wakeLock = await navigator.wakeLock?.request('screen');
  } catch {
    wakeLock = null;
  }
}

async function send(p) {
  const now = Date.now();
  if (now - lastSent < POSITION_INTERVAL_MS - 5000) return;
  lastSent = now;
  const c = p.coords;
  const row = {
    trip_id: state.trip.id,
    lat: c.latitude,
    lon: c.longitude,
    speed_kn: Number.isFinite(c.speed) ? +(c.speed * 1.94384).toFixed(1) : null,
    heading: Number.isFinite(c.heading) ? Math.round(c.heading) : null,
    accuracy_m: Number.isFinite(c.accuracy) ? Math.round(c.accuracy) : null
  };
  const { error } = await sb.from('positions').insert(row);
  sharing.error = error ? 'Could not send. Will retry.' : null;
  if (!error) sharing.last = new Date().toISOString();
  if (error) lastSent = 0;
  emit();
}

export function startSharing() {
  if (!('geolocation' in navigator)) {
    sharing.error = 'This phone cannot share its location.';
    emit();
    return;
  }
  if (!state.trip) return;
  stopSharing(false);
  sharing.on = true;
  sharing.error = null;
  lastSent = 0;
  try {
    localStorage.setItem('delusha:sharing', state.trip.id);
  } catch {
    /* ignore */
  }
  watchId = navigator.geolocation.watchPosition(
    (p) => send(p),
    (e) => {
      sharing.error = e.code === 1 ? 'Location permission was refused.' : 'No GPS signal yet.';
      emit();
    },
    { enableHighAccuracy: true, maximumAge: 30000, timeout: 60000 }
  );
  keepAwake();
  emit();
}

export function stopSharing(save = true) {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  sharing.on = false;
  wakeLock?.release?.().catch(() => {});
  wakeLock = null;
  if (save) {
    try {
      localStorage.removeItem('delusha:sharing');
    } catch {
      /* ignore */
    }
  }
  emit();
}

export function resumeSharingIfOn() {
  try {
    if (state.staff && state.trip && localStorage.getItem('delusha:sharing') === state.trip.id) startSharing();
  } catch {
    /* ignore */
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && sharing.on) keepAwake();
});
