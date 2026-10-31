// In-memory stand-in for the Supabase REST, auth, storage and functions endpoints.
const fs = require('fs');
const crypto = require('crypto');
const BASE = 'https://ynrsjazaeywoqdxvgipl.supabase.co';
const PHOTO = fs.readFileSync(require('path').join(__dirname, '..') + '/Delusha Beauty Shots/IMG-20250617-WA0016.jpg');
const today = new Date();
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (n) => iso(new Date(Date.now() + n * 86400000));
const uid = () => crypto.randomUUID();

function makeDb() {
  const trip = uid();
  const s1 = uid(), s2 = uid(), s3 = uid();
  const users = {
    host: { id: uid(), email: 'njalbout@gmail.com', password: 'HostPass-123' },
    crew: { id: uid(), email: 'sophie@delusha.test', password: 'CrewPass-123' },
    guest: { id: uid(), email: 'guest-x@guests.sydelusha.app' }
  };
  const gA = uid(), gB = uid();
  const now = new Date().toISOString();
  const nowH = today.getHours();
  const t = (h) => `${String(Math.min(23, Math.max(0, h))).padStart(2, '0')}:00`;
  return {
    users,
    tables: {
      staff: [
        { id: uid(), user_id: users.host.id, email: users.host.email, name: 'Nizar', role: 'host', title: 'Host', created_at: now },
        { id: uid(), user_id: users.crew.id, email: users.crew.email, name: 'Sophie', role: 'crew', title: 'Chief Stewardess', created_at: now },
        { id: uid(), user_id: null, email: 'deana@x.com', name: 'Deana', role: 'host', title: 'Host', created_at: now }
      ],
      trips: [{ id: trip, title: 'Ionian summer', start_date: addDays(-2), end_date: addDays(5), allow_corinth: false, current_stop_id: s2, created_at: now }],
      stops: [
        { id: s1, trip_id: trip, seq: 0, port_id: 'corfu', name: 'Corfu', lat: 39.62, lon: 19.92, arrive_on: addDays(-2) },
        { id: s2, trip_id: trip, seq: 1, port_id: 'paxos', name: 'Paxos', lat: 39.198, lon: 20.186, arrive_on: addDays(0), tender_name: 'Stone quay', tender_lat: 39.197, tender_lon: 20.187 },
        { id: s3, trip_id: trip, seq: 2, port_id: 'fiskardo', name: 'Fiskardo', lat: 38.459, lon: 20.577, arrive_on: addDays(1) }
      ],
      guests: [
        { id: gA, trip_id: trip, name: 'Sofia', cabin: 'Port VIP', is_host: false, user_id: users.guest.id, created_at: now },
        { id: gB, trip_id: trip, name: 'Leo', cabin: 'Twin', is_host: false, user_id: null, created_at: now }
      ],
      guest_invites: [
        { guest_id: gA, token: 'a'.repeat(36) },
        { guest_id: gB, token: 'b'.repeat(36) }
      ],
      preferences: [],
      day_plans: [{ id: uid(), trip_id: trip, plan_date: iso(today), headline: 'Gaios, Paxos', subline: 'Ionian Sea', schedule: [{ time: t(nowH - 2), label: 'Breakfast on the aft deck' }, { time: t(nowH + 1), label: 'Tender ashore to Gaios', note: 'Meet at the stern platform' }, { time: t(nowH + 3), label: 'Dinner on deck' }] }],
      menus: [{ id: uid(), trip_id: trip, menu_date: iso(today), meal: 'dinner', served_at: '21:00', location: 'On deck', note: 'Fish from Gaios.', courses: [{ course: 'Main', name: 'Sea bass', desc: 'Lemon potatoes', tags: 'Gluten-free' }, { course: 'Dessert', name: 'Pistachio baklava', desc: 'With almonds', tags: '' }], author_name: 'Elena' }],
      safety_sections: [1, 2, 3, 4, 5, 6].map((n) => ({ id: uid(), seq: n, title: `Section ${n}`, body: `Body ${n}` })),
      safety_acks: [],
      alerts: [{ id: uid(), trip_id: trip, title: 'Welcome aboard', body: 'Drinks at 7', sender_name: 'Nizar', created_by: users.host.id, created_at: now }],
      requests: [],
      media: [],
      media_favs: [],
      positions: [{ id: 1, trip_id: trip, lat: 39.2, lon: 20.19, speed_kn: 0, heading: 312, recorded_at: now }],
      logbook: [{ id: uid(), trip_id: trip, entry_date: addDays(-1), route: 'Corfu → Paxos', distance_nm: 37, peak_kn: 9.8, wind: 'NW 14 kn', note: 'Great sail.' }],
      yacht_settings: [{ id: 1, wifi_ssid: 'SY_Delusha_Starlink', wifi_password: 'secret-pw', crew: [{ name: 'Marko', role: 'Captain' }], toys: [{ name: 'Seabob', meta: 'x2' }] }],
      push_subscriptions: []
    },
    storage: {},
    log: []
  };
}

