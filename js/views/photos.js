import { state, isHost, currentStopIndex } from '../store.js';
import { esc, icon, toast, dayLabel, isoDate, fmtDate } from '../util.js';
import { addFiles, onQueue, progress, signedUrls, deleteMedia, toggleFav, queuedItems } from '../uploads.js';
import { confirmSheet } from './ui.js';
import { computeLegs, drawChart, fitView } from '../map.js';

let filter = 'All';

function favCount(id) {
  return state.favs.filter((f) => f.media_id === id).length;
}
function isMyFav(id) {
  return state.favs.some((f) => f.media_id === id && f.user_id === state.user?.id);
}

function filtered() {
  const stops = Object.fromEntries(state.stops.map((s) => [s.id, s.name]));
  return state.media.filter((m) => {
    if (filter === 'All') return true;
    if (filter === 'Favourites') return favCount(m.id) > 0;
    if (filter === 'Videos') return m.kind === 'video';
    if (filter === 'Mine') return m.uploaded_by === state.user?.id;
    return stops[m.stop_id] === filter;
  });
}

function groups(list) {
  const stops = Object.fromEntries(state.stops.map((s) => [s.id, s.name]));
  const out = [];
  for (const m of list) {
    const key = `${isoDate(new Date(m.created_at))}|${m.stop_id || ''}`;
    let g = out.find((x) => x.key === key);
    if (!g) {
      g = { key, title: `${dayLabel(m.created_at)}${stops[m.stop_id] ? ` · ${stops[m.stop_id]}` : ''}`, items: [] };
      out.push(g);
    }
    g.items.push(m);
  }
  return out;
}

