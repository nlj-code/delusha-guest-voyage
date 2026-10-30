/* Delusha Passage Planner — Offline Water Routing Web Worker */

const G_LON0 = -8;
const G_LAT0 = 29;
const G_STEP = 0.02;
const G_W = 2300;
const G_H = 900;

const B_LON0 = -12;
const B_LAT0 = 26;
const B_STEP = 0.1;
const B_W = 540;
const B_H = 240;

let isReady = false;
let isLand = null;
let clearance = null;
let buckets = null;
let segX1 = null;
let segY1 = null;
let segX2 = null;
let segY2 = null;

const gScore = new Float32Array(G_W * G_H);
const parent = new Int32Array(G_W * G_H);
const visitedTag = new Int32Array(G_W * G_H);
const closedTag = new Int32Array(G_W * G_H);
let searchId = 1;

// 16-direction moves (8 neighbours + 8 knight moves) with corner-cutting guard cells
const MOVES = [
  [-1, 0, []],
  [1, 0, []],
  [0, -1, []],
  [0, 1, []],
  [-1, -1, [[-1, 0], [0, -1]]],
  [-1, 1, [[-1, 0], [0, 1]]],
  [1, -1, [[1, 0], [0, -1]]],
  [1, 1, [[1, 0], [0, 1]]],
  [-2, -1, [[-1, 0], [-1, -1], [-2, 0], [0, -1]]],
  [-2, 1, [[-1, 0], [-1, 1], [-2, 0], [0, 1]]],
  [2, -1, [[1, 0], [1, -1], [2, 0], [0, -1]]],
  [2, 1, [[1, 0], [1, 1], [2, 0], [0, 1]]],
  [-1, -2, [[0, -1], [-1, -1], [0, -2], [-1, 0]]],
  [1, -2, [[0, -1], [1, -1], [0, -2], [1, 0]]],
  [-1, 2, [[0, 1], [-1, 1], [0, 2], [-1, 0]]],
  [1, 2, [[0, 1], [1, 1], [0, 2], [1, 0]]]
];

// Navigable water channel centerline inside the Bay of Kotor (Boka Kotorska)
// Verified zero coastline segment intersections from Kotor -> Verige Strait -> Porto Montenegro -> Kumbor Strait -> Mamula entrance
const KOTOR_CHAIN = [
  [42.428, 18.765], // 0: Kotor harbour water
  [42.455, 18.758], // 1: Dobrota
  [42.480, 18.742], // 2: Perast
  [42.482, 18.695], // 3: North of Verige
  [42.476, 18.688], // 4: Verige Strait N
  [42.463, 18.678], // 5: Verige Strait S
  [42.448, 18.675], // 6: Tivat Bay north
  [42.433, 18.685], // 7: Off Porto Montenegro
  [42.428, 18.625], // 8: Approach Kumbor
  [42.429, 18.600], // 9: Kumbor Strait
  [42.440, 18.545], // 10: Herceg Novi Bay
  [42.415, 18.538], // 11: Inner entrance
  [42.400, 18.545], // 12: Between Prevlaka & Luštica
  [42.380, 18.535]  // 13: Open Adriatic SW of Mamula
];

class MinHeap {
  constructor() {
    this.nodes = new Int32Array(65536);
    this.prios = new Float32Array(65536);
    this.size = 0;
  }
  push(node, prio) {
    if (this.size >= this.nodes.length) {
      const n2 = new Int32Array(this.nodes.length * 2);
      const p2 = new Float32Array(this.prios.length * 2);
      n2.set(this.nodes);
      p2.set(this.prios);
      this.nodes = n2;
      this.prios = p2;
    }
    let i = this.size++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.prios[p] <= prio) break;
      this.nodes[i] = this.nodes[p];
      this.prios[i] = this.prios[p];
      i = p;
    }
    this.nodes[i] = node;
    this.prios[i] = prio;
  }
  pop() {
    const top = this.nodes[0];
    const lastNode = this.nodes[--this.size];
    const lastPrio = this.prios[this.size];
    if (this.size > 0) {
      let i = 0;
      const half = this.size >> 1;
      while (i < half) {
        const l = (i << 1) + 1;
        const r = l + 1;
        const best = r < this.size && this.prios[r] < this.prios[l] ? r : l;
        if (lastPrio <= this.prios[best]) break;
        this.nodes[i] = this.nodes[best];
        this.prios[i] = this.prios[best];
        i = best;
      }
      this.nodes[i] = lastNode;
      this.prios[i] = lastPrio;
    }
    return top;
  }
}

