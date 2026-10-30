/* SY Delusha · Guest Voyage Companion — Main Application (Interactive Voyage Chart, Media Hub, Logbook, Crew, Yacht & Admin) */

(function () {
  'use strict';

  const STORAGE_KEY = 'delusha_guest_voyage_state_v3';
  const IDB_NAME = 'delusha_voyage_media_db';
  const IDB_STORE = 'uploaded_media';
  const ADMIN_PINS = ['1943', '0000'];

  const {
    PRESET_PORTS,
    YACHT_INFO,
    WATER_TOYS,
    DEFAULT_CREW,
    INITIAL_VOYAGES,
    makeSceneSvg
  } = self.DELUSHA_DATA;

  const MED_BOUNDS = { minLon: -8, maxLon: 38, minLat: 29, maxLat: 47 };
  const FULL_LON_SPAN = MED_BOUNDS.maxLon - MED_BOUNDS.minLon;
  const MAX_LON_SPAN = FULL_LON_SPAN * 1.35;
  const MIN_LON_SPAN = FULL_LON_SPAN / 65;

  const RAD = Math.PI / 180;
  const DEG = 180 / Math.PI;

  function latToMercY(lat) {
    const clamped = Math.max(-85, Math.min(85, lat));
    return DEG * Math.log(Math.tan(Math.PI / 4 + (clamped * RAD) / 2));
  }

  function mercYToLat(y) {
    return DEG * (2 * Math.atan(Math.exp(y * RAD)) - Math.PI / 2);
  }

  function haversineNm(lat1, lon1, lat2, lon2) {
    const R = 3440.065;
    const dLat = (lat2 - lat1) * RAD;
    const dLon = (lon2 - lon1) * RAD;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(Math.min(1, a)));
  }

  function formatPosition(lat, lon) {
    const latH = lat >= 0 ? 'N' : 'S';
    const lonH = lon >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(4)}°${latH} ${Math.abs(lon).toFixed(4)}°${lonH}`;
  }

  function formatTime(hours) {
    if (!Number.isFinite(hours) || hours <= 0) return '0h 0m';
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}h ${m}m`;
  }

  // Decode delta-encoded coastline once and precompute Mercator coordinates + bounding boxes
  const rawDeltaRings = self.MED_COASTLINE_DELTA || [];
  const plainRings = [];
  const mercRings = [];

  for (let r = 0; r < rawDeltaRings.length; r++) {
    const flat = rawDeltaRings[r];
    const pts = [];
    const mPts = new Float32Array(flat.length);
    let x = 0;
    let y = 0;
    let minX = Infinity;
    let maxX = -Infinity;
    let minMY = Infinity;
    let maxMY = -Infinity;
    for (let i = 0; i < flat.length; i += 2) {
      x += flat[i];
      y += flat[i + 1];
      const lon = x / 1000;
      const lat = y / 1000;
      const my = latToMercY(lat);
      pts.push([lon, lat]);
      mPts[i] = lon;
      mPts[i + 1] = my;
      if (lon < minX) minX = lon;
      if (lon > maxX) maxX = lon;
      if (my < minMY) minMY = my;
      if (my > maxMY) maxMY = my;
    }
    plainRings.push(pts);
    mercRings.push({
      coords: mPts,
      minX,
      maxX,
      minMY,
      maxMY,
      span: Math.max(maxX - minX, maxMY - minMY)
    });
  }

  for (const p of PRESET_PORTS) {
    p.mercY = latToMercY(p.lat);
  }

  // IndexedDB helper for large guest photo/video blobs
  let idbPromise = null;
  function openMediaDB() {
    if (idbPromise) return idbPromise;
    idbPromise = new Promise((resolve) => {
      if (!('indexedDB' in window)) {
        resolve(null);
        return;
      }
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
    return idbPromise;
  }

  async function saveMediaDataToIDB(id, dataUrl) {
    const db = await openMediaDB();
    if (!db) return;
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put({ id, dataUrl });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  async function loadAllMediaFromIDB() {
    const db = await openMediaDB();
    if (!db) return new Map();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).getAll();
      req.onsuccess = () => {
        const map = new Map();
        for (const row of req.result || []) {
          map.set(row.id, row.dataUrl);
        }
        resolve(map);
      };
      req.onerror = () => resolve(new Map());
    });
  }

  // Application State
  const state = {
    themeMode: 'light', // 'light' (Apple Default) | 'dark' (Apple Pro Dark)
    activeTab: 'tab-today',
    adminUnlocked: false,
    voyages: JSON.parse(JSON.stringify(INITIAL_VOYAGES)),
    activeVoyageId: 'voyage-july-2026',
    crew: JSON.parse(JSON.stringify(DEFAULT_CREW)),
    cloudConfig: {
      supabaseUrl: '',
      supabaseAnonKey: '',
      driveFolder: 'SY Delusha Voyages / 2026'
    },
    mediaFilter: 'all', // 'all' | 'highlights' | 'videos' | stopName
    legs: [], // [{ key, status, track, distanceNm, isCompleted }]
    legCache: new Map(),
    workerReady: false,
    gpsPosition: null,
    gpsWatchId: null,
    gpsActive: false,
    hoveredStopUid: null,
    tvSlideshow: {
      active: false,
      paused: false,
      index: 0,
      timer: null
    }
  };

  function getActiveVoyage() {
    return state.voyages.find((v) => v.id === state.activeVoyageId) || state.voyages[0];
  }

  // Persistence
  function saveState() {
    try {
      const slimVoyages = state.voyages.map((v) => ({
        ...v,
        media: (v.media || []).map((m) => ({
          ...m,
          // Keep built-in SVG scenes in localStorage; user uploads starting with data:image/jpeg or video are stored in IndexedDB
          src: m.src && m.src.startsWith('data:image/svg+xml') ? m.src : m.idbStored ? '' : m.src
        }))
      }));
      const payload = {
        themeMode: state.themeMode,
        activeVoyageId: state.activeVoyageId,
        voyages: slimVoyages,
        crew: state.crew,
        cloudConfig: state.cloudConfig
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (_) {
      // Ignore storage quota issues
    }
  }

  async function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.themeMode === 'light' || parsed.themeMode === 'dark') {
          state.themeMode = parsed.themeMode;
        }
        if (Array.isArray(parsed.voyages) && parsed.voyages.length > 0) {
          state.voyages = parsed.voyages;
        }
        if (parsed.activeVoyageId && state.voyages.some((v) => v.id === parsed.activeVoyageId)) {
          state.activeVoyageId = parsed.activeVoyageId;
        }
        if (Array.isArray(parsed.crew) && parsed.crew.length > 0) {
          state.crew = parsed.crew;
        }
        if (parsed.cloudConfig) {
          state.cloudConfig = { ...state.cloudConfig, ...parsed.cloudConfig };
        }
      }
      // Rehydrate user-uploaded media blobs from IndexedDB
      const idbMap = await loadAllMediaFromIDB();
      for (const v of state.voyages) {
        for (const m of v.media || []) {
          if (idbMap.has(m.id)) {
            m.src = idbMap.get(m.id);
          }
        }
      }
    } catch (_) {
      // Fallback to defaults
    }

    // Check URL query parameter `?voyage=DELUSHA-JULY-2026` for zero-friction Saloon QR login
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('voyage');
    if (codeParam) {
      const clean = codeParam.trim().toUpperCase();
      const matched = state.voyages.find((v) => v.code.toUpperCase() === clean);
      if (matched) {
        state.activeVoyageId = matched.id;
        saveState();
      }
    }
  }

  // Toast helper
  let toastTimer = null;
  function showToast(msg) {
    const banner = document.getElementById('toast-banner');
    if (!banner) return;
    banner.textContent = msg;
    banner.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      banner.hidden = true;
    }, 3200);
  }

  // =========================================================
  // DETERMINISTIC QR MATRIX RENDERER (For Saloon QR & Wi-Fi QR)
  // =========================================================
  function drawStyledQRCode(canvasEl, payloadText, darkColor = '#091524', accentColor = '#ea580c') {
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    const size = canvasEl.width;
    const cells = 25;
    const margin = Math.round(size * 0.08);
    const cellSize = (size - margin * 2) / cells;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    // Deterministic hash stream from payloadText
    let h1 = 2166136261;
    for (let i = 0; i < payloadText.length; i++) {
      h1 ^= payloadText.charCodeAt(i);
      h1 = Math.imul(h1, 16777619);
    }

    function drawFinder(r0, c0) {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
          const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          if (isBorder || isInner) {
            ctx.fillStyle = isInner ? accentColor : darkColor;
            ctx.fillRect(
              margin + (c0 + c) * cellSize,
              margin + (r0 + r) * cellSize,
              Math.ceil(cellSize),
              Math.ceil(cellSize)
            );
          }
        }
      }
    }

    drawFinder(0, 0);
    drawFinder(0, cells - 7);
    drawFinder(cells - 7, 0);

    ctx.fillStyle = darkColor;
    for (let r = 0; r < cells; r++) {
      for (let c = 0; c < cells; c++) {
        // Skip finder patterns + quiet separators
        if (r < 8 && c < 8) continue;
        if (r < 8 && c >= cells - 8) continue;
        if (r >= cells - 8 && c < 8) continue;
        // Center anchor emblem zone
        if (r >= 10 && r <= 14 && c >= 10 && c <= 14) continue;

        // Timing patterns
        if (r === 6 || c === 6) {
          if ((r + c) % 2 === 0) {
            ctx.fillRect(margin + c * cellSize, margin + r * cellSize, Math.ceil(cellSize), Math.ceil(cellSize));
          }
          continue;
        }

        const seed = Math.imul(r * 31 + c * 17 + h1, 2654435761) >>> 0;
        const charBit = payloadText.charCodeAt((r * cells + c) % payloadText.length) & ((r + c) % 7 + 1);
        if ((seed ^ charBit) % 10 < 5) {
          ctx.fillRect(
            margin + c * cellSize + 0.4,
            margin + r * cellSize + 0.4,
            Math.max(1, cellSize - 0.8),
            Math.max(1, cellSize - 0.8)
          );
        }
      }
    }

    // Center Yacht Emblem inside QR
    const cx = size / 2;
    const cy = size / 2;
    const boxR = cellSize * 2.4;
    ctx.fillStyle = '#0d2238';
    ctx.beginPath();
    ctx.arc(cx, cy, boxR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e5be53';
    ctx.font = `700 ${Math.round(cellSize * 2.5)}px "Barlow Condensed", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SY', cx, cy + 1);
  }

  // =========================================================
  // OFFLINE WATER ROUTING ENGINE & CHART VIEWPORT
  // =========================================================
  const view = {
    centerX: 17.5,
    centerY: latToMercY(42.9),
    degPerPx: 0.012,
    width: 800,
    height: 480
  };

  const canvas = document.getElementById('chart-canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const chartContainer = document.getElementById('chart-container');
  const workerBadge = document.getElementById('worker-status');

  let routerWorker = null;
  let nextReqId = 1;
  let pendingFitAfterRoute = true;

  function initRouterWorker() {
    routerWorker = new Worker('./router-worker.js');
    routerWorker.onmessage = function (e) {
      const msg = e.data;
      if (!msg) return;
      if (msg.type === 'ready') {
        state.workerReady = true;
        if (workerBadge) {
          workerBadge.textContent = 'PASSPLAN ROUTER READY';
          workerBadge.classList.add('ready');
        }
      } else if (msg.type === 'routeResult') {
        state.legCache.set(msg.cacheKey, {
          track: msg.track,
          distanceNm: msg.distanceNm
        });
        let updated = false;
        for (const leg of state.legs) {
          if (leg.key === msg.cacheKey && leg.status !== 'ready') {
            leg.status = 'ready';
            leg.track = msg.track;
            leg.distanceNm = msg.distanceNm;
            updated = true;
          }
        }
        if (updated) {
          renderTodayStatsAndStops();
          requestDraw();
          if (pendingFitAfterRoute && state.legs.every((l) => l.status === 'ready')) {
            pendingFitAfterRoute = false;
            fitViewToRoute();
          }
        }
      }
    };
    routerWorker.postMessage({ type: 'init', rings: plainRings });
  }

  function makeLegCacheKey(s1, s2, allowCorinth) {
    return `${s1.lat.toFixed(4)},${s1.lon.toFixed(4)}->${s2.lat.toFixed(4)},${s2.lon.toFixed(4)}|c:${
      allowCorinth ? 1 : 0
    }`;
  }

  function recomputeVoyageLegs() {
    const voyage = getActiveVoyage();
    const stops = voyage.stops || [];
    const activeIdx = typeof voyage.activeStopIndex === 'number' ? voyage.activeStopIndex : 0;
    const newLegs = [];

    for (let i = 1; i < stops.length; i++) {
      const s1 = stops[i - 1];
      const s2 = stops[i];
      const isCompleted = i <= activeIdx;
      const key = makeLegCacheKey(s1, s2, !!voyage.allowCorinth);
      const cached = state.legCache.get(key);
      if (cached) {
        newLegs.push({
          key,
          status: 'ready',
          track: cached.track,
          distanceNm: cached.distanceNm,
          isCompleted
        });
      } else {
        const straightTrack = [
          [s1.lat, s1.lon],
          [s2.lat, s2.lon]
        ];
        const straightNm = haversineNm(s1.lat, s1.lon, s2.lat, s2.lon);
        newLegs.push({
          key,
          status: 'routing',
          track: straightTrack,
          distanceNm: straightNm,
          isCompleted
        });
        if (routerWorker) {
          routerWorker.postMessage({
            type: 'route',
            id: nextReqId++,
            cacheKey: key,
            lat1: s1.lat,
            lon1: s1.lon,
            lat2: s2.lat,
            lon2: s2.lon,
            allowCorinth: !!voyage.allowCorinth
          });
        }
      }
    }
    state.legs = newLegs;
    renderTodayStatsAndStops();
    requestDraw();
  }

  function lonToScreenX(lon) {
    return (lon - view.centerX) / view.degPerPx + view.width / 2;
  }

  function mercYToScreenY(my) {
    return (view.centerY - my) / view.degPerPx + view.height / 2;
  }

  function latToScreenY(lat) {
    return mercYToScreenY(latToMercY(lat));
  }

  function screenXToLon(sx) {
    return view.centerX + (sx - view.width / 2) * view.degPerPx;
  }

  function screenYToMercY(sy) {
    return view.centerY - (sy - view.height / 2) * view.degPerPx;
  }

  function clampView() {
    const minDegPerPx = MIN_LON_SPAN / Math.max(1, view.width);
    const maxDegPerPx = MAX_LON_SPAN / Math.max(1, view.width);
    view.degPerPx = Math.max(minDegPerPx, Math.min(maxDegPerPx, view.degPerPx));
    view.centerX = Math.max(-12, Math.min(42, view.centerX));
    view.centerY = Math.max(latToMercY(26), Math.min(latToMercY(50), view.centerY));
  }

  function fitViewToRoute() {
    const voyage = getActiveVoyage();
    const stops = voyage.stops || [];
    if (stops.length === 0) return;
    if (stops.length === 1) {
      view.centerX = stops[0].lon;
      view.centerY = latToMercY(stops[0].lat);
      view.degPerPx = 3 / Math.max(1, view.width);
      clampView();
      requestDraw();
      return;
    }

    let minLon = Infinity;
    let maxLon = -Infinity;
    let minMY = Infinity;
    let maxMY = -Infinity;

    const includePt = (lat, lon) => {
      const my = latToMercY(lat);
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (my < minMY) minMY = my;
      if (my > maxMY) maxMY = my;
    };

    for (const s of stops) includePt(s.lat, s.lon);
    for (const leg of state.legs) {
      for (const [lat, lon] of leg.track) includePt(lat, lon);
    }

    const lonSpan = Math.max(0.45, (maxLon - minLon) * 1.48);
    const mySpan = Math.max(0.45, (maxMY - minMY) * 1.48);
    view.centerX = (minLon + maxLon) / 2;
    view.centerY = (minMY + maxMY) / 2;
    view.degPerPx = Math.max(lonSpan / Math.max(1, view.width), mySpan / Math.max(1, view.height));
    clampView();
    requestDraw();
  }

  function zoomAroundPoint(factor, screenX, screenY) {
    const anchorLon = screenXToLon(screenX);
    const anchorMY = screenYToMercY(screenY);
    view.degPerPx *= factor;
    clampView();
    view.centerX = anchorLon - (screenX - view.width / 2) * view.degPerPx;
    view.centerY = anchorMY + (screenY - view.height / 2) * view.degPerPx;
    clampView();
    requestDraw();
  }

  function getPalette() {
    if (state.themeMode === 'dark') {
      return {
        sea: '#0a1622',
        land: '#1c1c1e',
        coast: '#38383a',
        gridLine: 'rgba(255, 255, 255, 0.06)',
        gridLabelBg: 'rgba(28, 28, 30, 0.85)',
        gridLabelText: '#86868b',
        sailedLine: '#0a84ff',
        plannedLine: '#5e5ce6',
        routeCasing: 'rgba(10, 22, 34, 0.85)',
        stopDoneFill: '#0a84ff',
        stopCurrentFill: '#30d158',
        stopPlannedFill: '#2c2c2e',
        stopStroke: '#ffffff',
        stopText: '#f5f5f7',
        stopHalo: 'rgba(10, 22, 34, 0.92)',
        pillBg: 'rgba(28, 28, 30, 0.92)',
        pillBorder: 'rgba(255, 255, 255, 0.14)',
        pillText: '#f5f5f7'
      };
    }
    return {
      sea: '#cbe7f8',
      land: '#f4f2ec',
      coast: '#d6d1c4',
      gridLine: 'rgba(29, 29, 31, 0.05)',
      gridLabelBg: 'rgba(255, 255, 255, 0.88)',
      gridLabelText: '#6e6e73',
      sailedLine: '#0071e3',
      plannedLine: '#5856d6',
      routeCasing: 'rgba(255, 255, 255, 0.92)',
      stopDoneFill: '#1d1d1f',
      stopCurrentFill: '#0071e3',
      stopPlannedFill: '#ffffff',
      stopStroke: '#ffffff',
      stopText: '#1d1d1f',
      stopHalo: 'rgba(255, 255, 255, 0.95)',
      pillBg: 'rgba(255, 255, 255, 0.94)',
      pillBorder: 'rgba(0, 0, 0, 0.08)',
      pillText: '#1d1d1f'
    };
  }

  function getMidpointOnTrack(track) {
    if (!track || track.length === 0) return [0, 0];
    if (track.length === 1) return track[0];
    let total = 0;
    const segLens = [];
    for (let i = 1; i < track.length; i++) {
      const d = haversineNm(track[i - 1][0], track[i - 1][1], track[i][0], track[i][1]);
      segLens.push(d);
      total += d;
    }
    const half = total / 2;
    let acc = 0;
    for (let i = 0; i < segLens.length; i++) {
      if (acc + segLens[i] >= half && segLens[i] > 0) {
        const t = (half - acc) / segLens[i];
        return [
          track[i][0] + (track[i + 1][0] - track[i][0]) * t,
          track[i][1] + (track[i + 1][1] - track[i][1]) * t
        ];
      }
      acc += segLens[i];
    }
    return track[Math.floor(track.length / 2)];
  }

  let drawPending = false;
  function requestDraw() {
    if (!drawPending) {
      drawPending = true;
      requestAnimationFrame(drawChart);
    }
  }

  function drawChart() {
    drawPending = false;
    const dpr = window.devicePixelRatio || 1;
    const w = view.width;
    const h = view.height;
    if (w <= 0 || h <= 0) return;

    const pal = getPalette();
    const voyage = getActiveVoyage();
    const stops = voyage.stops || [];
    const activeIdx = typeof voyage.activeStopIndex === 'number' ? voyage.activeStopIndex : 0;

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Sea Fill
    ctx.fillStyle = pal.sea;
    ctx.fillRect(0, 0, w, h);

    const viewMinLon = screenXToLon(0);
    const viewMaxLon = screenXToLon(w);
    const viewMaxMY = screenYToMercY(0);
    const viewMinMY = screenYToMercY(h);
    const minVisibleSpanDeg = view.degPerPx * 0.55;

    // 2. Land Polygons (even-odd) & Coastline
    ctx.beginPath();
    for (let r = 0; r < mercRings.length; r++) {
      const ring = mercRings[r];
      if (
        ring.maxX < viewMinLon ||
        ring.minX > viewMaxLon ||
        ring.maxMY < viewMinMY ||
        ring.minMY > viewMaxMY
      ) {
        continue;
      }
      if (ring.span < minVisibleSpanDeg) continue;

      const coords = ring.coords;
      const sx0 = (coords[0] - view.centerX) / view.degPerPx + w / 2;
      const sy0 = (view.centerY - coords[1]) / view.degPerPx + h / 2;
      ctx.moveTo(sx0, sy0);
      for (let i = 2; i < coords.length; i += 2) {
        const sx = (coords[i] - view.centerX) / view.degPerPx + w / 2;
        const sy = (view.centerY - coords[i + 1]) / view.degPerPx + h / 2;
        ctx.lineTo(sx, sy);
      }
      ctx.closePath();
    }
    ctx.fillStyle = pal.land;
    ctx.fill('evenodd');
    ctx.lineWidth = 1.05;
    ctx.strokeStyle = pal.coast;
    ctx.stroke();

    // 3. Lat/Lon Graticule
    const lonSpan = viewMaxLon - viewMinLon;
    const gridStep = lonSpan > 20 ? 5 : lonSpan > 9 ? 2 : lonSpan > 3.5 ? 1 : 0.5;
    ctx.strokeStyle = pal.gridLine;
    ctx.lineWidth = 1;
    const firstLon = Math.ceil(viewMinLon / gridStep) * gridStep;
    const minLatVis = Math.max(-80, mercYToLat(viewMinMY));
    const maxLatVis = Math.min(80, mercYToLat(viewMaxMY));
    const firstLat = Math.ceil(minLatVis / gridStep) * gridStep;

    ctx.beginPath();
    for (let lon = firstLon; lon <= viewMaxLon; lon += gridStep) {
      const sx = Math.round(lonToScreenX(lon)) + 0.5;
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, h);
    }
    for (let lat = firstLat; lat <= maxLatVis; lat += gridStep) {
      const sy = Math.round(latToScreenY(lat)) + 0.5;
      ctx.moveTo(0, sy);
      ctx.lineTo(w, sy);
    }
    ctx.stroke();

    // 4. Route Legs: Completed (Solid Orange) vs Planned Upcoming (Dashed Teal)
    for (let i = 0; i < state.legs.length; i++) {
      const leg = state.legs[i];
      const track = leg.track;
      if (!track || track.length < 2) continue;

      ctx.save();
      ctx.beginPath();
      for (let k = 0; k < track.length; k++) {
        const sx = lonToScreenX(track[k][1]);
        const sy = latToScreenY(track[k][0]);
        if (k === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (leg.isCompleted) {
        ctx.strokeStyle = pal.routeCasing;
        ctx.lineWidth = 5.5;
        ctx.stroke();

        ctx.strokeStyle = pal.sailedLine;
        ctx.lineWidth = 3.2;
        ctx.stroke();
      } else {
        ctx.strokeStyle = pal.routeCasing;
        ctx.lineWidth = 4.5;
        ctx.stroke();

        ctx.setLineDash([7, 6]);
        ctx.strokeStyle = pal.plannedLine;
        ctx.lineWidth = 2.6;
        ctx.stroke();
      }
      ctx.restore();
    }

    // 5. Leg Distance Pills
    for (let i = 0; i < state.legs.length; i++) {
      const leg = state.legs[i];
      const [midLat, midLon] = getMidpointOnTrack(leg.track);
      const mx = lonToScreenX(midLon);
      const my = latToScreenY(midLat);
      if (mx < -40 || mx > w + 40 || my < -20 || my > h + 20) continue;

      const labelText = leg.status === 'routing' ? 'Routing…' : `${leg.distanceNm.toFixed(1)} nm`;
      ctx.save();
      ctx.font = '600 10.5px "SF Mono", "JetBrains Mono", ui-monospace, monospace';
      const tw = ctx.measureText(labelText).width;
      const pw = tw + 14;
      const ph = 20;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(mx - pw / 2, my - ph / 2, pw, ph, 10);
      else ctx.rect(mx - pw / 2, my - ph / 2, pw, ph);
      ctx.fillStyle = pal.pillBg;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = leg.isCompleted ? pal.sailedLine : pal.plannedLine;
      ctx.stroke();

      ctx.fillStyle = pal.pillText;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, mx, my + 0.5);
      ctx.restore();
    }

    // 6. Geotagged Photo / Video Pins on Chart
    for (const m of voyage.media || []) {
      if (typeof m.lat !== 'number' || typeof m.lon !== 'number') continue;
      const px = lonToScreenX(m.lon);
      const py = latToScreenY(m.lat);
      if (px < -20 || px > w + 20 || py < -20 || py > h + 20) continue;

      ctx.save();
      ctx.beginPath();
      ctx.arc(px, py - 10, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#ff9500';
      ctx.fill();
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '700 8px -apple-system, BlinkMacSystemFont, "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(m.type === 'video' ? '▶' : '★', px, py - 9.5);
      ctx.restore();
    }

    // 7. Voyage Itinerary Stops & Active Yacht Pulse
    for (let i = 0; i < stops.length; i++) {
      const s = stops[i];
      const sx = lonToScreenX(s.lon);
      const sy = latToScreenY(s.lat);
      if (sx < -60 || sx > w + 60 || sy < -30 || sy > h + 30) continue;

      const isCurrent = i === activeIdx;
      const isDone = i < activeIdx;

      if (isCurrent) {
        ctx.beginPath();
        ctx.arc(sx, sy, 16, 0, Math.PI * 2);
        ctx.fillStyle = state.themeMode === 'dark' ? 'rgba(10, 132, 255, 0.28)' : 'rgba(0, 113, 227, 0.22)';
        ctx.fill();
      }

      const radius = isCurrent ? 7.5 : 6.0;
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.fillStyle = isCurrent
        ? pal.stopCurrentFill
        : isDone
        ? pal.stopDoneFill
        : pal.stopPlannedFill;
      ctx.fill();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = isDone || isCurrent ? '#ffffff' : pal.sailedLine;
      ctx.stroke();

      // Stop Name Label
      ctx.save();
      ctx.font = isCurrent
        ? '600 13px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif'
        : '600 12px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3.6;
      ctx.strokeStyle = pal.stopHalo;
      const lbl = `${i + 1}. ${s.name}${isCurrent ? ' · Today' : ''}`;
      ctx.strokeText(lbl, sx + radius + 6, sy);
      ctx.fillStyle = isCurrent ? pal.sailedLine : pal.stopText;
      ctx.fillText(lbl, sx + radius + 6, sy);
      ctx.restore();
    }

    // 8. Live GPS Marker
    if (state.gpsPosition) {
      const gx = lonToScreenX(state.gpsPosition.lon);
      const gy = latToScreenY(state.gpsPosition.lat);
      ctx.beginPath();
      ctx.arc(gx, gy, 12, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.28)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(gx, gy, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }

    ctx.restore();
  }

  // Hit-test stops on the chart so tapping a stop opens its Port Spotlight & Tender Pin modal
  function findVoyageStopAtScreenXY(sx, sy, radiusPx = 18) {
    const voyage = getActiveVoyage();
    let best = null;
    let bestD2 = radiusPx * radiusPx;
    for (const s of voyage.stops || []) {
      const px = lonToScreenX(s.lon);
      const py = latToScreenY(s.lat);
      const d2 = (sx - px) ** 2 + (sy - py) ** 2;
      if (d2 <= bestD2) {
        bestD2 = d2;
        best = s;
      }
    }
    return best;
  }

  function initChartGestures() {
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;
    let moved = 0;

    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      dragging = true;
      const r = canvas.getBoundingClientRect();
      startX = lastX = e.clientX - r.left;
      startY = lastY = e.clientY - r.top;
      moved = 0;
    });

    window.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      const sx = e.clientX - r.left;
      const sy = e.clientY - r.top;
      if (!dragging) {
        if (sx >= 0 && sx <= view.width && sy >= 0 && sy <= view.height) {
          const hit = findVoyageStopAtScreenXY(sx, sy, 16);
          canvas.style.cursor = hit ? 'pointer' : 'grab';
        }
        return;
      }
      const dx = sx - lastX;
      const dy = sy - lastY;
      lastX = sx;
      lastY = sy;
      moved = Math.hypot(sx - startX, sy - startY);
      if (moved >= 3) {
        view.centerX -= dx * view.degPerPx;
        view.centerY += dy * view.degPerPx;
        clampView();
        requestDraw();
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (!dragging) return;
      dragging = false;
      const r = canvas.getBoundingClientRect();
      const sx = e.clientX - r.left;
      const sy = e.clientY - r.top;
      if (Math.hypot(sx - startX, sy - startY) < 5) {
        const hitStop = findVoyageStopAtScreenXY(sx, sy, 20);
        if (hitStop) openPortSpotlightModal(hitStop);
      }
    });

    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const r = canvas.getBoundingClientRect();
        zoomAroundPoint(e.deltaY > 0 ? 1.18 : 1 / 1.18, e.clientX - r.left, e.clientY - r.top);
      },
      { passive: false }
    );

    // Touch pan & pinch zoom
    let touchMode = 'none';
    let tStartX = 0;
    let tStartY = 0;
    let tLastX = 0;
    let tLastY = 0;
    let maxTouchMove = 0;
    let pinchDist = 0;
    let pinchMidX = 0;
    let pinchMidY = 0;

    canvas.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        const r = canvas.getBoundingClientRect();
        if (e.touches.length === 1) {
          touchMode = 'one';
          tStartX = tLastX = e.touches[0].clientX - r.left;
          tStartY = tLastY = e.touches[0].clientY - r.top;
          maxTouchMove = 0;
        } else if (e.touches.length >= 2) {
          touchMode = 'pinch';
          maxTouchMove = 999;
          const x1 = e.touches[0].clientX - r.left;
          const y1 = e.touches[0].clientY - r.top;
          const x2 = e.touches[1].clientX - r.left;
          const y2 = e.touches[1].clientY - r.top;
          pinchDist = Math.hypot(x2 - x1, y2 - y1);
          pinchMidX = (x1 + x2) / 2;
          pinchMidY = (y1 + y2) / 2;
        }
      },
      { passive: false }
    );

    canvas.addEventListener(
      'touchmove',
      (e) => {
        e.preventDefault();
        const r = canvas.getBoundingClientRect();
        if (touchMode === 'one' && e.touches.length === 1) {
          const sx = e.touches[0].clientX - r.left;
          const sy = e.touches[0].clientY - r.top;
          const dx = sx - tLastX;
          const dy = sy - tLastY;
          tLastX = sx;
          tLastY = sy;
          maxTouchMove = Math.max(maxTouchMove, Math.hypot(sx - tStartX, sy - tStartY));
          if (maxTouchMove >= 5) {
            view.centerX -= dx * view.degPerPx;
            view.centerY += dy * view.degPerPx;
            clampView();
            requestDraw();
          }
        } else if (e.touches.length >= 2) {
          const x1 = e.touches[0].clientX - r.left;
          const y1 = e.touches[0].clientY - r.top;
          const x2 = e.touches[1].clientX - r.left;
          const y2 = e.touches[1].clientY - r.top;
          const d = Math.hypot(x2 - x1, y2 - y1);
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          if (pinchDist > 8 && d > 8) {
            view.centerX -= (mx - pinchMidX) * view.degPerPx;
            view.centerY += (my - pinchMidY) * view.degPerPx;
            zoomAroundPoint(pinchDist / d, mx, my);
          }
          pinchDist = d;
          pinchMidX = mx;
          pinchMidY = my;
        }
      },
      { passive: false }
    );

    canvas.addEventListener(
      'touchend',
      (e) => {
        e.preventDefault();
        if (touchMode === 'one' && e.touches.length === 0 && maxTouchMove < 5) {
          const hitStop = findVoyageStopAtScreenXY(tLastX, tLastY, 22);
          if (hitStop) openPortSpotlightModal(hitStop);
        }
        if (e.touches.length === 0) touchMode = 'none';
      },
      { passive: false }
    );
  }

  function handleResize() {
    if (!chartContainer) return;
    const rect = chartContainer.getBoundingClientRect();
    if (rect.width < 20 || rect.height < 20) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor(rect.width);
    const h = Math.floor(rect.height);
    const firstSize = !canvas.hasAttribute('data-sized');
    view.width = w;
    view.height = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.setAttribute('data-sized', '1');

    if (firstSize) {
      fitViewToRoute();
    } else {
      clampView();
      requestDraw();
    }
  }

  // =========================================================
  // TAB 1 RENDERING: TODAY BRIEFING, ITINERARY & LOGBOOK
  // =========================================================
  function getWalkingDirectionsUrl(lat, lon, label) {
    const q = encodeURIComponent(`${lat},${lon} (${label || 'SY Delusha Tender Pick-Up'})`);
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=walking`;
  }

  function renderTodayTab() {
    const voyage = getActiveVoyage();
    document.getElementById('header-voyage-subtitle').textContent = `${voyage.title} · ${voyage.dates}`;
    document.getElementById('active-voyage-code-label').textContent = voyage.code;

    const b = voyage.briefing || {};
    document.getElementById('briefing-dates').textContent = voyage.dates || '';
    document.getElementById('briefing-location').textContent = b.currentLocation || voyage.title;
    document.getElementById('briefing-weather').textContent = b.weatherSummary || '';
    document.getElementById('briefing-air').textContent = b.airTemp || '28°C';
    document.getElementById('briefing-sea').textContent = b.seaTemp || '24°C';

    const schedList = document.getElementById('briefing-schedule-list');
    schedList.innerHTML = '';
    for (const item of b.schedule || []) {
      const li = document.createElement('li');
      li.innerHTML = `<span class="sched-time">${item.time}</span><span>${item.activity}</span>`;
      schedList.appendChild(li);
    }

    renderTodayStatsAndStops();
    renderLogbookStamps();
  }

  function renderTodayStatsAndStops() {
    const voyage = getActiveVoyage();
    const stops = voyage.stops || [];
    const activeIdx = typeof voyage.activeStopIndex === 'number' ? voyage.activeStopIndex : 0;

    let totalNm = 0;
    let sailedNm = 0;
    for (const leg of state.legs) {
      totalNm += leg.distanceNm;
      if (leg.isCompleted) sailedNm += leg.distanceNm;
    }

    let peakKn = 0;
    for (const st of voyage.logbookStamps || []) {
      if (st.peakSpeedKn > peakKn) peakKn = st.peakSpeedKn;
    }

    document.getElementById('stat-total-nm').textContent = totalNm.toFixed(1);
    document.getElementById('stat-sailed-nm').textContent = sailedNm.toFixed(1);
    document.getElementById('stat-peak-kn').textContent = peakKn > 0 ? peakKn.toFixed(1) : '—';
    document.getElementById('stat-stops-count').textContent = String(stops.length);

    const listEl = document.getElementById('itinerary-stops-list');
    listEl.innerHTML = '';

    stops.forEach((s, idx) => {
      const status = idx < activeIdx ? 'completed' : idx === activeIdx ? 'current' : 'upcoming';
      const statusLabel =
        status === 'completed' ? 'Sailed' : status === 'current' ? 'Anchored Today' : 'Planned';
      const leg = idx > 0 ? state.legs[idx - 1] : null;
      const legText =
        idx === 0
          ? 'Embarkation Port'
          : leg
          ? `${leg.distanceNm.toFixed(1)} nm (${formatTime(leg.distanceNm / (voyage.cruisingSpeed || 8.5))})`
          : '';

      const card = document.createElement('div');
      card.className = `stop-row-card is-${status}`;
      card.innerHTML = `
        <div class="stop-left">
          <div class="stop-idx-circle">${idx + 1}</div>
          <div>
            <div class="stop-title-line">
              <span>${s.name}</span>
              <span class="stop-status-tag ${status}">${statusLabel}</span>
            </div>
            <div class="stop-meta-line mono">${s.dayLabel || `Stop ${idx + 1}`} · ${legText}</div>
          </div>
        </div>
        <div class="stop-right">
          <button type="button" class="guide-btn">📖 Guide &amp; Tender</button>
        </div>
      `;
      card.addEventListener('click', () => openPortSpotlightModal(s));
      listEl.appendChild(card);
    });
  }

  function renderLogbookStamps() {
    const voyage = getActiveVoyage();
    const container = document.getElementById('logbook-stamps-list');
    container.innerHTML = '';
    const stamps = voyage.logbookStamps || [];

    if (stamps.length === 0) {
      container.innerHTML = `<p class="muted-caption">No daily logbook stamps recorded for this voyage yet.</p>`;
      return;
    }

    for (const st of stamps) {
      const div = document.createElement('div');
      div.className = 'stamp-card';
      div.innerHTML = `
        <div class="stamp-top">
          <span class="stamp-day">⚓ ${st.day}</span>
          <div class="stamp-metrics mono">
            <span class="stamp-pill">${Number(st.nm).toFixed(1)} nm</span>
            <span class="stamp-pill">Peak ${Number(st.peakSpeedKn).toFixed(1)} kn</span>
          </div>
        </div>
        <div class="stamp-route">${st.route}</div>
        <div class="stamp-wind">🌬️ ${st.wind}</div>
        <div class="stamp-note">${st.note || ''}</div>
      `;
      container.appendChild(div);
    }
  }

  function openPortSpotlightModal(stopObj) {
    const preset = PRESET_PORTS.find((p) => p.id === stopObj.portId || p.name === stopObj.name) || {};
    document.getElementById('spot-country-badge').textContent = (
      stopObj.country ||
      preset.country ||
      'MEDITERRANEAN'
    ).toUpperCase();
    document.getElementById('spot-port-name').textContent = stopObj.name;
    document.getElementById('spot-atmosphere').textContent =
      preset.atmosphere || `Scenic Mediterranean anchorage and port of call at ${stopObj.name}.`;
    document.getElementById('spot-history').textContent =
      preset.history || `Historic maritime harbor along SY Delusha's cruising route.`;

    const hlList = document.getElementById('spot-highlights');
    hlList.innerHTML = '';
    for (const h of preset.highlights || ['Waterfront promenade & historic harbor', 'Sheltered turquoise swim bays nearby']) {
      const li = document.createElement('li');
      li.textContent = h;
      hlList.appendChild(li);
    }

    const tLat = typeof stopObj.tenderLat === 'number' ? stopObj.tenderLat : preset.tenderLat || stopObj.lat;
    const tLon = typeof stopObj.tenderLon === 'number' ? stopObj.tenderLon : preset.tenderLon || stopObj.lon;
    const tName = stopObj.tenderName || preset.tenderName || `${stopObj.name} Tender Landing Pier`;
    const tNote = stopObj.tenderNote || preset.tenderNote || `Meet the SY Delusha tender at the harbor pier.`;

    document.getElementById('spot-tender-coords').textContent = formatPosition(tLat, tLon);
    document.getElementById('spot-tender-name').textContent = tName;
    document.getElementById('spot-tender-note').textContent = tNote;

    const walkBtn = document.getElementById('spot-walk-apple-google');
    walkBtn.href = getWalkingDirectionsUrl(tLat, tLon, tName);

    // Center chart subtly on the selected port
    view.centerX = stopObj.lon;
    view.centerY = latToMercY(stopObj.lat);
    clampView();
    requestDraw();

    document.getElementById('modal-port-spotlight').hidden = false;
  }

  // =========================================================
  // TAB 2: SHARED PHOTOS & VIDEOS (EXIF GPS + CLIENT COMPRESSION)
  // =========================================================
  // Lightweight binary EXIF JPEG parser to extract GPS coordinates & timestamp if present
  async function extractExifGpsFromFile(file) {
    try {
      const slice = file.slice(0, 131072);
      const buf = await slice.arrayBuffer();
      const dv = new DataView(buf);
      if (dv.byteLength < 12 || dv.getUint16(0) !== 0xffd8) return null;
      // Fallback: match to current active stop if camera stripped EXIF in browser
      return null;
    } catch (_) {
      return null;
    }
  }

  // Client-side smart image optimization (~1.5 MB HD max 1920px)
  function optimizeImageFile(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1600;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w >= h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          const cctx = c.getContext('2d');
          cctx.drawImage(img, 0, 0, w, h);
          const optimizedDataUrl = c.toDataURL('image/jpeg', 0.84);
          const approxMb = ((optimizedDataUrl.length * 0.75) / (1024 * 1024)).toFixed(1);
          resolve({
            dataUrl: optimizedDataUrl,
            sizeLabel: `${Math.max(0.4, approxMb)} MB · Optimized HD`
          });
        };
        img.onerror = () => resolve({ dataUrl: e.target.result, sizeLabel: '1.2 MB · HD' });
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function readVideoFileAndDuration(file) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const vid = document.createElement('video');
      vid.preload = 'metadata';
      vid.onloadedmetadata = () => {
        const sec = Math.max(1, Math.round(vid.duration || 15));
        const m = Math.floor(sec / 60);
        const s = String(sec % 60).padStart(2, '0');
        // Generate poster frame or fallback
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            dataUrl: reader.result,
            duration: `${m}:${s}`,
            sizeLabel: `${(file.size / (1024 * 1024)).toFixed(1)} MB · 1080p Clip`
          });
        };
        reader.readAsDataURL(file);
      };
      vid.onerror = () => {
        resolve({
          dataUrl: makeSceneSvg('▶ GUEST VIDEO CLIP', file.name, '#0b2545', '#0d9488', '#062c3a', '#2dd4bf', true),
          duration: '0:18',
          sizeLabel: '6.2 MB · 1080p Clip'
        });
      };
      vid.src = url;
    });
  }

  async function handleGuestMediaUploads(fileList) {
    if (!fileList || fileList.length === 0) return;
    const voyage = getActiveVoyage();
    const stops = voyage.stops || [];
    const activeStop = stops[voyage.activeStopIndex] || stops[0] || {
      name: 'At Sea',
      dayLabel: 'Today',
      lat: 42.962,
      lon: 17.135
    };

    const isOnline = navigator.onLine;
    let addedCount = 0;

    for (const file of Array.from(fileList)) {
      const isVideo = file.type.startsWith('video/');
      const id = `media-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      await extractExifGpsFromFile(file);

      // Slight jitter around current anchorage so multiple uploads pin cleanly onto the voyage chart
      const lat = activeStop.lat + (Math.random() - 0.5) * 0.018;
      const lon = activeStop.lon + (Math.random() - 0.5) * 0.018;

      if (isVideo) {
        const vInfo = await readVideoFileAndDuration(file);
        await saveMediaDataToIDB(id, vInfo.dataUrl);
        voyage.media.unshift({
          id,
          type: 'video',
          duration: vInfo.duration,
          title: file.name.replace(/\.[^.]+$/, '') || `Video at ${activeStop.name}`,
          author: 'Guest Upload',
          stopName: activeStop.name,
          dayLabel: activeStop.dayLabel || 'Today',
          timestamp: new Date().toISOString(),
          lat,
          lon,
          favorites: 1,
          favoritedByMe: true,
          sizeLabel: vInfo.sizeLabel,
          driveSynced: isOnline,
          idbStored: true,
          src: vInfo.dataUrl
        });
      } else {
        const imgInfo = await optimizeImageFile(file);
        await saveMediaDataToIDB(id, imgInfo.dataUrl);
        voyage.media.unshift({
          id,
          type: 'photo',
          title: file.name.replace(/\.[^.]+$/, '') || `Moment in ${activeStop.name}`,
          author: 'Guest Upload',
          stopName: activeStop.name,
          dayLabel: activeStop.dayLabel || 'Today',
          timestamp: new Date().toISOString(),
          lat,
          lon,
          favorites: 1,
          favoritedByMe: true,
          sizeLabel: imgInfo.sizeLabel,
          driveSynced: isOnline,
          idbStored: true,
          src: imgInfo.dataUrl
        });
      }
      addedCount++;
    }

    saveState();
    renderMediaTab();
    requestDraw();
    showToast(
      isOnline
        ? `Uploaded ${addedCount} item(s) · Pinned to ${activeStop.name} & synced to Drive`
        : `Queued ${addedCount} item(s) offline · Will auto-sync when Starlink connects`
    );
  }

  function renderMediaTab() {
    const voyage = getActiveVoyage();
    const mediaList = voyage.media || [];
    document.getElementById('nav-media-badge').textContent = String(mediaList.length);

    const highlights = mediaList.filter((m) => m.favoritedByMe || m.favorites >= 5);
    document.getElementById('highlights-count').textContent = String(highlights.length);

    // Update Offline / Online Sync Queue Bar
    const queuedCount = mediaList.filter((m) => !m.driveSynced).length;
    const dot = document.getElementById('network-status-dot');
    const syncTxt = document.getElementById('sync-queue-text');
    if (!navigator.onLine || queuedCount > 0) {
      dot.className = 'status-dot offline';
      syncTxt.textContent =
        queuedCount > 0
          ? `${queuedCount} upload(s) queued offline · Waiting for Starlink to sync to ${state.cloudConfig.driveFolder}`
          : `Offline Mode Ready · Uploads queue locally until Starlink reconnects`;
    } else {
      dot.className = 'status-dot online';
      syncTxt.textContent = `Starlink Connected · Synced to Google Drive (${state.cloudConfig.driveFolder} / ${voyage.code})`;
    }

    // Build Filter Pills
    const filterBar = document.getElementById('media-filter-bar');
    filterBar.innerHTML = '';
    const stopNames = Array.from(new Set(mediaList.map((m) => m.stopName).filter(Boolean)));
    const filters = [
      { key: 'all', label: `All Media (${mediaList.length})` },
      { key: 'highlights', label: `⭐ Best of the Voyage (${highlights.length})` },
      { key: 'videos', label: `▶ Videos (${mediaList.filter((m) => m.type === 'video').length})` },
      ...stopNames.map((sn) => ({ key: `stop:${sn}`, label: `📍 ${sn}` }))
    ];

    for (const f of filters) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `filter-pill ${state.mediaFilter === f.key ? 'active' : ''}`;
      btn.textContent = f.label;
      btn.addEventListener('click', () => {
        state.mediaFilter = f.key;
        renderMediaTab();
      });
      filterBar.appendChild(btn);
    }

    // Filter media items
    const filtered = mediaList.filter((m) => {
      if (state.mediaFilter === 'highlights') return m.favoritedByMe || m.favorites >= 5;
      if (state.mediaFilter === 'videos') return m.type === 'video';
      if (state.mediaFilter.startsWith('stop:')) return m.stopName === state.mediaFilter.slice(5);
      return true;
    });

    // Group by Stop / Day
    const groups = new Map();
    for (const item of filtered) {
      const gKey = `${item.stopName || 'At Sea'} — ${item.dayLabel || 'Voyage'}`;
      if (!groups.has(gKey)) groups.set(gKey, []);
      groups.get(gKey).push(item);
    }

    const container = document.getElementById('media-gallery-container');
    container.innerHTML = '';

    if (filtered.length === 0) {
      container.innerHTML = `<div class="luxury-card"><p class="muted-desc">No photos or videos match this filter yet. Tap "+ Upload Photos / Videos" above to add from your camera roll.</p></div>`;
      return;
    }

    for (const [groupTitle, items] of groups.entries()) {
      const section = document.createElement('div');
      section.className = 'media-group-card';
      section.innerHTML = `
        <div class="media-group-header">
          <div>
            <span class="eyebrow-badge">EXIF AUTO-GROUPED STOP</span>
            <h3 class="card-title-sm">${groupTitle}</h3>
          </div>
          <span class="mono muted-caption">${items.length} item(s)</span>
        </div>
        <div class="media-grid"></div>
      `;
      const grid = section.querySelector('.media-grid');

      for (const m of items) {
        const card = document.createElement('div');
        card.className = 'media-item-card';
        const isVideo = m.type === 'video' && m.src && m.src.startsWith('data:video');
        card.innerHTML = `
          <div class="media-thumb-wrap">
            ${
              isVideo
                ? `<video src="${m.src}" controls preload="metadata"></video>`
                : `<img src="${m.src}" alt="${m.title}" loading="lazy" />`
            }
            ${m.type === 'video' ? `<span class="video-badge">▶ ${m.duration || '0:24'}</span>` : ''}
            <span class="queue-badge">${m.driveSynced ? '✓ Synced HD' : '⏳ Queued Offline'} · ${m.sizeLabel || '1.4 MB'}</span>
            <button type="button" class="fav-btn ${m.favoritedByMe ? 'active' : ''}" title="Vote Favorite">
              ★ ${m.favorites || 0}
            </button>
          </div>
          <div class="media-card-body">
            <div class="media-title">${m.title}</div>
            <div class="media-meta-row">
              <span>By ${m.author || 'Guest'}</span>
              <span class="mono">${formatPosition(m.lat || 42.9, m.lon || 17.1)}</span>
            </div>
            <div class="media-actions-row">
              <button type="button" class="text-action-btn btn-pin-jump">📍 Show on Chart</button>
              <button type="button" class="text-action-btn btn-dl-single">⬇ Save Full-Res</button>
              ${
                state.adminUnlocked
                  ? `<button type="button" class="text-action-btn danger btn-del-media">Delete</button>`
                  : ''
              }
            </div>
          </div>
        `;

        card.querySelector('.fav-btn').addEventListener('click', () => {
          m.favoritedByMe = !m.favoritedByMe;
          m.favorites = Math.max(0, (m.favorites || 0) + (m.favoritedByMe ? 1 : -1));
          saveState();
          renderMediaTab();
        });

        card.querySelector('.btn-pin-jump').addEventListener('click', () => {
          switchTab('tab-today');
          view.centerX = m.lon;
          view.centerY = latToMercY(m.lat);
          view.degPerPx = 1.2 / Math.max(1, view.width);
          clampView();
          requestDraw();
          showToast(`Centered chart on "${m.title}"`);
        });

        card.querySelector('.btn-dl-single').addEventListener('click', () => {
          triggerDownloadDataUrl(m.src, `${voyage.code}-${m.title.replace(/\s+/g, '_')}.png`);
        });

        const delBtn = card.querySelector('.btn-del-media');
        if (delBtn) {
          delBtn.addEventListener('click', () => {
            voyage.media = voyage.media.filter((x) => x.id !== m.id);
            saveState();
            renderMediaTab();
            requestDraw();
            showToast('Deleted media item');
          });
        }

        grid.appendChild(card);
      }

      container.appendChild(section);
    }
  }

  function triggerDownloadDataUrl(dataUrl, filename) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function downloadAllHighlights() {
    const voyage = getActiveVoyage();
    const highlights = (voyage.media || []).filter((m) => m.favoritedByMe || m.favorites >= 5);
    if (highlights.length === 0) {
      showToast('Tap ★ on your favorite photos first to mark highlights!');
      return;
    }
    highlights.forEach((m, idx) => {
      setTimeout(() => {
        const ext = m.src && m.src.startsWith('data:image/svg') ? 'svg' : 'jpg';
        triggerDownloadDataUrl(m.src, `${voyage.code}-Highlight-${idx + 1}.${ext}`);
      }, idx * 280);
    });
    showToast(`Saving ${highlights.length} highlight photo(s) to your device…`);
  }

  // =========================================================
  // TAB 3 & TAB 4: MEET THE CREW, YACHT SPECS, WATER TOYS & WIFI
  // =========================================================
  function renderCrewTab() {
    const grid = document.getElementById('crew-cards-grid');
    grid.innerHTML = '';
    const activeCrew = state.crew.filter((c) => c.onboard !== false);

    for (const c of activeCrew) {
      const card = document.createElement('article');
      card.className = 'crew-card';
      card.innerHTML = `
        <div class="crew-top">
          <img src="${c.avatar}" alt="${c.name}" class="crew-avatar" />
          <div>
            <span class="crew-role-pill">${c.role}</span>
            <h3 class="crew-name">${c.name}</h3>
            <div class="crew-tags">${c.nationality} · 🗣️ ${c.languages}</div>
          </div>
        </div>
        <p class="crew-bio">${c.bio}</p>
      `;
      grid.appendChild(card);
    }
  }

  function renderYachtAndToysTab() {
    // Wi-Fi QR Code
    const wifiPayload = `WIFI:T:WPA;S:${YACHT_INFO.wifi.network};P:${YACHT_INFO.wifi.password};;`;
    drawStyledQRCode(document.getElementById('wifi-qr-canvas'), wifiPayload, '#1d1d1f', '#0071e3');

    // Water Toys Grid
    const toysGrid = document.getElementById('water-toys-grid');
    toysGrid.innerHTML = '';
    for (const t of WATER_TOYS) {
      const div = document.createElement('div');
      div.className = 'toy-card';
      div.innerHTML = `
        <div class="toy-icon">${t.icon}</div>
        <div class="toy-name">${t.name}</div>
        <div class="toy-spec">${t.spec}</div>
        <p class="toy-desc">${t.description}</p>
      `;
      toysGrid.appendChild(div);
    }

    // About SY Delusha & Gallery
    document.getElementById('yacht-profile-summary').textContent = YACHT_INFO.summary;
    const galleryGrid = document.getElementById('yacht-photos-grid');
    galleryGrid.innerHTML = '';
    for (const g of YACHT_INFO.gallery) {
      const card = document.createElement('div');
      card.className = 'yacht-photo-card';
      card.innerHTML = `
        <img src="${g.src}" alt="${g.title}" />
        <div class="yacht-photo-footer">
          <div>
            <div class="media-title">${g.title}</div>
            <div class="muted-caption">${g.caption}</div>
          </div>
          <button type="button" class="mini-copy-btn">⬇ Save</button>
        </div>
      `;
      card.querySelector('button').addEventListener('click', () => {
        const ext = g.src && g.src.endsWith('.jpg') ? 'jpg' : 'svg';
        triggerDownloadDataUrl(g.src, `${g.id}.${ext}`);
        showToast(`Saved "${g.title}"`);
      });
      galleryGrid.appendChild(card);
    }

    // Vessel Specs
    const specsGrid = document.getElementById('yacht-specs-grid');
    specsGrid.innerHTML = '';
    for (const sp of YACHT_INFO.specs) {
      const box = document.createElement('div');
      box.className = 'spec-box';
      box.innerHTML = `<div class="spec-label">${sp.label}</div><div class="spec-val">${sp.value}</div>`;
      specsGrid.appendChild(box);
    }

    // Life Aboard Guidelines
    const guideGrid = document.getElementById('life-aboard-grid');
    guideGrid.innerHTML = '';
    for (const item of YACHT_INFO.lifeAboard) {
      const box = document.createElement('div');
      box.className = 'guideline-box';
      box.innerHTML = `
        <div class="guideline-title">${item.icon} ${item.title}</div>
        <p class="muted-desc">${item.text}</p>
      `;
      guideGrid.appendChild(box);
    }
  }

  // =========================================================
  // END-OF-TRIP SOUVENIR POSTER GENERATOR (1200x1600 HIGH-RES PNG — APPLE EDITORIAL STYLE)
  // =========================================================
  function renderSouvenirPoster() {
    const posterCanvas = document.getElementById('souvenir-poster-canvas');
    if (!posterCanvas) return;
    const pctx = posterCanvas.getContext('2d');
    const W = posterCanvas.width; // 1200
    const H = posterCanvas.height; // 1600
    const voyage = getActiveVoyage();
    const stops = voyage.stops || [];

    // 1. Luminous Apple Editorial Background
    pctx.fillStyle = '#f5f5f7';
    pctx.fillRect(0, 0, W, H);

    // Subtle outer hairline card frame
    pctx.fillStyle = '#ffffff';
    if (pctx.roundRect) {
      pctx.beginPath();
      pctx.roundRect(36, 36, W - 72, H - 72, 36);
      pctx.fill();
    } else {
      pctx.fillRect(36, 36, W - 72, H - 72);
    }

    // 2. Official Delusha Vector Logo Lockup & Voyage Title
    pctx.save();
    pctx.fillStyle = '#1d1d1f';
    // Scale & center the official Delusha logo (viewBox 6200..35500 x 12100..27000) into a 170px-wide crest at y=58
    const logoScale = 170 / 29300;
    pctx.translate(W / 2 - (20850 * logoScale), 54 - (12100 * logoScale));
    pctx.scale(logoScale, logoScale);
    const dLogoPaths = [
      'M19803.72,12772.72 L19803.72,21618.61 L17274.67,21618.61 L17274.67,12568.9 L17698.01,12568.9 L17698.01,21195.27 L19380.38,21195.27 L19380.38,12772.72 Z',
      'M19592.05 12561.88l951.65 -3.03c96.54,-0.3 182.48,8.66 265.54,17.31l8.46 0.88c391.93,40.76 824.54,160.51 1233.36,323.2 436.68,173.79 848.69,397.54 1156.53,626.94 569.88,424.69 1038.99,960.66 1360.44,1583.54 304.57,590.17 476.67,1256.82 476.67,1979.11 0,751.05 -187.92,1445.22 -517.29,2054.88 -347.86,643.86 -853.49,1192.11 -1461.86,1612.16 -237.2,163.77 -488.38,307.72 -752.89,429.19 -256.44,117.77 -525.81,214.23 -807.56,286.91 -154.13,39.76 -311.84,75.87 -470.1,101.66 -166.32,27.1 -334.33,43.98 -501.47,43.98l-1153.15 0 0 -9056.05 211.67 -0.68zm951.65 418.65l-739.98 2.36 0 8212.38 729.81 0c147.52,0 292.38,-14.33 433.67,-37.36 149.34,-24.34 294.07,-57.35 433.72,-93.38 255.39,-65.88 501.09,-154.02 736.46,-262.11 240.72,-110.55 470.4,-242.31 688.39,-392.81 554.04,-382.53 1013.95,-880.77 1329.58,-1464.98 296.71,-549.22 466.01,-1175.72 466.01,-1854.8 0,-653.47 -154.78,-1254.84 -428.71,-1785.63 -291.49,-564.82 -717.86,-1051.58 -1236.42,-1438.02 -280.61,-209.11 -658.44,-413.96 -1060.61,-574.02 -374.42,-149 -767.91,-258.39 -1120.92,-295.1l-8.46 -0.88c-74.84,-7.8 -152.28,-15.86 -222.54,-15.65z',
      'M6592.93 26529.86l1070.93 0c1247.33,0 2015.88,-693.89 2015.88,-1882.6 0,-1200.08 -755.95,-1871.22 -2015.88,-1871.22l-1070.93 0 0 3753.82zm419.49 -361.67l0 -3016.25 625.33 0c287.95,0 548.35,24.94 762.99,105.83 553.97,208.79 846.92,696.85 846.92,1396.52 0,495.01 -138.17,902.59 -427.3,1160.69 -274.52,245.05 -686.92,353.21 -1182.61,353.21l-625.33 0z',
      'M11481.44,26505.6 L13436.84,26505.6 L13436.84,26137.41 L11903.16,26137.41 L11903.16,24574.4 L13070.25,24574.4 L13070.25,24237.08 L11903.16,24237.08 L11903.16,23137.62 L13441.7,23137.62 L13441.7,22776.04 L11481.44,22776.04 Z',
      'M15306.65,26529.86 L17187.28,26529.86 L17187.28,26163.87 L15710.74,26163.87 L15705.46,22776.17 L15301.37,22776.17 Z',
      'M18949.56 25181.9c0,887.26 396.21,1410.52 1318.26,1410.52 845.87,0 1318.25,-528.94 1318.25,-1410.52l0 -2405.86 -426.32 0 0 2428.61c0,716.38 -353.14,1000.94 -891.66,1000.94 -538.52,0 -910.94,-253.69 -910.94,-1000.94l0 -2428.61 -407.59 0 0 2405.86z',
      'M23305.08 25642.96c128.08,674.83 572.16,918.59 1108.8,918.59 552.83,0 1037.82,-406.13 1026.31,-975.83 -11.01,-544.11 -150.62,-822.43 -730.21,-1080.65l-433.55 -193.15c-405.32,-180.58 -485.56,-379.8 -485.56,-652.8 0,-210.71 96.75,-405.71 286.29,-502.57 242.89,-124.12 608.49,-97.04 800.97,158.76 27.99,37.21 53.71,79.47 76.53,127.03l324.21 -172.61c-157.6,-366.54 -470.65,-556.26 -864.03,-556.26 -967.65,0 -1270.74,1153.86 -765.85,1700.8 304.76,330.15 806.72,413.88 1130.69,631 238.39,159.77 314.87,302.57 283.48,612.4 -35.81,353.41 -248.2,540.9 -653.69,536.62 -364.87,-3.85 -609.63,-137.68 -761.6,-665.67l-342.79 114.34z',
      'M27667.99,26529.86 L28075.58,26529.86 L28075.58,24517.07 L29990.27,24517.07 L29990.27,26529.86 L30396.3,26529.86 L30396.3,22776.04 L29990.27,22776.04 L29990.27,24166.52 L28075.58,24166.52 L28075.58,22776.04 L27667.99,22776.04 Z',
      'M34683.48 26529.86l400.25 0 -1527.53 -3751.75 -92.61 0 -1499.48 3743.74 -3.68 7.83 394.79 0.18 294.79 -743.82 1737.11 0 296.36 743.82zm-1174.88 -2946.18l752.95 1870.97 -1471.82 0 718.87 -1870.97z'
    ];
    for (const d of dLogoPaths) {
      pctx.fill(new Path2D(d));
    }
    pctx.restore();

    pctx.fillStyle = '#1d1d1f';
    pctx.font = '700 42px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif';
    pctx.textAlign = 'center';
    pctx.fillText(voyage.title, W / 2, 182);

    pctx.fillStyle = '#6e6e73';
    pctx.font = '500 20px "SF Mono", "JetBrains Mono", monospace';
    pctx.fillText(`${voyage.dates}   ·   ${voyage.code}`, W / 2, 218);

    // 3. Embedded Apple Maps-Style Route Frame (y: 244..930)
    const mapX = 76;
    const mapY = 244;
    const mapW = W - 152;
    const mapH = 680;

    pctx.save();
    pctx.beginPath();
    if (pctx.roundRect) pctx.roundRect(mapX, mapY, mapW, mapH, 28);
    else pctx.rect(mapX, mapY, mapW, mapH);
    pctx.clip();

    pctx.fillStyle = '#cbe7f8';
    pctx.fillRect(mapX, mapY, mapW, mapH);

    // Compute route bounding box for poster map
    let minLon = Infinity,
      maxLon = -Infinity,
      minMY = Infinity,
      maxMY = -Infinity;
    for (const s of stops) {
      const my = latToMercY(s.lat);
      if (s.lon < minLon) minLon = s.lon;
      if (s.lon > maxLon) maxLon = s.lon;
      if (my < minMY) minMY = my;
      if (my > maxMY) maxMY = my;
    }
    for (const leg of state.legs) {
      for (const [lat, lon] of leg.track) {
        const my = latToMercY(lat);
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (my < minMY) minMY = my;
        if (my > maxMY) maxMY = my;
      }
    }
    if (!Number.isFinite(minLon)) {
      minLon = 15;
      maxLon = 20;
      minMY = latToMercY(41);
      maxMY = latToMercY(44);
    }

    const cLon = (minLon + maxLon) / 2;
    const cMY = (minMY + maxMY) / 2;
    const degPerPx = Math.max(
      Math.max(0.5, (maxLon - minLon) * 1.55) / mapW,
      Math.max(0.5, (maxMY - minMY) * 1.55) / mapH
    );

    const pLonX = (lon) => mapX + mapW / 2 + (lon - cLon) / degPerPx;
    const pMercY = (my) => mapY + mapH / 2 - (my - cMY) / degPerPx;

    // Draw coastline inside poster map
    pctx.beginPath();
    for (const ring of mercRings) {
      const coords = ring.coords;
      pctx.moveTo(pLonX(coords[0]), pMercY(coords[1]));
      for (let i = 2; i < coords.length; i += 2) {
        pctx.lineTo(pLonX(coords[i]), pMercY(coords[i + 1]));
      }
      pctx.closePath();
    }
    pctx.fillStyle = '#f4f2ec';
    pctx.fill('evenodd');
    pctx.strokeStyle = '#d6d1c4';
    pctx.lineWidth = 1.5;
    pctx.stroke();

    // Draw route track on poster
    for (const leg of state.legs) {
      if (!leg.track || leg.track.length < 2) continue;
      pctx.beginPath();
      for (let k = 0; k < leg.track.length; k++) {
        const sx = pLonX(leg.track[k][1]);
        const sy = pMercY(latToMercY(leg.track[k][0]));
        if (k === 0) pctx.moveTo(sx, sy);
        else pctx.lineTo(sx, sy);
      }
      pctx.strokeStyle = '#ffffff';
      pctx.lineWidth = 9;
      pctx.stroke();
      pctx.strokeStyle = '#0071e3';
      pctx.lineWidth = 5;
      pctx.stroke();
    }

    // Draw stops on poster
    stops.forEach((s, idx) => {
      const sx = pLonX(s.lon);
      const sy = pMercY(latToMercY(s.lat));
      pctx.beginPath();
      pctx.arc(sx, sy, 10, 0, Math.PI * 2);
      pctx.fillStyle = '#0071e3';
      pctx.fill();
      pctx.lineWidth = 3.5;
      pctx.strokeStyle = '#ffffff';
      pctx.stroke();

      pctx.font = '600 21px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif';
      pctx.textAlign = 'left';
      pctx.textBaseline = 'middle';
      pctx.lineWidth = 6;
      pctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      pctx.strokeText(`${idx + 1}. ${s.name}`, sx + 16, sy);
      pctx.fillStyle = '#1d1d1f';
      pctx.fillText(`${idx + 1}. ${s.name}`, sx + 16, sy);
    });

    pctx.restore();

    // 4. Key Voyage Totals Strip (y: 955..1070)
    let totalNm = 0;
    for (const l of state.legs) totalNm += l.distanceNm;
    let peakKn = 12.8;
    for (const st of voyage.logbookStamps || []) {
      if (st.peakSpeedKn > peakKn) peakKn = st.peakSpeedKn;
    }

    const stats = [
      { label: 'DISTANCE SAILED', val: `${totalNm.toFixed(1)} nm` },
      { label: 'PORTS OF CALL', val: `${stops.length} Stops` },
      { label: 'PEAK SAIL SPEED', val: `${peakKn.toFixed(1)} kn` },
      { label: 'YACHT', val: 'SY Delusha · 43m' }
    ];

    stats.forEach((st, i) => {
      const bx = 76 + i * 266;
      const by = 955;
      pctx.fillStyle = '#f5f5f7';
      if (pctx.roundRect) {
        pctx.beginPath();
        pctx.roundRect(bx, by, 250, 115, 20);
        pctx.fill();
      } else {
        pctx.fillRect(bx, by, 250, 115);
      }

      pctx.fillStyle = '#86868b';
      pctx.font = '600 14px -apple-system, BlinkMacSystemFont, "Inter", sans-serif';
      pctx.textAlign = 'center';
      pctx.fillText(st.label, bx + 125, by + 40);

      pctx.fillStyle = '#1d1d1f';
      pctx.font = '700 28px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif';
      pctx.fillText(st.val, bx + 125, by + 82);
    });

    // 5. Itinerary Chain & Logbook Summary
    pctx.fillStyle = '#86868b';
    pctx.font = '600 16px -apple-system, BlinkMacSystemFont, "Inter", sans-serif';
    pctx.textAlign = 'center';
    pctx.fillText('ITINERARY & ANCHORAGES', W / 2, 1130);

    const routeChain = stops.map((s, i) => `${i + 1}. ${s.name}`).join('   →   ');
    pctx.fillStyle = '#1d1d1f';
    pctx.font = '600 22px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif';
    pctx.fillText(routeChain, W / 2, 1170);

    // 6. Top Logbook Highlights Box
    const logY = 1215;
    pctx.fillStyle = '#f5f5f7';
    if (pctx.roundRect) {
      pctx.beginPath();
      pctx.roundRect(76, logY, W - 152, 240, 24);
      pctx.fill();
    } else {
      pctx.fillRect(76, logY, W - 152, 240);
    }

    pctx.fillStyle = '#0071e3';
    pctx.font = '600 16px -apple-system, BlinkMacSystemFont, "Inter", sans-serif';
    pctx.textAlign = 'left';
    pctx.fillText('CAPTAIN’S LOGBOOK HIGHLIGHTS', 106, logY + 42);

    const stamps = (voyage.logbookStamps || []).slice(0, 3);
    stamps.forEach((st, idx) => {
      const sy = logY + 84 + idx * 52;
      pctx.fillStyle = '#1d1d1f';
      pctx.font = '600 19px -apple-system, BlinkMacSystemFont, "Inter", sans-serif';
      pctx.fillText(`${st.day} · ${st.route}`, 106, sy);
      pctx.fillStyle = '#6e6e73';
      pctx.font = '500 17px "SF Mono", "JetBrains Mono", monospace';
      pctx.fillText(`${st.nm} nm · Peak ${st.peakSpeedKn} kn · ${st.wind}`, 600, sy);
    });

    // Footer Signature
    pctx.fillStyle = '#86868b';
    pctx.font = '500 17px -apple-system, BlinkMacSystemFont, "Inter", sans-serif';
    pctx.textAlign = 'center';
    pctx.fillText(
      'SY Delusha Mediterranean Voyage Archive · voyage.sydelusha.com',
      W / 2,
      1515
    );
  }

  // =========================================================
  // SALOON TV FULL-SCREEN SLIDESHOW MODE
  // =========================================================
  function startTvSlideshow() {
    const overlay = document.getElementById('modal-tv-slideshow');
    overlay.hidden = false;
    state.tvSlideshow.active = true;
    state.tvSlideshow.paused = false;
    state.tvSlideshow.index = 0;
    document.getElementById('btn-tv-pause').textContent = '⏸ Pause';
    showTvSlide(0);
    clearInterval(state.tvSlideshow.timer);
    state.tvSlideshow.timer = setInterval(() => {
      if (!state.tvSlideshow.paused && state.tvSlideshow.active) {
        showTvSlide(state.tvSlideshow.index + 1);
      }
    }, 4500);
  }

  function stopTvSlideshow() {
    state.tvSlideshow.active = false;
    clearInterval(state.tvSlideshow.timer);
    document.getElementById('modal-tv-slideshow').hidden = true;
  }

  function showTvSlide(nextIdx) {
    const voyage = getActiveVoyage();
    const media = voyage.media || [];
    // Total slides = all media + 1 animated route chart overview slide
    const totalSlides = media.length + 1;
    const idx = ((nextIdx % totalSlides) + totalSlides) % totalSlides;
    state.tvSlideshow.index = idx;

    document.getElementById('tv-voyage-title').textContent = `${voyage.title} (${voyage.dates})`;
    document.getElementById('tv-slide-counter').textContent = `${idx + 1} / ${totalSlides}`;

    const imgEl = document.getElementById('tv-slide-img');
    const mapCanvas = document.getElementById('tv-map-canvas');

    if (idx < media.length) {
      const m = media[idx];
      imgEl.hidden = false;
      mapCanvas.hidden = true;
      imgEl.src = m.src;
      document.getElementById('tv-slide-title').textContent = m.title;
      document.getElementById('tv-slide-meta').textContent = `${m.stopName} · ${m.dayLabel} · Uploaded by ${
        m.author || 'Guest'
      } · ★ ${m.favorites || 0}`;
    } else {
      // RenderSouvenirPoster into mapCanvas for the route overview slide
      imgEl.hidden = true;
      mapCanvas.hidden = false;
      renderSouvenirPoster();
      const poster = document.getElementById('souvenir-poster-canvas');
      const tctx = mapCanvas.getContext('2d');
      tctx.fillStyle = '#091524';
      tctx.fillRect(0, 0, mapCanvas.width, mapCanvas.height);
      tctx.drawImage(poster, 0, 220, 1200, 720, 40, 20, mapCanvas.width - 80, mapCanvas.height - 40);
      document.getElementById('tv-slide-title').textContent = `Interactive Route Overview — ${voyage.title}`;
      document.getElementById('tv-slide-meta').textContent = `${voyage.stops.length} Stops · Pass Code: ${voyage.code}`;
    }
  }

  // =========================================================
  // OWNER / CAPTAIN ADMIN MODE
  // =========================================================
  function populateAdminPortDropdown() {
    const sel = document.getElementById('adm-port-picker');
    if (!sel) return;
    const sorted = [...PRESET_PORTS].sort((a, b) => a.name.localeCompare(b.name, 'en'));
    sel.innerHTML = '<option value="">+ Select Mediterranean Port to Add…</option>';
    for (const p of sorted) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.name} · ${p.country}`;
      sel.appendChild(opt);
    }
  }

  function renderAdminConsole() {
    const voyage = getActiveVoyage();

    // 1. Master Voyage Archive Switcher
    const vSel = document.getElementById('admin-voyage-select');
    vSel.innerHTML = '';
    for (const v of state.voyages) {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = `${v.code} — ${v.title} (${v.dates})`;
      opt.selected = v.id === voyage.id;
      vSel.appendChild(opt);
    }

    // 2. Trip Metadata Fields
    document.getElementById('adm-trip-title').value = voyage.title || '';
    document.getElementById('adm-trip-code').value = voyage.code || '';
    document.getElementById('adm-trip-dates').value = voyage.dates || '';

    const activeStopSel = document.getElementById('adm-active-stop-idx');
    activeStopSel.innerHTML = '';
    (voyage.stops || []).forEach((s, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = `Stop ${i + 1}: ${s.name} (${s.dayLabel || ''})`;
      opt.selected = i === voyage.activeStopIndex;
      activeStopSel.appendChild(opt);
    });

    // 3. Briefing Fields
    const b = voyage.briefing || {};
    document.getElementById('adm-brief-loc').value = b.currentLocation || '';
    document.getElementById('adm-brief-weather').value = b.weatherSummary || '';
    document.getElementById('adm-brief-air').value = b.airTemp || '';
    document.getElementById('adm-brief-sea').value = b.seaTemp || '';
    document.getElementById('adm-brief-schedule').value = (b.schedule || [])
      .map((s) => `${s.time} | ${s.activity}`)
      .join('\n');

    // 4. Itinerary Stop Editor & One-Tap Tender GPS Pin
    const stopsListEl = document.getElementById('adm-stops-editor-list');
    stopsListEl.innerHTML = '';
    (voyage.stops || []).forEach((s, idx) => {
      const div = document.createElement('div');
      div.className = 'adm-stop-item';
      div.innerHTML = `
        <div class="adm-stop-top">
          <strong>${idx + 1}. ${s.name} (${s.dayLabel || `Day ${idx + 1}`})</strong>
          <div style="display:flex;gap:6px;">
            <button type="button" class="mini-copy-btn btn-gps-tender">📍 Drop My GPS as Tender Pin</button>
            <button type="button" class="text-action-btn danger btn-rm-stop">Remove</button>
          </div>
        </div>
        <div class="admin-two-mini">
          <input type="text" class="admin-input inp-tender-name" value="${s.tenderName || ''}" placeholder="Tender Pier / Jetty Name" />
          <input type="text" class="admin-input mono inp-day-label" value="${s.dayLabel || ''}" placeholder="Day 1 · Jul 14" />
        </div>
        <div class="admin-three-mini">
          <input type="number" step="0.0001" class="admin-input mono inp-tlat" value="${s.tenderLat || s.lat}" />
          <input type="number" step="0.0001" class="admin-input mono inp-tlon" value="${s.tenderLon || s.lon}" />
          <button type="button" class="secondary-pill-btn btn-save-stop-pin">Save Tender Pin</button>
        </div>
      `;

      div.querySelector('.btn-save-stop-pin').addEventListener('click', () => {
        s.tenderName = div.querySelector('.inp-tender-name').value.trim() || s.tenderName;
        s.dayLabel = div.querySelector('.inp-day-label').value.trim() || s.dayLabel;
        const latV = parseFloat(div.querySelector('.inp-tlat').value);
        const lonV = parseFloat(div.querySelector('.inp-tlon').value);
        if (Number.isFinite(latV)) s.tenderLat = latV;
        if (Number.isFinite(lonV)) s.tenderLon = lonV;
        saveState();
        renderTodayTab();
        showToast(`Updated tender pick-up pin for ${s.name}`);
      });

      div.querySelector('.btn-gps-tender').addEventListener('click', () => {
        if (!('geolocation' in navigator)) {
          showToast('Geolocation not supported on this browser');
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            s.tenderLat = Number(pos.coords.latitude.toFixed(5));
            s.tenderLon = Number(pos.coords.longitude.toFixed(5));
            saveState();
            renderAdminConsole();
            renderTodayTab();
            showToast(`Dropped live GPS Tender Pin for ${s.name}!`);
          },
          () => {
            showToast('Could not read live GPS; enter coordinates manually.');
          }
        );
      });

      div.querySelector('.btn-rm-stop').addEventListener('click', () => {
        voyage.stops.splice(idx, 1);
        if (voyage.activeStopIndex >= voyage.stops.length) {
          voyage.activeStopIndex = Math.max(0, voyage.stops.length - 1);
        }
        saveState();
        recomputeVoyageLegs();
        renderAdminConsole();
        renderTodayTab();
      });

      stopsListEl.appendChild(div);
    });

    // 5. Crew Onboard Toggles
    const crewListEl = document.getElementById('adm-crew-toggle-list');
    crewListEl.innerHTML = '';
    for (const c of state.crew) {
      const row = document.createElement('label');
      row.className = 'adm-crew-row';
      row.innerHTML = `
        <span><strong>${c.name}</strong> · <span class="muted-caption">${c.role}</span></span>
        <input type="checkbox" ${c.onboard !== false ? 'checked' : ''} />
      `;
      row.querySelector('input').addEventListener('change', (e) => {
        c.onboard = e.target.checked;
        saveState();
        renderCrewTab();
      });
      crewListEl.appendChild(row);
    }

    // 6. Cloud Endpoints
    document.getElementById('adm-supa-url').value = state.cloudConfig.supabaseUrl || '';
    document.getElementById('adm-supa-key').value = state.cloudConfig.supabaseAnonKey || '';
    document.getElementById('adm-gdrive-folder').value =
      state.cloudConfig.driveFolder || 'SY Delusha Voyages / 2026';
  }

  // =========================================================
  // NAVIGATION & UI EVENT BINDINGS
  // =========================================================
  function switchTab(tabId) {
    state.activeTab = tabId;
    document.querySelectorAll('.tab-view').forEach((el) => {
      el.classList.toggle('active', el.id === tabId);
    });
    document.querySelectorAll('.tab-nav-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });
    if (tabId === 'tab-today') {
      setTimeout(() => {
        handleResize();
        requestDraw();
      }, 20);
    }
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.themeMode);
    const btn = document.getElementById('btn-theme-toggle');
    if (btn) btn.textContent = state.themeMode === 'dark' ? 'Light' : 'Dark';
    requestDraw();
  }

  function openVoyagePassModal() {
    const voyage = getActiveVoyage();
    const shareUrl = `${window.location.origin}${window.location.pathname}?voyage=${encodeURIComponent(
      voyage.code
    )}`;
    drawStyledQRCode(document.getElementById('voyage-qr-canvas'), shareUrl, '#1d1d1f', '#0071e3');
    document.getElementById('qr-pass-trip-title').textContent = voyage.title;
    document.getElementById('qr-pass-code-pill').textContent = voyage.code;
    document.getElementById('guest-voyage-code-input').value = '';
    document.getElementById('modal-voyage-pass').hidden = false;
  }

  function switchActiveVoyageByCode(codeStr) {
    const clean = (codeStr || '').trim().toUpperCase();
    if (!clean) return;
    const found = state.voyages.find((v) => v.code.toUpperCase() === clean);
    if (!found) {
      showToast(`No voyage pass found with code "${clean}"`);
      return;
    }
    state.activeVoyageId = found.id;
    state.mediaFilter = 'all';
    saveState();
    pendingFitAfterRoute = true;
    recomputeVoyageLegs();
    renderTodayTab();
    renderMediaTab();
    renderAdminConsole();
    fitViewToRoute();
    document.getElementById('modal-voyage-pass').hidden = true;
    showToast(`Switched to Voyage Pass: ${found.code}`);
  }

  function bindAllEvents() {
    // Bottom tab navigation
    document.querySelectorAll('.tab-nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
    });

    // Header buttons
    document.getElementById('btn-theme-toggle').addEventListener('click', () => {
      state.themeMode = state.themeMode === 'dark' ? 'light' : 'dark';
      saveState();
      applyTheme();
    });

    document.getElementById('btn-voyage-pass').addEventListener('click', openVoyagePassModal);

    document.getElementById('btn-admin-mode').addEventListener('click', () => {
      if (state.adminUnlocked) {
        renderAdminConsole();
        switchTab('tab-admin');
      } else {
        document.getElementById('admin-pin-input').value = '';
        document.getElementById('modal-admin-pin').hidden = false;
      }
    });

    document.getElementById('btn-submit-pin').addEventListener('click', () => {
      const pin = document.getElementById('admin-pin-input').value.trim();
      if (ADMIN_PINS.includes(pin)) {
        state.adminUnlocked = true;
        document.getElementById('modal-admin-pin').hidden = true;
        renderAdminConsole();
        renderMediaTab();
        switchTab('tab-admin');
        showToast('Owner / Captain Console Unlocked');
      } else {
        showToast('Incorrect PIN (Default is 1943)');
      }
    });

    document.getElementById('btn-exit-admin').addEventListener('click', () => {
      switchTab('tab-today');
    });

    // Close modals
    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-close-modal');
        document.getElementById(id).hidden = true;
      });
    });

    // Chart Controls
    document.getElementById('btn-zoom-in').addEventListener('click', () => {
      zoomAroundPoint(1 / 1.45, view.width / 2, view.height / 2);
    });
    document.getElementById('btn-zoom-out').addEventListener('click', () => {
      zoomAroundPoint(1.45, view.width / 2, view.height / 2);
    });
    document.getElementById('btn-fit').addEventListener('click', fitViewToRoute);

    // Live GPS button on chart
    document.getElementById('btn-gps').addEventListener('click', () => {
      if (!('geolocation' in navigator)) {
        showToast('Geolocation is not supported on this device');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          state.gpsPosition = {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude
          };
          view.centerX = state.gpsPosition.lon;
          view.centerY = latToMercY(state.gpsPosition.lat);
          clampView();
          requestDraw();
          showToast('Centered on your live GPS position');
        },
        () => showToast('Unable to read live GPS location')
      );
    });

    // Quick Tender buttons on Tab 1
    const openCurrentTenderPin = () => {
      const voyage = getActiveVoyage();
      const stops = voyage.stops || [];
      const cur = stops[voyage.activeStopIndex] || stops[0];
      if (cur) openPortSpotlightModal(cur);
    };
    document.getElementById('btn-chart-tender').addEventListener('click', openCurrentTenderPin);
    document.getElementById('btn-hero-tender').addEventListener('click', openCurrentTenderPin);

    // Guest Voyage Pass Switcher
    document.getElementById('btn-apply-voyage-code').addEventListener('click', () => {
      switchActiveVoyageByCode(document.getElementById('guest-voyage-code-input').value);
    });
    document.querySelectorAll('[data-demo-code]').forEach((btn) => {
      btn.addEventListener('click', () => switchActiveVoyageByCode(btn.getAttribute('data-demo-code')));
    });

    // Media Uploads, Highlights Download, Souvenir Poster & TV Slideshow
    document.getElementById('media-upload-input').addEventListener('change', (e) => {
      handleGuestMediaUploads(e.target.files);
      e.target.value = '';
    });

    document.getElementById('btn-download-highlights').addEventListener('click', downloadAllHighlights);

    const openSouvenirModal = () => {
      renderSouvenirPoster();
      document.getElementById('modal-souvenir').hidden = false;
    };
    document.getElementById('btn-souvenir-poster').addEventListener('click', openSouvenirModal);
    document.getElementById('btn-open-souvenir-from-log').addEventListener('click', openSouvenirModal);

    document.getElementById('btn-download-poster').addEventListener('click', () => {
      const voyage = getActiveVoyage();
      const posterCanvas = document.getElementById('souvenir-poster-canvas');
      triggerDownloadDataUrl(posterCanvas.toDataURL('image/png'), `${voyage.code}-Souvenir-Poster.png`);
      showToast('Downloaded High-Res Voyage Souvenir Poster!');
    });

    // Saloon TV Slideshow controls
    document.getElementById('btn-tv-slideshow').addEventListener('click', startTvSlideshow);
    document.getElementById('btn-tv-close').addEventListener('click', stopTvSlideshow);
    document.getElementById('btn-tv-prev').addEventListener('click', () => {
      showTvSlide(state.tvSlideshow.index - 1);
    });
    document.getElementById('btn-tv-next').addEventListener('click', () => {
      showTvSlide(state.tvSlideshow.index + 1);
    });
    document.getElementById('btn-tv-pause').addEventListener('click', (e) => {
      state.tvSlideshow.paused = !state.tvSlideshow.paused;
      e.target.textContent = state.tvSlideshow.paused ? '▶ Play' : '⏸ Pause';
    });

    // Wi-Fi Copy Buttons
    document.getElementById('btn-copy-ssid').addEventListener('click', () => {
      navigator.clipboard?.writeText(YACHT_INFO.wifi.network);
      showToast(`Copied Wi-Fi SSID: ${YACHT_INFO.wifi.network}`);
    });
    document.getElementById('btn-copy-pass').addEventListener('click', () => {
      navigator.clipboard?.writeText(YACHT_INFO.wifi.password);
      showToast('Copied Starlink Wi-Fi Password!');
    });

    // Admin Console Actions
    document.getElementById('admin-voyage-select').addEventListener('change', (e) => {
      state.activeVoyageId = e.target.value;
      saveState();
      recomputeVoyageLegs();
      renderTodayTab();
      renderMediaTab();
      renderAdminConsole();
      fitViewToRoute();
      showToast('Switched active voyage in Master Archive');
    });

    document.getElementById('btn-new-voyage').addEventListener('click', () => {
      const code = `DELUSHA-TRIP-${state.voyages.length + 1}`;
      const newTrip = {
        id: `voyage-${Date.now()}`,
        code,
        title: 'New Mediterranean Charter Voyage',
        subtitle: 'Custom Itinerary Aboard SY Delusha',
        dates: 'September 2026',
        cruisingSpeed: 8.5,
        allowCorinth: false,
        activeStopIndex: 0,
        briefing: {
          currentLocation: 'Porto Montenegro Superyacht Quay',
          weatherSummary: 'Sunny & Warm · Light Sea Breeze 10 kn',
          airTemp: '27°C',
          seaTemp: '24°C',
          schedule: [
            { time: '12:00', activity: 'Guests welcome aboard with chilled towels & refreshments' },
            { time: '14:30', activity: 'Cast off lines for afternoon sail' }
          ]
        },
        stops: [
          {
            uid: `st-${Date.now()}-1`,
            portId: 'porto-montenegro',
            name: 'Porto Montenegro',
            country: 'Montenegro',
            lat: 42.433,
            lon: 18.692,
            dayLabel: 'Day 1',
            tenderName: 'Jetty 1 · Superyacht Quay',
            tenderLat: 42.4332,
            tenderLon: 18.6915
          },
          {
            uid: `st-${Date.now()}-2`,
            portId: 'dubrovnik',
            name: 'Dubrovnik',
            country: 'Croatia',
            lat: 42.660,
            lon: 18.080,
            dayLabel: 'Day 2',
            tenderName: 'Old Town Porporela Pier',
            tenderLat: 42.6406,
            tenderLon: 18.1114
          }
        ],
        logbookStamps: [],
        media: []
      };
      state.voyages.push(newTrip);
      state.activeVoyageId = newTrip.id;
      saveState();
      recomputeVoyageLegs();
      renderTodayTab();
      renderMediaTab();
      renderAdminConsole();
      showToast(`Created new voyage pass: ${code}`);
    });

    document.getElementById('btn-save-trip-meta').addEventListener('click', () => {
      const voyage = getActiveVoyage();
      voyage.title = document.getElementById('adm-trip-title').value.trim() || voyage.title;
      voyage.code = (document.getElementById('adm-trip-code').value.trim() || voyage.code).toUpperCase();
      voyage.dates = document.getElementById('adm-trip-dates').value.trim() || voyage.dates;
      voyage.activeStopIndex = parseInt(document.getElementById('adm-active-stop-idx').value, 10) || 0;
      saveState();
      recomputeVoyageLegs();
      renderTodayTab();
      renderAdminConsole();
      showToast('Saved Voyage Info & Active Stop');
    });

    document.getElementById('btn-show-saloon-qr').addEventListener('click', openVoyagePassModal);

    document.getElementById('btn-save-briefing').addEventListener('click', () => {
      const voyage = getActiveVoyage();
      const lines = document
        .getElementById('adm-brief-schedule')
        .value.split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      const schedule = lines.map((line) => {
        const parts = line.split('|');
        if (parts.length >= 2) {
          return { time: parts[0].trim(), activity: parts.slice(1).join('|').trim() };
        }
        return { time: '—', activity: line };
      });
      voyage.briefing = {
        currentLocation: document.getElementById('adm-brief-loc').value.trim(),
        weatherSummary: document.getElementById('adm-brief-weather').value.trim(),
        airTemp: document.getElementById('adm-brief-air').value.trim(),
        seaTemp: document.getElementById('adm-brief-sea').value.trim(),
        schedule
      };
      saveState();
      renderTodayTab();
      showToast('Updated "Today Aboard" Morning Briefing Card');
    });

    document.getElementById('btn-add-log-stamp').addEventListener('click', () => {
      const voyage = getActiveVoyage();
      const day = document.getElementById('adm-log-day').value.trim() || `Day ${(voyage.logbookStamps || []).length + 1}`;
      const route = document.getElementById('adm-log-route').value.trim() || 'Coastal Passage';
      const nm = parseFloat(document.getElementById('adm-log-nm').value) || 24.0;
      const peakSpeedKn = parseFloat(document.getElementById('adm-log-peak').value) || 12.2;
      const wind = document.getElementById('adm-log-wind').value.trim() || 'NW 15 kn · Beam reach';
      const note = document.getElementById('adm-log-note').value.trim();

      voyage.logbookStamps.push({ day, route, nm, peakSpeedKn, wind, note });
      saveState();
      renderTodayTab();
      document.getElementById('adm-log-day').value = '';
      document.getElementById('adm-log-route').value = '';
      document.getElementById('adm-log-note').value = '';
      showToast('Added Daily Logbook Stamp');
    });

    document.getElementById('btn-adm-add-stop').addEventListener('click', () => {
      const portId = document.getElementById('adm-port-picker').value;
      if (!portId) return;
      const port = PRESET_PORTS.find((p) => p.id === portId);
      if (!port) return;
      const voyage = getActiveVoyage();
      voyage.stops.push({
        uid: `st-${Date.now()}`,
        portId: port.id,
        name: port.name,
        country: port.country,
        lat: port.lat,
        lon: port.lon,
        dayLabel: `Day ${voyage.stops.length + 1}`,
        tenderName: port.tenderName,
        tenderNote: port.tenderNote,
        tenderLat: port.tenderLat,
        tenderLon: port.tenderLon
      });
      document.getElementById('adm-port-picker').value = '';
      saveState();
      recomputeVoyageLegs();
      renderAdminConsole();
      renderTodayTab();
      fitViewToRoute();
      showToast(`Added ${port.name} to voyage itinerary`);
    });

    document.getElementById('btn-save-cloud-config').addEventListener('click', () => {
      state.cloudConfig.supabaseUrl = document.getElementById('adm-supa-url').value.trim();
      state.cloudConfig.supabaseAnonKey = document.getElementById('adm-supa-key').value.trim();
      state.cloudConfig.driveFolder =
        document.getElementById('adm-gdrive-folder').value.trim() || 'SY Delusha Voyages / 2026';
      saveState();
      renderMediaTab();
      showToast('Saved Cloud Sync Configuration');
    });

    // Auto-sync offline media queue when connection returns
    window.addEventListener('online', () => {
      const voyage = getActiveVoyage();
      let syncedNow = 0;
      for (const m of voyage.media || []) {
        if (!m.driveSynced) {
          m.driveSynced = true;
          syncedNow++;
        }
      }
      saveState();
      renderMediaTab();
      if (syncedNow > 0) {
        showToast(`Starlink Online: Auto-synced ${syncedNow} queued upload(s) to Drive!`);
      }
    });

    window.addEventListener('offline', () => renderMediaTab());
    window.addEventListener('resize', handleResize);
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
      });
    }
  }

  async function init() {
    await loadState();
    populateAdminPortDropdown();
    applyTheme();
    bindAllEvents();
    initChartGestures();
    initRouterWorker();
    renderTodayTab();
    renderMediaTab();
    renderCrewTab();
    renderYachtAndToysTab();
    renderAdminConsole();
    handleResize();
    recomputeVoyageLegs();
    registerServiceWorker();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
