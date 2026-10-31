import { state, currentStop, isHost, isStaff, menusFor } from '../store.js';
import { esc, icon, isoDate, tripDay, fmtDate, timeAgo } from '../util.js';
import { getWeather } from '../weather.js';
import { HERO } from './ui.js';

export function unreadAlerts() {
  let seen = 0;
  try {
    seen = Number(localStorage.getItem(`delusha:seenAlerts:${state.trip?.id}`) || 0);
  } catch {
    /* ignore */
  }
  return state.alerts.filter((a) => new Date(a.created_at).getTime() > seen && a.created_by !== state.user?.id).length;
}

export function tenderUrl(stop) {
  const lat = stop?.tender_lat ?? stop?.lat;
  const lon = stop?.tender_lon ?? stop?.lon;
  if (!Number.isFinite(lat)) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=walking`;
}

function toMinutes(hhmm) {
  const m = /^(\d{1,2})[:.](\d{2})/.exec(hhmm || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function fmtPos(lat, lon) {
  const f = (v, p, n) => `${Math.floor(Math.abs(v))}°${String(Math.round((Math.abs(v) % 1) * 60)).padStart(2, '0')}′${v >= 0 ? p : n}`;
  return `${f(lat, 'N', 'S')} ${f(lon, 'E', 'W')}`;
}

export default {
  title: 'Today',
  tab: 'today',
  deps: ['trip', 'stops', 'plan', 'alerts', 'position', 'acks', 'safety', 'prefs', 'menus', 'guests'],
  async render(el) {
    if (!state.trip) {
      el.innerHTML = `
        <div class="page page-head">
          <div class="wordmark" style="color:var(--muted)">DELUSHA</div>
          <h1 class="h1 mt16">No trip yet</h1>
          <p class="muted mt8">${isHost() ? 'Create the first trip in the Host console.' : 'Your host has not added you to a trip yet.'}</p>
          ${isHost() ? '<a class="btn mt16" href="#/host/trips">Open Host console</a>' : ''}
        </div>`;
      return;
    }

    const stop = currentStop();
    const plan = state.plan && state.plan.plan_date === isoDate() ? state.plan : null;
    const day = tripDay(state.trip);
    const unread = unreadAlerts();
    const pos = state.position;

    const status = day.before
      ? `Starts ${fmtDate(state.trip.start_date)}`
      : day.after
      ? 'Trip ended'
      : `${pos && pos.speed_kn > 1.5 ? 'Under way' : 'Day'} · ${pos && pos.speed_kn > 1.5 ? `${pos.speed_kn} kn` : `${day.n} of ${day.total}`}`;
    const headline = plan?.headline || stop?.name || state.trip.title;
    const subline = plan?.subline || (stop ? fmtPos(stop.lat, stop.lon) : '');

    // schedule
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const sched = (plan?.schedule || []).map((s) => ({ ...s, min: toMinutes(s.time) })).sort((a, b) => (a.min ?? 9999) - (b.min ?? 9999));
    const next = sched.find((s) => s.min !== null && s.min >= nowMin);

    // safety & prefs progress for guests
    const safetyLeft = state.guest ? state.safety.length - state.acks.length : 0;
    const prefsDone = state.prefs?.food_done && state.prefs?.cabin_done;
    const dinner = menusFor(isoDate()).find((m) => m.meal === 'dinner') || menusFor(isoDate())[0];
    const tUrl = tenderUrl(stop);

    el.innerHTML = `
      <div class="hero">
        <img src="${HERO}" alt="SY Delusha under sail at sunset">
        <div class="scrim"></div>
        <div class="top">
          <div class="wordmark">DELUSHA</div>
          <a class="icon-btn glass notif" href="#/alerts" aria-label="Alerts${unread ? `, ${unread} unread` : ''}">
            ${icon('bell', 20)}${unread ? `<span class="count">${unread}</span>` : ''}
          </a>
        </div>
        <div class="bottom">
          <div class="pill-glass"><span class="dot" style="background:#5BD69A"></span>${esc(status)}</div>
          <h1>${esc(headline)}</h1>
          <div style="font-size:14px;opacity:.88">${esc(subline)}</div>
        </div>
      </div>

      <div class="page">
        <div class="wx" id="wx">
          <div class="grid4">
            <div class="cell"><div class="k">Air</div><div class="v">–</div><div class="k">&nbsp;</div></div>
            <div class="cell"><div class="k">Sea</div><div class="v">–</div><div class="k">&nbsp;</div></div>
            <div class="cell"><div class="k">Wind</div><div class="v">–</div><div class="k">&nbsp;</div></div>
            <div class="cell"><div class="k">Sunset</div><div class="v">–</div><div class="k">&nbsp;</div></div>
          </div>
          <div class="foot">Loading the forecast…</div>
        </div>

        ${
          state.guest && !prefsDone
            ? `<a class="card info mt16 row" style="margin:16px 16px 0;text-decoration:none" href="#/prefs/food">
                 ${icon('heart', 22)}<div class="grow"><div class="h3">Tell us your preferences</div><div class="small">Food, drinks and cabin. Takes 2 minutes.</div></div>${icon('chev', 18)}
               </a>`
            : ''
        }

        ${
          next
            ? `<div class="card dark" style="margin:16px 16px 0">
                <div class="between"><div class="eyebrow light">Next up · ${esc(inLabel(next.min - nowMin))}</div><div class="small muted">${esc(next.time)}</div></div>
                <div class="serif" style="font-size:28px;line-height:1.1;margin-top:8px">${esc(next.label)}</div>
                ${next.note ? `<div class="small muted mt8">${esc(next.note)}</div>` : ''}
                ${
                  tUrl && /tender|shore|ashore|pick/i.test(`${next.label} ${next.note || ''}`)
                    ? `<a class="btn light block mt16" href="${tUrl}" target="_blank" rel="noopener">${icon('pin', 16)}Walk to pick-up</a>`
                    : ''
                }
              </div>`
            : ''
        }

        <div class="section-head"><h2 class="h2">Today</h2><div class="small muted">${esc(fmtDate(isoDate(), { weekday: 'short', day: 'numeric', month: 'short' }))}</div></div>
        <div class="card tight" style="margin:0 16px">
          ${
            sched.length
              ? sched
                  .map((s) => {
                    const cls = s === next ? 'next' : s.min !== null && s.min < nowMin ? 'done' : '';
                    return `<div class="tl-row ${cls}"><div class="time">${esc(s.time || '')}</div><div class="bullet"></div><div class="grow">${esc(s.label)}</div>${s === next ? '<span class="badge accent">Next</span>' : ''}</div>`;
                  })
                  .join('')
              : `<div class="empty">${isHost() ? 'No plan for today yet. Add it in the Host console.' : 'The plan for today will appear here.'}</div>`
          }
        </div>

        <div class="grid2" style="margin:16px 16px 0">
          <a class="qt" href="#/dining">${icon('dining')}<div><div class="t">${dinner ? `Tonight's ${esc(dinner.meal)}` : "Today's menu"}</div><div class="s">${dinner ? esc([dinner.served_at, dinner.location].filter(Boolean).join(' · ') || 'See the menu') : 'From the chef'}</div></div></a>
          ${
            state.guest
              ? `<a class="qt" href="#/safety"><div class="between">${icon('shield')}${safetyLeft > 0 ? `<span class="badge warn">${state.acks.length} / ${state.safety.length}</span>` : '<span class="badge live">Done</span>'}</div><div><div class="t">Safety briefing</div><div class="s">${safetyLeft > 0 ? `${safetyLeft} section${safetyLeft === 1 ? '' : 's'} left` : 'All read'}</div></div></a>`
              : `<a class="qt" href="#/safety">${icon('shield')}<div><div class="t">Safety briefing</div><div class="s">What guests read</div></div></a>`
          }
          <a class="qt" href="#/aboard">${icon('wifi')}<div><div class="t">Join Wi-Fi</div><div class="s">Starlink · one tap</div></div></a>
          ${
            isHost()
              ? `<a class="qt" href="#/host">${icon('users')}<div><div class="t">Host console</div><div class="s">Plan, guests, alerts</div></div></a>`
              : isStaff()
              ? `<a class="qt" href="#/crew">${icon('laundry')}<div><div class="t">Crew</div><div class="s">Requests, guests, menu</div></div></a>`
              : `<a class="qt" href="#/requests">${icon('laundry')}<div><div class="t">Laundry & help</div><div class="s">Ironing, cabin issues</div></div></a>`
          }
        </div>
        ${pos ? `<p class="tiny muted" style="text-align:center;margin-top:16px">Position updated ${esc(timeAgo(pos.recorded_at))}</p>` : ''}
      </div>`;

    // forecast for the boat's position, or today's stop
    const lat = pos?.lat ?? stop?.lat;
    const lon = pos?.lon ?? stop?.lon;
    if (Number.isFinite(lat)) {
      getWeather(lat, lon).then((w) => {
        const box = el.querySelector('#wx');
        if (!box) return;
        if (!w) {
          box.querySelector('.foot').textContent = 'Forecast unavailable offline';
          return;
        }
        box.innerHTML = `
          <div class="grid4">
            <div class="cell"><div class="k">Air</div><div class="v">${w.air}°</div><div class="k">${esc(w.sky)}</div></div>
            <div class="cell"><div class="k">Sea</div><div class="v">${w.sea ?? '–'}${w.sea !== null ? '°' : ''}</div><div class="k">${w.waves !== null ? `Waves ${w.waves} m` : '&nbsp;'}</div></div>
            <div class="cell"><div class="k">Wind</div><div class="v">${w.wind}<small> kn</small></div><div class="k">${esc(w.windDir)}</div></div>
            <div class="cell"><div class="k">Sunset</div><div class="v">${esc(w.sunset || '–')}</div><div class="k">&nbsp;</div></div>
          </div>
          <div class="foot">Live forecast for ${pos ? 'the yacht' : esc(stop?.name || 'this anchorage')}</div>`;
      });
    } else {
      el.querySelector('#wx .foot').textContent = 'Forecast appears once the route is set';
    }

    // keep "next up" fresh
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') window.dispatchEvent(new HashChangeEvent('hashchange'));
    }, 60000);
    return () => clearInterval(t);
  }
};

function inLabel(min) {
  if (min <= 0) return 'now';
  if (min < 60) return `in ${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `in ${h} h${m ? ` ${m} min` : ''}`;
}
