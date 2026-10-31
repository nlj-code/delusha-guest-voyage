// Data layer: Supabase client, who is signed in, the current trip and its data.
// Everything fetched is also cached on the phone so the app still works without signal.
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { isoDate } from './util.js';

export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'delusha-auth' }
});

const listeners = new Set();
export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit(key) {
  for (const fn of listeners) {
    try {
      fn(key);
    } catch (e) {
      console.error(e);
    }
  }
}

export const state = {
  user: null,
  staff: null, // { id, name, role, title } when the person is a host or crew member
  guest: null, // this person's guest row on the current trip
  trip: null,
  trips: [],
  stops: [],
  guests: [],
  plan: null,
  menus: [],
  alerts: [],
  media: [],
  favs: [],
  position: null,
  settings: null,
  safety: [],
  acks: [],
  prefs: null,
  requests: [],
  logbook: [],
  staffList: [],
  allPrefs: [],
  allAcks: [],
  online: navigator.onLine,
  ready: false
};

export const role = () => (state.staff ? state.staff.role : state.guest ? 'guest' : 'none');
export const isHost = () => state.staff?.role === 'host';
export const isStaff = () => !!state.staff;
export const myName = () => state.staff?.name || state.guest?.name || 'Guest';

// ---------------------------------------------------------------- cache