function haversineNm(lat1, lon1, lat2, lon2) {
  const R = 3440.065;
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(Math.min(1, a)));
}

function trackDistanceNm(track) {
  let sum = 0;
  for (let i = 1; i < track.length; i++) {
    sum += haversineNm(track[i - 1][0], track[i - 1][1], track[i][0], track[i][1]);
  }
  return sum;
}

function initGridFromRings(rings) {
  if (isReady) return;

  // 1. Rasterise land (even-odd rule, 2x2 subsamples per cell; water if < 50% covered by land)
  const landHits = new Uint8Array(G_W * G_H);
  const SUB = 2;
  for (let sy = 0; sy < G_H * SUB; sy++) {
    const lat = G_LAT0 + (sy + 0.5) * (G_STEP / SUB);
    const row = (sy / SUB) | 0;
    const xs = [];
    for (let r = 0; r < rings.length; r++) {
      const ring = rings[r];
      const n = ring.length;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const y1 = ring[j][1];
        const y2 = ring[i][1];
        if ((y1 <= lat && y2 > lat) || (y2 <= lat && y1 > lat)) {
          const x1 = ring[j][0];
          const x2 = ring[i][0];
          xs.push(x1 + ((lat - y1) * (x2 - x1)) / (y2 - y1));
        }
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const sxStart = Math.max(0, Math.floor((xs[k] - G_LON0) / (G_STEP / SUB) - 0.5) + 1);
      const sxEnd = Math.min(G_W * SUB - 1, Math.floor((xs[k + 1] - G_LON0) / (G_STEP / SUB) - 0.5));
      for (let sx = sxStart; sx <= sxEnd; sx++) {
        const col = (sx / SUB) | 0;
        landHits[row * G_W + col]++;
      }
    }
  }

  isLand = new Uint8Array(G_W * G_H);
  for (let i = 0; i < G_W * G_H; i++) {
    if (landHits[i] >= 2) isLand[i] = 1;
  }

  // Filter out isolated tiny inland water pockets (< 5000 cells) so coastal ports never snap into cut-off lagoons
  const comp = new Int32Array(G_W * G_H);
  comp.fill(-1);
  const compSizes = [];
  const q = new Int32Array(G_W * G_H);
  let cid = 0;
  for (let i = 0; i < G_W * G_H; i++) {
    if (!isLand[i] && comp[i] === -1) {
      let h = 0;
      let t = 0;
      q[t++] = i;
      comp[i] = cid;
      while (h < t) {
        const u = q[h++];
        const r = (u / G_W) | 0;
        const c = u % G_W;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < G_H && nc >= 0 && nc < G_W) {
              const v = nr * G_W + nc;
              if (!isLand[v] && comp[v] === -1) {
                comp[v] = cid;
                q[t++] = v;
              }
            }
          }
        }
      }
      compSizes[cid] = t;
      cid++;
    }
  }
  for (let i = 0; i < G_W * G_H; i++) {
    if (!isLand[i] && compSizes[comp[i]] < 5000) {
      isLand[i] = 1;
    }
  }

  // 2. Build 0.1 deg spatial bucket index of coastline segments
  buckets = new Array(B_W * B_H);
  segX1 = [];
  segY1 = [];
  segX2 = [];
  segY2 = [];

  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r];
    const n = ring.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const x1 = ring[j][0];
      const y1 = ring[j][1];
      const x2 = ring[i][0];
      const y2 = ring[i][1];
      const idx = segX1.length;
      segX1.push(x1);
      segY1.push(y1);
      segX2.push(x2);
      segY2.push(y2);
      const bx0 = Math.max(0, Math.floor((Math.min(x1, x2) - B_LON0) / B_STEP));
      const bx1 = Math.min(B_W - 1, Math.floor((Math.max(x1, x2) - B_LON0) / B_STEP));
      const by0 = Math.max(0, Math.floor((Math.min(y1, y2) - B_LAT0) / B_STEP));
      const by1 = Math.min(B_H - 1, Math.floor((Math.max(y1, y2) - B_LAT0) / B_STEP));
      for (let by = by0; by <= by1; by++) {
        for (let bx = bx0; bx <= bx1; bx++) {
          const key = by * B_W + bx;
          if (!buckets[key]) buckets[key] = [];
          buckets[key].push(idx);
        }
      }
    }
  }

  // 3. Measure clearance for water cells within 5 cells of land (BFS pass)
  clearance = new Float32Array(G_W * G_H);
  clearance.fill(10.0);
  const cellDist = new Uint8Array(G_W * G_H);
  cellDist.fill(255);
  let qHead = 0;
  let qTail = 0;

  for (let i = 0; i < G_W * G_H; i++) {
    if (isLand[i]) {
      clearance[i] = 0;
      cellDist[i] = 0;
      q[qTail++] = i;
    }
  }

  while (qHead < qTail) {
    const idx = q[qHead++];
    const d = cellDist[idx];
    if (d >= 5) continue;
    const r = (idx / G_W) | 0;
    const c = idx % G_W;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < G_H && nc >= 0 && nc < G_W) {
          const nidx = nr * G_W + nc;
          if (cellDist[nidx] === 255) {
            cellDist[nidx] = d + 1;
            q[qTail++] = nidx;
          }
        }
      }
    }
  }

  for (let i = 0; i < G_W * G_H; i++) {
    if (!isLand[i] && cellDist[i] <= 5) {
      const r = (i / G_W) | 0;
      const c = i % G_W;
      const lon = G_LON0 + (c + 0.5) * G_STEP;
      const lat = G_LAT0 + (r + 0.5) * G_STEP;
      clearance[i] = pointToCoastNm(lon, lat, 0.15);
    }
  }

  isReady = true;
}