export default {
  title: 'Photos',
  tab: 'photos',
  deps: ['media', 'favs'],
  async render(el) {
    if (!state.trip) {
      el.innerHTML = `<div class="page page-head"><h1 class="h1">Photos</h1><p class="muted mt8">No trip yet.</p></div>`;
      return;
    }
    const uploaders = new Set(state.media.map((m) => m.uploaded_by)).size;
    const stopNames = [...new Set(state.media.map((m) => state.stops.find((s) => s.id === m.stop_id)?.name).filter(Boolean))];
    const filters = ['All', 'Favourites', 'Videos', 'Mine', ...stopNames];
    if (!filters.includes(filter)) filter = 'All';
    const list = filtered();
    const queued = await queuedItems();

    el.innerHTML = `
      <div class="page">
        <div class="page-head between" style="align-items:flex-end">
          <div>
            <h1 class="h1">Photos</h1>
            <div class="sub">${state.media.length} shared${uploaders ? ` by ${uploaders} ${uploaders === 1 ? 'person' : 'people'}` : ''}</div>
          </div>
          <label class="btn" style="min-height:44px">
            ${icon('plus', 18)}Add
            <input type="file" id="pick" accept="image/*,video/*" multiple hidden>
          </label>
        </div>
        <div class="chips scroll mt16" role="group" aria-label="Filter photos">
          ${filters.map((f) => `<button class="chip" data-f="${esc(f)}" aria-pressed="${f === filter}">${esc(f)}</button>`).join('')}
        </div>
        <div id="prog"></div>
        ${
          queued.length
            ? `<div class="section-head"><h2 class="h3">Waiting to send</h2><div class="small muted">${queued.length}</div></div>
               <div class="photo-grid">${queued
                 .map((q) => `<div class="ph"><img data-blob="${q.id}" alt="Waiting to upload"><div class="queued">${navigator.onLine ? 'Sending…' : 'Waiting for signal'}</div></div>`)
                 .join('')}</div>`
            : ''
        }
        <div id="groups">
          ${
            list.length
              ? groups(list)
                  .map(
                    (g) => `
            <div class="section-head"><h2 class="h3">${esc(g.title)}</h2><div class="small muted">${g.items.length}</div></div>
            <div class="photo-grid">
              ${g.items
                .map((m, i) => {
                  const fc = favCount(m.id);
                  return `<button class="ph${i === 0 && g.items.length >= 3 ? ' big' : ''}" data-id="${m.id}" aria-label="${m.kind === 'video' ? 'Video' : 'Photo'} by ${esc(m.uploader_name || 'someone')}">
                    <img data-path="${esc(m.thumb_path || m.path)}" alt="" loading="lazy">
                    ${m.kind === 'video' ? `<span class="dur">${m.duration_s ? `${Math.floor(m.duration_s / 60)}:${String(Math.round(m.duration_s % 60)).padStart(2, '0')}` : 'Video'}</span>` : ''}
                    ${fc ? `<span class="fav">${icon('star', 11, 'fill="#fff"')}${fc}</span>` : ''}
                  </button>`;
                })
                .join('')}
            </div>`
                  )
                  .join('')
              : `<div class="card mt16" style="margin:16px"><div class="empty">${filter === 'All' ? 'No photos yet. Tap Add to share yours in full quality.' : 'Nothing here yet.'}</div></div>`
          }
        </div>
        <div style="height:80px"></div>
      </div>
      <div class="float-row">
        <a class="btn" href="#/tv">${icon('tv', 18)}Saloon TV</a>
        <button class="btn" id="save">${icon('down', 18)}Favourites</button>
        <button class="btn" id="poster" aria-label="Make a keepsake poster">${icon('poster', 18)}Poster</button>
      </div>`;

    // thumbnails
    const imgs = [...el.querySelectorAll('img[data-path]')];
    signedUrls(imgs.map((i) => i.dataset.path)).then((urls) => {
      for (const i of imgs) if (urls[i.dataset.path]) i.src = urls[i.dataset.path];
    });
    for (const q of queued) {
      const img = el.querySelector(`img[data-blob="${q.id}"]`);
      if (img && (q.thumb || q.main)) img.src = URL.createObjectURL(q.thumb || q.main);
    }

    const prog = el.querySelector('#prog');
    const showProg = (p) => {
      if (!prog) return;
      if (!p.active && !p.waiting) return (prog.innerHTML = '');
      const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
      prog.innerHTML = `<div class="card row" style="margin:16px 16px 0;padding:12px 14px">
        <div class="avatar" style="width:36px;height:36px">${icon('up', 18)}</div>
        <div class="grow">
          <div class="h3" style="font-size:14px">${navigator.onLine ? `Uploading ${Math.min(p.done + 1, p.total || p.waiting)} of ${p.total || p.waiting} in full quality` : `${p.waiting} waiting for signal`}</div>
          <div class="progress mt8"><div style="width:${pct}%"></div></div>
          ${!navigator.onLine ? '<div class="tiny muted mt8">They will send by themselves when Starlink or 4G is back.</div>' : ''}
        </div></div>`;
    };
    showProg(progress);
    const off = onQueue(showProg);

    el.querySelector('#pick').onchange = async (e) => {
      const files = [...e.target.files];
      e.target.value = '';
      if (!files.length) return;
      toast(`Preparing ${files.length} file${files.length === 1 ? '' : 's'}…`);
      const { added, errors } = await addFiles(files);
      if (errors.length) toast(errors[0], 'error');
      else toast(navigator.onLine ? `Uploading ${added}` : `${added} saved · will send when online`);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    };
    el.querySelectorAll('[data-f]').forEach((b) =>
      b.addEventListener('click', () => {
        filter = b.dataset.f;
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      })
    );
    el.querySelector('#groups').addEventListener('click', (e) => {
      const b = e.target.closest('[data-id]');
      if (b) openViewer(list, list.findIndex((m) => m.id === b.dataset.id));
    });
    el.querySelector('#save').onclick = () => saveFavourites();
    el.querySelector('#poster').onclick = () => makePoster();
    return () => off();
  }
};

// ---------------------------------------------------------------- full-screen viewer

