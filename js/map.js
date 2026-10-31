// Offline voyage chart: Mediterranean coastline, routes around land (via router-worker.js),
// stops, photo pins and the yacht's live position. Pan, pinch and wheel zoom.

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const MED = { minLon: -8, maxLon: 38 };
const FULL_LON_SPAN = MED.maxLon - MED.minLon;
const MAX_LON_SPAN = FULL_LON_SPAN * 1.35;
const MIN_LON_SPAN = FULL_LON_SPAN / 140;

export function latToMercY(lat) {
  const c = Math.max(-85, Math.min(85, lat));
  return DEG * Math.log(Math.tan(Math.PI / 4 + (c * RAD) / 2));
}
export function mercYToLat(y) {
  return DEG * (2 * Math.atan(Math.exp(y * RAD)) - Math.PI / 2);
}
export function haversineNm(lat1, lon1, lat2, lon2) {
  const R = 3440.065;
  const dLat = (lat2 - lat1) * RAD;
  const dLon = (lon2 - lon1) * RAD;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(Math.min(1, a)));
}

// ---------------------------------------------------------------- coastline (decoded once)

let rings = null;
let plainRings = null;
function decodeCoast() {
  if (rings) return;
  rings = [];
  plainRings = [];
  const raw = self.MED_COASTLINE_DELTA || [];
  for (const flat of raw) {
    const pts = [];
    const m = new Float32Array(flat.length);
    let x = 0;
    let y = 0;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < flat.length; i += 2) {
      x += flat[i];
      y += flat[i + 1];
      const lon = x / 1000;
      const lat = y / 1000;
      const my = latToMercY(lat);
      pts.push([lon, lat]);
      m[i] = lon;
      m[i + 1] = my;
      if (lon < minX) minX = lon;
      if (lon > maxX) maxX = lon;
      if (my < minY) minY = my;
      if (my > maxY) maxY = my;
    }
    plainRings.push(pts);
    rings.push({ coords: m, minX, maxX, minY, maxY, span: Math.max(maxX - minX, maxY - minY) });
  }
}

// ---------------------------------------------------------------- shared router worker

const legCache = new Map();
const waiting = new Map();
let worker = null;
let reqId = 1;

function getWorker() {
  if (worker) return worker;
  decodeCoast();
  try {
    worker = new Worker('./router-worker.js');
    worker.onmessage = (e) => {
      const msg = e.data;
      if (msg?.type !== 'routeResult') return;
      legCache.set(msg.cacheKey, { track: msg.track, distanceNm: msg.distanceNm });
      const cbs = waiting.get(msg.cacheKey) || [];
      waiting.delete(msg.cacheKey);
      cbs.forEach((cb) => cb());
    };
    worker.postMessage({ type: 'init', rings: plainRings });
  } catch {
    worker = null;
  }
  return worker;
}

function legKey(a, b, corinth) {
  return `${a.lat.toFixed(4)},${a.lon.toFixed(4)}>${b.lat.toFixed(4)},${b.lon.toFixed(4)}|${corinth ? 1 : 0}`;
}

// Returns legs immediately (straight lines while routing) and calls onUpdate when routes arrive.
export function computeLegs(stops, activeIdx, corinth, onUpdate) {
  const legs = [];
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    const key = legKey(a, b, corinth);
    const cached = legCache.get(key);
    const done = i <= activeIdx;
    if (cached) {
      legs.push({ key, ready: true, track: cached.track, nm: cached.distanceNm, done });
    } else {
      legs.push({ key, ready: false, track: [[a.lat, a.lon], [b.lat, b.lon]], nm: haversineNm(a.lat, a.lon, b.lat, b.lon), done });
      const w = getWorker();
      if (w) {
        if (!waiting.has(key)) {
          waiting.set(key, []);
          w.postMessage({ type: 'route', id: reqId++, cacheKey: key, lat1: a.lat, lon1: a.lon, lat2: b.lat, lon2: b.lon, allowCorinth: !!corinth });
        }
        if (onUpdate) waiting.get(key).push(onUpdate);
      }
    }
  }
  return legs;
}

const PAL = {
  sea: '#D3E4E8',
  land: '#EFEDE6',
  coast: '#CFC9BC',
  grid: 'rgba(14,27,38,0.05)',
  sailed: '#0C5A6E',
  planned: '#3F6F7C',
  casing: 'rgba(255,255,255,0.95)',
  text: '#0E1B26',
  halo: 'rgba(255,255,255,0.92)',
  pillBg: 'rgba(255,255,255,0.95)',
  pin: '#D9622B',
  live: '#1F7A4D'
};

