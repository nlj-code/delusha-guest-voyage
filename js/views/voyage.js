import { state, currentStopIndex, isHost } from '../store.js';
import { esc, icon, timeAgo, fmtDate, toast } from '../util.js';
import { VoyageChart } from '../map.js';
import { openSheet } from './ui.js';
import { tenderUrl } from './today.js';

const ports = () => self.DELUSHA_DATA?.PRESET_PORTS || [];

function portInfo(stop) {
  return ports().find((p) => p.id === stop.port_id) || ports().find((p) => p.name === stop.name) || null;
}

export function openPortSheet(stop) {
  const p = portInfo(stop);
  const url = tenderUrl(stop);
  openSheet(
    `<div class="eyebrow brass">${esc(p?.country || 'Stop')}</div>
     <h2 class="h1" style="font-size:32px;margin-top:4px">${esc(stop.name)}</h2>
     ${stop.arrive_on ? `<p class="muted small mt8">${esc(fmtDate(stop.arrive_on, { weekday: 'long', day: 'numeric', month: 'long' }))}</p>` : ''}
     ${p?.atmosphere ? `<p class="mt12">${esc(p.atmosphere)}</p>` : ''}
     ${p?.history ? `<p class="muted small mt12">${esc(p.history)}</p>` : ''}
     ${
       p?.highlights?.length
         ? `<div class="card mt16"><div class="h3">Ashore</div><ul style="margin:8px 0 0;padding-left:18px">${p.highlights.map((h) => `<li class="small" style="margin:4px 0">${esc(h)}</li>`).join('')}</ul></div>`
         : ''
     }
     <div class="card mt12">
       <div class="h3">Tender pick-up</div>
       <p class="small mt8">${esc(stop.tender_name || p?.tenderName || 'The crew will confirm the landing spot.')}</p>
       ${p?.tenderNote && !stop.tender_name ? `<p class="small muted mt8">${esc(p.tenderNote)}</p>` : ''}
       ${url ? `<a class="btn accent block mt12" href="${url}" target="_blank" rel="noopener">${icon('pin', 16)}Walking directions</a>` : ''}
     </div>
     <button class="btn light block mt12" data-close>Close</button>`,
    { label: stop.name }
  );
}