function openViewer(list, index) {
  let i = index;
  const v = document.createElement('div');
  v.className = 'viewer';
  v.setAttribute('role', 'dialog');
  v.setAttribute('aria-modal', 'true');
  v.setAttribute('aria-label', 'Photo viewer');
  document.body.appendChild(v);
  let startX = null;

  const close = () => {
    v.remove();
    document.removeEventListener('keydown', onKey);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
  };
  document.addEventListener('keydown', onKey);
  const step = (d) => {
    i = (i + d + list.length) % list.length;
    draw();
  };

  async function draw() {
    const m = list[i];
    const canDelete = m.uploaded_by === state.user?.id || isHost();
    const mine = isMyFav(m.id);
    v.innerHTML = `
      <div class="vtop">
        <button class="icon-btn glass" data-a="close" aria-label="Close">${icon('close', 20)}</button>
        <div class="small" style="opacity:.8;text-align:center">${esc(m.uploader_name || '')}<br>${esc(dayLabel(m.created_at))}</div>
        ${canDelete ? `<button class="icon-btn glass" data-a="del" aria-label="Delete">${icon('trash', 20)}</button>` : '<span style="width:44px"></span>'}
      </div>
      <div class="vmedia"><div class="spinner"></div></div>
      <div class="vbar">
        <button class="icon-btn glass" data-a="prev" aria-label="Previous">${icon('back', 20)}</button>
        <button class="btn ghost" data-a="fav" aria-pressed="${mine}">${icon('star', 18, mine ? 'fill="currentColor"' : '')}${mine ? 'Favourite' : 'Add to favourites'}</button>
        <button class="icon-btn glass" data-a="share" aria-label="Save or share">${icon('share', 20)}</button>
        <button class="icon-btn glass" data-a="next" aria-label="Next">${icon('chev', 20)}</button>
      </div>`;
    const urls = await signedUrls([m.path]);
    const box = v.querySelector('.vmedia');
    if (!box) return;
    box.innerHTML =
      m.kind === 'video'
        ? `<video src="${urls[m.path] || ''}" controls playsinline autoplay></video>`
        : `<img src="${urls[m.path] || ''}" alt="Photo by ${esc(m.uploader_name || 'a guest')}">`;
  }

  v.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (!a) return;
    const m = list[i];
    if (a === 'close') close();
    if (a === 'prev') step(-1);
    if (a === 'next') step(1);
    if (a === 'fav') {
      try {
        await toggleFav(m.id);
      } catch {
        toast('Could not save. Try again when online.', 'error');
      }
      draw();
    }
    if (a === 'share') shareFiles([m]);
    if (a === 'del') {
      if (await confirmSheet('Delete this?', 'It will be removed for everyone on the trip.', 'Delete', true)) {
        try {
          await deleteMedia(m);
          list.splice(i, 1);
          if (!list.length) return close();
          i = Math.min(i, list.length - 1);
          draw();
          toast('Deleted');
        } catch {
          toast('Could not delete.', 'error');
        }
      }
    }
  });
  v.addEventListener('pointerdown', (e) => (startX = e.clientX));
  v.addEventListener('pointerup', (e) => {
    if (startX !== null && Math.abs(e.clientX - startX) > 60 && !e.target.closest('video')) step(e.clientX < startX ? 1 : -1);
    startX = null;
  });
  draw();
}

// ---------------------------------------------------------------- saving

async function shareFiles(items) {
  if (!items.length) return toast('No favourites yet. Tap the star on photos you love.');
  toast(`Getting ${items.length} file${items.length === 1 ? '' : 's'}…`);
  try {
    const urls = await signedUrls(items.map((m) => m.path));
    const files = [];
    for (const m of items) {
      const r = await fetch(urls[m.path]);
      const blob = await r.blob();
      const ext = m.path.split('.').pop();
      files.push(new File([blob], `Delusha-${isoDate(new Date(m.created_at))}-${m.id.slice(0, 6)}.${ext}`, { type: blob.type }));
    }
    if (navigator.canShare?.({ files })) {
      await navigator.share({ files, title: 'Delusha' });
      return;
    }
    for (const f of files) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(f);
      a.download = f.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      await new Promise((r) => setTimeout(r, 400));
    }
  } catch (e) {
    if (e?.name !== 'AbortError') toast('Could not save. Try again with signal.', 'error');
  }
}

function saveFavourites() {
  const mine = state.media.filter((m) => isMyFav(m.id));
  const items = mine.length ? mine : state.media.filter((m) => favCount(m.id) > 0);
  shareFiles(items);
}

