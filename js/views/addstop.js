// Add an itinerary stop without typing coordinates: search by name, drop a pin on the map, or use GPS.
import { sb, state, load, currentStop } from '../store.js';
import { esc, icon, toast, fmtDate, debounce, parseDate, isoDate } from '../util.js';
import { VoyageChart, mercYToLat, haversineNm, isLand } from '../map.js';
import { busy } from './ui.js';

const KINDS = ['Anchorage', 'Beach', 'Port', 'Restaurant', 'Swim stop'];
const PHOTON = 'https://photon.komoot.io';

// What kind of place an OpenStreetMap result is, and how to show it.
function classify(key, value) {
  const v = `${key}:${value}`;
  if (/natural:beach|leisure:beach_resort/.test(v)) return { badge: 'BEACH', kind: 'Beach', label: 'Beach', tone: 'brass' };
  if (/natural:(bay|cape|peninsula|strait)|place:(islet|island)/.test(v)) return { badge: value === 'bay' ? 'COVE' : 'COAST', kind: 'Anchorage', label: value === 'bay' ? 'Cove' : value.charAt(0).toUpperCase() + value.slice(1), tone: 'accent' };
  if (/leisure:marina|harbour|landuse:harbour|seamark|man_made:pier|amenity:ferry_terminal/.test(v)) return { badge: 'PORT', kind: 'Port', label: 'Marina or harbour', tone: 'accent' };
  if (/amenity:(restaurant|cafe|bar|pub|fast_food|biergarten)/.test(v)) return { badge: 'FOOD', kind: 'Restaurant', label: value === 'cafe' ? 'Café' : value.charAt(0).toUpperCase() + value.slice(1), tone: 'warn' };
  if (/leisure:nature_reserve|boundary:(protected_area|national_park)|leisure:park/.test(v)) return { badge: 'PARK', kind: 'Anchorage', label: 'Nature park', tone: 'live' };
  if (/place:(village|town|city|hamlet|suburb|locality)/.test(v)) return { badge: 'TOWN', kind: 'Port', label: value.charAt(0).toUpperCase() + value.slice(1), tone: '' };
  return { badge: 'PLACE', kind: 'Anchorage', label: (value || 'Place').replace(/_/g, ' '), tone: '' };
}

function anchorPoint() {
  const cur = currentStop() || state.stops[state.stops.length - 1];
  if (state.position) return { lat: state.position.lat, lon: state.position.lon };
  if (cur) return { lat: cur.lat, lon: cur.lon };
  return { lat: 39.5, lon: 3 };
}

function nmFrom(lat, lon) {
  const a = anchorPoint();
  const d = haversineNm(a.lat, a.lon, lat, lon);
  return d < 10 ? `${d.toFixed(1)} nm` : `${Math.round(d)} nm`;
}

async function search(q) {
  const out = [];
  const lower = q.toLowerCase();
  // Built-in port guides first: they work offline.
  for (const p of self.DELUSHA_DATA?.PRESET_PORTS || []) {
    if (p.name.toLowerCase().includes(lower)) out.push({ name: p.name, meta: `Port with guide · ${p.country}`, badge: 'PORT', tone: 'accent', kind: 'Port', lat: p.lat, lon: p.lon, port: p });
  }
  if (!navigator.onLine) return out;
  const a = anchorPoint();
  try {
    const r = await fetch(`${PHOTON}/api/?q=${encodeURIComponent(q)}&lat=${a.lat}&lon=${a.lon}&limit=10&lang=en`);
    const data = await r.json();
    for (const f of data.features || []) {
      const p = f.properties || {};
      if (!p.name) continue;
      const [lon, lat] = f.geometry.coordinates;
      const c = classify(p.osm_key, p.osm_value);
      const where = [p.city || p.county, p.state || p.country].filter(Boolean).filter((x, i, arr) => arr.indexOf(x) === i).join(', ');
      if (out.some((o) => o.name === p.name && Math.abs(o.lat - lat) < 0.01)) continue;
      out.push({ name: p.name, meta: `${c.label}${where ? ` · ${where}` : ''}`, badge: c.badge, tone: c.tone, kind: c.kind, lat, lon });
    }
  } catch {
    /* search service unreachable: built-in ports still shown */
  }
  const ap = anchorPoint();
  return out.sort((x, y) => haversineNm(ap.lat, ap.lon, x.lat, x.lon) - haversineNm(ap.lat, ap.lon, y.lat, y.lon)).slice(0, 10);
}