function cacheKey(k) {
  return `delusha:${state.user?.id || 'anon'}:${state.trip?.id || 'none'}:${k}`;
}
function saveCache(k, v) {
  try {
    localStorage.setItem(cacheKey(k), JSON.stringify(v));
  } catch {
    /* storage full or blocked: the app still works online */
  }
}
function loadCache(k) {
  try {
    const raw = localStorage.getItem(cacheKey(k));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function q(promise) {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

// Fetch with cache fallback. Returns cached data when offline or on error.
async function fetchCached(k, fn) {
  try {
    const data = await fn();
    saveCache(k, data);
    return data;
  } catch (e) {
    const cached = loadCache(k);
    if (cached !== null) return cached;
    throw e;
  }
}

// ---------------------------------------------------------------- auth

export async function joinWithInvite(token) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/guest-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
    body: JSON.stringify({ token })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Could not open your invite.');
  const { error } = await sb.auth.setSession(body.session);
  if (error) throw error;
  try {
    localStorage.setItem('delusha:tripId', body.guest.trip_id);
  } catch {
    /* ignore */
  }
  return body.guest;
}

export async function signIn(email, password) {
  const { error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Email or password is wrong.' : error.message);
}

export async function claimStaffAccount(email, password) {
  const { data, error } = await sb.functions.invoke('staff-account', {
    body: { action: 'claim', email: email.trim().toLowerCase(), password }
  });
  if (error) {
    const msg = await error.context?.json?.().catch(() => null);
    throw new Error(msg?.error || 'Could not set up your account.');
  }
  if (data?.error) throw new Error(data.error);
  await signIn(email, password);
}

export async function resetStaffPassword(staffId, password) {
  const { data, error } = await sb.functions.invoke('staff-account', {
    body: { action: 'reset', staff_id: staffId, password }
  });
  if (error) {
    const msg = await error.context?.json?.().catch(() => null);
    throw new Error(msg?.error || 'Could not reset the password.');
  }
  if (data?.error) throw new Error(data.error);
}

export async function signOut() {
  stopRealtime();
  await sb.auth.signOut().catch(() => {});
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith('delusha:')) localStorage.removeItem(k);
  }
  Object.assign(state, {
    user: null, staff: null, guest: null, trip: null, trips: [], stops: [], guests: [], plan: null,
    menus: [], alerts: [], media: [], favs: [], position: null, settings: null, safety: [], acks: [],
    prefs: null, requests: [], logbook: [], staffList: [], allPrefs: [], allAcks: []
  });
}

// Works out who is signed in and which trip to show.
export async function loadProfile() {
  const { data } = await sb.auth.getSession();
  state.user = data.session?.user || null;
  if (!state.user) {
    state.ready = true;
    return;
  }

  const profile = await fetchCached('profile', async () => {
    const staff = await q(sb.from('staff').select('id, name, role, title, email').eq('user_id', state.user.id).maybeSingle());
    const myGuests = await q(sb.from('guests').select('*').eq('user_id', state.user.id));
    return { staff, myGuests };
  }).catch(() => ({ staff: null, myGuests: [] }));

  state.staff = profile.staff || null;

  let trips = [];
  try {
    trips = await fetchCached('trips', () => q(sb.from('trips').select('*').order('start_date', { ascending: false })));
  } catch {
    trips = [];
  }
  state.trips = trips || [];

  let saved = null;
  try {
    saved = localStorage.getItem('delusha:tripId');
  } catch {
    /* ignore */
  }
  const today = isoDate();
  const pick =
    state.trips.find((t) => t.id === saved) ||
    state.trips.find((t) => t.start_date <= today && t.end_date >= today) ||
    [...state.trips].reverse().find((t) => t.start_date > today) ||
    state.trips[0] ||
    null;

  state.trip = pick;
  state.guest = pick ? (profile.myGuests || []).find((g) => g.trip_id === pick.id) || null : null;
  state.ready = true;
}

export function setTrip(id) {
  try {
    localStorage.setItem('delusha:tripId', id);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------- loaders

const loaders = {
  trip: async () => {
    state.trip = await fetchCached('trip', () => q(sb.from('trips').select('*').eq('id', state.trip.id).single()));
  },
  stops: async () => {
    state.stops = await fetchCached('stops', () =>
      q(sb.from('stops').select('*').eq('trip_id', state.trip.id).order('seq'))
    );
  },
  guests: async () => {
    state.guests = await fetchCached('guests', () =>
      q(sb.from('guests').select('id, trip_id, name, cabin, is_host, user_id, created_at').eq('trip_id', state.trip.id).order('created_at'))
    );
    if (state.user) state.guest = state.guests.find((g) => g.user_id === state.user.id) || state.guest;
  },
  plan: async () => {
    const rows = await fetchCached('plan', () =>
      q(sb.from('day_plans').select('*').eq('trip_id', state.trip.id).lte('plan_date', isoDate()).order('plan_date', { ascending: false }).limit(1))
    );
    state.plan = rows?.[0] || null;
  },
  menus: async () => {
    state.menus = await fetchCached('menus', () =>
      q(sb.from('menus').select('*').eq('trip_id', state.trip.id).gte('menu_date', isoDate(new Date(Date.now() - 86400000))).order('menu_date'))
    );
  },
  alerts: async () => {
    state.alerts = await fetchCached('alerts', () =>
      q(sb.from('alerts').select('*').eq('trip_id', state.trip.id).order('created_at', { ascending: false }).limit(60))
    );
  },
  media: async () => {
    state.media = await fetchCached('media', () =>
      q(sb.from('media').select('*').eq('trip_id', state.trip.id).order('created_at', { ascending: false }).limit(1000))
    );
  },
  favs: async () => {
    const ids = state.media.map((m) => m.id);
    state.favs = ids.length
      ? await fetchCached('favs', async () => {
          const out = [];
          for (let i = 0; i < ids.length; i += 150) {
            out.push(...(await q(sb.from('media_favs').select('media_id, user_id').in('media_id', ids.slice(i, i + 150)))));
          }
          return out;
        })
      : [];
  },
  position: async () => {
    const rows = await fetchCached('position', () =>
      q(sb.from('positions').select('*').eq('trip_id', state.trip.id).order('recorded_at', { ascending: false }).limit(1))
    );
    state.position = rows?.[0] || null;
  },
  settings: async () => {
    state.settings = await fetchCached('settings', () => q(sb.from('yacht_settings').select('*').eq('id', 1).maybeSingle()));
  },
  safety: async () => {
    state.safety = await fetchCached('safety', () => q(sb.from('safety_sections').select('*').order('seq')));
  },
  acks: async () => {
    state.acks = state.guest
      ? await fetchCached('acks', () => q(sb.from('safety_acks').select('section_id, acked_at').eq('guest_id', state.guest.id)))
      : [];
  },
  prefs: async () => {
    state.prefs = state.guest
      ? await fetchCached('prefs', () => q(sb.from('preferences').select('*').eq('guest_id', state.guest.id).maybeSingle()))
      : null;
  },
  requests: async () => {
    let query = sb.from('requests').select('*').eq('trip_id', state.trip.id).order('created_at', { ascending: false }).limit(200);
    if (!state.staff) query = query.eq('created_by', state.user.id);
    state.requests = await fetchCached('requests', () => q(query));
  },
  logbook: async () => {
    state.logbook = await fetchCached('logbook', () =>
      q(sb.from('logbook').select('*').eq('trip_id', state.trip.id).order('entry_date'))
    );
  },
  staffList: async () => {
    state.staffList = state.staff ? await fetchCached('staffList', () => q(sb.from('staff').select('*').order('created_at'))) : [];
  },
  allPrefs: async () => {
    if (!state.staff) return (state.allPrefs = []);
    const ids = state.guests.map((g) => g.id);
    state.allPrefs = ids.length ? await fetchCached('allPrefs', () => q(sb.from('preferences').select('*').in('guest_id', ids))) : [];
  },
  allAcks: async () => {
    if (!state.staff) return (state.allAcks = []);
    const ids = state.guests.map((g) => g.id);
    state.allAcks = ids.length ? await fetchCached('allAcks', () => q(sb.from('safety_acks').select('*').in('guest_id', ids))) : [];
  }
};

export async function load(...keys) {
  if (!state.trip && !keys.every((k) => k === 'settings' || k === 'safety' || k === 'staffList')) return;
  for (const k of keys) {
    try {
      await loaders[k]();
    } catch (e) {
      console.warn('load failed', k, e?.message || e);
    }
    emit(k);
  }
}

export async function loadAll() {
  if (!state.trip) {
    await load('settings', 'safety', 'staffList');
    return;
  }
  await Promise.all([
    load('trip', 'stops', 'position'),
    load('guests', 'acks', 'prefs', 'allPrefs', 'allAcks'),
    load('plan', 'menus', 'alerts'),
    load('media', 'favs'),
    load('settings', 'safety', 'requests', 'logbook', 'staffList')
  ]);
}

// ---------------------------------------------------------------- realtime

let channel = null;
const TABLE_KEYS = {
  alerts: ['alerts'],
  requests: ['requests'],
  media: ['media', 'favs'],
  media_favs: ['favs'],
  positions: ['position'],
  day_plans: ['plan'],
  menus: ['menus'],
  stops: ['stops'],
  trips: ['trip']
};

export function startRealtime() {
  stopRealtime();
  if (!state.trip) return;
  const id = state.trip.id;
  channel = sb.channel(`trip-${id}`);
  for (const table of Object.keys(TABLE_KEYS)) {
    const filter = table === 'media_favs' ? undefined : table === 'trips' ? `id=eq.${id}` : `trip_id=eq.${id}`;
    channel.on('postgres_changes', { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) }, (payload) => {
      handleRealtime(table, payload);
    });
  }
  channel.subscribe();
}

export function stopRealtime() {
  if (channel) {
    sb.removeChannel(channel);
    channel = null;
  }
}

const pendingReload = new Set();
let reloadTimer = null;
function handleRealtime(table, payload) {
  if (table === 'alerts' && payload.eventType === 'INSERT') emit('newAlert:' + payload.new.id);
  for (const k of TABLE_KEYS[table]) pendingReload.add(k);
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    const keys = [...pendingReload];
    pendingReload.clear();
    load(...keys);
  }, 400);
}