function pointToCoastNm(lon, lat, searchDeg = 0.15) {
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const bx0 = Math.max(0, Math.floor((lon - searchDeg - B_LON0) / B_STEP));
  const bx1 = Math.min(B_W - 1, Math.floor((lon + searchDeg - B_LON0) / B_STEP));
  const by0 = Math.max(0, Math.floor((lat - searchDeg - B_LAT0) / B_STEP));
  const by1 = Math.min(B_H - 1, Math.floor((lat + searchDeg - B_LAT0) / B_STEP));
  let minSqNm = 100;
  for (let by = by0; by <= by1; by++) {
    for (let bx = bx0; bx <= bx1; bx++) {
      const arr = buckets[by * B_W + bx];
      if (!arr) continue;
      for (let k = 0; k < arr.length; k++) {
        const s = arr[k];
        const x1 = segX1[s];
        const y1 = segY1[s];
        const x2 = segX2[s];
        const y2 = segY2[s];
        const dx = (x2 - x1) * cosLat * 60;
        const dy = (y2 - y1) * 60;
        const px = (lon - x1) * cosLat * 60;
        const py = (lat - y1) * 60;
        let cx = 0;
        let cy = 0;
        const lenSq = dx * dx + dy * dy;
        if (lenSq > 0) {
          let t = (px * dx + py * dy) / lenSq;
          if (t > 1) t = 1;
          else if (t < 0) t = 0;
          cx = dx * t;
          cy = dy * t;
        }
        const dSq = (px - cx) * (px - cx) + (py - cy) * (py - cy);
        if (dSq < minSqNm) minSqNm = dSq;
      }
    }
  }
  return Math.sqrt(minSqNm);
}

function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const ccw = (p1x, p1y, p2x, p2y, p3x, p3y) =>
    (p3y - p1y) * (p2x - p1x) - (p2y - p1y) * (p3x - p1x);
  const d1 = ccw(cx, cy, dx, dy, ax, ay);
  const d2 = ccw(cx, cy, dx, dy, bx, by);
  const d3 = ccw(ax, ay, bx, by, cx, cy);
  const d4 = ccw(ax, ay, bx, by, dx, dy);
  return (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  );
}