async function describe(lat, lon) {
  const water = !isLand(lat, lon);
  let near = null;
  if (navigator.onLine) {
    try {
      const r = await fetch(`${PHOTON}/reverse?lat=${lat}&lon=${lon}&limit=1&lang=en`);
      const f = (await r.json()).features?.[0];
      if (f?.properties?.name) {
        const [flon, flat] = f.geometry.coordinates;
        near = { name: f.properties.name, nm: haversineNm(lat, lon, flat, flon) };
      }
    } catch {
      /* offline: still usable */
    }
  }
  return { water, near };
}

async function usedBefore() {
  const { data } = await sb.from('stops').select('name, lat, lon, kind, port_id, tender_name, tender_lat, tender_lon, trip_id').neq('trip_id', state.trip.id).limit(300);
  const seen = new Map();
  for (const s of data || []) if (!seen.has(s.name)) seen.set(s.name, s);
  return [...seen.values()].slice(0, 8);
}

export function openAddStop() {
  const el = document.createElement('div');
  el.className = 'flow';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Add a stop');
  document.body.appendChild(el);
  let mode = 'search';
  let chart = null;
  let pick = null;
  let lastQuery = '';
  let results = [];

  const close = () => {
    chart?.destroy();
    el.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => e.key === 'Escape' && close();
  document.addEventListener('keydown', onKey);

  const tabs = () => `
    <div class="seg mt12" role="tablist" aria-label="How to add">
      <button role="tab" aria-selected="${mode === 'search'}" data-mode="search">Search</button>
      <button role="tab" aria-selected="${mode === 'map'}" data-mode="map">Pick on map</button>
      <button role="tab" aria-selected="false" data-mode="gps">Here (GPS)</button>
    </div>`;

  function bindTabs() {
    el.querySelectorAll('[data-mode]').forEach((b) =>
      b.addEventListener('click', () => {
        const m = b.dataset.mode;
        if (m === 'gps') return useGps(b);
        mode = m;
        draw();
      })
    );
    el.querySelector('[data-x]')?.addEventListener('click', close);
  }

  function useGps(btn) {
    if (!navigator.geolocation) return toast('Location is not available on this device.');
    busy(btn, true, 'Finding…');
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const lat = p.coords.latitude;
        const lon = p.coords.longitude;
        const d = await describe(lat, lon);
        pick = { name: d.near ? (d.near.nm < 0.5 ? d.near.name : `Near ${d.near.name}`) : 'Here', lat, lon, kind: d.water ? 'Anchorage' : 'Port', water: d.water };
        confirmStep();
      },
      () => {
        busy(btn, false);
        toast('Allow location access first.');
      },
      { enableHighAccuracy: true, timeout: 20000 }
    );
  }

  function header(title, sub) {
    return `<div class="between"><h1 class="h2" style="font-size:28px">${esc(title)}</h1><button class="icon-btn plain" data-x aria-label="Close" style="color:var(--ink)">${icon('close', 22)}</button></div>${sub ? `<div class="small muted">${esc(sub)}</div>` : ''}`;
  }

  async function drawSearch() {
    chart?.destroy();
    chart = null;
    el.innerHTML = `<div class="flow-panel">
      ${header('Add a stop', state.trip.title)}
      ${tabs()}
      <label for="q" class="sr-only">Search for a place</label>
      <div style="position:relative;margin-top:14px">
        <span style="position:absolute;left:14px;top:14px;color:var(--muted)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg></span>
        <input class="field" id="q" type="search" autocomplete="off" placeholder="Cove, beach, bay, village, restaurant…" style="padding-left:40px" value="${esc(lastQuery)}">
      </div>
      <p class="tiny muted" style="margin:8px 4px 0">Sorted by distance from the boat. Can't find it? Use Pick on map.</p>
      <div class="card tight mt12" id="res"></div>
      <div id="prev"></div>
    </div>`;
    bindTabs();
    const input = el.querySelector('#q');
    const res = el.querySelector('#res');
    const show = () => {
      if (!lastQuery || lastQuery.length < 2) {
        res.style.display = 'none';
        return;
      }
      res.style.display = '';
      res.innerHTML = results.length
        ? results
            .map(
              (r, i) => `<button class="list-row" data-r="${i}">
                <div class="avatar" style="width:38px;height:38px;font-size:10px;${r.tone ? `background:var(--${r.tone}-soft);color:var(--${r.tone === 'live' ? 'live-ink' : r.tone === 'accent' ? 'accent' : r.tone})` : ''}">${esc(r.badge)}</div>
                <div class="grow"><div class="t">${esc(r.name)}</div><div class="s">${esc(r.meta)}</div></div>
                <div class="tiny muted" style="flex:none">${esc(nmFrom(r.lat, r.lon))}</div>
              </button>`
            )
            .join('')
        : `<div class="empty">${navigator.onLine ? 'Nothing found. Try another spelling, or Pick on map.' : "You're offline. Built-in ports still work, or use Pick on map."}</div>`;
    };
    const run = debounce(async () => {
      const q = input.value.trim();
      lastQuery = q;
      if (q.length < 2) {
        results = [];
        return show();
      }
      res.style.display = '';
      res.innerHTML = '<div class="empty">Searching…</div>';
      const r = await search(q);
      if (input.value.trim() === q) {
        results = r;
        show();
      }
    }, 350);
    input.addEventListener('input', run);
    show();
    setTimeout(() => input.focus(), 50);
    res.addEventListener('click', (e) => {
      const b = e.target.closest('[data-r]');
      if (!b) return;
      const r = results[Number(b.dataset.r)];
      const water = !isLand(r.lat, r.lon);
      pick = { name: r.name, lat: r.lat, lon: r.lon, kind: r.port ? 'Port' : r.kind, port: r.port || null, water };
      confirmStep();
    });

    const prev = await usedBefore().catch(() => []);
    const box = el.querySelector('#prev');
    if (box && prev.length) {
      box.innerHTML = `<div class="eyebrow" style="margin:20px 4px 10px">Used before</div><div class="chips">${prev
        .map((p, i) => `<button class="chip" data-p="${i}">${esc(p.name)}</button>`)
        .join('')}</div>`;
      box.addEventListener('click', (e) => {
        const b = e.target.closest('[data-p]');
        if (!b) return;
        const p = prev[Number(b.dataset.p)];
        pick = { name: p.name, lat: p.lat, lon: p.lon, kind: p.kind || 'Anchorage', port_id: p.port_id, tender: p.tender_lat ? { name: p.tender_name, lat: p.tender_lat, lon: p.tender_lon } : null, water: !isLand(p.lat, p.lon) };
        confirmStep();
      });
    }
  }

  function drawMap() {
    el.innerHTML = `<div class="flow-map">
      <div id="pmap" style="position:absolute;inset:0"></div>
      <div class="pin" aria-hidden="true"><svg width="40" height="52" viewBox="0 0 40 52"><path d="M20 50C20 50 36 32 36 19A16 16 0 004 19C4 32 20 50 20 50Z" fill="#0C5A6E" stroke="#fff" stroke-width="3"/><circle cx="20" cy="19" r="6" fill="#fff"/></svg></div>
      <div class="chart-top">
        <button class="icon-btn" data-mode="search" aria-label="Back to search">${icon('back', 20)}</button>
        <div class="chart-pill" style="flex:1;margin-left:8px;font-weight:500;color:var(--muted)">Move the map to place the pin</div>
      </div>
      <div class="chart-zoom" style="bottom:210px">
        <button class="icon-btn" id="zin" aria-label="Zoom in">${icon('plus', 20)}</button>
        <button class="icon-btn" id="zout" aria-label="Zoom out"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg></button>
      </div>
      <div class="card" style="position:absolute;left:16px;right:16px;bottom:calc(20px + env(safe-area-inset-bottom,0px));box-shadow:0 10px 30px rgba(14,27,38,0.16)">
        <div class="eyebrow" id="pw">Checking this spot…</div>
        <div class="h2 mt8" id="pn">–</div>
        <div class="small muted" id="pc"></div>
        <button class="btn block lg mt12" id="use">Use this spot</button>
      </div>
    </div>`;
    el.querySelector('[data-mode="search"]').onclick = () => {
      mode = 'search';
      draw();
    };
    const a = pick || anchorPoint();
    chart = new VoyageChart(el.querySelector('#pmap'));
    chart.setData({ stops: state.stops, activeIdx: state.stops.indexOf(currentStop()), corinth: state.trip.allow_corinth, pins: [], boat: null });
    chart.centerOn(a.lat, a.lon, 0.25);
    el.querySelector('#zin').onclick = () => chart.zoom(1 / 1.8);
    el.querySelector('#zout').onclick = () => chart.zoom(1.8);

    let seq = 0;
    let latest = null;
    const update = debounce(async () => {
      const lat = mercYToLat(chart.view.cy);
      const lon = chart.view.cx;
      const my = ++seq;
      if (!el.isConnected || !el.querySelector('#pc')) return;
      el.querySelector('#pc').textContent = fmtCoord(lat, lon);
      const d = await describe(lat, lon);
      if (my !== seq || !el.isConnected || !el.querySelector('#pn') || !el.querySelector('#pc')) return;
      latest = { lat, lon, ...d };
      el.querySelector('#pw').textContent = d.water ? 'In the water · good for anchoring' : 'On land';
      el.querySelector('#pw').className = `eyebrow ${d.water ? 'live' : 'brass'}`;
      el.querySelector('#pn').textContent = d.near ? (d.near.nm < 0.3 ? d.near.name : `Near ${d.near.name}`) : d.water ? 'Open water' : 'Unnamed spot';
      el.querySelector('#pc').textContent = `${fmtCoord(lat, lon)}${d.near && d.near.nm >= 0.05 ? ` · ${d.near.nm.toFixed(1)} nm from ${d.near.name}` : ''}`;
    }, 300);
    const orig = chart.draw.bind(chart);
    chart.draw = () => {
      orig();
      update();
    };
    update();
    el.querySelector('#use').onclick = () => {
      const lat = mercYToLat(chart.view.cy);
      const lon = chart.view.cx;
      const d = latest && Math.abs(latest.lat - lat) < 1e-4 && Math.abs(latest.lon - lon) < 1e-4 ? latest : { water: !isLand(lat, lon), near: null };
      const name = d.near ? (d.near.nm < 0.3 ? d.near.name : d.near.name) : '';
      pick = { name, lat, lon, kind: d.water ? 'Anchorage' : 'Restaurant', water: d.water };
      confirmStep();
    };
  }

  function confirmStep() {
    chart?.destroy();
    chart = null;
    const stops = state.stops;
    const start = parseDate(state.trip.start_date);
    const days = [];
    for (let d = new Date(start); d <= parseDate(state.trip.end_date); d.setDate(d.getDate() + 1)) days.push(isoDate(d));
    const lastDate = stops.map((s) => s.arrive_on).filter(Boolean).sort().pop();
    const defaultDay = days.find((d) => d >= (lastDate || state.trip.start_date)) || days[0];
    const tender = pick.tender || (pick.port ? { name: pick.port.tenderName, lat: pick.port.tenderLat, lon: pick.port.tenderLon } : !pick.water ? { name: pick.name, lat: pick.lat, lon: pick.lon } : null);

    el.innerHTML = `<div class="flow-panel">
      ${header('Confirm stop', '')}
      <div id="mini" style="height:150px;border-radius:20px;overflow:hidden;position:relative;margin-top:12px;background:#D3E4E8"></div>
      <button class="btn sm light mt8" id="adj">${icon('pin', 14)}Adjust pin</button>
      <label class="lbl" for="nm">Name guests will see</label>
      <input class="field" id="nm" value="${esc(pick.name)}" placeholder="e.g. Cala Mondragó">
      <div class="lbl">Type</div>
      <div class="chips" id="kinds">${KINDS.map((k) => `<button type="button" class="chip" data-k="${k}" aria-pressed="${k === pick.kind}">${k}</button>`).join('')}</div>
      <div class="grid2">
        <div><label class="lbl" for="dy">Day</label><select class="field" id="dy">${days
          .map((d) => `<option value="${d}" ${d === defaultDay ? 'selected' : ''}>${esc(fmtDate(d))}</option>`)
          .join('')}</select></div>
        <div><label class="lbl" for="pos">Position in route</label><select class="field" id="pos">
          <option value="0">At the start</option>
          ${stops.map((s, i) => `<option value="${i + 1}" ${i === stops.length - 1 ? 'selected' : ''}>After ${esc(s.name)}</option>`).join('')}
        </select></div>
      </div>
      <div class="card row mt12" style="padding:12px 14px">
        ${icon('pin', 20)}
        <div class="grow"><div class="h3" style="font-size:14px">Tender pick-up</div><div class="tiny muted" id="tdesc">${
          tender ? esc(tender.name || 'Same place as the stop') : 'At anchor: set the landing spot later, or drop your GPS pin when you are there'
        }</div></div>
      </div>
      ${!pick.water && pick.kind !== 'Port' ? '<p class="tiny muted mt8">This spot is on land, so it is used as the tender landing. The route goes to the nearest water.</p>' : ''}
      <div class="form-foot" style="margin:12px -16px 0">
        <button class="btn light" id="back" style="width:110px">Back</button>
        <button class="btn accent lg grow" id="add">Add to itinerary</button>
      </div>
    </div>`;
    el.querySelector('[data-x]').onclick = close;
    const mini = new VoyageChart(el.querySelector('#mini'));
    mini.setData({ stops: [{ name: '', lat: pick.lat, lon: pick.lon }], activeIdx: 0, pins: [], boat: null, labels: false });
    mini.centerOn(pick.lat, pick.lon, 0.12);
    chart = mini;
    let kind = pick.kind;
    el.querySelector('#kinds').addEventListener('click', (e) => {
      const b = e.target.closest('[data-k]');
      if (!b) return;
      kind = b.dataset.k;
      el.querySelectorAll('#kinds [data-k]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    });
    el.querySelector('#adj').onclick = () => {
      mode = 'map';
      draw();
    };
    el.querySelector('#back').onclick = () => {
      mode = 'search';
      draw();
    };
    el.querySelector('#add').onclick = async (e) => {
      const name = el.querySelector('#nm').value.trim();
      if (!name) return toast('Give the stop a name.');
      const btn = e.currentTarget;
      busy(btn, true, 'Adding…');
      const at = Number(el.querySelector('#pos').value);
      // make room in the order
      const shift = stops.slice(at).map((s, i) => sb.from('stops').update({ seq: at + i + 1 }).eq('id', s.id));
      const res = await Promise.all(shift);
      if (res.some((r) => r.error)) {
        busy(btn, false);
        return toast('Could not add. Check signal.', 'error');
      }
      const row = {
        trip_id: state.trip.id,
        seq: at,
        name,
        kind,
        lat: pick.lat,
        lon: pick.lon,
        port_id: pick.port?.id || pick.port_id || null,
        arrive_on: el.querySelector('#dy').value || null,
        tender_name: tender?.name || null,
        tender_lat: tender?.lat ?? null,
        tender_lon: tender?.lon ?? null
      };
      const { error } = await sb.from('stops').insert(row);
      if (error) {
        busy(btn, false);
        return toast('Could not add. Check signal.', 'error');
      }
      await load('stops');
      if (!state.trip.current_stop_id && state.stops[0]) {
        await sb.from('trips').update({ current_stop_id: state.stops[0].id }).eq('id', state.trip.id);
        await load('trip');
      }
      toast(`Added ${name}`);
      close();
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    };
  }

  function draw() {
    if (mode === 'map') drawMap();
    else drawSearch();
  }
  draw();
}

function fmtCoord(lat, lon) {
  const f = (v, p, n) => `${Math.floor(Math.abs(v))}°${String(Math.floor((Math.abs(v) % 1) * 60)).padStart(2, '0')}′${v >= 0 ? p : n}`;
  return `${f(lat, 'N', 'S')} ${f(lon, 'E', 'W')}`;
}
