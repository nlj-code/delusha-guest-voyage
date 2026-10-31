// Destination guide for a stop: written guide (or automatic one), getting ashore, host picks, photos.
import { sb, state, isHost, myName } from '../store.js';
import { esc, icon, toast, fmtDate } from '../util.js';
import { haversineNm } from '../map.js';
import { getDayForecast } from '../weather.js';
import { signedUrls } from '../uploads.js';
import { GUIDES, COUNTRY_BASICS, findGuide, slugFor } from '../guides-data.js';
import { HERO, busy, confirmSheet } from './ui.js';

const overrides = new Map();

async function loadOverride(key) {
  if (overrides.has(key)) return overrides.get(key);
  const cacheKey = `delusha:guide:${key}`;
  try {
    const { data, error } = await sb.from('guide_overrides').select('content').eq('key', key).maybeSingle();
    if (error) throw error;
    const c = data?.content || null;
    overrides.set(key, c);
    try {
      localStorage.setItem(cacheKey, JSON.stringify(c));
    } catch {
      /* ignore */
    }
    return c;
  } catch {
    try {
      return JSON.parse(localStorage.getItem(cacheKey) || 'null');
    } catch {
      return null;
    }
  }
}

async function wiki(title) {
  if (!title) return null;
  const key = `delusha:wiki:${title}`;
  try {
    const c = JSON.parse(localStorage.getItem(key) || 'null');
    if (c) return c;
  } catch {
    /* ignore */
  }
  try {
    const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`);
    if (!r.ok) return null;
    const j = await r.json();
    if (j.type === 'disambiguation') return null;
    const data = { image: j.originalimage?.source || j.thumbnail?.source || null, extract: j.extract || '' };
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch {
      /* ignore */
    }
    return data;
  } catch {
    return null;
  }
}

function presetPort(stop) {
  const ports = self.DELUSHA_DATA?.PRESET_PORTS || [];
  return ports.find((p) => p.id === stop.port_id) || ports.find((p) => p.name.toLowerCase() === (stop.name || '').toLowerCase()) || null;
}

// Builds the guide content for a stop: written guide, then host edits on top, else an automatic guide.
export async function guideFor(stop) {
  const written = findGuide(stop);
  const key = written?.key || slugFor(stop);
  const over = await loadOverride(key);
  const port = presetPort(stop);
  const base = written
    ? { ...written }
    : {
        key,
        name: stop.name,
        region: port?.country || '',
        wiki: stop.name,
        lede: port?.atmosphere || '',
        picks: (port?.highlights || []).map((h) => ({ tag: 'Ashore', title: h, text: '' })),
        eat: [],
        know: COUNTRY_BASICS[port?.country] || [],
        story: port?.history || '',
        auto: true
      };
  return { ...base, ...(over || {}), key, hasOverride: !!over };
}

function toMin(t) {
  const m = /(\d{1,2})[:.](\d{2})/.exec(t || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

// Tender times from that day's plan: first trip ashore, and the return time if mentioned.
async function ashoreTimes(stop) {
  if (!stop.arrive_on) return null;
  let plan = state.plan?.plan_date === stop.arrive_on ? state.plan : null;
  if (!plan) {
    try {
      const { data } = await sb.from('day_plans').select('schedule').eq('trip_id', state.trip.id).eq('plan_date', stop.arrive_on).maybeSingle();
      plan = data;
    } catch {
      plan = null;
    }
  }
  const items = plan?.schedule || [];
  const out = items.find((s) => /tender|ashore|shore|landing|town/i.test(`${s.label} ${s.note || ''}`));
  if (!out) return null;
  const backMatch = /(return|back|pick-?up)[^0-9]*(\d{1,2}[:.]\d{2})/i.exec(`${out.note || ''}`);
  let back = backMatch ? backMatch[2].replace('.', ':') : null;
  if (!back) {
    const later = items.find((s) => toMin(s.time) > toMin(out.time) && /back|return|dinner|aboard/i.test(s.label));
    back = later?.time || null;
  }
  return { out: out.time, back, label: out.label };
}

const refresh = () => window.dispatchEvent(new HashChangeEvent('hashchange'));

export default {
  title: 'Guide',
  tab: 'voyage',
  deps: ['stops', 'media'],
  async render(el, params) {
    const stop = state.stops.find((s) => s.id === params[0]);
    if (!stop) {
      el.innerHTML = `<div class="page page-head"><h1 class="h1">Guide</h1><p class="muted mt8">This stop is no longer on the itinerary.</p><a class="btn mt16" href="#/voyage">Back to Voyage</a></div>`;
      return;
    }
    if (params[1] === 'edit' && isHost()) return renderEditor(el, stop);

    const g = await guideFor(stop);
    const idx = state.stops.indexOf(stop);
    const prev = idx > 0 ? state.stops[idx - 1] : null;
    const dayNo = stop.arrive_on ? Math.round((new Date(stop.arrive_on) - new Date(state.trip.start_date)) / 86400000) + 1 : null;
    const sailH = prev ? haversineNm(prev.lat, prev.lon, stop.lat, stop.lon) / 8 : null;
    const photos = state.media.filter((m) => m.stop_id === stop.id);
    const favCount = (id) => state.favs.filter((f) => f.media_id === id).length;
    const heroPhoto = [...photos].filter((m) => m.kind === 'photo').sort((a, b) => favCount(b.id) - favCount(a.id))[0];
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${stop.lat},${stop.lon}`;
    const tenderLat = stop.tender_lat ?? null;
    const walkUrl = tenderLat ? `https://www.google.com/maps/dir/?api=1&destination=${stop.tender_lat},${stop.tender_lon}&travelmode=walking` : null;

    el.innerHTML = `
      <div class="hero" style="height:380px">
        <img id="ghero" src="${HERO}" alt="${esc(g.name)}">
        <div class="scrim"></div>
        <div class="top">
          <a class="icon-btn glass" href="#/voyage" aria-label="Back to Voyage">${icon('back', 20)}</a>
          <div class="row" style="gap:8px">
            ${isHost() ? `<a class="icon-btn glass" href="#/guide/${stop.id}/edit" aria-label="Edit guide">${icon('edit', 20)}</a>` : ''}
            <button class="icon-btn glass" id="share" aria-label="Share guide">${icon('share', 20)}</button>
          </div>
        </div>
        <div class="bottom" style="bottom:26px">
          <div class="pill-glass">${esc([dayNo ? `Day ${dayNo}` : '', stop.arrive_on ? fmtDate(stop.arrive_on) : '', stop.kind || ''].filter(Boolean).join(' · '))}</div>
          <h1 style="font-size:42px">${esc(stop.name)}</h1>
          <div style="font-size:14px;opacity:.9">${esc([g.region, prev ? `${Math.round(haversineNm(prev.lat, prev.lon, stop.lat, stop.lon))} nm from ${prev.name}` : ''].filter(Boolean).join(' · '))}</div>
        </div>
      </div>
      <div class="page">
        <div class="card grid4" style="margin:16px 16px 0;padding:14px 4px;text-align:center" id="glance">
          <div><div class="tiny muted">Sail</div><div class="h3" style="font-size:17px;margin-top:2px">${sailH ? (sailH < 1 ? '< 1 h' : `${Math.round(sailH)} h`) : '–'}</div></div>
          <div style="border-left:1px solid var(--line)"><div class="tiny muted">Sea</div><div class="h3" style="font-size:17px;margin-top:2px" id="gsea">–</div></div>
          <div style="border-left:1px solid var(--line)"><div class="tiny muted">Sunset</div><div class="h3" style="font-size:17px;margin-top:2px" id="gsun">–</div></div>
          <div style="border-left:1px solid var(--line)"><div class="tiny muted">Air</div><div class="h3" style="font-size:17px;margin-top:2px" id="gair">–</div></div>
        </div>

        ${g.lede ? `<p class="serif" style="margin:20px 20px 0;font-size:20px;line-height:1.4;color:var(--ink-2)">${esc(g.lede)}</p>` : '<p class="serif" id="glede" style="margin:20px 20px 0;font-size:20px;line-height:1.4;color:var(--ink-2)"></p>'}

        <div id="ashore"></div>

        ${
          g.picks?.length
            ? `<div class="section-head"><h2 class="h2" style="font-size:26px">${g.auto ? 'Worth seeing' : 'Our picks'}</h2></div>
               <div class="stack" style="margin:0 16px">${g.picks
                 .map(
                   (p, i) => `<div class="card" style="padding:16px">
                     <div class="between" style="align-items:center"><span class="badge ${['accent', 'brass', 'live', 'warn'][i % 4]}">${esc((p.tag || '').toUpperCase())}</span>${p.level ? `<span class="tiny muted">${esc(p.level)}</span>` : ''}</div>
                     <div class="h3 mt12" style="font-size:16px">${esc(p.title)}</div>
                     ${p.text ? `<p class="small muted mt8" style="line-height:1.5">${esc(p.text)}</p>` : ''}
                   </div>`
                 )
                 .join('')}</div>`
            : ''
        }

        ${
          g.eat?.length
            ? `<div class="section-head"><h2 class="h2" style="font-size:26px">Eat &amp; drink</h2></div>
               <div class="card tight" style="margin:0 16px">${g.eat
                 .map(
                   (e) => `<div class="list-row" style="align-items:flex-start;padding:12px 0">
                     <div class="grow"><div class="t">${esc(e.name)}</div><div class="s" style="line-height:1.45;margin-top:2px">${esc(e.note || '')}</div></div>
                     ${e.menu ? '<a class="small" href="#/dining" style="font-weight:600;text-decoration:none;flex:none">Menu</a>' : e.badge ? `<span class="badge" style="flex:none">${esc(e.badge)}</span>` : ''}
                   </div>`
                 )
                 .join('')}</div>`
            : ''
        }

        ${
          g.know?.length
            ? `<div class="section-head"><h2 class="h2" style="font-size:26px">Good to know</h2></div>
               <div class="grid2" style="margin:0 16px;gap:10px">${g.know
                 .map((k) => `<div class="card" style="padding:14px"><div class="tiny muted">${esc(k.label)}</div><div class="small" style="font-weight:600;margin-top:4px;line-height:1.4">${esc(k.text)}</div></div>`)
                 .join('')}</div>`
            : ''
        }

        <div class="card" style="margin:28px 16px 0;padding:20px" id="story" ${g.story ? '' : 'hidden'}>
          <div class="eyebrow brass">The story</div>
          <p class="small mt12" style="line-height:1.6;color:var(--ink-2)" id="storytext">${esc(g.story || '')}</p>
        </div>

        ${
          photos.length
            ? `<div class="section-head"><h2 class="h2" style="font-size:26px">Your photos here</h2><a class="small" href="#/photos" style="font-weight:600;text-decoration:none">See all ${photos.length}</a></div>
               <div class="photo-grid">${photos
                 .slice(0, 6)
                 .map((m) => `<a class="ph" href="#/photos" aria-label="Open photos"><img data-path="${esc(m.thumb_path || m.path)}" alt="" loading="lazy"></a>`)
                 .join('')}</div>`
            : ''
        }

        <div class="btn-row" style="margin:24px 16px 0">
          <a class="btn light" href="#/voyage">Show on chart</a>
          <a class="btn" href="${mapsUrl}" target="_blank" rel="noopener">Open in Maps</a>
        </div>
        ${g.auto ? `<p class="tiny muted" style="text-align:center;margin:14px 24px 0">${isHost() ? 'No written guide for this stop yet. Tap the pencil to add your own.' : 'Ask the crew for their favourite spots here.'}</p>` : ''}
        <div style="height:24px"></div>
      </div>`;

    // header photo: best guest photo here, else Wikipedia, else Delusha
    const heroImg = el.querySelector('#ghero');
    if (heroPhoto) {
      signedUrls([heroPhoto.path]).then((u) => u[heroPhoto.path] && (heroImg.src = u[heroPhoto.path]));
    }
    wiki(g.wiki || stop.name).then((w) => {
      if (!w || !el.isConnected) return;
      if (!heroPhoto && w.image) heroImg.src = w.image;
      if (!g.lede && w.extract) el.querySelector('#glede').textContent = w.extract.split(/(?<=\.)\s/).slice(0, 2).join(' ');
      if (!g.story && w.extract) {
        el.querySelector('#storytext').textContent = w.extract;
        el.querySelector('#story').hidden = false;
      }
    });

    const thumbs = [...el.querySelectorAll('img[data-path]')];
    if (thumbs.length) signedUrls(thumbs.map((i) => i.dataset.path)).then((u) => thumbs.forEach((i) => u[i.dataset.path] && (i.src = u[i.dataset.path])));

    if (stop.arrive_on) {
      getDayForecast(stop.lat, stop.lon, stop.arrive_on).then((f) => {
        if (!f || !el.isConnected) return;
        if (f.sea !== null) el.querySelector('#gsea').textContent = `${f.sea}°`;
        if (f.sunset) el.querySelector('#gsun').textContent = f.sunset;
        if (f.high !== null) el.querySelector('#gair').textContent = `${f.high}°`;
      });
    }

    const t = await ashoreTimes(stop).catch(() => null);
    const box = el.querySelector('#ashore');
    if (box && (t || stop.tender_name || walkUrl)) {
      box.innerHTML = `<div class="card dark" style="margin:20px 16px 0;padding:20px">
        <div class="eyebrow light">Getting ashore</div>
        ${
          t
            ? `<div class="btn-row mt12">
                <div class="card" style="background:rgba(255,255,255,0.08);padding:10px 12px;border-radius:14px"><div class="tiny" style="color:#C9D2D9">Tender out</div><div style="font-size:20px;font-weight:600">${esc(t.out)}</div></div>
                <div class="card" style="background:rgba(255,255,255,0.08);padding:10px 12px;border-radius:14px;margin:0"><div class="tiny" style="color:#C9D2D9">${t.back ? 'Back aboard by' : 'Back'}</div><div style="font-size:20px;font-weight:600">${esc(t.back || 'Ask crew')}</div></div>
              </div>`
            : ''
        }
        <p class="small mt12" style="color:#C9D2D9">${esc(stop.tender_name ? `Landing: ${stop.tender_name}.` : 'The crew will confirm the landing spot.')} Meet back at the same place.</p>
        ${walkUrl ? `<a class="btn light block mt12" href="${walkUrl}" target="_blank" rel="noopener">${icon('pin', 16)}Directions to the landing</a>` : ''}
      </div>`;
    }

    el.querySelector('#share').onclick = async () => {
      const text = `${stop.name}: ${g.lede || ''}`;
      try {
        if (navigator.share) await navigator.share({ title: stop.name, text, url: mapsUrl });
        else {
          await navigator.clipboard.writeText(`${text}\n${mapsUrl}`);
          toast('Copied');
        }
      } catch {
        /* closed */
      }
    };
  }
};