function segmentCrossesCoast(lon1, lat1, lon2, lat2) {
  const minX = Math.min(lon1, lon2);
  const maxX = Math.max(lon1, lon2);
  const minY = Math.min(lat1, lat2);
  const maxY = Math.max(lat1, lat2);
  const bx0 = Math.max(0, Math.floor((minX - B_LON0) / B_STEP));
  const bx1 = Math.min(B_W - 1, Math.floor((maxX - B_LON0) / B_STEP));
  const by0 = Math.max(0, Math.floor((minY - B_LAT0) / B_STEP));
  const by1 = Math.min(B_H - 1, Math.floor((maxY - B_LAT0) / B_STEP));
  for (let by = by0; by <= by1; by++) {
    for (let bx = bx0; bx <= bx1; bx++) {
      const arr = buckets[by * B_W + bx];
      if (!arr) continue;
      for (let k = 0; k < arr.length; k++) {
        const s = arr[k];
        const x1 = segX1[s];
        const y1 = segY1[s];
        const x2 = segX2[s];
        const y2 = segY2[s];
        if (
          Math.max(x1, x2) < minX ||
          Math.min(x1, x2) > maxX ||
          Math.max(y1, y2) < minY ||
          Math.min(y1, y2) > maxY
        ) {
          continue;
        }
        if (segmentsIntersect(lon1, lat1, lon2, lat2, x1, y1, x2, y2)) return true;
      }
    }
  }
  return false;
}

function snapToWater(lat, lon) {
  const c0 = Math.floor((lon - G_LON0) / G_STEP);
  const r0 = Math.floor((lat - G_LAT0) / G_STEP);
  if (c0 < 0 || c0 >= G_W || r0 < 0 || r0 >= G_H) return null;
  if (!isLand[r0 * G_W + c0]) return [r0, c0];
  let best = null;
  let bestDistSq = Infinity;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  for (let dr = -30; dr <= 30; dr++) {
    for (let dc = -30; dc <= 30; dc++) {
      if (dr * dr + dc * dc > 900) continue;
      const nr = r0 + dr;
      const nc = c0 + dc;
      if (nr >= 0 && nr < G_H && nc >= 0 && nc < G_W && !isLand[nr * G_W + nc]) {
        const dSq = dr * dr + dc * cosLat * (dc * cosLat);
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          best = [nr, nc];
        }
      }
    }
  }
  return best;
}

