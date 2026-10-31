import { state, isHost, isStaff, signOut } from '../store.js';
import { esc, icon, initials, toast } from '../util.js';
import { pushSupport, isSubscribed, enablePush, disablePush } from '../push.js';
import { qrSvg, openSheet, confirmSheet } from './ui.js';

const COLORS = ['#0C5A6E', '#8C6420', '#3F6F7C', '#1F7A4D', '#6B4E7A', '#B4531A'];

function wifiPayload(ssid, pw) {
  const e = (s) => String(s).replace(/([\\;,:"])/g, '\\$1');
  return `WIFI:T:WPA;S:${e(ssid)};P:${e(pw)};;`;
}

export default {
  title: 'Aboard',
  tab: 'aboard',
  deps: ['settings', 'acks', 'safety', 'prefs'],
  async render(el) {
    const s = state.settings || {};
    const info = self.DELUSHA_DATA?.YACHT_INFO;
    const safetyLeft = state.guest ? state.safety.length - state.acks.length : 0;
    const push = pushSupport();
    const subscribed = await isSubscribed().catch(() => false);
    const links = [
      ['#/requests', 'Laundry, ironing and cabin help', ''],
      ['#/safety', 'Safety briefing', safetyLeft > 0 ? `<span class="badge warn">${state.acks.length} / ${state.safety.length}</span>` : ''],
      state.guest ? ['#/prefs/food', 'My preferences', state.prefs?.food_done && state.prefs?.cabin_done ? '' : '<span class="badge warn">To do</span>'] : null,
      ['#/alerts', 'Alerts', ''],
      ['life', 'Life aboard', ''],
      ['yacht', 'About Delusha', ''],
      isHost() ? ['#/host', 'Host console', ''] : null,
      isStaff() ? ['#/crew', 'Crew view', ''] : null
    ].filter(Boolean);

    el.innerHTML = `
      <div class="page">
        <div class="page-head">
          <h1 class="h1">Aboard</h1>
          <div class="sub">SY Delusha · 43 m sailing yacht</div>
        </div>

        ${
          s.wifi_ssid
            ? `<div class="card dark row" style="margin:18px 16px 0;gap:16px">
                <div class="qr">${qrSvg(wifiPayload(s.wifi_ssid, s.wifi_password || ''), 76)}</div>
                <div class="grow">
                  <div class="eyebrow light">Starlink Wi-Fi</div>
                  <div class="h3 mt8" style="word-break:break-all">${esc(s.wifi_ssid)}</div>
                  <div class="tiny muted">Point your camera at the code, or</div>
                  <button class="btn sm light mt8" id="cp">Copy password</button>
                </div>
              </div>`
            : ''
        }

        ${
          (s.crew || []).length
            ? `<div class="section-head"><h2 class="h2">Your crew</h2><div class="small muted">${s.crew.length} aboard</div></div>
               <div class="hscroll">${s.crew
                 .map(
                   (c, i) => `<div class="crew-card"><div class="avatar" style="background:${COLORS[i % COLORS.length]};margin:0 auto">${esc(initials(c.name))}</div>
                     <div class="small" style="font-weight:600;margin-top:8px">${esc(c.name)}</div><div class="tiny muted">${esc(c.role || '')}</div></div>`
                 )
                 .join('')}</div>`
            : ''
        }

        ${
          (s.toys || []).length
            ? `<div class="section-head"><h2 class="h2">Water toys</h2><div class="small muted">Ask the deck crew</div></div>
               <div class="grid2" style="margin:0 16px">${s.toys
                 .map((t) => `<div class="card" style="padding:14px"><div class="h3" style="font-size:15px">${esc(t.name)}</div><div class="tiny muted">${esc(t.meta || '')}</div></div>`)
                 .join('')}</div>`
            : ''
        }

        <div class="card tight" style="margin:22px 16px 0">
          ${links
            .map(([href, label, badge]) =>
              href.startsWith('#')
                ? `<a class="list-row" href="${href}"><div class="grow" style="font-size:15px;font-weight:500">${label}</div>${badge}${icon('chev', 16, 'style="color:#9AA1A8"')}</a>`
                : `<button class="list-row" data-sheet="${href}"><div class="grow" style="font-size:15px;font-weight:500">${label}</div>${icon('chev', 16, 'style="color:#9AA1A8"')}</button>`
            )
            .join('')}
        </div>

        <div class="card" style="margin:12px 16px 0">
          <div class="row">
            <div class="grow"><div class="h3">Notifications</div><div class="tiny muted">${
              push.needsInstall
                ? 'On iPhone: tap Share, then "Add to Home Screen", and open Delusha from there.'
                : !push.supported
                ? 'Not available in this browser.'
                : 'Tender times, meals and updates from the crew'
            }</div></div>
            <button class="switch" role="switch" aria-checked="${subscribed}" aria-label="Notifications" id="push" ${!push.supported || push.needsInstall ? 'disabled' : ''}></button>
          </div>
        </div>

        <div style="margin:12px 16px 0;text-align:center">
          ${state.staff ? `<p class="tiny muted">Signed in as ${esc(state.staff.name)} · ${esc(state.staff.role === 'host' ? 'Host' : state.staff.title || 'Crew')}</p>` : state.guest ? `<p class="tiny muted">Signed in as ${esc(state.guest.name)}${state.guest.cabin ? ` · ${esc(state.guest.cabin)}` : ''}</p>` : ''}
          <button class="btn light sm mt8" id="out">${icon('logout', 16)}Sign out</button>
        </div>
      </div>`;

    el.querySelector('#cp')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(s.wifi_password || '');
        toast('Password copied');
      } catch {
        toast(`Password: ${s.wifi_password}`);
      }
    });
    el.querySelector('#push')?.addEventListener('click', async (e) => {
      const b = e.currentTarget;
      try {
        if (b.getAttribute('aria-checked') === 'true') {
          await disablePush();
          b.setAttribute('aria-checked', 'false');
          toast('Notifications off');
        } else {
          await enablePush();
          b.setAttribute('aria-checked', 'true');
          toast('Notifications on');
        }
      } catch (x) {
        toast(x.message, 'error');
      }
    });
    el.querySelector('#out').addEventListener('click', async () => {
      const msg = state.staff ? 'You will need your email and password to sign back in.' : 'You will need your invite link to get back in.';
      if (await confirmSheet('Sign out?', msg, 'Sign out', true)) {
        await signOut();
        location.hash = '#/welcome';
      }
    });
    el.querySelectorAll('[data-sheet]').forEach((b) =>
      b.addEventListener('click', () => {
        if (b.dataset.sheet === 'life') {
          openSheet(
            `<h2 class="h2">Life aboard</h2>${(info?.lifeAboard || [])
              .map((x) => `<div class="card mt12"><div class="h3">${esc(x.title)}</div><p class="small muted mt8">${esc(x.text)}</p></div>`)
              .join('')}<button class="btn light block mt16" data-close>Close</button>`,
            { label: 'Life aboard' }
          );
        } else {
          openSheet(
            `<h2 class="h2">${esc(info?.name || 'SY Delusha')}</h2><p class="small muted mt8">${esc(info?.summary || '')}</p>
             <div class="card tight mt12">${(info?.specs || [])
               .map((x) => `<div class="list-row"><div class="grow small muted">${esc(x.label)}</div><div class="small" style="font-weight:600;text-align:right">${esc(x.value)}</div></div>`)
               .join('')}</div>
             <div class="stack mt12">${(info?.gallery || [])
               .map((g) => `<figure style="margin:0"><img src="${g.src}" alt="${esc(g.title)}" loading="lazy" style="border-radius:18px;width:100%"><figcaption class="tiny muted mt8">${esc(g.title)}</figcaption></figure>`)
               .join('')}</div>
             <button class="btn light block mt16" data-close>Close</button>`,
            { label: 'About Delusha' }
          );
        }
      })
    );
  }
};