// ---------------------------------------------------------------- host editor

function renderEditor(el, stop) {
  let g = null;
  const draw = async () => {
    if (!g) g = JSON.parse(JSON.stringify(await guideFor(stop)));
    const row = (list, i, fields) =>
      `<div class="card" data-list="${list}" data-i="${i}" style="padding:14px">
        ${fields.map(([k, ph, big]) => (big ? `<textarea class="field mt8" data-k="${k}" rows="2" placeholder="${ph}">${esc(g[list][i][k] || '')}</textarea>` : `<input class="field mt8" data-k="${k}" placeholder="${ph}" value="${esc(g[list][i][k] || '')}">`)).join('')}
        <button type="button" class="btn sm light mt8" data-rm="${list}:${i}">${icon('trash', 14)}Remove</button>
      </div>`;
    el.innerHTML = `
      <div class="dark-head">
        <a class="back" style="margin:0;padding:0" href="#/guide/${stop.id}">${icon('back', 20)}Guide</a>
        <h1 class="h1" style="margin-top:8px">Edit guide</h1>
        <div class="small muted mt8">${esc(stop.name)}${g.hasOverride ? ' · edited' : g.auto ? ' · automatic guide' : ' · written guide'}</div>
      </div>
      <form class="page wrap stack" id="f" novalidate style="padding-top:16px">
        <div class="card"><label class="h3" for="lede" style="display:block">Introduction</label>
          <textarea class="field mt8" id="lede" rows="3">${esc(g.lede || '')}</textarea></div>
        <div class="h3" style="margin:8px 4px 0">Our picks</div>
        ${(g.picks || []).map((_, i) => row('picks', i, [['tag', 'e.g. Walk · 40 min'], ['level', 'e.g. Easy'], ['title', 'Title'], ['text', 'What to do and why', true]])).join('')}
        <button type="button" class="btn light" data-add="picks">${icon('plus', 16)}Add a pick</button>
        <div class="h3" style="margin:8px 4px 0">Eat &amp; drink</div>
        ${(g.eat || []).map((_, i) => row('eat', i, [['name', 'Name'], ['badge', 'Label, e.g. Lunch'], ['note', 'Note', true]])).join('')}
        <button type="button" class="btn light" data-add="eat">${icon('plus', 16)}Add a place</button>
        <div class="h3" style="margin:8px 4px 0">Good to know</div>
        ${(g.know || []).map((_, i) => row('know', i, [['label', 'Topic, e.g. Money'], ['text', 'Tip', true]])).join('')}
        <button type="button" class="btn light" data-add="know">${icon('plus', 16)}Add a tip</button>
        <div class="card"><label class="h3" for="story" style="display:block">The story</label>
          <textarea class="field mt8" id="story" rows="5">${esc(g.story || '')}</textarea></div>
        <div class="form-foot" style="margin:0 -16px">
          ${g.hasOverride ? '<button type="button" class="btn danger" id="reset" style="width:120px">Reset</button>' : ''}
          <button class="btn accent lg grow" type="submit" id="save">Save guide</button>
        </div>
      </form>`;
    const f = el.querySelector('#f');
    const collect = () => {
      g.lede = f.querySelector('#lede').value.trim();
      g.story = f.querySelector('#story').value.trim();
      f.querySelectorAll('[data-list]').forEach((c) => {
        const item = g[c.dataset.list][Number(c.dataset.i)];
        c.querySelectorAll('[data-k]').forEach((inp) => (item[inp.dataset.k] = inp.value.trim()));
      });
    };
    f.querySelectorAll('[data-add]').forEach((b) =>
      b.addEventListener('click', () => {
        collect();
        (g[b.dataset.add] ||= []).push({});
        draw();
      })
    );
    f.querySelectorAll('[data-rm]').forEach((b) =>
      b.addEventListener('click', () => {
        collect();
        const [list, i] = b.dataset.rm.split(':');
        g[list].splice(Number(i), 1);
        draw();
      })
    );
    f.querySelector('#reset')?.addEventListener('click', async () => {
      if (!(await confirmSheet('Reset this guide?', 'Your edits are removed and the original guide comes back.', 'Reset', true))) return;
      const { error } = await sb.from('guide_overrides').delete().eq('key', g.key);
      if (error) return toast('Could not reset.', 'error');
      overrides.delete(g.key);
      localStorage.removeItem(`delusha:guide:${g.key}`);
      location.hash = `#/guide/${stop.id}`;
    });
    f.onsubmit = async (e) => {
      e.preventDefault();
      collect();
      const clean = (list) => (g[list] || []).filter((x) => Object.values(x).some((v) => typeof v === 'string' && v));
      const content = { name: g.name, region: g.region, wiki: g.wiki, lede: g.lede, picks: clean('picks'), eat: clean('eat'), know: clean('know'), story: g.story, auto: false };
      const btn = f.querySelector('#save');
      busy(btn, true);
      const { error } = await sb.from('guide_overrides').upsert({ key: g.key, content, updated_by_name: myName() });
      if (error) {
        busy(btn, false);
        return toast('Could not save. Check signal.', 'error');
      }
      overrides.set(g.key, content);
      toast('Guide saved');
      location.hash = `#/guide/${stop.id}`;
    };
  };
  draw();
}

export { GUIDES };
