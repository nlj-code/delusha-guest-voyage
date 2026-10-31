// Photo and video uploads. Files are prepared on the phone, kept in a local queue,
// and sent to Supabase Storage when there is signal. The queue survives closing the app.
import { sb, state, load, currentStop, myName } from './store.js';

const DB_NAME = 'delusha-uploads';
const STORE = 'queue';
const MAX_EDGE = 2560;
const THUMB_EDGE = 480;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

const listeners = new Set();
export function onQueue(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export const progress = { total: 0, done: 0, active: false, waiting: 0, failed: 0 };
function emit() {
  for (const fn of listeners) fn(progress);
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function tx(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(out?.result ?? out);
    t.onerror = () => reject(t.error);
  });
}
const putItem = (item) => tx('readwrite', (s) => s.put(item));
const delItem = (id) => tx('readwrite', (s) => s.delete(id));
async function allItems() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read this photo.'));
    };
    img.src = url;
  });
}

function toBlob(source, w, h, edge, quality) {
  const s = Math.min(1, edge / Math.max(w, h));
  const cw = Math.round(w * s);
  const ch = Math.round(h * s);
  const c = document.createElement('canvas');
  c.width = cw;
  c.height = ch;
  c.getContext('2d').drawImage(source, 0, 0, cw, ch);
  return new Promise((resolve) => c.toBlob((b) => resolve({ blob: b, w: cw, h: ch }), 'image/jpeg', quality));
}