// ---------------------------------------------------------------- keepsake poster (1200 × 1600)

async function makePoster() {
  toast('Making your poster…');
  const W = 1200;
  const H = 1600;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#F3F2EE';
  ctx.fillRect(0, 0, W, H);

  // map
  const stops = state.stops;
  const activeIdx = currentStopIndex();
  const legs = computeLegs(stops, stops.length - 1, state.trip.allow_corinth);
  const view = { w: 1080, h: 860, cx: 0, cy: 0, dpp: 1 };
  fitView(view, [...stops.map((s) => [s.lat, s.lon]), ...legs.flatMap((l) => l.track)], 1.35);
  const mapC = document.createElement('canvas');
  mapC.width = view.w;
  mapC.height = view.h;
  drawChart(mapC.getContext('2d'), view, { stops, legs, activeIdx: -1, labels: true, todayLabel: false, scale: 1.4 });
  ctx.save();
  roundRect(ctx, 60, 220, 1080, 860, 36);
  ctx.clip();
  ctx.drawImage(mapC, 60, 220);
  ctx.restore();

  ctx.fillStyle = '#0E1B26';
  ctx.font = '600 22px Inter, sans-serif';
  ctx.letterSpacing = '8px';
  ctx.fillText('DELUSHA', 60, 100);
  ctx.letterSpacing = '0px';
  ctx.font = '400 64px Newsreader, Georgia, serif';
  ctx.fillText(state.trip.title, 60, 175);

  const total = legs.reduce((s, l) => s + l.nm, 0);
  const peak = Math.max(0, ...state.logbook.map((l) => Number(l.peak_kn) || 0));
  const cards = [
    ['Nautical miles', `${Math.round(total)}`],
    ['Stops', `${stops.length}`],
    ['Photos shared', `${state.media.length}`],
    ['Peak speed', peak ? `${peak} kn` : '–']
  ];
  cards.forEach(([k, v], i) => {
    const x = 60 + i * 276;
    ctx.fillStyle = '#FFFFFF';
    roundRect(ctx, x, 1120, 252, 150, 28);
    ctx.fill();
    ctx.fillStyle = '#5E6873';
    ctx.font = '500 22px Inter, sans-serif';
    ctx.fillText(k, x + 26, 1170);
    ctx.fillStyle = '#0E1B26';
    ctx.font = '600 52px Inter, sans-serif';
    ctx.fillText(v, x + 26, 1238);
  });

  ctx.fillStyle = '#0C5A6E';
  ctx.font = '600 26px Inter, sans-serif';
  wrap(ctx, stops.map((s) => s.name).join('  ·  '), 60, 1330, 1080, 36, 2);
  ctx.fillStyle = '#5E6873';
  ctx.font = '400 24px Inter, sans-serif';
  ctx.fillText(`${fmtDate(state.trip.start_date, { day: 'numeric', month: 'long' })} – ${fmtDate(state.trip.end_date, { day: 'numeric', month: 'long', year: 'numeric' })}`, 60, 1420);
  const note = state.logbook.filter((l) => l.note).slice(-1)[0];
  if (note) {
    ctx.fillStyle = '#2A3843';
    ctx.font = 'italic 400 30px Newsreader, Georgia, serif';
    wrap(ctx, `“${note.note}”`, 60, 1480, 1080, 40, 2);
  }

  c.toBlob(async (blob) => {
    const file = new File([blob], `Delusha-${state.trip.title.replace(/\W+/g, '-')}.png`, { type: 'image/png' });
    try {
      if (navigator.canShare?.({ files: [file] })) return await navigator.share({ files: [file], title: 'Delusha keepsake' });
    } catch (e) {
      if (e?.name === 'AbortError') return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    a.click();
  }, 'image/png');
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrap(ctx, text, x, y, maxW, lh, maxLines) {
  const words = text.split(' ');
  let line = '';
  let n = 0;
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) {
      ctx.fillText(line, x, y + n * lh);
      line = w;
      if (++n >= maxLines) return;
    } else line = t;
  }
  if (line) ctx.fillText(line, x, y + n * lh);
}