export default {
  title: 'Voyage',
  tab: 'voyage',
  deps: ['stops', 'trip', 'position', 'media', 'logbook'],
  async render(el) {
    if (!state.trip) {
      el.innerHTML = `<div class="page page-head"><h1 class="h1">Voyage</h1><p class="muted mt8">No trip yet.</p></div>`;
      return;
    }
    const stops = state.stops;
    const activeIdx = currentStopIndex();
    const pos = state.position;
    const fresh = pos && Date.now() - new Date(pos.recorded_at).getTime() < 30 * 60 * 1000;
    const moving = pos && pos.speed_kn > 1.5;

    el.innerHTML = `
      <div class="chart-wrap" id="chart">
        <div class="chart-top">
          <div class="chart-pill"><span class="dot" style="background:${fresh ? 'var(--live)' : 'var(--faint)'}"></span>${fresh ? 'Live position' : 'Route'}</div>
          <div class="row" style="gap:8px">
            <button class="icon-btn" id="me" aria-label="Show my location">${icon('locate', 20)}</button>
            <button class="icon-btn" id="fit" aria-label="Show the whole route">${icon('fit', 20)}</button>
          </div>
        </div>
        <div class="chart-zoom">
          <button class="icon-btn" id="zin" aria-label="Zoom in">${icon('plus', 20)}</button>
          <button class="icon-btn" id="zout" aria-label="Zoom out"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg></button>
        </div>
      </div>
      <div class="sheet-body page">
        <div class="grabber"></div>
        <div class="card">
          <div class="between" style="align-items:flex-start">
            <div>
              <div class="eyebrow ${moving ? 'brass' : 'live'}">${pos ? (moving ? 'Under way' : 'At anchor') : 'Itinerary'}</div>
              <div class="h2 mt8" style="font-size:26px">${esc(pos ? nearestName(pos, stops) : stops[activeIdx]?.name || state.trip.title)}</div>
            </div>
            ${pos ? `<div class="tiny muted" style="text-align:right">Updated<br>${esc(timeAgo(pos.recorded_at))}</div>` : ''}
          </div>
          ${
            pos
              ? `<div class="grid3 mt12">
                  <div class="stat"><div class="k">Speed</div><div class="v">${pos.speed_kn ?? 0} kn</div></div>
                  <div class="stat"><div class="k">Heading</div><div class="v">${Number.isFinite(+pos.heading) && pos.heading !== null ? `${pos.heading}°` : '–'}</div></div>
                  <div class="stat"><div class="k">Stops</div><div class="v">${stops.length}</div></div>
                </div>`
              : `<p class="small muted mt8">The live position appears when a host or crew phone is sharing it.</p>`
          }
        </div>

        <div class="between" style="margin:24px 4px 10px">
          <h2 class="h2">Itinerary</h2>
          <div class="small muted" id="tot"></div>
        </div>
        <div class="card tight" id="stops">
          ${
            stops.length
              ? stops
                  .map((s, i) => {
                    const st = i < activeIdx ? 'done' : i === activeIdx ? 'cur' : '';
                    return `<button class="list-row" data-stop="${i}">
                      <div class="num ${st}">${i + 1}</div>
                      <div class="grow"><div class="t">${esc(s.name)}</div><div class="s" data-meta="${i}">${esc(s.arrive_on ? fmtDate(s.arrive_on) : '')}</div></div>
                      <span class="badge ${st === 'cur' ? 'live' : ''}">${st === 'done' ? 'Sailed' : st === 'cur' ? 'Today' : 'Planned'}</span>
                    </button>`;
                  })
                  .join('')
              : `<div class="empty">${isHost() ? 'Add stops in the Host console.' : 'The route will appear here.'}</div>`
          }
        </div>

        ${
          state.logbook.length
            ? `<div class="between" style="margin:24px 4px 10px"><h2 class="h2">Logbook</h2></div>
               <div class="stack">${state.logbook
                 .map(
                   (l) => `<div class="card">
                     <div class="between"><div class="eyebrow brass">${esc(fmtDate(l.entry_date))}</div>${l.distance_nm ? `<div class="small muted">${esc(l.distance_nm)} nm${l.peak_kn ? ` · peak ${esc(l.peak_kn)} kn` : ''}</div>` : ''}</div>
                     <div class="h3 mt8">${esc(l.route || '')}</div>
                     ${l.wind ? `<div class="small muted">${esc(l.wind)}</div>` : ''}
                     ${l.note ? `<p class="quote" style="font-size:16px;margin-top:8px">“${esc(l.note)}”</p>` : ''}
                   </div>`
                 )
                 .join('')}</div>`
            : ''
        }
      </div>`;

    const chart = new VoyageChart(el.querySelector('#chart'), { onStopTap: (i) => openPortSheet(stops[i]) });
    let me = null;
    const setData = () =>
      chart.setData({
        stops,
        activeIdx,
        corinth: state.trip.allow_corinth,
        pins: state.media.filter((m) => m.lat !== null).map((m) => ({ lat: m.lat, lon: m.lon })),
        boat: pos ? { lat: pos.lat, lon: pos.lon, heading: pos.heading === null ? NaN : Number(pos.heading) } : null,
        me
      });
    setData();

    const showTotals = () => {
      const t = chart.totals();
      const tot = el.querySelector('#tot');
      if (tot && stops.length > 1) tot.textContent = `${Math.round(t.total)} nm · ${Math.round(t.sailed)} sailed`;
      t.legs.forEach((leg, i) => {
        const meta = el.querySelector(`[data-meta="${i + 1}"]`);
        if (meta) {
          const s = stops[i + 1];
          const hrs = leg.nm / 8;
          meta.textContent = [s.arrive_on ? fmtDate(s.arrive_on) : '', `${Math.round(leg.nm)} nm${leg.ready ? '' : ' (est.)'}`, `~${Math.max(1, Math.round(hrs))} h`].filter(Boolean).join(' · ');
        }
      });
    };
    showTotals();
    const totTimer = setInterval(showTotals, 1500);

    el.querySelector('#fit').onclick = () => chart.fit();
    el.querySelector('#zin').onclick = () => chart.zoom(1 / 1.6);
    el.querySelector('#zout').onclick = () => chart.zoom(1.6);
    el.querySelector('#me').onclick = () => {
      if (!navigator.geolocation) return toast('Location is not available on this device.');
      navigator.geolocation.getCurrentPosition(
        (p) => {
          me = { lat: p.coords.latitude, lon: p.coords.longitude };
          setData();
          chart.centerOn(me.lat, me.lon, 0.3);
        },
        () => toast('Allow location access to see where you are.'),
        { enableHighAccuracy: true, timeout: 15000 }
      );
    };
    el.querySelector('#stops').addEventListener('click', (e) => {
      const b = e.target.closest('[data-stop]');
      if (!b) return;
      const s = stops[Number(b.dataset.stop)];
      chart.centerOn(s.lat, s.lon, 0.5);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      openPortSheet(s);
    });

    return () => {
      clearInterval(totTimer);
      chart.destroy();
    };
  }
};

function nearestName(pos, stops) {
  let best = null;
  let bestD = Infinity;
  for (const s of stops) {
    const d = (s.lat - pos.lat) ** 2 + ((s.lon - pos.lon) * Math.cos((pos.lat * Math.PI) / 180)) ** 2;
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  if (!best) return 'At sea';
  const nm = Math.sqrt(bestD) * 60;
  return nm < 3 ? `Off ${best.name}` : nm < 25 ? `Near ${best.name}` : 'At sea';
}