async function preparePhoto(file) {
  const { img, url } = await loadImage(file);
  try {
    const full = await toBlob(img, img.naturalWidth, img.naturalHeight, MAX_EDGE, 0.9);
    const thumb = await toBlob(img, img.naturalWidth, img.naturalHeight, THUMB_EDGE, 0.78);
    return { kind: 'photo', main: full.blob, mainType: 'image/jpeg', thumb: thumb.blob, width: full.w, height: full.h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function prepareVideo(file) {
  if (file.size > MAX_VIDEO_BYTES) {
    return Promise.reject(new Error(`${file.name} is over 50 MB. Trim it to under about 1 minute and try again.`));
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.playsInline = true;
    let finished = false;
    const finish = async (thumb) => {
      if (finished) return;
      finished = true;
      URL.revokeObjectURL(url);
      resolve({
        kind: 'video',
        main: file,
        mainType: file.type || 'video/mp4',
        thumb,
        width: v.videoWidth || null,
        height: v.videoHeight || null,
        duration: Number.isFinite(v.duration) ? Math.round(v.duration) : null
      });
    };
    v.onloadeddata = () => {
      v.currentTime = Math.min(1, (v.duration || 2) / 2);
    };
    v.onseeked = async () => {
      try {
        const t = await toBlob(v, v.videoWidth, v.videoHeight, THUMB_EDGE, 0.78);
        finish(t.blob);
      } catch {
        finish(null);
      }
    };
    v.onerror = () => finish(null);
    setTimeout(() => finish(null), 8000);
    v.src = url;
  });
}

// Adds picked files to the queue, then starts sending.
export async function addFiles(files) {
  if (!state.trip) throw new Error('No trip selected.');
  const stop = currentStop();
  const errors = [];
  let added = 0;
  for (const file of files) {
    try {
      const isVideo = file.type.startsWith('video/');
      const prep = isVideo ? await prepareVideo(file) : await preparePhoto(file);
      const jitter = () => (Math.random() - 0.5) * 0.01;
      await putItem({
        id: crypto.randomUUID(),
        trip_id: state.trip.id,
        stop_id: stop?.id || null,
        lat: stop ? stop.lat + jitter() : null,
        lon: stop ? stop.lon + jitter() : null,
        uploader_name: myName(),
        taken_at: file.lastModified ? new Date(file.lastModified).toISOString() : null,
        size: prep.main.size,
        ...prep,
        added_at: Date.now()
      });
      added++;
    } catch (e) {
      errors.push(e.message);
    }
  }
  progress.total += added;
  emit();
  processQueue();
  return { added, errors };
}

let running = false;
export async function processQueue() {
  if (running) return;
  running = true;
  try {
    let items = await allItems();
    progress.waiting = items.length;
    emit();
    if (!navigator.onLine) return;
    const { data: sess } = await sb.auth.getSession();
    if (!sess.session) return;
    for (const item of items) {
      if (!navigator.onLine) break;
      progress.active = true;
      emit();
      try {
        const ext = item.kind === 'video' ? (item.mainType.split('/')[1] || 'mp4').replace('quicktime', 'mov') : 'jpg';
        const base = `${item.trip_id}/${item.id}`;
        const mainPath = `${base}.${ext}`;
        const thumbPath = item.thumb ? `${base}_t.jpg` : null;
        // A retry after a dropped connection may find the file already there: that counts as sent.
        const isDup = (err) => err && /exists|duplicate/i.test(err.message || '');
        const up1 = await sb.storage.from('media').upload(mainPath, item.main, { contentType: item.mainType });
        if (up1.error && !isDup(up1.error)) throw up1.error;
        if (thumbPath) {
          const up2 = await sb.storage.from('media').upload(thumbPath, item.thumb, { contentType: 'image/jpeg' });
          if (up2.error && !isDup(up2.error)) throw up2.error;
        }
        const ins = await sb.from('media').insert({
          id: item.id,
          trip_id: item.trip_id,
          stop_id: item.stop_id,
          uploader_name: item.uploader_name,
          kind: item.kind,
          path: mainPath,
          thumb_path: thumbPath,
          width: item.width,
          height: item.height,
          duration_s: item.duration ?? null,
          size_bytes: item.size,
          lat: item.lat,
          lon: item.lon,
          taken_at: item.taken_at
        });
        if (ins.error && ins.error.code !== '23505') throw ins.error;
        await delItem(item.id);
        progress.done++;
      } catch (e) {
        console.warn('upload failed', e?.message || e);
        progress.failed++;
        // A file the server refuses (wrong trip, too large) would block the queue forever.
        if (e?.statusCode === '413' || e?.statusCode === '403' || /row-level security|exceeded/i.test(e?.message || '')) {
          await delItem(item.id);
        } else {
          break;
        }
      }
      items = await allItems();
      progress.waiting = items.length;
      emit();
    }
  } finally {
    running = false;
    progress.active = false;
    const left = await allItems().catch(() => []);
    progress.waiting = left.length;
    if (!left.length) {
      progress.total = 0;
      progress.done = 0;
      progress.failed = 0;
    }
    emit();
    load('media', 'favs');
  }
}

export async function queuedItems() {
  return allItems().catch(() => []);
}

window.addEventListener('online', () => processQueue());
setInterval(() => {
  if (navigator.onLine && progress.waiting) processQueue();
}, 60000);

// ---------------------------------------------------------------- signed URLs (private bucket)

const urlCache = new Map();
export async function signedUrls(paths, expires = 3600) {
  const need = [...new Set(paths.filter((p) => p && !(urlCache.get(p)?.exp > Date.now() + 60000)))];
  for (let i = 0; i < need.length; i += 100) {
    const chunk = need.slice(i, i + 100);
    const { data } = await sb.storage.from('media').createSignedUrls(chunk, expires);
    for (const row of data || []) {
      if (row.signedUrl) urlCache.set(row.path, { url: row.signedUrl, exp: Date.now() + expires * 1000 });
    }
  }
  const out = {};
  for (const p of paths) if (urlCache.get(p)) out[p] = urlCache.get(p).url;
  return out;
}

export async function deleteMedia(m) {
  await sb.storage.from('media').remove([m.path, m.thumb_path].filter(Boolean));
  const { error } = await sb.from('media').delete().eq('id', m.id);
  if (error) throw error;
  await load('media', 'favs');
}

export async function toggleFav(mediaId) {
  const mine = state.favs.some((f) => f.media_id === mediaId && f.user_id === state.user.id);
  if (mine) {
    state.favs = state.favs.filter((f) => !(f.media_id === mediaId && f.user_id === state.user.id));
    await sb.from('media_favs').delete().eq('media_id', mediaId).eq('user_id', state.user.id);
  } else {
    state.favs.push({ media_id: mediaId, user_id: state.user.id });
    await sb.from('media_favs').insert({ media_id: mediaId });
  }
  return !mine;
}