// Draws the whole chart onto a 2D context. Used by the live chart and the poster.
export function drawChart(ctx, view, data) {
  decodeCoast();
  const { w, h } = view;
  const toX = (lon) => (lon - view.cx) / view.dpp + w / 2;
  const toYm = (my) => (view.cy - my) / view.dpp + h / 2;
  const toY = (lat) => toYm(latToMercY(lat));
  const scale = data.scale || 1;

  ctx.fillStyle = PAL.sea;
  ctx.fillRect(0, 0, w, h);

  const minLon = view.cx - (w / 2) * view.dpp;
  const maxLon = view.cx + (w / 2) * view.dpp;
  const maxY = view.cy + (h / 2) * view.dpp;
  const minY = view.cy - (h / 2) * view.dpp;
  const minSpan = view.dpp * 0.55;

  ctx.beginPath();
  for (const r of rings) {
    if (r.maxX < minLon || r.minX > maxLon || r.maxY < minY || r.minY > maxY || r.span < minSpan) continue;
    const c = r.coords;
    ctx.moveTo(toX(c[0]), toYm(c[1]));
    for (let i = 2; i < c.length; i += 2) ctx.lineTo(toX(c[i]), toYm(c[i + 1]));
    ctx.closePath();
  }
  ctx.fillStyle = PAL.land;
  ctx.fill('evenodd');
  ctx.lineWidth = 1 * scale;
  ctx.strokeStyle = PAL.coast;
  ctx.stroke();

  // graticule
  const span = maxLon - minLon;
  const step = span > 20 ? 5 : span > 9 ? 2 : span > 3.5 ? 1 : 0.5;
  ctx.strokeStyle = PAL.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let lon = Math.ceil(minLon / step) * step; lon <= maxLon; lon += step) {
    const x = Math.round(toX(lon)) + 0.5;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }
  const latLo = mercYToLat(minY);
  const latHi = mercYToLat(maxY);
  for (let lat = Math.ceil(latLo / step) * step; lat <= latHi; lat += step) {
    const y = Math.round(toY(lat)) + 0.5;
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();

  // legs
  for (const leg of data.legs || []) {
    if (!leg.track || leg.track.length < 2) continue;
    ctx.save();
    ctx.beginPath();
    leg.track.forEach(([lat, lon], k) => (k ? ctx.lineTo(toX(lon), toY(lat)) : ctx.moveTo(toX(lon), toY(lat))));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = PAL.casing;
    ctx.lineWidth = (leg.done ? 7 : 5) * scale;
    ctx.stroke();
    if (!leg.done) ctx.setLineDash([6 * scale, 7 * scale]);
    ctx.strokeStyle = leg.done ? PAL.sailed : PAL.planned;
    ctx.lineWidth = (leg.done ? 3.5 : 2.5) * scale;
    ctx.stroke();
    ctx.restore();
  }

  // photo pins
  for (const p of data.pins || []) {
    if (typeof p.lat !== 'number' || typeof p.lon !== 'number') continue;
    const x = toX(p.lon);
    const y = toY(p.lat);
    if (x < -20 || x > w + 20 || y < -20 || y > h + 20) continue;
    ctx.beginPath();
    ctx.arc(x, y, 5 * scale, 0, Math.PI * 2);
    ctx.fillStyle = PAL.pin;
    ctx.fill();
    ctx.lineWidth = 2 * scale;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
  }

  // stops
  const stops = data.stops || [];
  stops.forEach((s, i) => {
    const x = toX(s.lon);
    const y = toY(s.lat);
    if (x < -80 || x > w + 80 || y < -40 || y > h + 40) return;
    const cur = i === data.activeIdx;
    const done = i < data.activeIdx;
    const r = (cur ? 7 : 6) * scale;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = cur ? PAL.live : done ? PAL.sailed : '#fff';
    ctx.fill();
    ctx.lineWidth = 2.5 * scale;
    ctx.strokeStyle = cur || done ? '#fff' : PAL.planned;
    ctx.stroke();
    if (data.labels !== false) {
      ctx.save();
      ctx.font = `${cur ? 700 : 600} ${(cur ? 13 : 12) * scale}px Inter, system-ui, sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 4 * scale;
      ctx.strokeStyle = PAL.halo;
      const label = cur && data.todayLabel !== false ? `${s.name} · today` : s.name;
      ctx.strokeText(label, x + r + 6 * scale, y);
      ctx.fillStyle = cur ? PAL.sailed : PAL.text;
      ctx.fillText(label, x + r + 6 * scale, y);
      ctx.restore();
    }
  });

  // the yacht
  if (data.boat) {
    const x = toX(data.boat.lon);
    const y = toY(data.boat.lat);
    ctx.beginPath();
    ctx.arc(x, y, 18 * scale, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(12,90,110,0.16)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, 9 * scale, 0, Math.PI * 2);
    ctx.fillStyle = PAL.sailed;
    ctx.fill();
    ctx.lineWidth = 2.5 * scale;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    if (Number.isFinite(data.boat.heading)) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(data.boat.heading * RAD);
      ctx.beginPath();
      ctx.moveTo(0, -6 * scale);
      ctx.lineTo(3.5 * scale, 4 * scale);
      ctx.lineTo(0, 2.5 * scale);
      ctx.lineTo(-3.5 * scale, 4 * scale);
      ctx.closePath();
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.restore();
    }
  }

  // this phone's own position
  if (data.me) {
    const x = toX(data.me.lon);
    const y = toY(data.me.lat);
    ctx.beginPath();
    ctx.arc(x, y, 6 * scale, 0, Math.PI * 2);
    ctx.fillStyle = '#3B82F6';
    ctx.fill();
    ctx.lineWidth = 2 * scale;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
  }
}

export function fitView(view, points, pad = 1.5) {
  if (!points.length) {
    view.cx = 19;
    view.cy = latToMercY(39);
    view.dpp = 16 / Math.max(1, view.w);
    return view;
  }
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [lat, lon] of points) {
    const my = latToMercY(lat);
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minY = Math.min(minY, my);
    maxY = Math.max(maxY, my);
  }
  const lonSpan = Math.max(0.35, (maxLon - minLon) * pad);
  const ySpan = Math.max(0.35, (maxY - minY) * pad);
  view.cx = (minLon + maxLon) / 2;
  view.cy = (minY + maxY) / 2;
  view.dpp = Math.max(lonSpan / Math.max(1, view.w), ySpan / Math.max(1, view.h));
  clamp(view);
  return view;
}

function clamp(view) {
  view.dpp = Math.max(MIN_LON_SPAN / Math.max(1, view.w), Math.min(MAX_LON_SPAN / Math.max(1, view.w), view.dpp));
  view.cx = Math.max(-12, Math.min(42, view.cx));
  view.cy = Math.max(latToMercY(26), Math.min(latToMercY(50), view.cy));
}

// Interactive chart bound to a container element.
export class VoyageChart {
  constructor(container, { onStopTap } = {}) {
    this.container = container;
    this.onStopTap = onStopTap;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'chart-canvas';
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'Chart of the voyage route');
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.view = { cx: 19, cy: latToMercY(39), dpp: 0.02, w: 300, h: 300 };
    this.data = { stops: [], legs: [], pins: [], activeIdx: -1 };
    this.fitted = false;
    this.pending = false;
    this._bind();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
  }

  destroy() {
    this.ro.disconnect();
    this.canvas.remove();
  }

  setData({ stops, activeIdx, corinth, pins, boat, me, labels, todayLabel }) {
    const update = () => {
      this.data.legs = computeLegs(this.data.stops, this.data.activeIdx, corinth);
      if (!this.fitted && this.data.legs.every((l) => l.ready)) this.fit();
      this.draw();
    };
    Object.assign(this.data, { stops, activeIdx, pins, boat, me, labels, todayLabel });
    this.data.legs = computeLegs(stops, activeIdx, corinth, update);
    if (!this.fitted) this.fit(true);
    this.draw();
  }

  totals() {
    const legs = this.data.legs || [];
    return {
      total: legs.reduce((s, l) => s + l.nm, 0),
      sailed: legs.filter((l) => l.done).reduce((s, l) => s + l.nm, 0),
      legs
    };
  }

  points() {
    const pts = this.data.stops.map((s) => [s.lat, s.lon]);
    for (const l of this.data.legs) pts.push(...l.track);
    if (this.data.boat) pts.push([this.data.boat.lat, this.data.boat.lon]);
    return pts;
  }

  fit(provisional = false) {
    fitView(this.view, this.points());
    if (!provisional) this.fitted = true;
    this.draw();
  }

  centerOn(lat, lon, lonSpan = 0.6) {
    this.view.cx = lon;
    this.view.cy = latToMercY(lat);
    this.view.dpp = lonSpan / Math.max(1, this.view.w);
    clamp(this.view);
    this.fitted = true;
    this.draw();
  }

  zoom(f, sx = this.view.w / 2, sy = this.view.h / 2) {
    const v = this.view;
    const aLon = v.cx + (sx - v.w / 2) * v.dpp;
    const aY = v.cy - (sy - v.h / 2) * v.dpp;
    v.dpp *= f;
    clamp(v);
    v.cx = aLon - (sx - v.w / 2) * v.dpp;
    v.cy = aY + (sy - v.h / 2) * v.dpp;
    clamp(v);
    this.fitted = true;
    this.draw();
  }

  resize() {
    const r = this.container.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return;
    const dpr = window.devicePixelRatio || 1;
    this.view.w = Math.floor(r.width);
    this.view.h = Math.floor(r.height);
    this.canvas.width = Math.round(this.view.w * dpr);
    this.canvas.height = Math.round(this.view.h * dpr);
    this.canvas.style.width = `${this.view.w}px`;
    this.canvas.style.height = `${this.view.h}px`;
    if (!this.fitted) fitView(this.view, this.points());
    this.draw();
  }

  draw() {
    if (this.pending) return;
    this.pending = true;
    requestAnimationFrame(() => {
      this.pending = false;
      const dpr = window.devicePixelRatio || 1;
      this.ctx.save();
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawChart(this.ctx, this.view, this.data);
      this.ctx.restore();
    });
  }

  hitStop(sx, sy, radius = 22) {
    const v = this.view;
    let best = null;
    let bestD = radius * radius;
    this.data.stops.forEach((s, i) => {
      const x = (s.lon - v.cx) / v.dpp + v.w / 2;
      const y = (v.cy - latToMercY(s.lat)) / v.dpp + v.h / 2;
      const d = (x - sx) ** 2 + (y - sy) ** 2;
      if (d <= bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  _pan(dx, dy) {
    this.view.cx -= dx * this.view.dpp;
    this.view.cy += dy * this.view.dpp;
    clamp(this.view);
    this.fitted = true;
    this.draw();
  }

  _bind() {
    const c = this.canvas;
    const pointers = new Map();
    let start = null;
    let moved = 0;
    let pinch = null;
    const pos = (e) => {
      const r = c.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, pos(e));
      if (pointers.size === 1) {
        start = pos(e);
        moved = 0;
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
        moved = 999;
      }
    });
    c.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      const p = pos(e);
      const prev = pointers.get(e.pointerId);
      pointers.set(e.pointerId, p);
      if (pointers.size === 1) {
        moved = Math.max(moved, Math.hypot(p.x - start.x, p.y - start.y));
        if (moved > 4) this._pan(p.x - prev.x, p.y - prev.y);
      } else if (pointers.size === 2 && pinch) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        this._pan(mx - pinch.mx, my - pinch.my);
        if (pinch.d > 8 && d > 8) this.zoom(pinch.d / d, mx, my);
        pinch = { d, mx, my };
      }
    });
    const end = (e) => {
      if (!pointers.has(e.pointerId)) return;
      const p = pointers.get(e.pointerId);
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 0 && moved < 6 && this.onStopTap) {
        const i = this.hitStop(p.x, p.y);
        if (i !== null) this.onStopTap(i);
      }
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const p = pos(e);
        this.zoom(e.deltaY > 0 ? 1.18 : 1 / 1.18, p.x, p.y);
      },
      { passive: false }
    );
  }
}

// True when the point is on land, using the offline coastline (even-odd test).
export function isLand(lat, lon) {
  decodeCoast();
  const y = latToMercY(lat);
  let inside = false;
  for (const r of rings) {
    if (lon < r.minX || lon > r.maxX || y < r.minY || y > r.maxY) continue;
    const c = r.coords;
    const n = c.length / 2;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = c[i * 2];
      const yi = c[i * 2 + 1];
      const xj = c[j * 2];
      const yj = c[j * 2 + 1];
      if (yi > y !== yj > y && lon < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}