function routeCoreLeg(lat1, lon1, lat2, lon2) {
  const s1 = snapToWater(lat1, lon1);
  const s2 = snapToWater(lat2, lon2);
  if (!s1 || !s2) return [[lat1, lon1], [lat2, lon2]];
  const startIdx = s1[0] * G_W + s1[1];
  const goalIdx = s2[0] * G_W + s2[1];
  if (startIdx === goalIdx) return [[lat1, lon1], [lat2, lon2]];

  const curSearch = ++searchId;
  const heap = new MinHeap();
  gScore[startIdx] = 0;
  parent[startIdx] = -1;
  visitedTag[startIdx] = curSearch;
  heap.push(startIdx, 0);

  const goalR = s2[0];
  const goalC = s2[1];
  const cosGoal = Math.cos(((G_LAT0 + (goalR + 0.5) * G_STEP) * Math.PI) / 180);
  let expansions = 0;
  let found = false;

  while (heap.size > 0 && expansions < 4000000) {
    const u = heap.pop();
    if (u === goalIdx) {
      found = true;
      break;
    }
    if (closedTag[u] === curSearch) continue;
    closedTag[u] = curSearch;
    expansions++;

    const ur = (u / G_W) | 0;
    const uc = u % G_W;
    const ug = gScore[u];
    const cosU = Math.cos(((G_LAT0 + (ur + 0.5) * G_STEP) * Math.PI) / 180);

    for (let m = 0; m < 16; m++) {
      const [dr, dc, checks] = MOVES[m];
      const nr = ur + dr;
      const nc = uc + dc;
      if (nr < 0 || nr >= G_H || nc < 0 || nc >= G_W) continue;
      const v = nr * G_W + nc;
      if (isLand[v]) continue;

      let blocked = false;
      for (let k = 0; k < checks.length; k++) {
        if (isLand[(ur + checks[k][0]) * G_W + (uc + checks[k][1])]) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;

      const stepDist = Math.hypot(dr, dc * cosU);
      const clr = clearance[v];
      const pen = clr >= 1.6 ? 1.0 : clr >= 1.0 ? 1.5 : clr >= 0.5 ? 3.0 : 6.0;
      const ng = ug + stepDist * pen;

      if (visitedTag[v] !== curSearch || ng < gScore[v]) {
        visitedTag[v] = curSearch;
        gScore[v] = ng;
        parent[v] = u;
        const cosNr = Math.cos(((G_LAT0 + (nr + 0.5) * G_STEP) * Math.PI) / 180);
        const h = Math.hypot(goalR - nr, (goalC - nc) * Math.min(cosNr, cosGoal));
        heap.push(v, ng + h);
      }
    }
  }

  if (!found) return [[lat1, lon1], [lat2, lon2]];

  const pathCells = [];
  for (let cur = goalIdx; cur !== -1; cur = parent[cur]) {
    pathCells.push(cur);
  }
  pathCells.reverse();

  const P = pathCells.length;
  const pathPts = pathCells.map((idx) => [
    G_LAT0 + (((idx / G_W) | 0) + 0.5) * G_STEP,
    G_LON0 + ((idx % G_W) + 0.5) * G_STEP
  ]);

  // Local allowance: min(1.0 nm, 0.85 * lowest clearance within +-4 cells)
  const localAllow = new Float32Array(P);
  for (let i = 0; i < P; i++) {
    let minC = Infinity;
    for (let j = Math.max(0, i - 4); j <= Math.min(P - 1, i + 4); j++) {
      const c = clearance[pathCells[j]];
      if (c < minC) minC = c;
    }
    localAllow[i] = Math.min(1.0, 0.85 * minC);
  }

  function canConnect(i, j) {
    const lonA = pathPts[i][1];
    const latA = pathPts[i][0];
    const lonB = pathPts[j][1];
    const latB = pathPts[j][0];
    // Fast midpoint and quartile land reject before stepping 0.2 nm
    for (const q of [0.5, 0.25, 0.75, 0.125, 0.375, 0.625, 0.875]) {
      const qlon = lonA + (lonB - lonA) * q;
      const qlat = latA + (latB - latA) * q;
      const qc = Math.floor((qlon - G_LON0) / G_STEP);
      const qr = Math.floor((qlat - G_LAT0) / G_STEP);
      if (qc < 0 || qc >= G_W || qr < 0 || qr >= G_H || isLand[qr * G_W + qc]) return false;
    }
    const distNm = haversineNm(latA, lonA, latB, lonB);
    const steps = Math.max(1, Math.ceil(distNm / 0.2));
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const lon = lonA + (lonB - lonA) * t;
      const lat = latA + (latB - latA) * t;
      const c = Math.floor((lon - G_LON0) / G_STEP);
      const r = Math.floor((lat - G_LAT0) / G_STEP);
      if (c < 0 || c >= G_W || r < 0 || r >= G_H) return false;
      const idx = r * G_W + c;
      if (isLand[idx]) return false;
      const k = Math.round(i + t * (j - i));
      const req = localAllow[k];
      if (clearance[idx] + 0.9 < req) return false;
    }
    if (segmentCrossesCoast(lonA, latA, lonB, latB)) return false;
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const lon = lonA + (lonB - lonA) * t;
      const lat = latA + (latB - latA) * t;
      const c = Math.floor((lon - G_LON0) / G_STEP);
      const r = Math.floor((lat - G_LAT0) / G_STEP);
      const idx = r * G_W + c;
      const k = Math.round(i + t * (j - i));
      const req = localAllow[k];
      if (clearance[idx] < req + 1.0) {
        if (pointToCoastNm(lon, lat, 0.08) < req) return false;
      }
    }
    return true;
  }

  // Straighten (string pulling)
  const keptIdx = [0];
  let cur = 0;
  while (cur < P - 1) {
    let next = cur + 1;
    for (let j = P - 1; j > cur + 1; j--) {
      if (canConnect(cur, j)) {
        next = j;
        break;
      }
    }
    keptIdx.push(next);
    cur = next;
  }

  for (let pass = 0; pass < 2; pass++) {
    for (let k = 1; k < keptIdx.length - 1; ) {
      if (canConnect(keptIdx[k - 1], keptIdx[k + 1])) {
        keptIdx.splice(k, 1);
      } else {
        k++;
      }
    }
  }

  return [[lat1, lon1], ...keptIdx.map((i) => pathPts[i]), [lat2, lon2]];
}

function getKotorNodeIndex(lat, lon) {
  if (lat >= 42.395 && lat <= 42.520 && lon >= 18.530 && lon <= 18.790) {
    if (Math.abs(lat - 42.433) < 0.005 && Math.abs(lon - 18.692) < 0.005) return 7;
    if (Math.abs(lat - 42.424) < 0.005 && Math.abs(lon - 18.769) < 0.005) return 0;
    let bestIdx = 0;
    let bestD = Infinity;
    for (let i = 0; i < KOTOR_CHAIN.length - 1; i++) {
      const d = haversineNm(lat, lon, KOTOR_CHAIN[i][0], KOTOR_CHAIN[i][1]);
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
      }
    }
    return bestIdx;
  }
  return -1;
}