window.addEventListener('online', () => {
  state.online = true;
  emit('online');
});
window.addEventListener('offline', () => {
  state.online = false;
  emit('online');
});

// ---------------------------------------------------------------- derived data

export function currentStop() {
  if (!state.stops.length) return null;
  return state.stops.find((s) => s.id === state.trip?.current_stop_id) || state.stops[0];
}

export function currentStopIndex() {
  const cur = currentStop();
  return cur ? state.stops.indexOf(cur) : -1;
}

export function menusFor(date) {
  return state.menus.filter((m) => m.menu_date === date);
}

export function prefsFor(guestId) {
  return state.allPrefs.find((p) => p.guest_id === guestId) || null;
}

// Allergy words from guests' answers, used to flag menu dishes.
export function allergyWords() {
  const words = [];
  const source = state.staff ? state.allPrefs : state.prefs ? [state.prefs] : [];
  for (const p of source) {
    if (!p?.allergies) continue;
    for (const part of p.allergies.toLowerCase().split(/[,;/()]+|\band\b/)) {
      const w = part.trim().replace(/\s+/g, ' ');
      if (w.length >= 3) words.push({ word: w, guestId: p.guest_id, severity: p.allergy_severity });
    }
  }
  return words;
}

// Common allergen families, so "tree nuts" also catches pistachio, almond and so on.
const FAMILIES = [
  [/tree ?nut|\bnuts?\b/, ['nut', 'almond', 'pistachio', 'walnut', 'hazelnut', 'cashew', 'pecan', 'macadamia', 'praline', 'marzipan', 'pine nut', 'frangipane', 'baklava', 'pesto']],
  [/peanut/, ['peanut', 'satay', 'groundnut']],
  [/shellfish|crustacean|seafood/, ['shrimp', 'prawn', 'crab', 'lobster', 'langoustine', 'crayfish', 'mussel', 'clam', 'oyster', 'scallop', 'shellfish']],
  [/mollus/, ['mussel', 'clam', 'oyster', 'scallop', 'squid', 'octopus', 'calamari', 'cuttlefish']],
  [/\bfish\b/, ['fish', 'bream', 'bass', 'tuna', 'salmon', 'cod', 'anchov', 'sardine', 'mackerel', 'swordfish', 'snapper', 'crudo', 'tartare']],
  [/dairy|lactose|milk/, ['milk', 'cream', 'butter', 'cheese', 'feta', 'yoghurt', 'yogurt', 'burrata', 'mozzarella', 'parmesan', 'ricotta', 'custard', 'gelato', 'galaktoboureko']],
  [/gluten|wheat|coeliac|celiac/, ['bread', 'pasta', 'flour', 'wheat', 'couscous', 'breadcrumb', 'tagliolini', 'spaghetti', 'linguine', 'filo', 'phyllo', 'semolina', 'pastry', 'brioche', 'focaccia', 'orzo', 'barley']],
  [/\beggs?\b/, ['egg', 'mayonnaise', 'aioli', 'meringue', 'custard', 'hollandaise']],
  [/sesame/, ['sesame', 'tahini', 'halva']],
  [/soy/, ['soy', 'tofu', 'edamame', 'miso']],
  [/mustard/, ['mustard']],
  [/celery/, ['celery', 'celeriac']]
];

function termsFor(word) {
  const terms = new Set([word.replace(/s$/, '')]);
  for (const [re, list] of FAMILIES) if (re.test(word)) list.forEach((t) => terms.add(t));
  return [...terms].filter((t) => t.length >= 3);
}

export function flagDish(course) {
  const text = `${course.name || ''} ${course.desc || ''}`.toLowerCase();
  const hits = [];
  for (const a of allergyWords()) {
    for (const t of termsFor(a.word)) {
      // "nut-free" or "without nuts" means the chef already handled it.
      if (text.includes(t) && !new RegExp(`(${t}[a-z]*[- ]free|without [a-z ]*${t}|no ${t})`).test(text)) {
        hits.push(a);
        break;
      }
    }
  }
  return hits;
}