function jwt(user) {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b({ alg: 'HS256', typ: 'JWT' })}.${b({ sub: user.id, email: user.email, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
}
function session(user) {
  return { access_token: jwt(user), refresh_token: `r-${user.id}`, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: user.id, email: user.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} } };
}
function userFromAuth(db, h) {
  const tok = (h.authorization || '').replace('Bearer ', '');
  const parts = tok.split('.');
  if (parts.length !== 3) return null;
  try {
    const p = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    return Object.values(db.users).find((u) => u.id === p.sub) || null;
  } catch {
    return null;
  }
}

function parseVal(v) {
  if (v === 'null') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return v;
}
function applyFilters(rows, params) {
  let out = rows;
  for (const [k, raw] of params) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue;
    const i = raw.indexOf('.');
    const op = raw.slice(0, i);
    const v = raw.slice(i + 1);
    out = out.filter((r) => {
      const x = r[k];
      if (op === 'eq') return String(x) === String(parseVal(v)) || x === parseVal(v);
      if (op === 'neq') return String(x) !== v;
      if (op === 'in') return v.replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/^"|"$/g, '')).includes(String(x));
      if (op === 'lte') return String(x) <= v;
      if (op === 'gte') return String(x) >= v;
      if (op === 'lt') return String(x) < v;
      if (op === 'gt') return String(x) > v;
      if (op === 'is') return x === parseVal(v);
      return true;
    });
  }
  return out;
}
function applyOrder(rows, params) {
  const o = params.get('order');
  let out = [...rows];
  if (o) {
    const [col, dir] = o.split(',')[0].split('.');
    out.sort((a, b) => (String(a[col] ?? '') < String(b[col] ?? '') ? -1 : String(a[col] ?? '') > String(b[col] ?? '') ? 1 : 0) * (dir === 'desc' ? -1 : 1));
  }
  const lim = params.get('limit');
  if (lim) out = out.slice(0, Number(lim));
  return out;
}
const DEFAULTS = {
  alerts: () => ({ id: uid(), created_at: new Date().toISOString() }),
  requests: () => ({ id: uid(), status: 'new', urgent: false, captain_told: false, services: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
  media: () => ({ id: uid(), on_tv: true, created_at: new Date().toISOString() }),
  guests: () => ({ id: uid(), is_host: false, user_id: null, created_at: new Date().toISOString() }),
  trips: () => ({ id: uid(), allow_corinth: false, current_stop_id: null, created_at: new Date().toISOString() }),
  stops: () => ({ id: uid() }),
  staff: () => ({ id: uid(), user_id: null, created_at: new Date().toISOString() }),
  menus: () => ({ id: uid() }),
  day_plans: () => ({ id: uid() }),
  logbook: () => ({ id: uid() }),
  positions: () => ({ id: Math.floor(Math.random() * 1e6), recorded_at: new Date().toISOString() }),
  safety_acks: () => ({ acked_at: new Date().toISOString() }),
  media_favs: () => ({ created_at: new Date().toISOString() }),
  preferences: () => ({ diet: [], food_done: false, cabin_done: false })
};
const KEYS = { preferences: ['guest_id'], safety_acks: ['guest_id', 'section_id'], media_favs: ['media_id', 'user_id'], guest_invites: ['guest_id'], push_subscriptions: ['endpoint'], yacht_settings: ['id'] };

async function handle(db, route) {
  const req = route.request();
  const url = new URL(req.url());
  const method = req.method();
  const h = req.headers();
  const p = url.pathname;
  const json = (status, body, headers = {}) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*', ...headers }, body: body === undefined ? '' : JSON.stringify(body) });
  if (method === 'OPTIONS') return json(200, {});
  const body = req.postData() ? (() => { try { return JSON.parse(req.postData()); } catch { return req.postData(); } })() : null;
  const me = userFromAuth(db, h);
  db.log.push(`${method} ${p}${url.search}`);

  // auth
  if (p === '/auth/v1/token') {
    if (url.searchParams.get('grant_type') === 'password') {
      const u = Object.values(db.users).find((x) => x.email === body.email && x.password === body.password);
      return u ? json(200, session(u)) : json(400, { error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials' });
    }
    const u = Object.values(db.users).find((x) => body.refresh_token === `r-${x.id}`);
    return u ? json(200, session(u)) : json(400, { error: 'invalid_grant' });
  }
  if (p === '/auth/v1/user') return me ? json(200, session(me).user) : json(401, { msg: 'no' });
  if (p === '/auth/v1/logout') return json(204);

  // functions
  if (p === '/functions/v1/guest-session') {
    const inv = db.tables.guest_invites.find((i) => i.token === body.token);
    if (!inv) return json(404, { error: 'This invite link is not valid any more. Ask your host for a new one.' });
    const g = db.tables.guests.find((x) => x.id === inv.guest_id);
    let u = Object.values(db.users).find((x) => x.id === g.user_id);
    if (!u) {
      u = { id: uid(), email: `guest-${g.id}@guests.sydelusha.app` };
      db.users[`g-${g.id}`] = u;
      g.user_id = u.id;
    }
    const s = session(u);
    return json(200, { session: { access_token: s.access_token, refresh_token: s.refresh_token }, guest: { id: g.id, name: g.name, trip_id: g.trip_id } });
  }
  if (p === '/functions/v1/staff-account') {
    if (body.action === 'claim') {
      const st = db.tables.staff.find((s) => s.email === body.email);
      if (!st) return json(404, { error: 'This email is not on the Delusha team list. Ask a host to add you.' });
      if (st.user_id) return json(409, { error: 'This account is already set up. Sign in with your password.' });
      const u = { id: uid(), email: st.email, password: body.password };
      db.users[st.email] = u;
      st.user_id = u.id;
      return json(200, { ok: true });
    }
    return json(200, { ok: true });
  }
  if (p === '/functions/v1/notify') return json(200, { sent: 0 });

  // storage
  if (p.startsWith('/storage/v1/object/sign/')) {
    const bucket = p.split('/')[5];
    if (method === 'POST' && body?.paths) {
      return json(200, body.paths.map((path) => ({ path, signedURL: `/object/sign/${bucket}/${path}?token=t`, error: null })));
    }
    const path = decodeURIComponent(p.split(`/sign/${bucket}/`)[1]);
    const f = db.storage[`${bucket}/${path}`];
    let data = f?.data;
    if (data && data.indexOf(Buffer.from([0xff, 0xd8])) > 0) data = data.slice(data.indexOf(Buffer.from([0xff, 0xd8])));
    return route.fulfill({ status: 200, contentType: 'image/jpeg', body: data || PHOTO });
  }
  if (p.startsWith('/storage/v1/object/')) {
    const rest = p.replace('/storage/v1/object/', '');
    if (method === 'POST' || method === 'PUT') {
      const buf = req.postDataBuffer();
      db.storage[decodeURIComponent(rest)] = { data: buf, type: h['content-type'] };
      return json(200, { Key: rest });
    }
    if (method === 'DELETE') return json(200, []);
  }

  // rest
  if (p.startsWith('/rest/v1/')) {
    const table = p.replace('/rest/v1/', '');
    if (table.startsWith('rpc/')) return json(200, null);
    const rows = db.tables[table] || (db.tables[table] = []);
    const params = url.searchParams;
    const single = (h.accept || '').includes('vnd.pgrst.object');
    const prefer = h.prefer || '';
    const respond = (data) => {
      if (single) {
        if (data.length !== 1) return json(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' });
        return json(200, data[0]);
      }
      return json(200, data);
    };
    if (method === 'GET' || method === 'HEAD') return respond(applyOrder(applyFilters(rows, params), params));
    if (method === 'POST') {
      const items = Array.isArray(body) ? body : [body];
      const out = [];
      for (const it of items) {
        const keys = params.get('on_conflict')?.split(',') || KEYS[table] || ['id'];
        const existing = prefer.includes('merge-duplicates') ? rows.find((r) => keys.every((k) => it[k] !== undefined && String(r[k]) === String(it[k]))) : null;
        if (!existing && (KEYS[table] || ['id']).every((k) => it[k] !== undefined) && rows.find((r) => (KEYS[table] || ['id']).every((k) => String(r[k]) === String(it[k])))) {
          return json(409, { code: '23505', message: 'duplicate key value violates unique constraint' });
        }
        if (existing) {
          Object.assign(existing, it);
          out.push(existing);
        } else {
          const row = { ...(DEFAULTS[table]?.() || {}), ...it };
          if (['requests', 'alerts', 'media'].includes(table) && me) {
            if (table === 'media') row.uploaded_by = row.uploaded_by || me.id;
            else row.created_by = row.created_by || me.id;
          }
          if (table === 'media_favs' && me) row.user_id = row.user_id || me.id;
          if (table === 'guests') db.tables.guest_invites.push({ guest_id: row.id, token: crypto.randomBytes(18).toString('hex') });
          rows.push(row);
          out.push(row);
        }
      }
      return prefer.includes('return=representation') ? respond(out) : json(201);
    }
    if (method === 'PATCH') {
      const hit = applyFilters(rows, params);
      for (const r of hit) Object.assign(r, body);
      return prefer.includes('return=representation') ? respond(hit) : json(204);
    }
    if (method === 'DELETE') {
      const hit = new Set(applyFilters(rows, params));
      db.tables[table] = rows.filter((r) => !hit.has(r));
      return json(204);
    }
  }
  return json(404, { message: 'not mocked ' + p });
}

module.exports = { makeDb, handle, BASE, PHOTO };