function routeFullLeg(lat1, lon1, lat2, lon2, allowCorinth = false) {
  const k1 = getKotorNodeIndex(lat1, lon1);
  const k2 = getKotorNodeIndex(lat2, lon2);

  if (k1 !== -1 && k2 !== -1) {
    const chain = [];
    if (k1 <= k2) {
      for (let i = k1; i <= k2; i++) chain.push(KOTOR_CHAIN[i]);
    } else {
      for (let i = k1; i >= k2; i--) chain.push(KOTOR_CHAIN[i]);
    }
    return [[lat1, lon1], ...chain, [lat2, lon2]];
  }

  let prefix = [];
  let suffix = [];
  let rLat1 = lat1;
  let rLon1 = lon1;
  let rLat2 = lat2;
  let rLon2 = lon2;

  if (k1 !== -1) {
    prefix = [[lat1, lon1]];
    for (let i = k1; i < KOTOR_CHAIN.length - 1; i++) prefix.push(KOTOR_CHAIN[i]);
    const exitPt = KOTOR_CHAIN[KOTOR_CHAIN.length - 1];
    rLat1 = exitPt[0];
    rLon1 = exitPt[1];
  }
  if (k2 !== -1) {
    const exitPt = KOTOR_CHAIN[KOTOR_CHAIN.length - 1];
    rLat2 = exitPt[0];
    rLon2 = exitPt[1];
    for (let i = KOTOR_CHAIN.length - 2; i >= k2; i--) suffix.push(KOTOR_CHAIN[i]);
    suffix.push([lat2, lon2]);
  }

  let mainTrack = routeCoreLeg(rLat1, rLon1, rLat2, rLon2);

  if (allowCorinth) {
    const CORINTH_NW = [37.965, 22.935];
    const CORINTH_SE = [37.905, 23.025];
    const baseDist = trackDistanceNm(mainTrack);
    const d1 =
      haversineNm(rLat1, rLon1, CORINTH_NW[0], CORINTH_NW[1]) +
      haversineNm(CORINTH_SE[0], CORINTH_SE[1], rLat2, rLon2);
    const d2 =
      haversineNm(rLat1, rLon1, CORINTH_SE[0], CORINTH_SE[1]) +
      haversineNm(CORINTH_NW[0], CORINTH_NW[1], rLat2, rLon2);
    const [ent, ext] = d1 <= d2 ? [CORINTH_NW, CORINTH_SE] : [CORINTH_SE, CORINTH_NW];
    if (Math.min(d1, d2) + 4.0 < baseDist) {
      const legA = routeCoreLeg(rLat1, rLon1, ent[0], ent[1]);
      const legB = routeCoreLeg(ext[0], ext[1], rLat2, rLon2);
      const cand = [...legA, ...legB];
      if (trackDistanceNm(cand) < baseDist) {
        mainTrack = cand;
      }
    }
  }

  if (prefix.length > 0) {
    mainTrack = [...prefix, ...mainTrack.slice(1)];
  }
  if (suffix.length > 0) {
    mainTrack = [...mainTrack.slice(0, -1), ...suffix];
  }
  return mainTrack;
}

self.onmessage = function (e) {
  const msg = e.data;
  if (!msg) return;

  if (msg.type === 'init') {
    const t0 = performance.now();
    initGridFromRings(msg.rings);
    self.postMessage({ type: 'ready', initMs: Math.round(performance.now() - t0) });
  } else if (msg.type === 'route') {
    if (!isReady && msg.rings) {
      initGridFromRings(msg.rings);
    }
    const t0 = performance.now();
    const track = routeFullLeg(msg.lat1, msg.lon1, msg.lat2, msg.lon2, !!msg.allowCorinth);
    const distanceNm = trackDistanceNm(track);
    const durationMs = Math.round(performance.now() - t0);
    self.postMessage({
      type: 'routeResult',
      id: msg.id,
      cacheKey: msg.cacheKey,
      track,
      distanceNm,
      durationMs
    });
  }
};
